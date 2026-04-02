# Fix Transaction Classification for Unsigned CSV Amounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the classifier so it correctly categorizes transactions from bank CSVs that use unsigned (all positive) amounts, by running keyword matching before the inflow-to-income shortcut and allowing keyword results to override the inferred flow direction.

**Architecture:** Restructure `classifyTransaction` to always run keyword rules first. When keywords match an expense-type category (subscriptions, groceries, dining, etc.) but the caller says "inflow", the classifier overrides with "outflow"/"expense" and returns a `flowOverride` flag. The route handler respects this override to correct the stored flowType and negate the amount. Also enhance the CSV parser to detect Type/DR-CR columns as an additional sign source.

**Tech Stack:** TypeScript, Vitest

---

## Bug Diagnosis

### Problem

Bank CSVs that have only a single "Amount" column with all positive values (no sign encoding):

```csv
Date,Description,Amount
01/15/2026,NETFLIX INC,15.99
01/16/2026,WHOLE FOODS,85.00
01/17/2026,PAYROLL DEPOSIT,3500.00
```

Every amount is positive, so `inferFlowType` returns `"inflow"` for all rows. The classifier then short-circuits at line 425 — when `transactionClass === "income"`, keyword matching is **skipped entirely**. Netflix gets `category: "income"` instead of `"subscriptions"`.

### Data Flow (current, broken for unsigned CSVs)

```
CSV "15.99" → parseCSV → amount=15.99 → inferFlowType → "inflow"
→ classifyTransaction("Netflix Inc", 15.99, "inflow")
→ transactionClass="income" (line 414: inflow + not refund/transfer)
→ category="income" (line 425-428: income shortcut, SKIP keyword rules)
→ stored as income/income ← WRONG
```

### Data Flow (after fix)

```
CSV "15.99" → parseCSV → amount=15.99 → inferFlowType → "inflow"
→ classifyTransaction("Netflix Inc", 15.99, "inflow")
→ keyword scan FIRST → "netflix" matches subscriptions
→ keyword says expense-type category → override: transactionClass="expense", flowOverride="outflow"
→ route handler: flowType="outflow", amount="-15.99"
→ stored as expense/subscriptions ← CORRECT
```

### Categories that indicate expense direction

These are "expense-type" categories. If keywords match any of these AND the raw flowType was "inflow", the classifier should override to "outflow"/"expense":

`subscriptions`, `business_software`, `insurance`, `housing`, `utilities`, `groceries`, `dining`, `transportation`, `health`, `debt`, `fees`, `entertainment`, `shopping`

The only non-expense categories are: `income`, `transfers`, `other`.

### Sign convention (banking standard)

The system follows standard checking-account terminology:
- **Debit** = money leaving your account (you paid with debit card) → **negative** / outflow
- **Credit** = money entering your account (credited to you) → **positive** / inflow

This is already encoded in `deriveSignedAmount` (`debit → -Math.abs()`, `credit → Math.abs()`) and the Type column detection in Task 5 follows the same rule.

---

## File Structure

### Modified files
- `server/classifier.ts` — restructure to keyword-first logic, add `flowOverride` to result
- `server/classifier.test.ts` — add tests for unsigned-amount scenarios
- `server/routes.ts` — respect `flowOverride` from classifier
- `server/csvParser.ts` — detect Type/DR-CR columns
- `server/csvParser.test.ts` — test Type column detection
- `server/transactionUtils.ts` — no changes needed (inferFlowType stays as-is)

---

## Task Breakdown

### Task 1: Add failing tests for unsigned-amount classification

