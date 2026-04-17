-- Back-port: transactions dedup unique index
--
-- Enforces that no two rows for the same user+account have an identical
-- (date, amount, lower(trim(raw_description))) fingerprint — the same key
-- used by the JS fingerprint in createTransactionBatch.
--
-- Step 1 (best-effort): purge any pre-existing duplicate rows, keeping the
--   lowest ID per fingerprint group (original import), with user_corrected rows
--   prioritised so manual edits are preserved.
--   Idempotent: if data is already clean, the DELETE matches nothing.
--
-- Step 2 (mandatory): create the functional unique index.
--   CREATE UNIQUE INDEX IF NOT EXISTS is idempotent on re-runs.

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
);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_dedup_idx
  ON transactions (user_id, account_id, date, amount,
                   lower(trim(raw_description)));
