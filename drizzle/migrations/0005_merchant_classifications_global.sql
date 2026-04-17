-- Phase 5: global merchant classification seed table
--
-- Stores the per-deployment merchant classification seed (from RULE_SEED_ENTRIES).
-- Resolution order in classifyPipeline: per-user cache → global seed → structural rules → AI.
-- No userId — applies to all users equally.

CREATE TABLE IF NOT EXISTS merchant_classifications_global (
  id                serial PRIMARY KEY,
  merchant_key      text NOT NULL,
  category          text NOT NULL,
  transaction_class text NOT NULL,
  recurrence_type   text NOT NULL,
  label_confidence  numeric(5, 2) NOT NULL,
  source            text NOT NULL DEFAULT 'rule-seed',
  hit_count         integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'merchant_classifications_global'
      AND indexname  = 'merchant_classifications_global_key_idx'
  ) THEN
    CREATE UNIQUE INDEX merchant_classifications_global_key_idx
      ON merchant_classifications_global (merchant_key);
  END IF;
END $$;