**Files:**
- Modify: `server/classifier.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `server/classifier.test.ts`:

```typescript
describe("unsigned amount classification (inflow with expense keywords)", () => {
  it("classifies Netflix as subscription even when flowType is inflow", () => {
    const result = classifyTransaction("NETFLIX INC", 15.99, "inflow");
    expect(result.category).toBe("subscriptions");
    expect(result.transactionClass).toBe("expense");
    expect(result.flowOverride).toBe("outflow");
  });

  it("classifies Whole Foods as groceries even when flowType is inflow", () => {
    const result = classifyTransaction("WHOLE FOODS MARKET", 85.00, "inflow");
    expect(result.category).toBe("groceries");
    expect(result.transactionClass).toBe("expense");
    expect(result.flowOverride).toBe("outflow");
  });

  it("classifies Starbucks as dining even when flowType is inflow", () => {
    const result = classifyTransaction("STARBUCKS", 5.50, "inflow");
    expect(result.category).toBe("dining");
    expect(result.transactionClass).toBe("expense");
    expect(result.flowOverride).toBe("outflow");
  });

  it("classifies Amazon as shopping even when flowType is inflow", () => {
    const result = classifyTransaction("AMAZON.COM", 42.00, "inflow");
    expect(result.category).toBe("shopping");
    expect(result.transactionClass).toBe("expense");
    expect(result.flowOverride).toBe("outflow");
  });

  it("still classifies unknown inflow merchants as income", () => {
    const result = classifyTransaction("PAYROLL DEPOSIT", 3500.00, "inflow");
    expect(result.category).toBe("income");
    expect(result.transactionClass).toBe("income");
    expect(result.flowOverride).toBeNull();
  });

  it("still classifies refunds correctly", () => {
    const result = classifyTransaction("REFUND FROM AMAZON", 29.99, "inflow");
    expect(result.transactionClass).toBe("refund");
    expect(result.flowOverride).toBeNull();
  });

  it("still classifies transfers correctly", () => {
    const result = classifyTransaction("TRANSFER TO SAVINGS", 500.00, "inflow");
    expect(result.transactionClass).toBe("transfer");
    expect(result.flowOverride).toBeNull();
  });

  it("does not override when flowType is already outflow", () => {
    const result = classifyTransaction("NETFLIX INC", -15.99, "outflow");
    expect(result.category).toBe("subscriptions");
    expect(result.transactionClass).toBe("expense");
    expect(result.flowOverride).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/classifier.test.ts
```

Expected: FAIL — `flowOverride` property doesn't exist on `ClassificationResult`, and Netflix with `"inflow"` returns `"income"` instead of `"subscriptions"`.

- [ ] **Step 3: Commit test file**

```bash
git add server/classifier.test.ts
git commit -m "test(classifier): add failing tests for unsigned-amount classification

Tests that expense-keyword merchants (Netflix, Whole Foods, Starbucks,
Amazon) get correct expense classification even when flowType is inflow
from unsigned CSV amounts. Verifies flowOverride field."
```

---

### Task 2: Restructure classifier to keyword-first logic

**Files:**
- Modify: `server/classifier.ts`

- [ ] **Step 1: Add `flowOverride` to `ClassificationResult`**

Change the type at the top of `server/classifier.ts`:

```typescript
export type ClassificationResult = {
  transactionClass: "income" | "expense" | "transfer" | "refund";
  category: V1Category;
  recurrenceType: "recurring" | "one-time";
  labelSource: "rule";
  labelConfidence: number;
  labelReason: string;
  flowOverride: "outflow" | null;
};
```

- [ ] **Step 2: Define expense-type categories and shared transfer keywords constants**

Add after `RECURRING_KEYWORDS`:

```typescript
const EXPENSE_CATEGORIES: ReadonlySet<string> = new Set([
  "subscriptions",
  "business_software",
  "insurance",
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transportation",
  "health",
  "debt",
  "fees",
  "entertainment",
  "shopping",
]);

const TRANSFER_KEYWORDS = ["transfer", "xfer", "zelle", "venmo", "cash app", "wire"];
```

Note: `TRANSFER_KEYWORDS` unifies the hardcoded list (which was missing "cash app") and should also be used in `CATEGORY_RULES[0].keywords` for transfers to keep them in sync. Update the transfers entry in `CATEGORY_RULES` to reference `TRANSFER_KEYWORDS`:

```typescript
{
  category: "transfers" as V1Category,
  keywords: TRANSFER_KEYWORDS,
  confidence: 0.9,
},
```

- [ ] **Step 3: Restructure `classifyTransaction`**

Replace the entire function body with keyword-first logic:

```typescript
export function classifyTransaction(
  merchant: string,
  amount: number,
  flowType: "inflow" | "outflow",
): ClassificationResult {
  const lower = merchant.toLowerCase();

  // Step 1: Always run keyword matching first
  let category: V1Category = "other";
  let confidence = 0.3;
  let matchedKeyword = "";

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        category = rule.category;
        confidence = rule.confidence;
        matchedKeyword = kw;
        break;
      }
    }
    if (matchedKeyword) break;
  }

  // Step 2: Determine transaction class, respecting keyword results
  let transactionClass: ClassificationResult["transactionClass"];
  let flowOverride: "outflow" | null = null;

  if (matchesAny(merchant, REFUND_KEYWORDS) && flowType === "inflow") {
    transactionClass = "refund";
  } else if (matchesAny(merchant, TRANSFER_KEYWORDS)) {
    transactionClass = "transfer";
    if (!matchedKeyword) {
      category = "transfers";
      confidence = 0.8;
      matchedKeyword = "transfer";
    }
  } else if (matchedKeyword && EXPENSE_CATEGORIES.has(category)) {
    // Keywords matched an expense-type category — this IS an expense
    // regardless of what the amount sign says
    transactionClass = "expense";
    if (flowType === "inflow") {
      flowOverride = "outflow";
    }
  } else if (flowType === "inflow") {
    transactionClass = "income";
    if (!matchedKeyword) {
      category = "income";
      confidence = 0.8;
      matchedKeyword = "inflow";
    }
  } else {
    transactionClass = "expense";
  }

  // Step 3: Recurrence hint
  const recurrenceType = matchesAny(merchant, RECURRING_KEYWORDS)
    ? "recurring" as const
    : "one-time" as const;

  const labelReason = matchedKeyword
    ? `Matched keyword "${matchedKeyword}" → ${category}`
    : `No keyword match — defaulted to ${category}`;

  return {
    transactionClass,
    category,
    recurrenceType,
    labelSource: "rule",
    labelConfidence: confidence,
    labelReason,
    flowOverride,
  };
}
```

Key logic changes:
1. Keyword scan runs FIRST, before any transactionClass decision
2. If keywords match an expense-type category AND flowType was "inflow", override to expense + set `flowOverride = "outflow"`
3. Only default to income when NO expense keywords matched and flowType is inflow
4. `flowOverride` is null when no correction is needed (outflow already, or genuinely income)

- [ ] **Step 4: Run classifier tests**

```bash
npx vitest run server/classifier.test.ts
```

Expected: All tests PASS — both existing and new unsigned-amount tests.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: PASS — adding `flowOverride` to the return type doesn't break callers that ignore it.

- [ ] **Step 6: Commit**

```bash
git add server/classifier.ts server/classifier.test.ts
git commit -m "fix(classifier): keyword-first classification for unsigned CSV amounts

Always run keyword matching before the inflow-to-income shortcut.
When keywords match an expense-type category (subscriptions, groceries,
dining, etc.) but flowType is inflow, override to expense/outflow.
Adds flowOverride field to ClassificationResult so the route handler
can correct the stored amount sign and flowType.

Fixes: unsigned bank CSVs where all amounts are positive caused every
transaction to be classified as income because keyword rules were
skipped entirely."
```

---

### Task 3: Route handler respects flowOverride

**Files:**
- Modify: `server/routes.ts`

- [ ] **Step 1: Update the upload route to use flowOverride**

In `server/routes.ts`, find the `txnInputs` mapping (around line 378-404). Replace it:

```typescript
          const txnInputs = parseResult.rows.map((row) => {
            const merchant = normalizeMerchant(row.description);
            const rawFlowType = inferFlowType(row.amount);
            const classification = classifyTransaction(
              merchant || row.description,
              row.amount,
              rawFlowType,
            );

            const effectiveFlowType = classification.flowOverride ?? rawFlowType;
            const effectiveAmount =
              effectiveFlowType === "outflow" && row.amount > 0
                ? -Math.abs(row.amount)
                : row.amount;

            return {
              userId,
              uploadId: uploadRecord.id,
              accountId: fileMeta.accountId,
              date: row.date,
              amount: effectiveAmount.toFixed(2),
              merchant: merchant || row.description,
              rawDescription: row.description,
              flowType: effectiveFlowType,
              transactionClass: classification.transactionClass,
              recurrenceType: classification.recurrenceType,
              category: classification.category,
              labelSource: classification.labelSource,
              labelConfidence: classification.labelConfidence.toFixed(2),
              labelReason: classification.labelReason,
            };
          });
```

Key changes:
- Renamed `flowType` to `rawFlowType` to avoid confusion
- `effectiveFlowType` uses `flowOverride` from classifier when present
- `effectiveAmount` negates positive amounts when classifier says it's an outflow

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: PASS — no type errors.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All existing tests pass. The upload route test mocks `classifyTransaction`, so it's unaffected by the signature change.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "fix(routes): apply classifier flowOverride to correct unsigned amounts

When the classifier detects an expense-keyword merchant but the CSV
amount was unsigned positive, the route handler now:
1. Uses the classifier's flowOverride as the stored flowType
2. Negates the amount to reflect outflow direction

Completes the fix for unsigned bank CSV formats."
```

---

### Task 4: Integration test for unsigned CSV → correct classification

**Files:**
- Create: `server/upload-classification.test.ts`

- [ ] **Step 1: Write integration test**

This test exercises the full pipeline: `parseCSV` → `inferFlowType` → `classifyTransaction` → route handler amount/flowType correction logic (extracted as a helper or tested inline).

```typescript
import { describe, expect, it } from "vitest";
import { parseCSV } from "./csvParser.js";
import { inferFlowType, normalizeMerchant } from "./transactionUtils.js";
import { classifyTransaction } from "./classifier.js";

function buildTransaction(row: { date: string; description: string; amount: number }) {
  const merchant = normalizeMerchant(row.description);
  const rawFlowType = inferFlowType(row.amount);
  const classification = classifyTransaction(
    merchant || row.description,
    row.amount,
    rawFlowType,
  );

  const effectiveFlowType = classification.flowOverride ?? rawFlowType;
  const effectiveAmount =
    effectiveFlowType === "outflow" && row.amount > 0
      ? -Math.abs(row.amount)
      : row.amount;

  return {
    merchant: merchant || row.description,
    amount: effectiveAmount,
    flowType: effectiveFlowType,
    transactionClass: classification.transactionClass,
    category: classification.category,
  };
}

describe("unsigned CSV → classification integration", () => {
  it("classifies an unsigned CSV with mixed merchants correctly", async () => {
    const csv = Buffer.from(
      [
        "Date,Description,Amount",
        "01/15/2026,NETFLIX INC,15.99",
        "01/16/2026,WHOLE FOODS MARKET #1234,85.00",
        "01/17/2026,PAYROLL DEPOSIT,3500.00",
        "01/18/2026,STARBUCKS COFFEE,5.50",
        "01/19/2026,XYZZY CORP,25.00",
      ].join("\n"),
    );

    const result = await parseCSV(csv, "test.csv");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("parse failed");

    const txns = result.rows.map(buildTransaction);

    // Netflix → subscriptions/expense, amount negated
    expect(txns[0]).toMatchObject({
      category: "subscriptions",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -15.99,
    });

    // Whole Foods → groceries/expense, amount negated
    expect(txns[1]).toMatchObject({
      category: "groceries",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -85.00,
    });

    // Payroll → income/income, amount stays positive
    expect(txns[2]).toMatchObject({
      category: "income",
      transactionClass: "income",
      flowType: "inflow",
      amount: 3500.00,
    });

    // Starbucks → dining/expense, amount negated
    expect(txns[3]).toMatchObject({
      category: "dining",
      transactionClass: "expense",
      flowType: "outflow",
      amount: -5.50,
    });

    // Unknown → income/income (no keywords match, positive amount)
    expect(txns[4]).toMatchObject({
      category: "income",
      transactionClass: "income",
      flowType: "inflow",
      amount: 25.00,
    });
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
npx vitest run server/upload-classification.test.ts
```

Expected: PASS — the full pipeline correctly classifies unsigned amounts.

- [ ] **Step 3: Commit**

```bash
git add server/upload-classification.test.ts
git commit -m "test: add integration test for unsigned CSV classification pipeline

Exercises parseCSV → inferFlowType → classifyTransaction → amount
correction to verify the full pipeline handles unsigned bank CSVs."
```

---

### Task 5: Enhance CSV parser to detect Type/DR-CR columns (defense in depth)

**Files:**
- Modify: `server/csvParser.ts`
- Modify: `server/csvParser.test.ts`

- [ ] **Step 1: Write failing test for Type column**

Add to `server/csvParser.test.ts`:

```typescript
it("detects Type column and uses it for sign (Debit/Credit values)", async () => {
  const csv = makeCsv([
    "Date,Description,Amount,Type",
    "01/15/2026,NETFLIX INC,15.99,Debit",
    "01/16/2026,PAYROLL DEPOSIT,3500.00,Credit",
  ]);

  const result = await parseCSV(csv, "test.csv");

  expect(result.ok).toBe(true);
  const { rows } = result as CSVParseResult & { ok: true };
  expect(rows).toHaveLength(2);
  expect(rows[0]!.amount).toBe(-15.99);
  expect(rows[1]!.amount).toBe(3500.0);
});

it("detects Transaction Type column with DR/CR values", async () => {
  const csv = makeCsv([
    "Date,Description,Amount,Transaction Type",
    "01/15/2026,NETFLIX INC,15.99,DR",
    "01/16/2026,PAYROLL DEPOSIT,3500.00,CR",
  ]);

  const result = await parseCSV(csv, "test.csv");

  expect(result.ok).toBe(true);
  const { rows } = result as CSVParseResult & { ok: true };
  expect(rows[0]!.amount).toBe(-15.99);
  expect(rows[1]!.amount).toBe(3500.0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/csvParser.test.ts
```

Expected: FAIL — Type column not detected.

- [ ] **Step 3: Add Type column detection**

In `server/csvParser.ts`, add after `CREDIT_PATTERNS`:

```typescript
const TYPE_PATTERNS = ["type", "transaction type", "trans type", "dr/cr"];
```

Add `typeIdx` to `ColumnMapping`:

```typescript
type ColumnMapping = {
  dateIdx: number;
  descriptionIdx: number;
  amountIdx: number | null;
  debitIdx: number | null;
  creditIdx: number | null;
  typeIdx: number | null;
};
```

In `detectColumns`, add type detection:

```typescript
  const typeIdx = findColumnIndex(headers, TYPE_PATTERNS);
```

And include it in the return:

```typescript
  return {
    dateIdx,
    descriptionIdx,
    amountIdx: amountIdx !== -1 ? amountIdx : null,
    debitIdx: debitIdx !== -1 ? debitIdx : null,
    creditIdx: creditIdx !== -1 ? creditIdx : null,
    typeIdx: typeIdx !== -1 ? typeIdx : null,
  };
```

In the amount resolution block inside `parseCSV`, add a Type column branch. The full priority becomes:

```typescript
    let amount: number;
    if (mapping.debitIdx !== null || mapping.creditIdx !== null) {
      // Priority 1: Explicit debit/credit columns
      const rawDebit = mapping.debitIdx !== null ? row[mapping.debitIdx] ?? "" : "";
      const rawCredit = mapping.creditIdx !== null ? row[mapping.creditIdx] ?? "" : "";
      const debitVal = rawDebit ? normalizeAmount(rawDebit) : 0;
      const creditVal = rawCredit ? normalizeAmount(rawCredit) : 0;
      amount = deriveSignedAmount({
        debit: isNaN(debitVal) ? 0 : debitVal,
        credit: isNaN(creditVal) ? 0 : creditVal,
      });
    } else if (mapping.amountIdx !== null && mapping.typeIdx !== null) {
      // Priority 2: Amount + Type column (Debit/Credit or DR/CR)
      const rawAmount = row[mapping.amountIdx] ?? "";
      const rawType = (row[mapping.typeIdx] ?? "").trim().toLowerCase();
      const parsed = normalizeAmount(rawAmount);
      const isDebit = rawType === "debit" || rawType === "dr" || rawType === "deb";
      amount = isDebit ? -Math.abs(parsed) : Math.abs(parsed);
    } else if (mapping.amountIdx !== null) {
      // Priority 3: Amount column only (sign comes from the value itself)
      const rawAmount = row[mapping.amountIdx] ?? "";
      amount = normalizeAmount(rawAmount);
    } else {
      amount = NaN;
    }
```

- [ ] **Step 4: Run CSV parser tests**

```bash
npx vitest run server/csvParser.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/csvParser.ts server/csvParser.test.ts
git commit -m "feat(csv): detect Type/DR-CR column for amount sign

Adds detection for Type, Transaction Type, and DR/CR columns.
When present alongside an Amount column, uses the type value
(Debit/DR → negative, Credit/CR → positive) to derive sign.
Priority: debit/credit columns > amount+type > amount-only."
```

---

### Task 6: Verification and documentation

**Files:**
- Modify: `docs/phase-logs/phase-4-recurring-leak-review-progress.md`

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: Clean.

- [ ] **Step 3: Update progress log**

Add to the Phase 4 progress log a section on the classification fix:

```markdown
## Hotfix: Unsigned CSV classification

**Problem:** Bank CSVs with only a single Amount column (all positive, no sign) caused every transaction to be classified as income. The classifier's inflow-to-income shortcut (line 425) skipped keyword matching entirely.

**Fix (3 parts):**
1. **Classifier restructure:** keyword rules now run FIRST. When keywords match an expense-type category but flowType is "inflow", classifier returns `flowOverride: "outflow"`.
2. **Route handler:** respects `flowOverride` to correct the stored flowType and negate the amount.
3. **CSV parser:** detects Type/Transaction Type/DR-CR columns as an additional sign source.

**Impact:** Netflix with unsigned +15.99 now correctly classifies as subscriptions/expense instead of income/income.
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "docs: document unsigned CSV classification fix

Adds hotfix section to Phase 4 progress log explaining the
keyword-first classifier restructure and route handler flowOverride."
```
