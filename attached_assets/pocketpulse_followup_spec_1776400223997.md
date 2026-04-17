# PocketPulse Classifier Overhaul — Follow-Up Spec (Post-Phase-4)

**Repo:** `fighterz8/pocketpulse-v1` (as of commit `23d7d24`)
**Author:** Nick (project lead)
**Prerequisites:** Original overhaul spec Phases 1–4 shipped and verified.
**Purpose:** Clean up two pieces of technical debt that grew during the Phase 1–4 build, then ship Phase 5 (rule migration) safely.

---

## 0. Context

The Phase 1–4 overhaul shipped successfully but introduced two new debts:

1. **The classification pipeline is now duplicated** across `server/routes.ts` (upload handler) and `server/reclassify.ts`. Both files contain near-identical sequences of: build rows → apply user rules → cache lookup → AI fallback → cache writeback. The upload path and the reclassify path must stay in lockstep; any drift between them causes silent behavior divergence.

2. **Startup migrations in `server/index.ts` have grown to four.** Every schema change since app inception has been handled with an ad-hoc `pool.query` block at boot rather than through Drizzle migrations. `drizzle-kit` is installed and configured (`drizzle.config.ts`), but `drizzle/migrations/` does not exist — everything has been `drizzle-kit push`.

These debts must be resolved **before** Phase 5. The rule migration is the highest-risk phase in the overhaul (estimated 70% breakage). Running it with a duplicated pipeline and no migration system is asking for trouble — the surface area for bugs doubles and the rollback story degrades.

After cleanup, Phase 5 ships with confidence.

---

## 1. Phase 4.5 — Extract shared classification pipeline

**Goal:** One module owns the rules → user-rules → cache → AI → writeback sequence. `routes.ts` and `reclassify.ts` become thin callers.

### New file: `server/classifyPipeline.ts`

Public surface:

```ts
export type PipelineRow = {
  rawDescription: string;
  amount: number;
  /** Upload-only: marks CSV-ambiguous single-column rows for AI review. */
  ambiguous?: boolean;
};

export type PipelineOutput = {
  merchant: string;
  amount: number;              // sign-normalized to match flowType
  flowType: "inflow" | "outflow";
  transactionClass: string;
  category: string;
  recurrenceType: string;
  recurrenceSource: string;
  labelSource: string;         // "rule" | "user-rule" | "cache" | "ai"
  labelConfidence: number;
  labelReason: string;
  aiAssisted: boolean;
  fromCache: boolean;
};

export type PipelineOptions = {
  userId: number;
  aiTimeoutMs: number;         // 6_000 for upload, 90_000 for reclassify
  aiConfidenceThreshold: number; // 0.5 — shared for now, in config later
  cacheWriteMinConfidence: number; // 0.7 — shared
};

/**
 * Runs rules → user rules → cache lookup → AI fallback → cache writeback,
 * returning one output per input. Input order is preserved.
 * Non-fatal on AI or cache errors; always returns a PipelineOutput per row.
 */
export async function classifyPipeline(
  rows: PipelineRow[],
  opts: PipelineOptions,
): Promise<PipelineOutput[]>;
```

### Key design decisions (non-negotiable)

- **No I/O for DB writes** inside the pipeline. The pipeline returns results. Callers write. Keeps test seams clean and prevents accidental partial writes on error.
- **User rules and cache fetches happen inside the pipeline.** These are read-only lookups keyed on `userId` and scoped to the request. Batched per call.
- **Cache writeback happens inside the pipeline as fire-and-forget.** The `.catch(() => undefined)` pattern already present in both files is preserved — cache write failures never fail the caller.
- **AI timeout and threshold are caller-supplied**, not pipeline-internal. Upload and reclassify have legitimately different latency budgets.

### Call-site changes

**`server/routes.ts` upload handler** (current lines ~776–953): replace the entire rules + user-rules + cache + AI + cache-writeback block with:

```ts
const results = await classifyPipeline(
  parseResult.rows.map(r => ({
    rawDescription: r.description,
    amount: r.amount,
    ambiguous: r.ambiguous,
  })),
  { userId, aiTimeoutMs: 6_000, aiConfidenceThreshold: 0.5, cacheWriteMinConfidence: 0.7 },
);

const txnInputs = results.map((out, i) => ({
  userId,
  uploadId: uploadRecord.id,
  accountId: fileMeta.accountId,
  date: parseResult.rows[i]!.date,
  amount: out.amount.toFixed(2),
  merchant: out.merchant,
  rawDescription: parseResult.rows[i]!.rawDescription,
  flowType: out.flowType,
  transactionClass: out.transactionClass,
  category: out.category,
  recurrenceType: out.recurrenceType,
  recurrenceSource: out.recurrenceSource,
  labelSource: out.labelSource,
  labelConfidence: out.labelConfidence.toFixed(2),
  labelReason: out.labelReason,
  aiAssisted: out.aiAssisted,
}));
```

