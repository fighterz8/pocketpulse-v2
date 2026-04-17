#!/usr/bin/env npx tsx
/**
 * Verify that merchant keywords deleted from CATEGORY_RULES in classifier.ts
 * during Phase 5 are covered by entries in RULE_SEED_ENTRIES.
 *
 * Usage: npx tsx scripts/verify-rule-seed-coverage.ts
 *
 * A "covered" keyword is one whose normalized form exists as a merchantKeyPattern
 * in RULE_SEED_ENTRIES (exact or substring match against the seed list).
 */

import { RULE_SEED_ENTRIES } from "../server/classifierRuleMigration.js";

// ─── Merchant-specific keywords deleted from classifier.ts in Phase 5 ─────────
// These were migrated to RULE_SEED_ENTRIES. Each entry records the original
// keyword and its expected category so we can verify coverage.

type DeletedRule = { keyword: string; expectedCategory: string };

const DELETED_RULES: DeletedRule[] = [
  // DEBT — named servicers
  { keyword: "sallie mae", expectedCategory: "debt" },
  { keyword: "navient", expectedCategory: "debt" },
  { keyword: "great lakes", expectedCategory: "debt" },
  { keyword: "fedloan", expectedCategory: "debt" },
  { keyword: "mohela", expectedCategory: "debt" },
  { keyword: "nelnet", expectedCategory: "debt" },
  { keyword: "sofi loan", expectedCategory: "debt" },
  { keyword: "upstart", expectedCategory: "debt" },
  // INSURANCE — named carriers
  { keyword: "geico", expectedCategory: "insurance" },
  { keyword: "state farm", expectedCategory: "insurance" },
  { keyword: "allstate", expectedCategory: "insurance" },
  { keyword: "progressive", expectedCategory: "insurance" },
  { keyword: "liberty mutual", expectedCategory: "insurance" },
  { keyword: "usaa", expectedCategory: "insurance" },
  { keyword: "aetna", expectedCategory: "insurance" },
  { keyword: "cigna", expectedCategory: "insurance" },
  { keyword: "blue cross", expectedCategory: "insurance" },
  { keyword: "anthem", expectedCategory: "insurance" },
  { keyword: "unitedhealthcare", expectedCategory: "insurance" },
  { keyword: "humana", expectedCategory: "insurance" },
  // STREAMING
  { keyword: "netflix", expectedCategory: "entertainment" },
  { keyword: "hulu", expectedCategory: "entertainment" },
  { keyword: "disney+", expectedCategory: "entertainment" },
  { keyword: "hbo max", expectedCategory: "entertainment" },
  { keyword: "paramount+", expectedCategory: "entertainment" },
  { keyword: "peacock", expectedCategory: "entertainment" },
  { keyword: "crunchyroll", expectedCategory: "entertainment" },
  { keyword: "espn+", expectedCategory: "entertainment" },
  { keyword: "sling tv", expectedCategory: "entertainment" },
  // SOFTWARE — consumer
  { keyword: "spotify", expectedCategory: "software" },
  { keyword: "apple music", expectedCategory: "software" },
  { keyword: "amazon prime", expectedCategory: "software" },
  { keyword: "icloud", expectedCategory: "software" },
  { keyword: "google one", expectedCategory: "software" },
  { keyword: "microsoft 365", expectedCategory: "software" },
  { keyword: "chatgpt", expectedCategory: "software" },
  { keyword: "adobe", expectedCategory: "software" },
  { keyword: "figma", expectedCategory: "software" },
  { keyword: "notion", expectedCategory: "software" },
  { keyword: "1password", expectedCategory: "software" },
  { keyword: "nordvpn", expectedCategory: "software" },
  { keyword: "grammarly", expectedCategory: "software" },
  { keyword: "canva", expectedCategory: "software" },
  // SOFTWARE — business
  { keyword: "github", expectedCategory: "software" },
  { keyword: "aws", expectedCategory: "software" },
  { keyword: "google cloud", expectedCategory: "software" },
  { keyword: "azure", expectedCategory: "software" },
  { keyword: "digitalocean", expectedCategory: "software" },
  { keyword: "vercel", expectedCategory: "software" },
  { keyword: "netlify", expectedCategory: "software" },
  { keyword: "zoom", expectedCategory: "software" },
  { keyword: "shopify", expectedCategory: "software" },
  { keyword: "hubspot", expectedCategory: "software" },
  { keyword: "salesforce", expectedCategory: "software" },
  { keyword: "stripe", expectedCategory: "software" },
  { keyword: "gusto", expectedCategory: "software" },
  { keyword: "quickbooks", expectedCategory: "software" },
  // HOUSING — named servicers
  { keyword: "home depot", expectedCategory: "housing" },
  { keyword: "lowe's", expectedCategory: "housing" },
  { keyword: "airbnb", expectedCategory: "housing" },
  { keyword: "vrbo", expectedCategory: "housing" },
  { keyword: "pennymac", expectedCategory: "housing" },
  { keyword: "freedom mortgage", expectedCategory: "housing" },
  // UTILITIES — named providers
  { keyword: "pg&e", expectedCategory: "utilities" },
  { keyword: "pge", expectedCategory: "utilities" },
  { keyword: "con ed", expectedCategory: "utilities" },
  { keyword: "duke energy", expectedCategory: "utilities" },
  { keyword: "xfinity", expectedCategory: "utilities" },
  { keyword: "comcast", expectedCategory: "utilities" },
  { keyword: "at&t", expectedCategory: "utilities" },
  { keyword: "verizon", expectedCategory: "utilities" },
  { keyword: "t-mobile", expectedCategory: "utilities" },
  // TRAVEL
  { keyword: "united airlines", expectedCategory: "travel" },
  { keyword: "delta airlines", expectedCategory: "travel" },
  { keyword: "american airlines", expectedCategory: "travel" },
  { keyword: "southwest airlines", expectedCategory: "travel" },
  { keyword: "marriott", expectedCategory: "travel" },
  { keyword: "hilton", expectedCategory: "travel" },
  { keyword: "expedia", expectedCategory: "travel" },
  { keyword: "hertz", expectedCategory: "travel" },
  // GAS
  { keyword: "shell", expectedCategory: "gas" },
  { keyword: "exxon", expectedCategory: "gas" },
  { keyword: "chevron", expectedCategory: "gas" },
  { keyword: "bp", expectedCategory: "gas" },
  { keyword: "mobil", expectedCategory: "gas" },
  // PARKING
  { keyword: "spothero", expectedCategory: "parking" },
  { keyword: "parkmobile", expectedCategory: "parking" },
  // AUTO
  { keyword: "autozone", expectedCategory: "auto" },
  { keyword: "jiffy lube", expectedCategory: "auto" },
  { keyword: "firestone", expectedCategory: "auto" },
  { keyword: "discount tire", expectedCategory: "auto" },
  // GROCERIES
  { keyword: "whole foods", expectedCategory: "groceries" },
  { keyword: "trader joe", expectedCategory: "groceries" },
  { keyword: "kroger", expectedCategory: "groceries" },
  { keyword: "safeway", expectedCategory: "groceries" },
  { keyword: "publix", expectedCategory: "groceries" },
  { keyword: "aldi", expectedCategory: "groceries" },
  { keyword: "costco", expectedCategory: "groceries" },
  { keyword: "target", expectedCategory: "shopping" },
  { keyword: "h-e-b", expectedCategory: "groceries" },
  { keyword: "99 ranch", expectedCategory: "groceries" },
  { keyword: "h mart", expectedCategory: "groceries" },
  // COFFEE
  { keyword: "starbucks", expectedCategory: "coffee" },
  { keyword: "dunkin", expectedCategory: "coffee" },
  { keyword: "dutch bros", expectedCategory: "coffee" },
  // DELIVERY
  { keyword: "doordash", expectedCategory: "delivery" },
  { keyword: "ubereats", expectedCategory: "delivery" },
  { keyword: "grubhub", expectedCategory: "delivery" },
  { keyword: "instacart", expectedCategory: "delivery" },
  { keyword: "hellofresh", expectedCategory: "delivery" },
  { keyword: "factor75", expectedCategory: "delivery" },
  // CONVENIENCE
  { keyword: "7-eleven", expectedCategory: "convenience" },
  { keyword: "circle k", expectedCategory: "convenience" },
  { keyword: "wawa", expectedCategory: "convenience" },
  { keyword: "sheetz", expectedCategory: "convenience" },
  // DINING
  { keyword: "chipotle", expectedCategory: "dining" },
  { keyword: "mcdonalds", expectedCategory: "dining" },
  { keyword: "subway sandwich", expectedCategory: "dining" },
  { keyword: "pizza hut", expectedCategory: "dining" },
  { keyword: "burger king", expectedCategory: "dining" },
  { keyword: "chick-fil-a", expectedCategory: "dining" },
  { keyword: "panera", expectedCategory: "dining" },
  { keyword: "kfc", expectedCategory: "dining" },
  { keyword: "five guys", expectedCategory: "dining" },
  // MEDICAL
  { keyword: "cvs", expectedCategory: "medical" },
  { keyword: "walgreens", expectedCategory: "medical" },
  { keyword: "labcorp", expectedCategory: "medical" },
  { keyword: "quest diagnostics", expectedCategory: "medical" },
  { keyword: "betterhelp", expectedCategory: "medical" },
  // FITNESS
  { keyword: "planet fitness", expectedCategory: "fitness" },
  { keyword: "la fitness", expectedCategory: "fitness" },
  { keyword: "equinox", expectedCategory: "fitness" },
  { keyword: "peloton", expectedCategory: "fitness" },
  { keyword: "orangetheory", expectedCategory: "fitness" },
  // EDUCATION
  { keyword: "coursera", expectedCategory: "software" },
  { keyword: "udemy", expectedCategory: "software" },
  { keyword: "skillshare", expectedCategory: "software" },
  { keyword: "duolingo", expectedCategory: "software" },
  // ENTERTAINMENT
  { keyword: "amc", expectedCategory: "entertainment" },
  { keyword: "ticketmaster", expectedCategory: "entertainment" },
  { keyword: "epic games", expectedCategory: "entertainment" },
  { keyword: "playstation store", expectedCategory: "entertainment" },
  // SHOPPING
  { keyword: "amazon", expectedCategory: "shopping" },
  { keyword: "walmart", expectedCategory: "shopping" },
  { keyword: "target", expectedCategory: "shopping" },
  { keyword: "best buy", expectedCategory: "shopping" },
  { keyword: "ebay", expectedCategory: "shopping" },
  { keyword: "etsy", expectedCategory: "shopping" },
];

