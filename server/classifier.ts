/**
 * Rules-based transaction classifier (structural keywords only).
 * Merchant-specific keywords have been migrated to classifierRuleMigration.ts
 * and are seeded into the merchant cache via classifyPipeline Phase 1.8.
 */
import type { V1Category } from "../shared/schema.js";
import { getDirectionHint, isDebitCardDescription, normalizeMerchant } from "./transactionUtils.js";

const TRANSFER_KEYWORDS = [
  "transfer",
  "xfer",
  "zelle",
  "venmo",
  "cash app",
  "cashapp",
  "wire",
  "paypal",
  "apple pay",
  "google pay",
  "samsung pay",
  "peer transfer",
  "p2p",
  "remittance",
  "western union",
  "moneygram",
  "wise transfer",
  "revolut",
  "mobile deposit",
  "edeposit",
  "e-deposit",
  "mobile check deposit",
  "remote deposit",
];

const P2P_DEBIT_EXEMPT: ReadonlySet<string> = new Set([
  "cash app",
  "cashapp",
  "venmo",
  "zelle",
]);

export type ClassificationResult = {
  transactionClass: "income" | "expense" | "transfer" | "refund";
  flowType: "inflow" | "outflow";
  category: V1Category;
  recurrenceType: "recurring" | "one-time";
  recurrenceSource: "none" | "hint" | "detected";
  merchant: string;
  labelSource: "rule";
  labelConfidence: number;
  labelReason: string;
  aiAssisted: boolean;
};

type CategoryRule = {
  category: V1Category;
  keywords: string[];
  confidence: number;
  transactionClass?: "expense" | "income";
  recurrenceType?: "recurring" | "one-time";
};

