import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db.js";

/**
 * Applies any pending Drizzle migrations from drizzle/migrations/ to the
 * connected database. Idempotent — migrations that have already run are
 * tracked in the drizzle/__drizzle_migrations table and skipped automatically.
 *
 * Call this once at startup, before any application code runs.
 */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
}
