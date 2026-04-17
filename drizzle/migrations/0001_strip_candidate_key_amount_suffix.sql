-- Back-port: strip old "|amount.toFixed(2)" suffix from recurring_reviews.candidate_key
--
-- Old format: "merchantKey|15.99"
-- New format: "merchantKey" (bare) or "merchantKey|1" (bucket index suffix)
--
-- Step 1: delete lower-priority duplicates (same user + same stripped key),
--   keeping the row with the highest id (most recently created/updated).
--   Idempotent: if no rows match the regex, the DELETE is a safe no-op.
--
-- Step 2: strip the suffix from surviving rows.
--   Idempotent: if no rows match the regex, the UPDATE is a safe no-op.

DELETE FROM recurring_reviews rr_old
USING recurring_reviews rr_keep
WHERE rr_old.user_id = rr_keep.user_id
  AND rr_old.candidate_key ~ '\|\d+\.\d{2}$'
  AND rr_keep.candidate_key ~ '\|\d+\.\d{2}$'
  AND regexp_replace(rr_old.candidate_key, '\|\d+\.\d{2}$', '')
    = regexp_replace(rr_keep.candidate_key, '\|\d+\.\d{2}$', '')
  AND rr_old.candidate_key <> rr_keep.candidate_key
  AND rr_old.id < rr_keep.id;

UPDATE recurring_reviews
SET candidate_key = regexp_replace(candidate_key, '\|\d+\.\d{2}$', '')
WHERE candidate_key ~ '\|\d+\.\d{2}$';