// Structural keyword rules — describes the *form* of the transaction, not a brand.
// Merchant-specific entries live in classifierRuleMigration.ts (rule-seed cache).
const CATEGORY_RULES: CategoryRule[] = [
  // Debt — generic debt phrases (must come before housing/utilities to override transfers)
  {
    category: "debt",
    transactionClass: "expense",
    keywords: [
      "loan payment", "loan repayment", "personal loan", "student loan", "auto loan",
      "car payment", "car loan", "vehicle loan", "vehicle payment", "auto payment",
      "mortgage payment", "home loan", "heloc",
      "credit card payment", "credit card pymt", "transfer to credit card",
      "payment to credit card", "card payment",
      "payment to loan", "payment to auto", "payment to mortgage",
      "transfer to loan", "transfer to auto", "transfer to mortgage",
    ],
    confidence: 0.92,
  },

  // Bank fees — ATM, NSF, account maintenance (specific markers before the broad "fee" rule)
  {
    category: "fees",
    transactionClass: "expense",
    keywords: [
      "atm withdrawal", "cash withdrawal", "atm/cash",
      "nsf fee", "overdraft fee", "monthly fee", "service charge", "maintenance fee",
    ],
    confidence: 0.88,
  },

  // Insurance — generic keyword only; named carriers are in rule-seed
  { category: "insurance", keywords: ["insurance"], confidence: 0.9 },

  // Housing — structural terms; named servicers/retailers are in rule-seed
  {
    category: "housing",
    keywords: [
      "rent", "mortgage", "hoa", "homeowner", "property tax", "landlord", "apartment",
      "realty", "real estate", "property management",
      "maintenance", "pest control", "lawn", "landscaping", "cleaning service", "maid",
      "loan servicing", "mtg pymt", "mortgage pymt",
    ],
    confidence: 0.8,
  },

  // Utilities — structural terms; named providers are in rule-seed
  {
    category: "utilities",
    keywords: [
      "electric", "electricity", "water bill", "water dept", "water utility",
      "gas co", "gas company", "natural gas", "sewer",
      "utility", "utilities", "power", "energy",
      "internet", "broadband", "phone bill", "cell phone", "wireless bill",
      "trash", "recycling", "propane",
    ],
    confidence: 0.85,
  },

  // Travel — generic terms; named airlines/hotels/booking sites are in rule-seed
  { category: "travel", keywords: ["airline", "airways", "hotel"], confidence: 0.85 },

  // Gas — structural terms; named stations are in rule-seed
  { category: "gas", keywords: ["gas station", "fuel", "gasoline", "petrol"], confidence: 0.85 },

  // Parking — structural term; named apps are in rule-seed
  { category: "parking", keywords: ["parking", "park & ride"], confidence: 0.85 },

  // Auto — structural terms + major rideshare (Uber/Lyft are generic rideshare proxies)
  {
    category: "auto",
    keywords: [
      "uber", "lyft", "taxi", "cab ", "rideshare",
      "toll", "e-zpass", "ezpass", "fastrak", "sunpass",
      "metro", "subway train", "bart ", "mta ", "transit", "bus pass", "train ticket",
      "car wash", "auto parts", "oil change", "tire", "auto repair",
      "brake", "mechanic", "dealership", "dmv", "motor vehicle", "vehicle registration",
      "towing", "roadside assistance", "aaa ",
    ],
    confidence: 0.8,
  },

  // Groceries — generic terms; named chains are in rule-seed
  { category: "groceries", keywords: ["grocery", "supermarket"], confidence: 0.85 },

  // Coffee — structural terms; named chains are in rule-seed
  { category: "coffee", keywords: ["coffee shop", "cafe ", "espresso"], confidence: 0.85 },

  // Dining — structural food/venue terms; named chains are in rule-seed
  {
    category: "dining",
    keywords: [
      "restaurant", "pizza", "burger", "grill ", "kitchen", "bakery",
      "sushi", "thai food", "chinese food", "indian food", "pho", "ramen",
      "diner", "bar & grill", "pub ", "tavern", "bistro", "brasserie",
      "trattoria", "cantina", "taproom", "brew pub", "bbq", "barbeque",
      "steakhouse", "seafood", "wings", "noodle", "taqueria", "burrito", "wrap",
      "smoothie", "juice bar", "boba", "donut", "bagel", "deli", "sandwich",
      "sub shop", "catering", "eat ", "snack",
      "toast tab", "toasttab", "olo.com",
    ],
    confidence: 0.8,
  },

  // Medical — structural terms; named pharmacies/labs/clinics are in rule-seed
  {
    category: "medical",
    keywords: [
      "pharmacy", "doctor", "physician", "medical", "hospital",
      "dental", "dentist", "orthodont", "optometry", "optometrist", "vision care",
      "urgent care", "clinic", "therapy", "therapist", "counseling",
      "psychiatry", "psychology", "mental health",
      "lab work", "blood test", "x-ray", "radiology", "surgery", "anesthesia",
      "copay", "co-pay", "prescription", "rx", "vitamin", "supplement", "healthcare",
    ],
    confidence: 0.8,
  },

  // Fitness — structural terms; named chains are in rule-seed
  {
    category: "fitness",
    recurrenceType: "recurring",
    keywords: [
      "gym", "fitness", "pilates", "yoga", "massage", "chiropractor",
      "physical therapy", "rehabilitation",
    ],
    confidence: 0.82,
  },

  // Software — "subscription" is structural; named services are in rule-seed
  { category: "software", recurrenceType: "recurring", keywords: ["subscription"], confidence: 0.9 },

  // Education — institution expenses
  {
    category: "shopping",
    keywords: [
      "tuition", "university", "college", "school fees", "textbook",
      "bookstore", "student fee", "enrollment fee", "campus",
    ],
    confidence: 0.72,
  },

  // Childcare — structural terms; named providers are in rule-seed
  {
    category: "shopping",
    keywords: [
      "daycare", "day care", "childcare", "child care", "babysitter",
      "nanny", "au pair", "preschool", "nursery school", "after school", "summer camp",
    ],
    confidence: 0.78,
  },

  // Charity — generic terms; named organizations are in rule-seed
  {
    category: "shopping",
    keywords: ["donation", "donate", "charity", "charitable", "nonprofit", "non-profit"],
    confidence: 0.68,
  },

  // Fees — broad markers (after the specific bank-fee rule above)
  {
    category: "fees",
    keywords: [
      "fee", "overdraft", "nsf", "non-sufficient", "insufficient fund",
      "late charge", "late fee", "service charge", "annual fee", "maintenance fee",
      "monthly fee", "account fee", "atm fee", "wire fee",
      "foreign transaction", "currency conversion", "cash advance fee",
      "returned check", "stop payment", "penalty", "fine ", "bank charge",
    ],
    confidence: 0.9,
  },

  // Entertainment — structural venue/activity terms; named venues/platforms are in rule-seed
  {
    category: "entertainment",
    keywords: [
      "theatre", "theater", "concert", "bowling", "arcade", "museum",
      "zoo ", "aquarium", "amusement park",
      "golf", "mini golf", "go-kart", "escape room", "laser tag",
      "trampoline", "paintball", "rock climbing",
      "comedy club", "improv", "nightclub", "club cover", "bar tab",
      "karaoke", "billiards", "pool hall",
    ],
    confidence: 0.75,
  },
];

