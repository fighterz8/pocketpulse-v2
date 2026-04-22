-- Task #60: drop the parser_samples table (Tool B / parser-fidelity sampler
-- removed). Forward-only destructive migration; the verdicts JSON snapshots
-- were sandboxed and never referenced from any other table.
DROP TABLE IF EXISTS "parser_samples" CASCADE;
