import { db } from "./db.js";
import { users } from "../shared/schema.js";
import { seedMerchantClassificationsForUser } from "./storage.js";

/**
 * Seed the merchant_classifications table from userCorrected rows.
 * Seeds only from rows where userCorrected=true or labelSource="manual".
 * Uses onConflictDoNothing so it is idempotent and safe on every startup.
 *
 * This is ongoing seed maintenance, not a schema migration — it runs on
 * every boot so that new user corrections are reflected in the cache.
 */
export async function seedMerchantClassifications(): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  let totalSeeded = 0;
  for (const u of allUsers) {
    totalSeeded += await seedMerchantClassificationsForUser(u.id);
  }
  console.log(
    `[startup] merchant classification seed complete (${totalSeeded} entries)`,
  );
}
