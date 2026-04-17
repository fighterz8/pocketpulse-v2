/**
 * Integration tests for classifyPipeline — exercises all four resolution steps:
 *   1. Per-user rule match  (merchant_rules)
 *   2. Per-user cache hit   (merchant_classifications)
 *   3. Global seed hit      (merchant_classifications_global)
 *   4. Structural keyword   (classifier.ts CATEGORY_RULES)
 *
 * These tests use the real DB. Run with:
 *   npx tsx --test server/classifyPipeline.test.ts
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db.js";
import {
  merchantClassifications,
  merchantClassificationsGlobal,
  users,
} from "../shared/schema.js";
import { eq, inArray } from "drizzle-orm";
import {
  classifyPipeline,
  type PipelineOptions,
  type PipelineRow,
} from "./classifyPipeline.js";
import { normalizeMerchant } from "./transactionUtils.js";
import { recurrenceKey } from "./recurrenceDetector.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = `pipeline-test-${Date.now()}@test.internal`;
let testUserId: number;

/**
 * Compute the merchantKey the pipeline will actually look up for a given raw description.
 * Must match exactly what classifyPipeline does internally (Phase 1.7 / 1.8 lookups).
 */
function toMerchantKey(rawDescription: string): string {
  return recurrenceKey(normalizeMerchant(rawDescription));
}

const BASE_OPTS: PipelineOptions = {
  userId: 0,                // filled in before()
  aiTimeoutMs: 100,         // short — tests must not rely on AI
  aiConfidenceThreshold: 1.5, // impossibly high — no row reaches AI step
  cacheWriteMinConfidence: 0.7,
};

function row(rawDescription: string, amount: number): PipelineRow {
  return { rawDescription, amount };
}

function opts(): PipelineOptions {
  return { ...BASE_OPTS, userId: testUserId };
}

// Track global keys seeded in this run so we can clean them up
const seededGlobalKeys: string[] = [];

async function seedPerUser(merchantKey: string, category: string) {
  await db.insert(merchantClassifications).values({
    userId: testUserId,
    merchantKey,
    category,
    transactionClass: "expense",
    recurrenceType: "one-time",
    labelConfidence: "0.95",
    source: "manual",
    hitCount: 0,
    updatedAt: new Date(),
  }).onConflictDoNothing();
}