// ─── Compiled rules ────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileKeyword(kw: string): RegExp {
  const trimmed = kw.trim();
  const prefix = /^\w/.test(trimmed) ? "\\b" : "";
  const suffix = /\w$/.test(trimmed) ? "\\b" : "";
  return new RegExp(prefix + escapeRegex(kw) + suffix, "i");
}

type CompiledCategoryRule = Omit<CategoryRule, "keywords"> & {
  keywords: string[];
  compiledPatterns: RegExp[];
};

const COMPILED_RULES: CompiledCategoryRule[] = CATEGORY_RULES.map((rule) => ({
  ...rule,
  compiledPatterns: rule.keywords.map(compileKeyword),
}));

const NON_EXPENSE_CATEGORIES: ReadonlySet<string> = new Set(["transfers", "income", "other"]);
const EXPENSE_CATEGORIES: ReadonlySet<string> = new Set(
  CATEGORY_RULES.map((r) => r.category).filter((c) => !NON_EXPENSE_CATEGORIES.has(c)),
);

const REFUND_KEYWORDS = [
  "refund", "return credit", "credit adj", "reversal", "chargeback", "adjustment cr",
];

const INCOME_KEYWORDS = [
  "deposit", "payment received", "direct dep", "ach credit", "wire from", "invoice",
];

const RECURRING_INCOME_KEYWORDS = [
  "salary", "payroll", "direct deposit", "regular income",
  "benefit", "benefits", "pension", "social security",
  "veteran affairs", "dept. of veterans", "department of veteran", "thrift savings",
];

// ─── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify a single transaction using the v1 12-pass state machine.
 * Takes raw bank description and signed amount (negative = outflow).
 */
