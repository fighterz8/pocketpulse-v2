import http from "node:http";

import { createApp } from "./routes.js";
import { pool } from "./db.js";
import { db } from "./db.js";
import { users } from "../shared/schema.js";
import { seedMerchantClassificationsForUser } from "./storage.js";

// ── One-time startup migration: strip old "|amount.toFixed(2)" suffix ──────
// Old candidateKey format: "merchantKey|15.99"
// New format: "merchantKey" (bare) or "merchantKey|1" (bucket index suffix)
//
// This preserves existing reviews by re-attaching them to the new key format.
// The regex matches a pipe followed by a decimal number at the end of the key.
// Housing keys like "__housing_3200" are unaffected (no pipe + decimal suffix).
//
// Two-step process:
//  1. Delete lower-priority duplicates (same user, same new key after stripping)
//     keeping the row with the highest id (most recently created/updated).
//  2. Update the surviving rows to the new key format.
try {
  await pool.query(`
    DELETE FROM recurring_reviews rr_old
    USING recurring_reviews rr_keep
    WHERE rr_old.user_id = rr_keep.user_id
      AND rr_old.candidate_key ~ '\\|\\d+\\.\\d{2}$'
      AND rr_keep.candidate_key ~ '\\|\\d+\\.\\d{2}$'
      AND regexp_replace(rr_old.candidate_key, '\\|\\d+\\.\\d{2}$', '')
        = regexp_replace(rr_keep.candidate_key, '\\|\\d+\\.\\d{2}$', '')
      AND rr_old.candidate_key <> rr_keep.candidate_key
      AND rr_old.id < rr_keep.id
  `);
  await pool.query(`
    UPDATE recurring_reviews
    SET candidate_key = regexp_replace(candidate_key, '\\|\\d+\\.\\d{2}$', '')
    WHERE candidate_key ~ '\\|\\d+\\.\\d{2}$'
  `);
  console.log("[startup] candidateKey migration complete");
} catch (err) {
  console.warn("[startup] candidateKey migration skipped:", err);
}

// ── Startup migration: transactions dedup unique index ────────────────────────
// Enforces that no two rows for the same user+account have an identical
// (date, amount, lower(trim(raw_description))) fingerprint — the same key
// used by the JS fingerprint in createTransactionBatch.
//
// Step 1 (best-effort): purge any pre-existing duplicate rows keeping the
//   lowest ID per fingerprint group so Step 2 can never fail on existing data.
//   Wrapped in try/catch: data may already be clean, or another process may
//   have cleaned it; either way we proceed to Step 2.
//
// Step 2 (mandatory): create the functional unique index.  Uses
//   CREATE UNIQUE INDEX IF NOT EXISTS so it is a no-op on re-runs.
//   NOT wrapped in try/catch — if this fails the app must not start, because
//   without the index the onConflictDoNothing() in createTransactionBatch has
//   no DB constraint to enforce against and race-condition safety is lost.
//
// Functional expression lower(trim(raw_description)) is used instead of raw
// rawDescription because: (a) it matches the JS fingerprint exactly,
// (b) it tolerates case/whitespace variants, and (c) it bounds index key size
// to the text content length (typical bank descriptions are <200 chars).
try {
  // Keep-row priority: user_corrected=true first (preserves manual edits),
  // then lowest id (original import) among equal-priority rows.
  await pool.query(`
    DELETE FROM transactions
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, account_id, date, amount,
                              lower(trim(raw_description))
                 ORDER BY user_corrected DESC, id ASC
               ) AS rn
        FROM transactions
      ) ranked
      WHERE rn > 1
    )
  `);
} catch {
  // pre-cleanup is best-effort; proceed to index creation regardless
}
// Mandatory — throws on failure, crashing startup deliberately.
await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS transactions_dedup_idx
    ON transactions (user_id, account_id, date, amount,
                     lower(trim(raw_description)))
`);
console.log("[startup] transactions dedup index migration complete");

// ── Day-one seed: populate merchant_classifications from userCorrected rows ──
// Seeds only from rows where userCorrected=true or labelSource="manual".
// Uses onConflictDoNothing so it is idempotent and safe on every startup.
try {
  const allUsers = await db.select({ id: users.id }).from(users);
  let totalSeeded = 0;
  for (const u of allUsers) {
    const n = await seedMerchantClassificationsForUser(u.id);
    totalSeeded += n;
  }
  console.log(`[startup] merchant classification seed complete (${totalSeeded} entries)`);
} catch (err) {
  console.warn("[startup] merchant classification seed skipped:", err);
}

const app = createApp();
const isProduction = process.env.NODE_ENV === "production";
/**
 * Dev: defaults to 5001 (API-only, Vite runs separately on 5000 and proxies /api here).
 * Prod: uses PORT from environment (Replit maps external 80 → 5000).
 */
const port = Number(process.env.PORT ?? (isProduction ? "5000" : "5001"));
const server = http.createServer(app);

if (isProduction) {
  const { setupStatic } = await import("./static.js");
  setupStatic(app);
} else if (!process.env.SKIP_VITE) {
  const { setupVite } = await import("./vite.js");
  await setupVite(app, server);
}

server.listen(port, "0.0.0.0", () => {
  console.log(`server listening on ${port}`);
});
