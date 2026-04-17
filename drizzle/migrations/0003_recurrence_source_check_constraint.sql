-- Back-port: recurrenceSource check constraint
--
-- Enforces the allowed values for recurrence_source at the DB level so that
-- any future write path that passes an unexpected string is rejected immediately.
--
-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so we guard with a
-- pg_constraint lookup. Safe to run multiple times.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_recurrence_source'
      AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT chk_recurrence_source
        CHECK (recurrence_source IN ('none', 'hint', 'detected'));
  END IF;
END $$;