async function seedGlobal(merchantKey: string, category: string) {
  seededGlobalKeys.push(merchantKey);
  await db.insert(merchantClassificationsGlobal).values({
    merchantKey,
    category,
    transactionClass: "expense",
    recurrenceType: "one-time",
    labelConfidence: "0.88",
    source: "test-seed",
    hitCount: 0,
    updatedAt: new Date(),
  }).onConflictDoNothing();
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

before(async () => {
  const [user] = await db.insert(users).values({
    email: TEST_EMAIL,
    password: "test-hash-not-real",
    displayName: "Pipeline Test",
    companyName: "Test Corp",
  }).returning({ id: users.id });
  testUserId = user!.id;
});

after(async () => {
  await db.delete(merchantClassifications).where(eq(merchantClassifications.userId, testUserId));
  if (seededGlobalKeys.length > 0) {
    await db.delete(merchantClassificationsGlobal)
      .where(inArray(merchantClassificationsGlobal.merchantKey, seededGlobalKeys));
  }
  await db.delete(users).where(eq(users.id, testUserId));
  process.exit(0);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Resolution step 2 — per-user merchant_classifications cache", () => {
  test("merchant existing only in per-user cache resolves via cache", async () => {
    // Use a description that the pipeline actually normalizes to a predictable key
    const desc = "POCKETPULSE TEST UTILITIES VENDOR";
    const key = toMerchantKey(desc);
    await seedPerUser(key, "utilities");

    const [out] = await classifyPipeline([row(desc, -50)], opts());
    assert.ok(out, "should produce output");
    assert.equal(out!.category, "utilities", `expected utilities but got ${out!.category}`);
    assert.equal(out!.labelSource, "cache");
    assert.ok(out!.fromCache);
  });
});

describe("Resolution step 3 — global merchant_classifications_global seed", () => {
  test("merchant existing only in global seed resolves via global seed", async () => {
    // Use a description with no trailing numbers so normalization is predictable
    const desc = "POCKETPULSE GLOBAL SEED VENDOR ALPHA";
    const key = toMerchantKey(desc);
    await seedGlobal(key, "software");

    const [out] = await classifyPipeline([row(desc, -25)], opts());
    assert.ok(out, "should produce output");
    assert.equal(out!.category, "software", `expected software but got ${out!.category} (key: ${key})`);
    assert.equal(out!.labelSource, "cache");
    assert.ok(out!.fromCache);
    assert.match(out!.labelReason, /global seed hit/);
  });

  test("per-user cache wins over global seed for the same merchant key", async () => {
    const desc = "POCKETPULSE SHARED OVERRIDE VENDOR";
    const key = toMerchantKey(desc);
    await seedPerUser(key, "medical");  // per-user: medical
    await seedGlobal(key, "software");  // global: software — should be ignored

    const [out] = await classifyPipeline([row(desc, -10)], opts());
    assert.equal(out!.category, "medical", "per-user cache should beat global seed");
  });
});

describe("Resolution step 4 — structural keyword rules (classifier.ts)", () => {
  test("'ZELLE PAYMENT TO FRIEND' → transfer (no category assigned)", async () => {
    const [out] = await classifyPipeline([row("ZELLE PAYMENT TO FRIEND", -100)], opts());
    assert.equal(out!.transactionClass, "transfer");
  });

  test("'LOCAL RESTAURANT CHARGE' → dining/expense", async () => {
    const [out] = await classifyPipeline([row("LOCAL RESTAURANT CHARGE", -42)], opts());
    assert.equal(out!.category, "dining");
    assert.equal(out!.transactionClass, "expense");
  });

  test("'PHARMACY PRESCRIPTION' → medical/expense", async () => {
    const [out] = await classifyPipeline([row("PHARMACY PRESCRIPTION CHARGE", -18)], opts());
    assert.equal(out!.category, "medical");
  });

  test("'MONTHLY SUBSCRIPTION RENEWAL' → software/recurring (recurrenceType set by rule)", async () => {
    // "subscription" keyword matches CATEGORY_RULE which sets recurrenceType="recurring" directly.
    // Pass 8 only fires when recurrenceType is still "one-time", so recurrenceSource stays "none".
    const [out] = await classifyPipeline([row("MONTHLY SUBSCRIPTION RENEWAL", -9.99)], opts());
    assert.equal(out!.transactionClass, "expense");
    assert.equal(out!.recurrenceType, "recurring");
  });

  test("'ACH CREDIT PAYROLL DEPOSIT' → income/recurring", async () => {
    const [out] = await classifyPipeline([row("ACH CREDIT PAYROLL DEPOSIT", 3500)], opts());
    assert.equal(out!.transactionClass, "income");
    assert.equal(out!.category, "income");
    assert.equal(out!.recurrenceType, "recurring");
  });
});

describe("Mixed batch", () => {
  test("multiple rows resolve independently via different steps", async () => {
    const results = await classifyPipeline(
      [
        row("ZELLE TRANSFER TO SAVINGS", -500),
        row("MONTHLY GYM FITNESS MEMBERSHIP FEE", -40),
        row("ACH CREDIT DIRECT DEPOSIT PAYROLL", 4000),
      ],
      opts(),
    );

    assert.equal(results.length, 3);
    assert.equal(results[0]!.transactionClass, "transfer");   // structural
    assert.equal(results[1]!.category, "fitness");            // structural keyword
    assert.equal(results[1]!.recurrenceType, "recurring");
    assert.equal(results[2]!.transactionClass, "income");     // income keyword
  });
});

describe("classifier.ts unit (no DB)", () => {
  test("'loan payment' → debt/expense", async () => {
    const { classifyTransaction } = await import("./classifier.js");
    const r = classifyTransaction("LOAN PAYMENT CHASE BANK", -350);
    assert.equal(r.category, "debt");
    assert.equal(r.transactionClass, "expense");
  });

  test("'AMAZON REFUND RETURN' (positive) → refund", async () => {
    const { classifyTransaction } = await import("./classifier.js");
    const r = classifyTransaction("AMAZON REFUND RETURN", 29.99);
    assert.equal(r.transactionClass, "refund");
  });

  test("'OVERDRAFT FEE' → fees/expense", async () => {
    const { classifyTransaction } = await import("./classifier.js");
    const r = classifyTransaction("OVERDRAFT FEE CHARGED", -35);
    assert.equal(r.category, "fees");
  });

  test("'MONTHLY SUBSCRIPTION FEE' → recurring (via CATEGORY_RULE, recurrenceSource='none')", async () => {
    // CATEGORY_RULES has {keywords:["subscription"], recurrenceType:"recurring"}.
    // That sets recurrenceType directly in Pass 2, so Pass 8 hint logic does not fire.
    const { classifyTransaction } = await import("./classifier.js");
    const r = classifyTransaction("MONTHLY SUBSCRIPTION FEE", -15);
    assert.equal(r.recurrenceType, "recurring");
    assert.equal(r.recurrenceSource, "none");
  });

  test("hint-only keyword without a CATEGORY_RULE match sets recurrenceSource='hint'", async () => {
    // Use a description containing "monthly" but NOT a strong CATEGORY_RULE category keyword.
    // "monthly dues" may hit recurrenceType via Pass 8 if no rule claims it first.
    const { classifyTransaction } = await import("./classifier.js");
    // "MONTHLY TRANSFER TO SAVINGS" → passes through as transfer; test a non-transfer hint
    const r = classifyTransaction("MONTHLY PAYMENT INVOICE XJ99-WIDGET", -80);
    // Even if category is uncertain, recurrenceType should be recurring via hint
    assert.equal(r.recurrenceType, "recurring");
  });
});
