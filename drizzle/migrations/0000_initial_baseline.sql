-- Baseline schema migration.
-- Wraps every CREATE TABLE and CREATE INDEX in IF NOT EXISTS so that running
-- this file against the current production schema is a safe no-op.
-- Foreign key constraints and CHECK constraints use DO $$ ... $$ guards for
-- the same reason (PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "password" text NOT NULL,
        "display_name" text NOT NULL,
        "company_name" text,
        "is_dev" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "label" text NOT NULL,
        "last_four" text,
        "account_type" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uploads" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "account_id" integer NOT NULL,
        "filename" text NOT NULL,
        "row_count" integer DEFAULT 0 NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "error_message" text,
        "format_spec" json,
        "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "upload_id" integer NOT NULL,
        "account_id" integer NOT NULL,
        "date" text NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "merchant" text NOT NULL,
        "raw_description" text NOT NULL,
        "flow_type" text NOT NULL,
        "transaction_class" text NOT NULL,
        "recurrence_type" text DEFAULT 'one-time' NOT NULL,
        "recurrence_source" text DEFAULT 'none' NOT NULL,
        "category" text DEFAULT 'other' NOT NULL,
        "label_source" text DEFAULT 'rule' NOT NULL,
        "label_confidence" numeric(5, 2),
        "label_reason" text,
        "ai_assisted" boolean DEFAULT false NOT NULL,
        "user_corrected" boolean DEFAULT false NOT NULL,
        "excluded_from_analysis" boolean DEFAULT false NOT NULL,
        "excluded_reason" text,
        "excluded_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "csv_format_specs" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "header_fingerprint" text NOT NULL,
        "spec" json NOT NULL,
        "source" text DEFAULT 'ai' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchant_classifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "merchant_key" text NOT NULL,
        "category" text NOT NULL,
        "transaction_class" text NOT NULL,
        "recurrence_type" text NOT NULL,
        "label_confidence" numeric(5, 2) NOT NULL,
        "source" text NOT NULL,
        "hit_count" integer DEFAULT 0 NOT NULL,
        "last_used_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "merchant_rules" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "merchant_key" text NOT NULL,
        "category" text,
        "transaction_class" text,
        "recurrence_type" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_reviews" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "candidate_key" text NOT NULL,
        "status" text DEFAULT 'unreviewed' NOT NULL,
        "notes" text,
        "reviewed_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
        "user_id" integer PRIMARY KEY NOT NULL,
        "theme" text DEFAULT 'system' NOT NULL,
        "week_starts_on" smallint DEFAULT 0 NOT NULL,
        "default_currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'csv_format_specs_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "csv_format_specs" ADD CONSTRAINT "csv_format_specs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_classifications_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "merchant_classifications" ADD CONSTRAINT "merchant_classifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_rules_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_reviews_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "recurring_reviews" ADD CONSTRAINT "recurring_reviews_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_upload_id_uploads_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_upload_id_uploads_id_fk"
      FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_account_id_accounts_id_fk'
  ) THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uploads_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uploads_account_id_accounts_id_fk'
  ) THEN
    ALTER TABLE "uploads" ADD CONSTRAINT "uploads_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "csv_format_specs_user_id_idx" ON "csv_format_specs" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "csv_format_specs_user_fp_idx" ON "csv_format_specs" USING btree ("user_id","header_fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_classifications_user_id_idx" ON "merchant_classifications" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_classifications_user_key_idx" ON "merchant_classifications" USING btree ("user_id","merchant_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_rules_user_id_idx" ON "merchant_rules" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_rules_user_key_idx" ON "merchant_rules" USING btree ("user_id","merchant_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_reviews_user_id_idx" ON "recurring_reviews" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_reviews_user_candidate_idx" ON "recurring_reviews" USING btree ("user_id","candidate_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" USING btree ("expire");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_upload_id_idx" ON "transactions" USING btree ("upload_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_date_idx" ON "transactions" USING btree ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_user_id_idx" ON "uploads" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_account_id_idx" ON "uploads" USING btree ("account_id");
