-- Extend recurrence_source check constraint to include 'manual'.
--
-- 'manual' is written by updateTransaction and propagateUserCorrection
-- whenever a user explicitly sets recurrenceType via the UI.  The original
-- constraint only allowed 'none', 'hint', and 'detected' — omitting 'manual'
-- would cause those writes to violate the constraint.
--
-- PostgreSQL requires DROP + ADD to replace a check constraint.  We guard
-- both halves against partial-apply scenarios so this is safe to re-run.

DO $$ BEGIN
  -- Drop the old constraint if it still exists with the narrow allowed-set.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recurrence_source'
      AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT chk_recurrence_source;
  END IF;

  -- Add the updated constraint that includes 'manual'.
  ALTER TABLE transactions
    ADD CONSTRAINT chk_recurrence_source
      CHECK (recurrence_source IN ('none', 'hint', 'detected', 'manual'));
END $$;
