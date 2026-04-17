/**
 * Ad-hoc migration runner — runs all pending Drizzle migrations and exits.
 * Usage: npx tsx server/migrate-cli.ts
 * Or via package.json: npm run db:migrate
 */
import { runMigrations } from "./migrations.js";

await runMigrations();
console.log("[migrate-cli] all migrations applied");
process.exit(0);