// ─── Seed lookup ──────────────────────────────────────────────────────────────

const seedIndex = new Map<string, string>(
  RULE_SEED_ENTRIES.map((e) => [e.merchantKeyPattern, e.category]),
);

// ─── Coverage check ───────────────────────────────────────────────────────────

type Report = {
  keyword: string;
  expectedCategory: string;
  found: boolean;
  foundCategory: string | undefined;
  categoryMatch: boolean;
};

const reports: Report[] = DELETED_RULES.map((rule) => {
  const normalized = rule.keyword.trim().toLowerCase();
  // Exact match first
  if (seedIndex.has(normalized)) {
    const foundCategory = seedIndex.get(normalized);
    return {
      keyword: rule.keyword,
      expectedCategory: rule.expectedCategory,
      found: true,
      foundCategory,
      categoryMatch: foundCategory === rule.expectedCategory,
    };
  }
  // Substring match — keyword is a prefix/sub of a seed entry
  for (const [seedKey, cat] of seedIndex) {
    if (seedKey.startsWith(normalized) || seedKey === normalized) {
      return {
        keyword: rule.keyword,
        expectedCategory: rule.expectedCategory,
        found: true,
        foundCategory: cat,
        categoryMatch: cat === rule.expectedCategory,
      };
    }
  }
  return {
    keyword: rule.keyword,
    expectedCategory: rule.expectedCategory,
    found: false,
    foundCategory: undefined,
    categoryMatch: false,
  };
});

// ─── Output ───────────────────────────────────────────────────────────────────

const missing = reports.filter((r) => !r.found);
const categoryMismatch = reports.filter((r) => r.found && !r.categoryMatch);
const passing = reports.filter((r) => r.found && r.categoryMatch);

console.log(`\n=== Rule-Seed Coverage Report ===`);
console.log(`Total deleted rules checked : ${DELETED_RULES.length}`);
console.log(`Covered + category matches  : ${passing.length}`);
console.log(`Category mismatches         : ${categoryMismatch.length}`);
console.log(`Missing from seed           : ${missing.length}`);

if (categoryMismatch.length > 0) {
  console.log("\n--- Category mismatches ---");
  for (const r of categoryMismatch) {
    console.log(`  "${r.keyword}": expected=${r.expectedCategory}, got=${r.foundCategory}`);
  }
}

if (missing.length > 0) {
  console.log("\n--- Missing from seed (action required) ---");
  for (const r of missing) {
    console.log(`  "${r.keyword}" (expected: ${r.expectedCategory})`);
  }
  console.log("\n[FAIL] Some deleted rules are not covered by rule-seed entries.");
  process.exit(1);
} else {
  console.log("\n[PASS] All deleted rules are covered by rule-seed entries.");
}