Net change: upload handler loses ~180 lines.

**`server/reclassify.ts`**: replace the entire rules + user-rules + cache + AI block (current lines ~55–240) with a pipeline call, then do the diff-vs-existing-DB comparison on the outputs. `reclassifyTransactions` still owns:
- The `userCorrected` / `propagated` / `recurring-transfer` skip logic (pipeline is pure — it doesn't know about DB state)
- The `finalChanged` diff against the existing transaction
- The bulk DB update call

Net change: `reclassify.ts` drops from 315 to ~130 lines.

### Files touched

- **New:** `server/classifyPipeline.ts` (~250 lines)
- **New:** `server/classifyPipeline.test.ts` (mirrors coverage of current upload + reclassify flows)
- **Modified:** `server/routes.ts` (upload handler slims by ~180 lines)
- **Modified:** `server/reclassify.ts` (drops to ~130 lines)
- **Modified:** `server/upload-classification.test.ts`, `server/reclassify.test.ts` (call sites move but assertions stay — if a behavior test fails after extraction, the extraction is wrong)

### Acceptance criteria

- `server/routes.ts` does not import `aiClassifyBatch`, `getMerchantClassifications`, `batchUpsertMerchantClassifications`, or `recordCacheHits` directly.
- `server/reclassify.ts` does not import those either.
- Both import only `classifyPipeline` from the new module.
- All existing tests pass unchanged (this is a pure refactor — no behavior changes).
- A diff of upload-handler behavior before vs. after against the same CSV produces identical DB rows.
- A diff of `reclassifyTransactions` behavior before vs. after against the same dataset produces identical DB rows.

### Breakage risk: ~20%

The behavior is supposed to be identical, but two pipelines have subtly diverged during the Phase 1–4 build and merging them may expose differences the authors didn't realize were there. Specific places to audit:

- **Upload uses `row.ambiguous`** in `needsAi` determination. Reclassify has no equivalent concept. The pipeline must accept `ambiguous?: boolean` and apply it only when present.
- **`needsAi` trigger conditions may differ.** Upload: `conf < AI_THRESHOLD || t.category === "other"`. Reclassify: `classification.aiAssisted || classification.labelConfidence < AI_CONFIDENCE_THRESHOLD || classification.category === "other"`. Reclassify's first condition (`aiAssisted`) isn't used in upload — pick the union of both conditions in the pipeline and document it.
- **Upload does not use `getUserCorrectionExamples`**; reclassify does. The pipeline should always fetch and pass them to the AI call; this would be a *change* for the upload path, so it needs a flag (`includeUserExamplesInAi: boolean`) or must be documented as an intentional improvement.

**Mitigation:** Ship this phase behind a feature flag (`USE_SHARED_PIPELINE=true`) that switches between the new and old implementation at the call site. Run both for a week in staging with output diffing.

---

## 2. Phase 4.6 — Move startup migrations into Drizzle

**Goal:** `server/index.ts` stops running schema changes on boot. Drizzle owns migrations end-to-end.

### Current state

`server/index.ts` runs four startup migrations on every boot:

1. Strip old `|amount.toFixed(2)` suffix from `recurring_reviews.candidate_key`
2. Purge duplicate transactions + create `transactions_dedup_idx` functional unique index
3. Add `chk_recurrence_source` check constraint on `transactions.recurrence_source`
4. Day-one seed of `merchant_classifications` from userCorrected rows (iterates all users)

Migrations 1–3 are one-time schema changes dressed as idempotent startup hooks. They belong in Drizzle. Migration 4 is ongoing seed maintenance — it is **not** a migration and should stay in `index.ts`, but it should move to a dedicated `server/startup.ts` file.

### Plan

**Step 1: Generate initial schema baseline migration.**

```bash
npx drizzle-kit generate --name initial_baseline
```

This produces `drizzle/migrations/0000_initial_baseline.sql` reflecting the current `shared/schema.ts`. Commit this.

**Step 2: Back-port the three one-time migrations as explicit files.**

Write these by hand (not via `generate`) because they operate on pre-existing data, not just schema:

- `drizzle/migrations/0001_strip_candidate_key_amount_suffix.sql` — the regex UPDATE and dedup DELETE from `index.ts:18–38`
- `drizzle/migrations/0002_transactions_dedup_index.sql` — the dedup purge + `CREATE UNIQUE INDEX` from `index.ts:60–87`
- `drizzle/migrations/0003_recurrence_source_check_constraint.sql` — the `ADD CONSTRAINT` from `index.ts:96–112`

Each file is idempotent — any of these queries already run in production must be safe to run again. The existing code already uses `IF NOT EXISTS` and conditional patterns, so the SQL can be copied almost verbatim.

**Step 3: Add a migration runner.**

Drizzle does not run migrations automatically at boot. Add an npm script and a startup hook:

```ts
// server/migrations.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
}
```

```ts
// server/index.ts — replaces the four inline migration blocks
import { runMigrations } from "./migrations.js";
await runMigrations();
console.log("[startup] migrations applied");
```

**Step 4: Move the seed into `startup.ts`.**

```ts
// server/startup.ts
import { db } from "./db.js";
import { users } from "../shared/schema.js";
import { seedMerchantClassificationsForUser } from "./storage.js";

export async function seedMerchantClassifications(): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  let total = 0;
  for (const u of allUsers) {
    total += await seedMerchantClassificationsForUser(u.id);
  }
  console.log(`[startup] merchant classification seed complete (${total} entries)`);
}
```

`index.ts` calls `await runMigrations(); await seedMerchantClassifications();` in sequence.

**Step 5: Add `npm run db:migrate` script** to `package.json`:

```json
"db:migrate": "tsx server/migrate-cli.ts"
```

Where `server/migrate-cli.ts` just runs `runMigrations()` and exits. This lets you run migrations ad-hoc without starting the server.

### Acceptance criteria

- `server/index.ts` has no inline `pool.query` blocks for schema changes.
- `drizzle/migrations/` contains 4 files (0000 baseline + 3 back-ports).
- `npm run db:migrate` succeeds against a fresh database and produces a schema byte-identical to what Drizzle push would produce.
- `npm run db:migrate` succeeds against the current production schema with zero changes applied (idempotency verified).
- Boot sequence logs: "migrations applied" then "merchant classification seed complete".
- `drizzle-kit push` is no longer used for production changes. Use `drizzle-kit generate` + `npm run db:migrate` instead.

### Breakage risk: ~35%

Migration systems are finicky. Specific failure modes:

- **The baseline migration may conflict with the existing production schema.** Drizzle's baseline generation assumes the DB is empty; in production the schema is already there. Work around by running `drizzle-kit generate` against the current schema, then manually editing the 0000 file to wrap all `CREATE TABLE` statements in `CREATE TABLE IF NOT EXISTS`, or by using Drizzle's `--custom` flag and handling baseline explicitly.
- **Migration ordering guarantees.** If 0001 runs before 0000 on a fresh DB, it fails. Drizzle's migrator enforces filename order, so this is fine as long as filenames are correct. Double-check before merging.
- **Test database state.** Any integration test that assumes certain tables exist must now run migrations first. Add a test setup hook.

**Mitigation:** Test the full migration flow end-to-end against a copy of production before merging. Specifically: dump production schema → drop public → run `npm run db:migrate` → diff the result against the original dump. Zero diff is the pass condition.

---

## 3. Phase 5 (revised) — Migrate `CATEGORY_RULES` to cache

**This is the original Phase 5 from the prior spec, with adjustments now that Phase 4.5 and 4.6 are in place.** Re-read the original spec's Phase 5 for full context; only the delta is captured here.

### Key change from original Phase 5

The original Phase 5 said to build a **global seed cache** — a table separate from `merchant_classifications` holding cross-user seed rows. That was written before Phase 2 landed. Now that `merchant_classifications` exists with `source: "rule-seed"` already supported, the cleanest path is:

**Use `merchant_classifications` for the seed, not a new global table. Seed per-user, lazily, on first upload.**

Rationale: a global cross-user table complicates RLS / multi-tenancy later and requires an extra join at read time. A per-user lazy seed has no upfront cost, no cross-user data path, and reuses all existing cache infrastructure.

### Plan

**Step 1: Extract structural rules from `CATEGORY_RULES`.**

Categorize each entry in `server/classifier.ts::CATEGORY_RULES` as:

- **Structural:** describes the *form* of the transaction (transfer keywords, refund keywords, income keywords, ACH/debit/wire prefixes, fee markers). Keep in code.
- **Merchant-specific:** describes a known merchant (Netflix, Sallie Mae, Duke Energy, Geico, etc.). Migrate to seed.

Create `server/classifierRuleMigration.ts` exporting `RULE_SEED_ENTRIES: Array<{ merchantKeyPattern: string; category, transactionClass, recurrenceType, confidence }>`. Each entry represents one keyword from the original `CATEGORY_RULES` with its category/class assignment.

**Step 2: Add a `seedRuleSeedForUser()` storage function.**

Parallel to the existing `seedMerchantClassificationsForUser()`, but seeds from `RULE_SEED_ENTRIES` with `source: "rule-seed"` and `onConflictDoNothing` (so existing manual / ai entries are preserved).

**Step 3: Wire the rule-seed into the pipeline.**

In `classifyPipeline.ts`, after the per-user manual/ai cache lookup returns misses, call `seedRuleSeedForUser(userId)` once per pipeline invocation (memoize per-request), then re-query the cache. Rule-seed entries now behave identically to any other cache entry.

**Step 4: Delete merchant-specific entries from `CATEGORY_RULES`.**

The file shrinks from ~1,970 lines to ~400 (keeping type definitions, structural keywords, compile helpers, and the `classifyTransaction` function itself). Structural rules stay because they need regex compilation and can't be expressed as simple merchant-key lookups.

**Step 5: Monitor.**

For two weeks after deploy: watch the accuracy report daily. If overall accuracy drops by more than 2 points, pause and investigate before continuing. If cache hit rate fails to rise above 70% within two weeks, the seed migration missed merchants and needs extending.

### Acceptance criteria

- `server/classifier.ts` line count drops below 500.
- `RULE_SEED_ENTRIES` contains at least one row for every merchant keyword that was deleted from `CATEGORY_RULES`, verified by an automated script that diffs the old `CATEGORY_RULES` export against the new seed.
- Cache hit rate after two weeks of normal usage is ≥ 70%.
- Accuracy report after two weeks shows net improvement vs. Phase 4 baseline.
- No test in `classifier.test.ts` fails; tests that previously exercised merchant-specific paths now run against the pipeline + seed.

### Breakage risk: now ~40% (down from the original 70%)

Risk dropped because:

- The pipeline extraction (Phase 4.5) means one place to change, not two.
- The migration system (Phase 4.6) gives a clean rollback path: add a 0004 migration that DELETEs from `merchant_classifications WHERE source='rule-seed'` and restore the old classifier.
- The seed uses existing infrastructure; no new tables, no new write paths.

Remaining risk concentrates in the diff between `CATEGORY_RULES` and `RULE_SEED_ENTRIES`. A missed merchant causes a silent regression (the row lands in `"other"` instead of getting its keyword-derived category). The automated diff script in acceptance criterion is the primary defense.

---

## 4. Ship order

| Phase | Depends on | Parallel-safe | Estimated effort |
|-------|------------|---------------|------------------|
| 4.5 pipeline extraction | — | No — ship first | 0.5–1 day |
| 4.6 migration system | — | Yes (can run alongside 4.5 on a different branch) | 1 day |
| 5 rule migration | 4.5 + 4.6 | No — ship last | 2–3 days |

Total: 3.5–5 days.

**Do not start Phase 5 until both 4.5 and 4.6 are merged to main and have been running cleanly for at least 72 hours.**

---

## 5. Rollback plan

| Phase | Rollback |
|-------|----------|
| 4.5 | Feature flag (`USE_SHARED_PIPELINE=false`) reverts call sites to inline implementations. Leave the new file in place. |
| 4.6 | The Drizzle migrator is additive; leaving migrations in place is safe. If the runner itself fails, revert the `index.ts` change that swaps `runMigrations()` for the inline queries. |
| 5 | Run `DELETE FROM merchant_classifications WHERE source='rule-seed'`. Restore `CATEGORY_RULES` from git (commit `23d7d24` or later baseline). Deploy. Cache misses from that point re-enter the AI path, which is the pre-Phase-5 behavior. |

---

## 6. Notes for the build agent

- **Squash commits before push.** The Phase 1–4 run produced 30 commits for 4 phases, many with duplicate messages. Target: one squashed commit per phase (three commits total for this spec).
- **Phase 4.5 is a pure refactor.** If any existing test requires modification beyond call-site updates, the refactor is wrong. Revert and re-approach.
- **Phase 4.6's baseline migration is the hardest part.** Drizzle's generate-against-existing-schema flow is underdocumented. Budget extra time; verify the idempotency check (run twice, second run changes nothing) before merging.
- **Accuracy report is the source of truth throughout.** Run it before Phase 4.5, after Phase 4.5, after Phase 4.6, and daily during Phase 5 rollout. Any drop is a stop-ship signal.
- **Do not combine phases in a single PR.** Three PRs minimum, reviewed and merged independently.
