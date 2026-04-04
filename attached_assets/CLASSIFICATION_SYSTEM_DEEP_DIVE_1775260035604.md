# PocketPulse — Classification System: Deep Dive

**Purpose:** This document explains the full transaction classification pipeline in detail — not just what each piece of code does, but *why* each design decision was made, what problems it solves, and what would break without it. Use this as the authoritative reference for rebuilding the system in a new project.

---

## Table of Contents

1. [The Core Problem](#1-the-core-problem)
2. [The Data Model for a Classified Transaction](#2-the-data-model-for-a-classified-transaction)
3. [Stage 0: Amount Derivation (Before Classification)](#3-stage-0-amount-derivation-before-classification)
4. [Stage 1: Rule-Based Classifier](#4-stage-1-rule-based-classifier)
5. [Stage 2: Batch Recurrence Detection](#5-stage-2-batch-recurrence-detection)
6. [Stage 3: LLM Enrichment (Optional)](#6-stage-3-llm-enrichment-optional)
7. [Stage 4: User Corrections (Permanent Overrides)](#7-stage-4-user-corrections-permanent-overrides)
8. [The aiAssisted Flag — The Escalation Signal](#8-the-aiassisted-flag--the-escalation-signal)
9. [The labelSource Field — Audit Trail](#9-the-labelsource-field--audit-trail)
10. [The labelConfidence Field](#10-the-labelconfidence-field)
11. [How the Reprocess Flow Works](#11-how-the-reprocess-flow-works)
12. [Why This Architecture Worked](#12-why-this-architecture-worked)
13. [Worked Examples](#13-worked-examples)
14. [Complete Keyword Reference](#14-complete-keyword-reference)
15. [Pitfalls and Edge Cases](#15-pitfalls-and-edge-cases)

---

## 1. The Core Problem

Bank CSV exports are the worst kind of structured data. Every bank formats them differently. A single transaction might be described as any of:

```
SQ *STARBUCKS #12345 SAN DIEGO CA
TST* STARBUCKS
STARBUCKS STORE 00223421
CHECKCARD STARBUCKS 11/02
```

All four of those are the same Starbucks purchase. The classifier has to:

1. Figure out the **merchant** (clean, human-readable name)
2. Decide the **transaction class** — is this income, an expense, a transfer, or a refund?
3. Decide the **category** — what kind of expense? groceries? dining? utilities?
4. Decide **recurrence** — does this happen every month or is it a one-time thing?
5. Do all of this without looking at any other transactions — just from the raw description and the amount

The pipeline is designed to answer these four questions in a specific order, using the most reliable signal available at each step, and escalating to more expensive (LLM) or more contextual (batch recurrence) methods only when simpler ones fail.

---

## 2. The Data Model for a Classified Transaction

Every transaction stored in the database carries these classification fields:

| Field | Type | What it means |
|---|---|---|
| `merchant` | string | Cleaned, human-readable merchant name |
| `flowType` | `"inflow" \| "outflow"` | Which direction did money move? |
| `transactionClass` | `"income" \| "expense" \| "transfer" \| "refund"` | What kind of transaction is this? |
| `recurrenceType` | `"recurring" \| "one-time"` | Does this happen every month? |
| `category` | enum (16 values) | What spending/income category? |
| `labelSource` | `"rule" \| "llm" \| "manual"` | What assigned the label? |
| `labelConfidence` | `"0.00"–"1.00"` | How confident is the labeler? |
| `labelReason` | string | Human-readable explanation |
| `aiAssisted` | boolean | Did the AI layer touch this? |
| `userCorrected` | boolean | Did a human manually correct this? |

The most important insight here is that **the classification fields and the metadata fields are inseparable**. Every label change must update `labelSource`, `labelConfidence`, and `labelReason` together. This audit trail is what allows the UI to show users exactly *why* a transaction was labeled the way it was, and it's what allows the reprocessing system to know which labels are protected.

---

## 3. Stage 0: Amount Derivation (Before Classification)

**File:** `server/transactionUtils.ts`, function `deriveSignedAmount()`

Before any classification can happen, the system needs to know **how much money moved and in which direction**. This sounds trivial but it isn't — different banks format this completely differently.

### The Problem with Bank CSV Formats

There are four common patterns in the wild:

**Pattern 1: Single signed amount column**
```
Date,Amount,Description
2024-01-15,-45.00,STARBUCKS
2024-01-16,2500.00,PAYROLL DIRECT DEPOSIT
```
Negative = outflow, positive = inflow. Straightforward.

**Pattern 2: Split credit/debit columns**
```
Date,Debit,Credit,Description
2024-01-15,45.00,,STARBUCKS
2024-01-16,,2500.00,PAYROLL DIRECT DEPOSIT
```
Here amounts are always positive. The column tells you direction.

**Pattern 3: Single amount with a direction indicator column**
```
Date,Amount,Type,Description
2024-01-15,45.00,DEBIT,STARBUCKS
2024-01-16,2500.00,CREDIT,PAYROLL DIRECT DEPOSIT
```

**Pattern 4: All amounts positive, direction only in the description**
```
Date,Amount,Description
2024-01-15,45.00,POS PURCHASE STARBUCKS
2024-01-16,2500.00,ACH CREDIT PAYROLL
```
This is the messiest. Some banks (notably some credit unions) use this format.

### The Derivation Priority Chain

`deriveSignedAmount()` resolves these in a strict priority order. **The reason for strict priority is that if you try to use multiple signals simultaneously you get conflicts. The most reliable signal wins, always.**

```
Priority 1: Split credit/debit columns
  → If creditAmount > 0: amount = +|credit|, ambiguous = false
  → If debitAmount > 0: amount = -|debit|, ambiguous = false
  → WHY: Explicit column separation is the most unambiguous signal possible.
     You literally cannot misread a separate "Credit" column.

Priority 2: Direction indicator column
  → If indicator contains "credit", "cr", "deposit", "inflow", "incoming", "received":
     amount = +|rawAmount|, ambiguous = false
  → If indicator contains "debit", "dr", "withdrawal", "charge", "payment", "outflow":
     amount = -|rawAmount|, ambiguous = false
  → WHY: An explicit direction indicator is nearly as reliable as split columns.
     Banks that use this format (e.g., some bank-of-america exports) are consistent.

Priority 3: Negative sign on the amount
  → If rawAmount < 0: amount = rawAmount, ambiguous = false
  → WHY: A negative sign is intentional. Banks only use it when they mean outflow.
     NOTE: Positive amounts in a single-column format are NOT trusted alone here.
     A positive amount could mean inflow OR it could mean the bank shows all
     amounts as positive and uses descriptions to indicate direction.
     That's why positive-only single-column falls through to heuristics.

Priority 4: Description/type heuristics
  → Scans rawDescription + typeHint against known patterns
  → Returns "inflow" or "outflow", sets ambiguous = true
  → WHY: If we got here, the amount alone doesn't tell us direction.
     The description often contains strong signals like "POS", "ACH DEBIT",
     "DIRECT DEPOSIT", "TRANSFER FROM". These are reliable but not certain,
     so we flag this result as ambiguous = true.

Priority 5: Fallback
  → amount = rawAmount as-is, ambiguous = (rawAmount >= 0)
  → WHY: We have no information. We just use the raw value. Any non-negative
     amount is flagged ambiguous because we genuinely don't know.
```

### Why ambiguous = true Matters

When `ambiguous = true`, it gets OR'd into the `aiAssisted` flag on the final transaction:
```typescript
aiAssisted: classification.aiAssisted || amountResult.ambiguous
```

This means the LLM labeler (Stage 3) will review this transaction. Even if the rule-based classifier gave it a good label, the fact that we're uncertain about the amount's direction means we want a second opinion.

### The Direction Hint Patterns

`getDirectionHint()` uses three tiers of patterns with specific logic behind each:

**Tier 1: Strong outflow patterns (checked first)**
```
\btransfer to\b, \bpayment to\b, \bach debit\b, \bpos\b,
\bpurchase\b, \bwithdrawal\b, \bwithdraw\b, \batm fee\b,
\batm\b, \bbill pay\b, \bautopay\b, \bdebit\b
```
WHY: These are unambiguous operational bank terms. "POS" (point of sale), "ACH DEBIT", "withdrawal" only appear in outflow contexts. We check outflow first because misidentifying an expense as income is worse than the reverse.

**Tier 2: Inflow patterns (checked second)**
```
\btransfer from\b, \bach credit\b, \bdirect deposit\b, \bdeposit\b,
\bsalary\b, \bpayroll\b, \bpayment received\b, \bwire from\b,
\bincoming\b, \brefund\b, \breversal\b, \breturn\b, \badjustment - credit\b
```
WHY: "Transfer FROM" vs "Transfer TO" is critical — both contain "transfer" but mean opposite things. Checking outflow patterns first means "transfer to" will be caught before the "transfer" fragment in "transfer from" creates confusion at a higher level.

**Tier 3: Merchant-based outflow patterns (weakest signal)**
```
\bloan\b, \bmortgage\b, \bdoordash\b, \bamazon\b, \bstarbucks\b,
\bvons\b, \bchevron\b, \bopenai\b, \bapple\b, \badobe\b, etc.
```
WHY: If we see a well-known merchant name in the description and still don't know the direction, we default to assuming it's an expense. You never receive money FROM Starbucks.

---

## 4. Stage 1: Rule-Based Classifier

**File:** `server/classifier.ts`, function `classifyTransaction(rawDescription, amount)`

This is the heart of the system. It runs on every single transaction, one row at a time, using only the raw description string and the derived amount.

### Why Rule-Based First?

The temptation when building a classification system is to go straight to ML or LLM. There are several strong reasons not to:

1. **Speed**: Rules run in microseconds. Processing a 1,000-row CSV should take under a second. An LLM call adds 1–5 seconds of latency per batch.
2. **Cost**: Every LLM call costs money. If rules can correctly label 80% of transactions, that's 80% cost savings.
3. **Predictability**: Rules always produce the same output for the same input. You can unit test them. LLMs are non-deterministic.
4. **Auditability**: When a rule fires, you know exactly why. The `labelReason` field records the specific keyword that matched.
5. **Small business reality**: A small business's transactions are highly repetitive. The same utilities, subscriptions, and payroll entries appear every month. A modest ruleset covers the vast majority.

### The Classification State Machine

The classifier maintains a set of mutable variables and walks through a series of passes, each one potentially overwriting the previous output. Understanding the **order of the passes** is critical — it's not arbitrary.

```typescript
// Initial defaults — set before any pass runs
let transactionClass = amount >= 0 ? "income" : "expense"
let flowType = flowTypeFromAmount(amount)
let recurrenceType = "one-time"
let category = amount >= 0 ? "income" : "other"
let labelReason = "Initial amount-sign heuristic"
let aiAssisted = false
```

**The starting defaults encode the simplest assumption**: positive amounts are income, negative amounts are expenses, nothing is known to be recurring. Everything that follows either confirms or overrides this.

---

#### Pass 1: Transfer Detection

```typescript
const TRANSFER_KEYWORDS = [
  "transfer", "xfer", "ach transfer", "wire transfer",
  "zelle", "venmo transfer"
]
```

If any of these appear in the description: `transactionClass = "transfer"`, `category = "transfers"`.

**Why this goes first:**

Transfers are the most critical edge case for cashflow analysis. If a user transfers $5,000 from their checking account to savings and we label it as "income" and "expense" on both sides, their Safe-to-Spend metric will be wildly wrong — it'll look like they spent $5,000 when they didn't. Transfers need to be identified *before* any other classification happens.

**Why "transfer" alone (not "transfer from" or "transfer to"):**

At this stage we just need to know it's a transfer. The direction handling for transfers happens in `getDirectionHint()` which uses the more specific patterns. The broader keyword here is intentional — it catches everything first.

**Why zelle and venmo?**

These are person-to-person payment apps. Banks typically show them as "ZELLE PAYMENT TO [NAME]" or "VENMO TRANSFER". They look like expenses on the surface but the user may have sent money to themselves. Flagging them as transfers lets the UI give the user the option to reclassify rather than silently counting them as expenses.

---

#### Pass 2: Refund Detection

```typescript
const REFUND_KEYWORDS = [
  "refund", "return", "reversal", "chargeback",
  "adjustment - credit", "credit adjustment"
]
```

Only runs if `transactionClass !== "transfer"` (a transfer cannot also be a refund).

**Why separate from income?**

A refund is not income — it's a correction of a previous expense. If a user bought $200 of tools on Amazon and returned half, the refund is not revenue. Including it in `totalInflows` would inflate their income metrics. By keeping refunds as their own class, the cashflow engine can exclude them from all income/expense summaries:

```typescript
if (tx.transactionClass === "transfer" || tx.transactionClass === "refund") {
  continue; // Skip both in all cashflow calculations
}
```

**The "return" keyword consideration:**

"Return" is a broad word. A bank might show a grocery return as "RETURN VONS 04/15". But "return" could also appear in unrelated contexts. In practice, for bank statement descriptions, "return" almost exclusively appears in refund/return contexts. The tradeoff of occasional false positives is worth catching the common case.

---

#### Pass 3: Income Detection

```typescript
const INCOME_KEYWORDS = [
  "deposit", "payment received", "direct dep",
  "ach credit", "wire from", "invoice"
]
```

Only runs if not already `"transfer"` or `"refund"`, AND only when `amount >= 0`.

**Why require amount >= 0?**

The `deposit` keyword can appear in ambiguous contexts. Some banks show a fee reversal as "FEE REVERSAL DEPOSIT". If the amount came through as negative for some reason (e.g., a credit that got parsed as negative due to unusual CSV formatting), we don't want to label it income. The non-negative guard prevents that.

**Why "ach credit" here AND in the direction hints?**

The direction hint system (`getDirectionHint()`) is used for determining amount sign *before* classification. Once we have a signed amount and arrive at the classifier, seeing "ach credit" in the description is a strong signal that this is deliberate income (not just a refund or account correction). It's safe to repeat the signal at both stages because they're answering different questions: "which direction?" vs "what kind of transaction?"

---

#### Pass 4: Standalone "Credit" Keyword

```typescript
if (/(^|\s)credit($|\s)/.test(lower) && amount > 0 && !hasIncomeContext && transactionClass !== "income") {
  transactionClass = "refund"
}
```

This pass handles a specific bank formatting pattern. Some banks use the word "CREDIT" by itself to indicate a credit to the account:
```
CREDIT ADJUSTMENT
CREDIT MEMO
ANNUAL FEE CREDIT
```

**Why not income?**

When a bank says "CREDIT" without any income context (no payroll, deposit, invoice language), it's almost always a one-time correction — a refund of a fee, a promotional credit, a billing adjustment. These are not revenue. Labeling them as refunds (rather than income) keeps them out of the recurring income baseline, which is what drives the Safe-to-Spend metric.

**Why the word-boundary regex `(^|\s)credit($|\s)`?**

"Credit card" contains the word "credit" but is absolutely not a credit to the account — it's a payment. The regex requires credit to appear as an isolated word (preceded and followed by whitespace or start/end of string). This prevents "credit card payment" from triggering this pass.

**Why check `!hasIncomeContext`?**

Before this pass runs, we check whether the description also contains income-type keywords. "ACH CREDIT DIRECT DEPOSIT PAYROLL" has both "credit" and "direct deposit". We don't want the standalone-credit rule to override the already-correct income classification. The income context check prevents that downgrade.

---

#### Pass 5: Transfer Direction Refinement

```typescript
const directionHint = getDirectionHint(rawDescription)
if (transactionClass === "transfer" && directionHint) {
  flowType = directionHint
}
```

Transfers detected in Pass 1 need their `flowType` set. Since transfers don't change the user's overall wealth, the flow direction matters for display purposes but not for cashflow math. However, we want to show it correctly in the ledger. "TRANSFER TO SAVINGS" should show as an outflow even though it's labeled as a transfer.

---

#### Pass 6: Merchant Rule Matching

```typescript
for (const { keyword, rule } of MERCHANT_RULES) {
  if (lower.includes(keyword)) {
    merchant = rule.merchant
    category = rule.category
    if (rule.transactionClass) transactionClass = rule.transactionClass
    if (rule.recurrenceType) recurrenceType = rule.recurrenceType
    labelReason = `Matched merchant rule: ${keyword}`
    break // First match wins
  }
}
```

This is the largest single data structure in the classifier — 90+ entries mapping keyword substrings to merchant metadata.

**Why keyword substring matching instead of exact matching?**

Bank descriptions are never clean exact names. "AMAZON.COM AMZN.COM/BILL WA" contains "amazon" but is not exactly "amazon". Substring matching on lowercase handles all these variations.

**Why first match wins?**

The rules are ordered from most specific to least specific. `"amazon web services"` appears before `"amazon"` because "amazon web services" is more specific — if we matched `"amazon"` first, AWS would be miscategorized as shopping. The ordering is intentional and important.

**Why do some merchant rules set `transactionClass` explicitly?**

Look at the debt rules:
```typescript
{ keyword: "loan payment", rule: { merchant: "Loan Payment", category: "debt",
  recurrenceType: "recurring", transactionClass: "expense" } }
{ keyword: "credit card", rule: { merchant: "Credit Card Payment", category: "debt",
  recurrenceType: "recurring", transactionClass: "expense" } }
```

A loan payment or credit card payment might appear as a positive amount in some bank formats (because the bank is showing it from the perspective of "you paid toward your debt"). Without the explicit `transactionClass: "expense"` override, a positively-signed loan payment would be classified as income. Certain merchants need both category AND class locked down regardless of amount sign.

**Why does category default to "other" for expense transactions and "income" for positive ones?**

The initial defaults only set category to `"income"` for positive-amount transactions. All expenses start as `"other"`. Merchant rules then override this. The `"other"` fallback is intentional — it's better to have a transaction labeled `"other"` than to wrongly assign it to a specific category. The user can always correct it in the ledger.

**Why do some merchant rules omit `recurrenceType`?**

Dining merchants (Starbucks, DoorDash) and grocery/retail merchants (Costco, Amazon, Target) don't have `recurrenceType` set. That's because these purchases are genuinely one-time — there's no reason to assume a Starbucks visit happens on a monthly cadence. If Starbucks does show up regularly, the recurrence detector (Stage 2) will catch it from the pattern data.

---

#### Pass 7: Category Keyword Fallback

```typescript
if (category === "other") {
  for (const { keyword, category: matchedCategory } of CATEGORY_KEYWORDS) {
    if (lower.includes(keyword)) {
      category = matchedCategory
      break
    }
  }
}
```

This only runs if the category is still `"other"` after the merchant pass. It's a broader sweep — general keywords like `"fee"`, `"pharmacy"`, `"grocery"`, `"subscription"` that might appear in descriptions that didn't match any specific merchant rule.

**Why run this after merchant rules?**

Merchant rules are more specific and more trustworthy. If we already have `category = "business_software"` from a Slack match, we don't want a stray keyword to override it. The `category === "other"` guard ensures this pass only fills in gaps.

---

#### Pass 8: Recurring Subscription Heuristic

```typescript
if (recurrenceType === "one-time" && transactionClass !== "transfer" && transactionClass !== "refund") {
  if (lower.includes("subscription") || lower.includes("monthly") ||
      lower.includes("recurring") || lower.includes("membership")) {
    recurrenceType = "recurring"
  }
}
```

If the description literally contains the word "subscription", "monthly", "recurring", or "membership" — and we haven't already identified it as a transfer or refund — it's recurring.

**Why this is separate from the merchant rules:**

Banks sometimes add these words as qualifiers in the description. "ADOBE CREATIVE CLOUD MONTHLY" might be caught by the Adobe merchant rule (which sets recurring) but "HOBBY LOBBY ANNUAL MEMBERSHIP FEE" would not match any merchant rule. This pass catches the general case.

---

#### Pass 9: Recurring Income Detection

```typescript
if (recurrenceType === "one-time" && transactionClass === "income") {
  for (const keyword of RECURRING_INCOME_KEYWORDS) {
    if (lower.includes(keyword)) {
      recurrenceType = "recurring"
      break
    }
  }
}
```

```typescript
const RECURRING_INCOME_KEYWORDS = [
  "salary", "payroll", "direct deposit", "regular income",
  "benefit", "benefits", "pension", "social security",
  "veteran affairs", "dept. of veterans", "department of veteran", "thrift savings"
]
```

This pass specifically handles the most important income signal: payroll and government benefits. These are the backbone of the Safe-to-Spend calculation.

**Why is this income-specific?**

`recurrenceType` detection for expenses relies heavily on knowing *which* expense recurs — that's what the merchant rules handle. But income is different. You don't need to know it's from "specific employer X" to know it recurs — the presence of "payroll" or "direct deposit" is almost always a reliable recurring income signal regardless of the source.

**Why the veterans/social security entries?**

This application was built for small business owners, many of whom have diverse income sources including government benefits. "DEPT. OF VETERANS AFFAIRS" and "SOCIAL SECURITY" appear verbatim in bank descriptions and are definitively recurring income.

---

#### Pass 10: Transfer Reclassification

```typescript
if (transactionClass === "transfer") {
  transactionClass = amount >= 0 ? "income" : "expense"
  if (amount >= 0) {
    category = "income"
  } else if (category === "transfers") {
    category = "other"
  }
}
```

This is one of the most deliberate design decisions in the whole classifier. After all the passes, if a transaction is still classified as `"transfer"`, it gets reclassified to `"income"` or `"expense"` based on amount sign.

**Why?**

For cashflow analysis, transfers in their raw form are useless. A transfer OUT looks like an expense and a transfer IN looks like income — but they cancel each other out if the user's accounts are all in the same workspace. However, not all users upload data from both sides of a transfer. If only the outgoing side is uploaded, it *should* count as an expense for the period.

The decision was made to treat transfers pragmatically: positive transfers = income-like, negative transfers = expense-like. The `category` is set to `"income"` for positive transfers and `"other"` for negative ones (since "other" is more honest than a specific category when we don't know the purpose).

This means "TRANSFER TO SAVINGS $5,000" will show as a $5,000 expense in the ledger — which might surprise users who expect to filter transfers separately. The UI's category filter lets users filter by `"transfers"` category to review these, and they can manually reclassify if needed.

---

#### Pass 11: Income Category Lock

```typescript
if (transactionClass === "income") {
  category = "income"
}
```

After all the passes, if we ended up with `transactionClass === "income"`, the category must be `"income"`. This prevents edge cases where an income transaction ended up with a non-income category (e.g., a refund reclassified as income might have retained its original merchant category).

---

#### Pass 12: aiAssisted Flag Assignment

```typescript
if (
  merchant === cleanMerchant(rawDescription) &&
  recurrenceType === "one-time" &&
  !directionHint
) {
  aiAssisted = true
  labelReason = "No strong merchant or recurrence rule matched"
}
```

This is the ambiguity detector — the three conditions that together mean "we don't really know what this is".

**Condition 1: `merchant === cleanMerchant(rawDescription)`**

If the merchant name is still just the cleaned version of the raw description (no specific merchant rule matched), we didn't recognize this merchant.

**Condition 2: `recurrenceType === "one-time"`**

No recurring signals were found. This is the default — if nothing elevated it to recurring, it stayed one-time.

**Condition 3: `!directionHint`**

No strong directional language was found in the description (no "transfer to", "ACH DEBIT", "direct deposit" etc.)

All three conditions together mean: "we processed this through the entire rule system and nothing specific matched". This is genuinely ambiguous data — the LLM has a real chance of doing better.

**The confidence values:**

```typescript
labelConfidence: aiAssisted ? "0.55" : "0.92"
```

- `0.92` for rule-matched: Not `1.00` because rules can be wrong, but high confidence
- `0.55` for ambiguous: Just above random chance (0.50) — we have some signal from the amount sign but not much else

---

## 5. Stage 2: Batch Recurrence Detection

**File:** `server/recurrenceDetector.ts`, function `detectMonthlyRecurringPatterns()`

This stage runs after the classifier has processed all rows. It looks at the entire batch of transactions together — something the single-row classifier cannot do — and identifies monthly repeating patterns.

### Why a Separate Stage?

The rule-based classifier works row-by-row. It can detect recurring merchants it knows about (Netflix, Verizon, mortgage) but it cannot detect *unknown recurring charges*. If a small business pays an accountant $500/month from an account named "JOHNSON & ASSOCIATES CPA 5001", the classifier will label it one-time (no rule matches). But the batch detector will see three months of "$500.00 from JOHNSON & ASSOCIATES CPA 5001" with 28–32 day gaps and mark all three as recurring.

### The Grouping Key

```typescript
const key = [
  normalizeMerchant(candidate.merchant),
  candidate.flowType,
  normalizeAmountToCents(candidate.amount),
].join("::")
```

Three components:
1. **Normalized merchant name** (lowercase, trimmed, whitespace collapsed)
2. **Flow type** (inflow or outflow) — this prevents a $500 deposit and a $500 payment from being grouped together even if they're from the same "merchant"
3. **Amount in cents** (rounded integer) — this prevents a $499.99 charge and a $501.00 charge from being considered the same recurring payment

**Why cents instead of dollars?**

Floating point comparison is unreliable. `500.00 * 100 = 50000` as an integer is safe. Two charges that are truly the same subscription will be for exactly the same amount.

**Why not allow slight amount variation?**

Tested both ways. Allowing 5% variance caused false positives where different transactions from the same merchant (e.g., Amazon orders of different amounts) got grouped as "recurring". The exact-match requirement is stricter but produces cleaner data. Utility bills can vary month-to-month — but utilities are already caught by merchant rules. The cadence detector primarily adds value for unknown fixed-cost subscriptions.

### The Streak Algorithm

```typescript
const sorted = group.sort by date (ascending)
let streakStart = 0

for (let current = 1; current <= sorted.length; current++) {
  const gap = diffInDays(sorted[current-1].date, sorted[current].date)
  
  if (gap is between 25 and 40 days) {
    continue  // Still in a valid monthly streak
  }
  
  // Gap broken or end of array — evaluate the streak
  const streak = sorted.slice(streakStart, current)
  if (streak.length >= 3) {
    // Mark all entries in streak as recurring
  }
  
  streakStart = current
}
```

**Why 25–40 days?**

A calendar month ranges from 28 to 31 days. Billing cycles don't always align perfectly with calendar months — a charge on the 1st one month might process on the 3rd the next month (weekends, holidays). The 25–40 day window covers:
- A short February (28 days) → next charge: 25 days minimum
- Slightly early billing → can be as few as 25 days after last month
- Slightly late billing → up to 40 days is still plausibly monthly

The window is intentionally asymmetric: it's tighter on the low end (can't be less than 25 days between monthly charges) and looser on the high end (up to 40 days handles edge cases without catching truly quarterly charges).

**Why minimum 3 occurrences?**

Two charges that are 30 days apart could be coincidence. Three is enough to establish a pattern with high confidence. Four or five is better but many small business bank statements only go back 90 days, so requiring 4+ would miss many real subscriptions.

**Why the streak break logic (not just "group has 3+ entries")?**

A user might have cancelled and restarted a subscription. If they paid Netflix for 6 months, cancelled, then paid again for 2 months, those 2 recent charges should NOT be marked recurring (the pattern broke). The streak algorithm handles this: if the date gap between two consecutive entries exceeds 40 days, the streak resets. Only continuous streaks of 3+ are marked.

### What userCorrected protects

```typescript
if (candidate.userCorrected) {
  return  // Skip this candidate from grouping
}
```

If a user manually set a transaction to `"one-time"` in the ledger, the recurrence detector skips it entirely. This prevents the detector from overriding a deliberate human decision. If the user says "this Starbucks charge was one-time", we don't want the batch to override that.

---

## 6. Stage 3: LLM Enrichment (Optional)

**File:** `server/llmLabeler.ts`, function `maybeApplyLlmLabels()`

This stage only runs when:
```typescript
process.env.LLM_LABELING_ENABLED === "true" 
&& (ANTHROPIC_API_KEY || OPENAI_API_KEY)
```

### Who Gets Sent to the LLM?

Only transactions where `aiAssisted === true` from Stage 1. Remember, that flag means all three ambiguity conditions were met:
- No specific merchant rule matched
- No recurring signal found
- No direction hint in description

This is deliberate cost control. If rules already classified 80% of transactions with high confidence, there's no point spending money asking an LLM to confirm "yes, this is a Starbucks coffee" — the rule already did that correctly.

### The Prompt Design

```
"You label financial transactions."
"Only relabel ambiguous transactions."
"Return strict JSON with shape: {...}"
"Prefer deterministic categories. Use recurring only when there is a strong reason."
[JSON array of transaction candidates]
```

**Why "Only relabel ambiguous transactions"?**

The current rule-based labels are included in the prompt. This instruction prevents the LLM from deciding it "knows better" than an existing high-confidence rule label. The LLM is supposed to fill gaps, not second-guess confident decisions.

**Why "Prefer deterministic categories"?**

LLMs tend toward hedging. Without this instruction, an ambiguous charge might come back as `"other"` when a reasonable deterministic category exists. Telling the model to prefer deterministic categories pushes it toward actually useful labels.

**Why `temperature: 0`?**

Classification is not a creative task. Higher temperatures introduce randomness into what should be a deterministic inference. `temperature: 0` gives the most reproducible results and avoids cases where the same transaction gets different labels on different runs.

**Why Anthropic first?**

```typescript
if (process.env.ANTHROPIC_API_KEY) {
  return fetchAnthropicLabels(candidates)
}
return fetchOpenAiLabels(candidates)
```

At the time of implementation, Claude 3.5 Haiku showed better cost-to-quality ratio for structured JSON classification tasks than GPT-4o-mini. The code supports either. OpenAI is the fallback. Both implementations are nearly identical except for API format.

### Batch Size of 25

```typescript
for (const batch of chunk(ambiguousIndexes, 25)) {
```

Token limits and response reliability both informed the batch size of 25. Sending more than ~25 transactions per call risks:
1. Hitting context limits for the response JSON
2. The model losing track of index mappings (returning wrong index numbers)
3. Longer latency per request

25 transactions fit comfortably within a 1,200 max_tokens response budget.

### Index Tracking

The prompt includes `"index": 0...N` on each transaction, and the model is required to return the same index in its response. This allows the system to correctly map LLM decisions back to the original transaction array even if the LLM skips some entries or reorders its response.

### Fail-Safe: Empty Map on Any Error

```typescript
try {
  const parsed = llmResponseSchema.parse(JSON.parse(content))
  return new Map(...)
} catch {
  return new Map()  // Silent fallback to rule-based labels
}
```

If the LLM returns malformed JSON, the Zod schema validation fails, or the API call fails — the function returns an empty map. Callers treat an empty map as "no LLM updates available" and use the rule-based labels instead. The LLM is never a point of failure; it's a best-effort enhancement.

---

## 7. Stage 4: User Corrections (Permanent Overrides)

**File:** `server/transactionUtils.ts`, function `buildTransactionUpdate()`

When a user edits a transaction in the Ledger UI, the update is handled specially:

```typescript
return {
  amount: nextAmount.toFixed(2),
  flowType: ...,
  transactionClass: ...,
  recurrenceType: ...,
  category: ...,
  merchant: ...,
  labelSource: "manual",
  labelConfidence: "1.00",
  labelReason: "Confirmed manually in the ledger",
  userCorrected: true,
}
```

**`userCorrected: true` is the most important field.** It is checked at two critical points:

1. **Recurrence detector:** Skips this transaction entirely. No cadence detection will override a manual decision.
2. **Reprocess function:** Skips this transaction entirely. Running "Reprocess All" will not touch user-corrected rows.

**Why `labelConfidence: "1.00"`?**

A human making an explicit decision is perfectly confident by definition. This value is used in the UI to show confidence badges. `1.00` means no badge is shown (it would be redundant for a manually verified row).

**Amount direction is re-normalized on class change:**

```typescript
const shouldUpdateDirection = Boolean(data.transactionClass || data.flowType)
const nextAmount = shouldUpdateDirection
  ? normalizeAmountForClass(parseFloat(transaction.amount), nextClass, data.flowType)
  : parseFloat(transaction.amount)
```

If a user changes `transactionClass` from `"income"` to `"expense"`, the stored amount sign also flips (positive → negative). This keeps the stored amount and the transaction class consistent. The system always stores income as positive and expenses as negative — no exceptions.

---

## 8. The aiAssisted Flag — The Escalation Signal

The `aiAssisted` boolean is set to `true` in two distinct situations:

**From the classifier (Stage 1):**
- No merchant rule matched AND no recurring signal AND no direction hint

**From the amount derivation (Stage 0):**
- Amount direction was determined by heuristic or fallback (not explicit column/indicator/sign)

The final `aiAssisted` on the stored transaction is an OR of both:
```typescript
aiAssisted: classification.aiAssisted || amountResult.ambiguous
```

This flag serves two purposes:
1. **Routing**: Determines which transactions go to the LLM (Stage 3)
2. **UI signal**: The ledger can highlight these rows as "auto-classified with lower confidence" so users know to review them

---

## 9. The labelSource Field — Audit Trail

```typescript
type LabelSource = "rule" | "llm" | "manual"
```

This field records who made the final labeling decision:

- **`"rule"`**: The rule-based classifier made the decision with no subsequent overrides. The most common value.
- **`"llm"`**: The LLM enrichment layer overrode the rule-based label. The `labelReason` explains why.
- **`"manual"`**: A human explicitly set this label in the Ledger UI. Protected from all future automated changes.

The UI uses this in two ways:
1. Shows a ✨ sparkle icon next to LLM-labeled transactions (indicating AI involvement)
2. Shows a "Protected" badge on manually corrected rows
3. The `labelReason` is displayed under the merchant name for LLM and pattern-matched transactions

---

## 10. The labelConfidence Field

```typescript
labelConfidence: aiAssisted ? "0.55" : "0.92"  // from classifier
labelConfidence: label.confidence.toFixed(2)    // from LLM (0.0-1.0)
labelConfidence: "1.00"                         // from user correction
```

Values and their meaning:

| Value | Source | Meaning |
|---|---|---|
| `"1.00"` | User correction | Human-verified, certain |
| `"0.92"` | Rule match | Strong rule matched, high confidence |
| `"0.70"–"0.95"` | LLM | LLM's self-reported confidence on a specific label |
| `"0.55"` | Ambiguous rule | No strong signal, defaulted to amount-sign heuristic |

The UI shows confidence as a percentage badge on LLM-labeled rows. A `0.72` confidence LLM label shows as "72% confidence" in the ledger, giving users a quick sense of how much to trust the label.

---

## 11. How the Reprocess Flow Works

The reprocess endpoint (`POST /api/transactions/reprocess`) re-runs the full pipeline over all existing transactions. This is useful after improving the classifier or after adding new merchant rules.

The flow:
```
1. Load all transactions for the user
2. Skip any where userCorrected === true
3. Re-run classifyTransaction() + deriveSignedAmount() on rawDescription
4. Collect all pending decisions into an array
5. Run maybeApplyLlmLabels() on the full array (LLM sees all ambiguous ones)
6. Run detectMonthlyRecurringPatterns() on the full array (sees the full history)
7. Apply the LLM and recurrence decisions in priority order:
   - If recurrence detector says "recurring" AND LLM didn't already say "recurring":
     → Override to recurring (recurrence detector wins on recurrence type)
   - Otherwise use LLM decision as-is
8. Write updates to database
```

**Why recurrence detector wins over LLM for recurrenceType?**

The recurrence detector works with actual date cadence data from the full transaction history. The LLM only sees a single row's description and amount. The cadence signal (25–40 day gap, 3+ occurrences) is more reliable for recurring detection than LLM inference from a single row's text. So the final merge logic lets the LLM win on `transactionClass` and `category` while the cadence detector wins on `recurrenceType` when it fires.

---

## 12. Why This Architecture Worked

After testing many approaches, this multi-stage pipeline outperformed simpler alternatives for several reasons:

### Why Not Pure LLM?

Tested sending all transactions directly to Claude/GPT. Issues:
- Cost at scale: $0.003–0.01 per batch of 25; a 1,000-row CSV costs $0.12–$0.40 just for labeling
- Latency: LLM calls during upload add 15–60 seconds for large files
- Non-determinism: Two uploads of the same file could produce different labels
- Hallucination risk: LLMs sometimes invent categories or return malformed JSON

### Why Not Pure Rules?

Rules correctly classify ~75–80% of small business transactions. The remaining 20–25% are genuinely novel:
- New/niche merchants not in the rule database
- Regional or industry-specific vendors
- Unusual bank description formats

### Why the Recurrence Detector Separately?

The recurrence detector requires looking at the full batch. You cannot determine monthly cadence from a single row. Separating it from the row-by-row classifier keeps concerns cleanly separated: the classifier answers "what is this transaction?" and the recurrence detector answers "does this type of transaction happen every month?".

### Why User Corrections Are Sacred

Every automated system will make mistakes. The most important guarantee the system makes to users is: **"once you correct something, we will never change it back"**. Without this guarantee, users who invest time correcting labels will see their corrections overwritten on the next reprocess and stop trusting the system.

---

## 13. Worked Examples

### Example 1: Payroll Deposit

**Raw input:**
```
description: "ADP PAYROLL DIRECT DEPOSIT 112233"
amount: +4500.00
```

**Stage 0 — Amount Derivation:**
- `rawAmount = 4500.00` (positive), no split columns, no indicator
- Falls to "heuristic": `getDirectionHint()` matches `\bdirect deposit\b` (INFLOW_HINT_PATTERNS)
- Result: `amount = +4500.00`, `ambiguous = true` (heuristic source)

Wait — why is it `ambiguous = true` here? Because heuristics are not certain even when they fire. The `ambiguous` flag propagates to `aiAssisted` OR. However...

**Stage 1 — Classifier:**
- Initial default: `transactionClass = "income"`, `category = "income"` (amount >= 0)
- Pass 3 (Income detection): `"direct dep"` doesn't match but `"deposit"` does → `transactionClass = "income"`, confirmed
- Pass 9 (Recurring income): `"payroll"` matches RECURRING_INCOME_KEYWORDS → `recurrenceType = "recurring"`
- Pass 11 (Income lock): `category = "income"` confirmed
- Pass 12 (aiAssisted check): merchant is still just cleaned rawDesc, recurrenceType IS "recurring" → condition 2 fails → `aiAssisted = false`

**Final result:**
```
merchant: "Adp Payroll Direct Deposit 112233" (cleaned but no merchant rule matched)
transactionClass: "income"
recurrenceType: "recurring"
category: "income"
labelSource: "rule"
labelConfidence: "0.92"  (aiAssisted was false at check time)
aiAssisted: false (no 3-condition match, recurrenceType = recurring breaks it)
```

Despite `ambiguous = true` from amount derivation, the classifier sets `aiAssisted = false` because the recurrence condition was met. The LLM will not review this. ✓

---

### Example 2: Unknown Vendor (Ambiguous)

**Raw input:**
```
description: "JOHNSON & ASSOC 05012024 REF#44521"
amount: -850.00
```

**Stage 0:** Negative amount, `ambiguous = false`, `source = "signed-amount"`

**Stage 1:**
- Default: `transactionClass = "expense"`, `category = "other"`
- Pass 1–4: No transfer, refund, income, or standalone credit keywords match
- Pass 6 (Merchant rules): No rule matches "johnson"
- Pass 7 (Category keywords): No keyword matches
- Pass 8, 9: No subscription or recurring income keywords
- Pass 12: `merchant === cleanMerchant(rawDesc)` ✓, `recurrenceType === "one-time"` ✓, `!directionHint` ✓ → `aiAssisted = true`, `labelConfidence = "0.55"`

**Stage 2 (if 3 months of this charge exist):**
The recurrence detector finds "johnson & assoc", outflow, 85000 cents, with gaps of 29–31 days across 3 occurrences → marks all three as `recurring`.

**Stage 3 (LLM):**
Sent to LLM. LLM sees: `"JOHNSON & ASSOC 05012024 REF#44521"`, amount -850, currently labeled expense/one-time/other. Returns: `{ transactionClass: "expense", recurrenceType: "one-time", category: "business_software", confidence: 0.68, reason: "Likely professional services or SaaS vendor based on naming pattern" }`

**Stage 3 + Stage 2 merge:**
Recurrence detector said `recurring`, LLM said `one-time`. Recurrence detector wins on recurrenceType: final `recurrenceType = "recurring"`.

**Final result:**
```
transactionClass: "expense"
recurrenceType: "recurring"   (recurrence detector won)
category: "business_software" (LLM won)
labelSource: "llm"
labelConfidence: "0.68"
labelReason: "Likely professional services or SaaS vendor..."
aiAssisted: true
```

---

### Example 3: Credit Card Payment

**Raw input:**
```
description: "PAYMENT TO CHASE CREDIT CARD"
amount: +1200.00
```

Note: Some bank exports show credit card payments as positive (from the credit account's perspective).

**Stage 0:** Positive amount, no split columns, heuristic: `\bpayment to\b` (STRONG_OUTFLOW_HINT_PATTERNS) → `flowType = "outflow"`, `ambiguous = true`

**Stage 1:**
- Default: `transactionClass = "income"` (amount >= 0)
- Pass 1 (Transfer): "transfer" not present. But wait, "payment to" is in STRONG_OUTFLOW_HINT_PATTERNS, not TRANSFER_KEYWORDS. Not caught here.
- Pass 4 (Standalone credit): "credit" matches! But wait — check the regex: `/(^|\s)credit($|\s)/`. Does "credit card" satisfy this? "credit card" — "credit" is followed by " " then "card", not end-of-string. So `credit` IS followed by whitespace... wait let me re-read: `(^|\s)credit($|\s)` — "credit" followed by space → matches. But there's also `!hasIncomeContext` and `transactionClass !== "income"`. `transactionClass` is currently "income" (amount >= 0 default)! → condition `transactionClass !== "income"` fails. Pass 4 does NOT fire.
- Pass 6 (Merchant rules): `"payment to chase"` → matches! Rule: `{ merchant: "Payment To Chase", category: "debt", recurrenceType: "recurring", transactionClass: "expense" }`
  - `transactionClass` overridden to `"expense"`
  - `category = "debt"`
  - `recurrenceType = "recurring"`
- Pass 11: `transactionClass !== "income"` → income lock doesn't fire
- Pass 12: merchant was changed by rule → `merchant !== cleanMerchant(rawDesc)` → condition fails → `aiAssisted = false`

**normalizeAmountForClass:** `transactionClass = "expense"` → amount = -|+1200| = -1200

**Final result:**
```
amount: "-1200.00"
transactionClass: "expense"
recurrenceType: "recurring"
category: "debt"
flowType: "outflow"
labelSource: "rule"
labelConfidence: "0.92"
aiAssisted: false
```

The merchant rule for "payment to chase" correctly handled the positively-signed credit card payment. ✓

---

## 14. Complete Keyword Reference

### Transfer Keywords
`"transfer"`, `"xfer"`, `"ach transfer"`, `"wire transfer"`, `"zelle"`, `"venmo transfer"`

### Refund Keywords
`"refund"`, `"return"`, `"reversal"`, `"chargeback"`, `"adjustment - credit"`, `"credit adjustment"`

### Income Keywords
`"deposit"`, `"payment received"`, `"direct dep"`, `"ach credit"`, `"wire from"`, `"invoice"`

### Recurring Income Keywords
`"salary"`, `"payroll"`, `"direct deposit"`, `"regular income"`, `"benefit"`, `"benefits"`, `"pension"`, `"social security"`, `"veteran affairs"`, `"dept. of veterans"`, `"department of veteran"`, `"thrift savings"`

### Recurring Subscription Trigger Words
`"subscription"`, `"monthly"`, `"recurring"`, `"membership"`

### Merchant Rules (by category)

| Category | Keywords |
|---|---|
| `business_software` | aws, amazon web services, gusto, google cloud, microsoft, slack, github, heroku, netlify, vercel, mailchimp, hubspot, salesforce, quickbooks, xero |
| `subscriptions` | adobe, zoom, dropbox, openai, shopify, godaddy |
| `insurance` | insurance, geico, tesla insurance |
| `housing` | rent, lease, mortgage |
| `utilities` | electric, water, internet, phone, at&t, verizon, comcast, spectrum, sdg&e, gas & electric, solar |
| `dining` | starbucks, doordash, grubhub, ubereats, mcdonald, 7-eleven |
| `groceries` | vons, costco, 99 ranch, food 4 less |
| `shopping` | amazon, target, walmart, home depot, pandora |
| `transportation` | chevron, shell |
| `debt` | transfer to loan, payment to loan, loan payment, lakeview, payment to chase, credit card |

---

## 15. Pitfalls and Edge Cases

### 1. "Amazon" keyword matches both Amazon shopping AND Amazon Web Services

The MERCHANT_RULES array is ordered — `"amazon web services"` appears before `"amazon"`. First match wins. A description containing "amazon web services" will match the AWS rule before the generic Amazon rule. A description containing just "amazon" will match the generic shopping rule. Order matters.

### 2. "Credit" appears in "credit card payment"

The standalone credit regex `/(^|\s)credit($|\s)/` uses word-boundary anchors. "Credit card" has "credit " followed by "card" — the regex still matches "credit " (credit followed by a space) because `$` is end-of-line, not end-of-word. However Pass 4 is guarded by `transactionClass !== "income"`. A credit card payment that arrives as a positive amount will have `transactionClass = "income"` from the default, so Pass 4 won't fire. It will then get caught by the "credit card" merchant rule in Pass 6.

### 3. Positive transfers counted as income

This is intentional but worth documenting. A "TRANSFER FROM SAVINGS $5000" will be classified as income after the Transfer Reclassification pass. Users who do a lot of internal transfers will see inflated income. The correct solution is to upload data from all accounts so both sides of transfers are visible. In practice, users are informed they should either upload all accounts or manually reclassify transfers.

### 4. Same description, different direction in different bank formats

"DOORDASH" can appear as a positive amount in some bank formats (credit card statement showing pending authorization release). The classifier will label it as income (positive default) initially, then the merchant rule will override `transactionClass` — but wait, the DoorDash merchant rule does NOT set `transactionClass`. So a positive DoorDash will stay as `transactionClass = "income"`, `category = "dining"`. This is one of the known edge cases where user correction is needed.

### 5. Recurrence detector and amount variation

The detector uses exact cent-amount matching. If a utility bill varies by a few dollars each month ($102.50, $98.75, $103.20), these will NOT be grouped as recurring by the detector — they'll be three separate groups. Utilities are already caught by merchant rules as recurring, so this isn't a problem for known utilities. For unknown variable-amount subscriptions, the LLM has a chance to help but the batch detector will miss them.

### 6. The aiAssisted flag is set from classifier state, not final state

The aiAssisted check runs after all classification passes but before the Transfer Reclassification pass (Pass 10) and Income Lock pass (Pass 11). This means a transaction that starts as "transfer" and gets reclassified to "income" will have its aiAssisted status determined by the state at Pass 12, which reflects the reclassified state. This is correct behavior.

---

*This document reflects the exact implementation as of the PocketPulse v1.0 codebase. The classification system was iteratively refined through testing against real bank statement exports from multiple US banks.*
