-- Phase 5: rule-seed warmup
--
-- Merchant-specific CATEGORY_RULES have been migrated from classifier.ts into
-- classifierRuleMigration.ts (RULE_SEED_ENTRIES) and are seeded per-user into
-- merchant_classifications at runtime via seedRuleSeedForUser() called from
-- classifyPipeline.ts Phase 1.8.
--
-- No schema changes are required — merchant_classifications already supports
-- source = 'rule-seed' and the (userId, merchantKey) unique index handles
-- deduplication / onConflictDoNothing.
--
-- This file exists only as a migration-log marker so the migration runner
-- records that Phase 5 was applied.

SELECT 1;