export function classifyTransaction(
  rawDescription: string,
  amount: number,
): ClassificationResult {
  const lower = rawDescription.toLowerCase().trim();
  const directionHint = getDirectionHint(rawDescription);
  const cleanedMerchant = normalizeMerchant(rawDescription);

  let transactionClass: ClassificationResult["transactionClass"] =
    amount >= 0 ? "income" : "expense";
  let flowType: "inflow" | "outflow" = amount >= 0 ? "inflow" : "outflow";
  let recurrenceType: "recurring" | "one-time" = "one-time";
  let recurrenceSource: "none" | "hint" | "detected" = "none";
  let category: V1Category = amount >= 0 ? "income" : "other";
  let labelReason = "Initial amount-sign heuristic";
  let matchedRule = false;
  let matchedKeyword = "";
  let labelConfidence = 0.92;

  // Pass 1: Transfer detection — catches Zelle/Venmo/wire/mobile deposit etc.
  // P2P apps on debit cards are exempt so "-dc Cash App*name" stays expense.
  const isDebitCardOutflow = isDebitCardDescription(rawDescription);
  if (TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))) {
    const isP2pCardPayment =
      isDebitCardOutflow &&
      [...P2P_DEBIT_EXEMPT].some((kw) => lower.includes(kw));
    if (!isP2pCardPayment) {
      transactionClass = "transfer";
      category = "other";
    }
  }

  // Pass 2: Refund detection (skipped if transfer)
  if (transactionClass !== "transfer" && REFUND_KEYWORDS.some((kw) => lower.includes(kw))) {
    transactionClass = "refund";
  }

  // Pass 3: Income detection for non-negative amounts
  if (
    transactionClass !== "transfer" &&
    transactionClass !== "refund" &&
    amount >= 0 &&
    INCOME_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    transactionClass = "income";
    category = "income";
  }

  // Pass 3b: Direction-hint correction for unsigned CSV formats
  if (transactionClass === "income" && amount >= 0 && directionHint === "outflow") {
    transactionClass = "expense";
    flowType = "outflow";
    category = "other";
    labelReason = "Direction-hint correction (strong outflow keyword in description)";
  }

  // Pass 4: Standalone "credit" keyword (e.g. "ANNUAL FEE CREDIT")
  const hasIncomeContext = INCOME_KEYWORDS.some((kw) => lower.includes(kw));
  if (
    /(^|\s)credit($|\s)/.test(lower) &&
    amount > 0 &&
    !hasIncomeContext &&
    transactionClass !== "income"
  ) {
    transactionClass = "refund";
  }

  // Pass 5: Transfer direction refinement
  if (transactionClass === "transfer" && directionHint) {
    flowType = directionHint;
  }

  // Pass 6: Merchant rule matching — first rule that matches wins
  for (const rule of COMPILED_RULES) {
    for (let ki = 0; ki < rule.compiledPatterns.length; ki++) {
      if (rule.compiledPatterns[ki]!.test(lower)) {
        const kw = rule.keywords[ki]!;
        category = rule.category;
        matchedKeyword = kw;
        matchedRule = true;
        labelConfidence = rule.confidence;
        labelReason = `Matched rule keyword "${kw}" → ${category}`;

        if (rule.transactionClass) {
          transactionClass = rule.transactionClass;
        } else if (EXPENSE_CATEGORIES.has(rule.category) && transactionClass === "income") {
          transactionClass = "expense";
        }

        if (transactionClass === "expense") flowType = "outflow";
        else if (transactionClass === "income") flowType = "inflow";

        if (rule.recurrenceType) recurrenceType = rule.recurrenceType;
        break;
      }
    }
    if (matchedRule) break;
  }

  // Pass 8: Recurring subscription heuristic (description-level keywords)
  if (recurrenceType === "one-time" && transactionClass !== "transfer" && transactionClass !== "refund") {
    if (
      lower.includes("subscription") ||
      lower.includes("monthly") ||
      lower.includes("recurring") ||
      lower.includes("membership")
    ) {
      recurrenceType = "recurring";
      recurrenceSource = "hint";
    }
  }

  // Pass 9: Recurring income keywords (payroll, pension, etc.)
  if (recurrenceType === "one-time" && transactionClass === "income") {
    if (RECURRING_INCOME_KEYWORDS.some((kw) => lower.includes(kw))) {
      recurrenceType = "recurring";
      recurrenceSource = "hint";
    }
  }

  // Pass 11: Income category lock
  if (transactionClass === "income") {
    category = "income";
    flowType = "inflow";
  }

  // Pass 12: aiAssisted flag — true when no specific rule or recurring signal fired
  const aiAssisted =
    !matchedRule &&
    recurrenceType === "one-time" &&
    !directionHint &&
    transactionClass !== "transfer" &&
    transactionClass !== "refund";

  if (!matchedRule) {
    labelConfidence = aiAssisted ? 0.55 : 0.75;
    labelReason = aiAssisted
      ? "No strong merchant or recurrence rule matched"
      : `Amount-sign heuristic → ${category}`;
  }

  // Suppress unused-variable warning; matchedKeyword is used in labelReason above
  void matchedKeyword;

  return {
    transactionClass,
    flowType,
    category,
    recurrenceType,
    recurrenceSource,
    merchant: cleanedMerchant,
    labelSource: "rule",
    labelConfidence,
    labelReason,
    aiAssisted,
  };
}
