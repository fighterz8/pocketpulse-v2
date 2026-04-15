# PocketPulse — Leak Detection Feature: Complete Report

**Purpose:** Full capture of every component involved in the leak detection feature — server algorithm, API route, frontend page, Dashboard integration, current limitations, and what must change to make it month-aware in the new version.

---

## Table of Contents

1. [What the Feature Does](#1-what-the-feature-does)
2. [The LeakItem Data Model](#2-the-leakitem-data-model)
3. [Server Algorithm — `detectLeaks()`](#3-server-algorithm--detectleaks)
4. [Server API Route — `/api/leaks`](#4-server-api-route--apileaks)
5. [Frontend Page — `Leaks.tsx` (Full Source)](#5-frontend-page--leakstsx-full-source)
6. [Dashboard Connection](#6-dashboard-connection)
7. [The Disconnect — Current Limitation](#7-the-disconnect--current-limitation)
8. [What Needs to Change for the Month-Based Version](#8-what-needs-to-change-for-the-month-based-version)
9. [Complete Data Flow Diagram](#9-complete-data-flow-diagram)
10. [Summary of All Files Involved](#10-summary-of-all-files-involved)

---

## 1. What the Feature Does

Leak detection scans a user's expense transactions within a selected time window and flags spending patterns that are likely avoidable. It does **not** look for fraud — it looks for **behavioral patterns** like:

- Buying coffee from the same place 6+ times in a month (**high-frequency convenience**)
- Small $5–$15 purchases from the same vendor that add up (**micro-spend**)
- Any discretionary vendor (dining, shopping, entertainment) with 3+ charges totalling $60+ (**repeat discretionary**)

The feature produces a **ranked list of merchant-level groups**. Each item tells you: the merchant name, how often you're buying, the category, a monthly normalized cost, the raw spend in the window, confidence rating (High / Medium / Low), last seen date, and average ticket size.

**What it deliberately excludes:** Utilities, subscriptions, insurance, housing, debt, groceries, health, transportation, and fees are never flagged. Only discretionary and `other`-category expenses are eligible.

**Where it appears in the app:**
- The **Leaks page** (`/leaks`) is the full standalone view
- The **Dashboard** shows a compact summary card: count of leaks + `~$X/mo` total

---

## 2. The LeakItem Data Model

Defined in `server/cashflow.ts` (the authoritative source) and mirrored as a local interface in `client/src/pages/Leaks.tsx`.

```typescript
// server/cashflow.ts — line 279
export interface LeakItem {
  merchant: string;
  // Human-readable merchant name, sourced directly from transaction.merchant
  // e.g. "Starbucks", "DoorDash", "Amazon"

  merchantFilter: string;
  // Same value as merchant. Used as the URL query param when the user
  // clicks "View related transactions" to drill into the Ledger.
  // Kept as a separate field in case merchant display name ever diverges
  // from the filter value.

  category: TransactionCategory;
  // The shared category enum value: "dining", "shopping", "entertainment", "other", etc.
  // All items in a LeakItem group share the same category.

  bucket: "repeat_discretionary" | "micro_spend" | "high_frequency_convenience";
  // Which threshold triggered the flag. Determines the label shown in the UI.
  // Priority: micro_spend > high_frequency_convenience > repeat_discretionary

  label: string;
  // Human-readable bucket description shown under the merchant name:
  // "Frequent micro-purchases" | "High-frequency convenience spend" | "Repeat discretionary spend"

  monthlyAmount: number;
  // totalSpend / monthFactor — normalized to a per-month cost.
  // monthFactor = max(1, rangeDays / 30)
  // For a 90-day window: monthFactor = 3, so $270 over 90 days = $90/mo
  // For a 30-day window: monthFactor = 1, so $270 over 30 days = $270/mo
  // This is the value displayed on the Dashboard as "~$X/mo"

  occurrences: number;
  // Total count of matching charges in the selected window

  lastDate: string;
  // ISO date string (YYYY-MM-DD) of the most recent transaction in the group.
  // Shown as "Last Seen" in the UI.

  confidence: "High" | "Medium" | "Low";
  // High:   6+ occurrences, OR (isRecurring AND amount variance < 15% of average)
  // Medium: default
  // Low:    2 or fewer occurrences

  averageAmount: number;
  // totalSpend / occurrences — average charge amount

  recentSpend: number;
  // Raw total spend for all matching transactions in the window (NOT normalized).
  // This is what the Leaks page sums to show "Flagged discretionary spend in window."
  // Results are sorted by this value descending (highest spend first).

  transactionClass: "expense";
  // Always "expense" — used as a hardcoded filter param in Ledger drilldown links

  recurrenceType?: "recurring" | "one-time";
  // Set to "recurring" if at least one transaction in the group was marked recurring
  // by the classifier. Undefined otherwise (not included in Ledger drilldown link).
}
```

**Key distinction between `recentSpend` and `monthlyAmount`:**

| Field | Meaning | 90-day example |
|---|---|---|
| `recentSpend` | Raw total in the selected window | $270 (actual) |
| `monthlyAmount` | Window total ÷ monthFactor | $90/mo (normalized) |

The Dashboard shows `monthlyAmount` (to present a recurring cost view). The Leaks page shows both — `monthlyAmount` in the "Monthly" column and `recentSpend` in the "{days}-Day Spend" column.

---

## 3. Server Algorithm — `detectLeaks()`

**File:** `server/cashflow.ts`

### Full Source

```typescript
const DISCRETIONARY_CATEGORIES = new Set<TransactionCategory>([
  "dining",
  "shopping",
  "entertainment",
]);

const ESSENTIAL_LEAK_EXCLUSIONS = new Set<TransactionCategory>([
  "utilities",
  "subscriptions",
  "business_software",
  "insurance",
  "housing",
  "debt",
  "groceries",
  "health",
  "transportation",
  "fees",
  "income",
  "transfers",
]);

export function detectLeaks(
  transactions: Transaction[],
  options: { rangeDays?: number } = {},
): LeakItem[] {
  const monthFactor = getMonthFactor(
    options.rangeDays ?? getRangeDaysFromTransactions(transactions),
  );

  const candidateExpenses = transactions.filter(
    (tx) =>
      tx.transactionClass === "expense" &&
      !ESSENTIAL_LEAK_EXCLUSIONS.has(tx.category as TransactionCategory),
  );

  const merchantGroups: Record<
    string,
    {
      merchant: string;
      category: TransactionCategory;
      amounts: number[];
      dates: string[];
      recurrenceTypes: Array<"recurring" | "one-time">;
    }
  > = {};

  for (const tx of candidateExpenses) {
    const key = `${tx.merchant.toLowerCase()}::${tx.category}`;
    if (!merchantGroups[key]) {
      merchantGroups[key] = {
        merchant: tx.merchant,
        category: tx.category as TransactionCategory,
        amounts: [],
        dates: [],
        recurrenceTypes: [],
      };
    }
    merchantGroups[key].amounts.push(Math.abs(parseFloat(tx.amount)));
    merchantGroups[key].dates.push(tx.date);
    merchantGroups[key].recurrenceTypes.push(
      tx.recurrenceType as "recurring" | "one-time",
    );
  }

  const leaks: LeakItem[] = [];

  for (const group of Object.values(merchantGroups)) {
    if (group.amounts.length < 2) continue;

    const totalSpend = group.amounts.reduce((a, b) => a + b, 0);
    const avgAmount = totalSpend / group.amounts.length;
    const sortedDates = group.dates.sort().reverse();
    const amountVariance =
      group.amounts.length > 1
        ? Math.max(...group.amounts) - Math.min(...group.amounts)
        : 0;
    const isRecurring = group.recurrenceTypes.includes("recurring");
    const isMicroSpend = avgAmount <= 20 && group.amounts.length >= 4;
    const isConvenience =
      group.category === "dining" && group.amounts.length >= 4;
    const isRepeatDiscretionary =
      DISCRETIONARY_CATEGORIES.has(group.category) &&
      group.amounts.length >= 3 &&
      totalSpend >= 60;

    if (!isRecurring && !isMicroSpend && !isConvenience && !isRepeatDiscretionary) {
      continue;
    }

    let bucket: LeakItem["bucket"] = "repeat_discretionary";
    let label = "Repeat discretionary spend";
    if (isMicroSpend) {
      bucket = "micro_spend";
      label = "Frequent micro-purchases";
    } else if (isConvenience) {
      bucket = "high_frequency_convenience";
      label = "High-frequency convenience spend";
    }

    let confidence: "High" | "Medium" | "Low" = "Medium";
    if (
      group.amounts.length >= 6 ||
      (isRecurring && amountVariance < avgAmount * 0.15)
    ) {
      confidence = "High";
    } else if (group.amounts.length <= 2) {
      confidence = "Low";
    }

    leaks.push({
      merchant: group.merchant,
      merchantFilter: group.merchant,
      category: group.category,
      bucket,
      label,
      monthlyAmount: roundCurrency(totalSpend / monthFactor),
      occurrences: group.amounts.length,
      lastDate: sortedDates[0],
      confidence,
      averageAmount: roundCurrency(avgAmount),
      recentSpend: roundCurrency(totalSpend),
      transactionClass: "expense",
      recurrenceType: isRecurring ? "recurring" : undefined,
    });
  }

  return leaks.sort((a, b) => b.recentSpend - a.recentSpend);
}
```

### Helper functions used

```typescript
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getMonthFactor(rangeDays?: number): number {
  if (!rangeDays || rangeDays <= 0) return 1;
  return Math.max(1, rangeDays / 30);
}

// Fallback used when rangeDays is not passed — calculates actual date span
function getRangeDaysFromTransactions(transactions: Transaction[]): number {
  const dates = transactions.map((tx) => tx.date).filter(Boolean).sort();
  if (dates.length < 2) return 30;
  const minDate = new Date(`${dates[0]}T00:00:00Z`);
  const maxDate = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  return Math.max(
    1,
    Math.floor((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}
```

### Step-by-Step Walkthrough

**Step 1: Compute `monthFactor`**

```
monthFactor = max(1, rangeDays / 30)
```

If `rangeDays` is not passed in `options`, it falls back to `getRangeDaysFromTransactions()` which calculates the actual date span from earliest to latest transaction date. The fallback matters when `detectLeaks()` is called from `buildCashflowAnalysis()` without an explicit `rangeDays`.

**Step 2: Filter to leak candidates**

```typescript
const candidateExpenses = transactions.filter(
  (tx) =>
    tx.transactionClass === "expense" &&
    !ESSENTIAL_LEAK_EXCLUSIONS.has(tx.category as TransactionCategory),
);
```

Only `"expense"` class transactions are considered. All twelve essential categories in `ESSENTIAL_LEAK_EXCLUSIONS` are skipped. What remains: `"dining"`, `"shopping"`, `"entertainment"`, and `"other"`.

**Step 3: Group by merchant + category**

```typescript
const key = `${tx.merchant.toLowerCase()}::${tx.category}`;
```

The composite key means: two purchases at "Starbucks" in `"dining"` and two in `"other"` (if miscategorized) become two separate groups. Merchant name matching is case-insensitive (lowercased). Groups accumulate `amounts[]`, `dates[]`, and `recurrenceTypes[]`.

Groups with fewer than 2 entries are immediately skipped (`if (group.amounts.length < 2) continue`).

**Step 4: Compute stats per group**

```typescript
const totalSpend = group.amounts.reduce((a, b) => a + b, 0);
const avgAmount = totalSpend / group.amounts.length;
const sortedDates = group.dates.sort().reverse();   // Most recent first
const amountVariance = Math.max(...group.amounts) - Math.min(...group.amounts);
const isRecurring = group.recurrenceTypes.includes("recurring");
```

**Step 5: Apply bucket thresholds**

| Flag | Condition |
|---|---|
| `isRecurring` | Any transaction in the group was classified as recurring |
| `isMicroSpend` | Average amount ≤ $20 AND 4+ occurrences |
| `isConvenience` | Category = `"dining"` AND 4+ occurrences |
| `isRepeatDiscretionary` | Category is discretionary AND 3+ occurrences AND total ≥ $60 |

If none of the four flags are true, the group is skipped. Any single flag qualifies the group.

**Step 6: Assign bucket label (priority order)**

```
micro_spend (highest priority)
  → "Frequent micro-purchases"
high_frequency_convenience
  → "High-frequency convenience spend"
repeat_discretionary (default)
  → "Repeat discretionary spend"
```

**Step 7: Assign confidence**

```
High:   6+ occurrences  OR  (isRecurring AND amountVariance < avgAmount × 0.15)
Low:    ≤ 2 occurrences
Medium: everything else
```

**Step 8: Sort and return**

```typescript
return leaks.sort((a, b) => b.recentSpend - a.recentSpend);
```

Sorted descending by raw window spend. The highest dollar-value leak appears first.

---

## 4. Server API Route — `/api/leaks`

**File:** `server/routes.ts`, lines 264–270

```typescript
app.get("/api/leaks", requireAuth, async (req: Request, res: Response) => {
  const { filters, range } = buildTransactionFilters(req.query, {
    fallbackToRecent: true,
  });
  const txns = await storage.getTransactions(req.user!.id, filters);
  const leaks = detectLeaks(txns, { rangeDays: range?.rangeDays });
  res.json(leaks);
});
```

### `buildTransactionFilters()` — full source

```typescript
// server/routes.ts, lines 65–93
function buildTransactionFilters(
  query: Request["query"],
  options: { fallbackToRecent?: boolean } = {},
) {
  const filters: {
    flowType?: string;
    accountId?: number;
    search?: string;
    merchant?: string;
    category?: string;
    transactionClass?: string;
    recurrenceType?: string;
    startDate?: string;
    endDate?: string;
  } = {};

  if (query.flowType)          filters.flowType = query.flowType as string;
  if (query.accountId)         filters.accountId = parseInt(String(query.accountId), 10);
  if (query.search)            filters.search = query.search as string;
  if (query.merchant)          filters.merchant = query.merchant as string;
  if (query.category)          filters.category = query.category as string;
  if (query.transactionClass)  filters.transactionClass = query.transactionClass as string;
  if (query.recurrenceType)    filters.recurrenceType = query.recurrenceType as string;

  const range = getResolvedRange(query, options.fallbackToRecent);
  if (range) {
    filters.startDate = range.startDate;
    filters.endDate = range.endDate;
  }

  return { filters, range, metric: parseDashboardMetric(query.metric) };
}
```

The `{ fallbackToRecent: true }` option means: if no date params are in the query, default to the last 90 days. This is what causes the Leaks page to always show 90 days when it sends `?days=90`.

### `resolveDateRange()` — how day params become date ranges

```typescript
// server/dateRanges.ts, lines 94–143 (abbreviated)
export function resolveDateRange(input: DateRangeInput = {}): ResolvedDateRange {
  // ... [earlier branches handle preset="custom", "year", "thisMonth", etc.]
  const days = parseInt(String(input.days ?? ""), 10);
  const normalizedDays = [30, 60, 90].includes(days) ? days : 90;
  const startDate = addDays(today, -(normalizedDays - 1));
  return buildRange(
    `last${normalizedDays}` as DateRangePreset,
    startDate,
    today,
    `Last ${normalizedDays} days`,
  );
}
```

### Supported query parameters for `/api/leaks`

| Parameter | Example | Effect |
|---|---|---|
| `days` | `?days=30` | Rolling 30, 60, or 90-day window from today |
| `preset` | `?preset=thisMonth` | Named calendar preset |
| `startDate` + `endDate` | `?startDate=2026-04-01&endDate=2026-04-30` | Explicit calendar window |
| `preset=year&year=2025` | `?preset=year&year=2025` | Full calendar year |

**The route already supports `startDate`/`endDate` params.** They simply aren't used by the current Leaks page.

---

## 5. Frontend Page — `Leaks.tsx` (Full Source)

**File:** `client/src/pages/Leaks.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";

interface LeakItem {
  merchant: string;
  merchantFilter: string;
  category: string;
  bucket: "repeat_discretionary" | "micro_spend" | "high_frequency_convenience";
  label: string;
  monthlyAmount: number;
  occurrences: number;
  lastDate: string;
  confidence: "High" | "Medium" | "Low";
  averageAmount: number;
  recentSpend: number;
  transactionClass: "expense";
  recurrenceType?: "recurring" | "one-time";
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Leaks() {
  const [days, setDays] = useState(90);
  const leaksUrl = useMemo(() => `/api/leaks?days=${days}`, [days]);
  const { data: leaks = [], isLoading } = useQuery<LeakItem[]>({
    queryKey: [leaksUrl],
  });

  const totalWindowSpend = leaks.reduce((s, l) => s + l.recentSpend, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leak Detection</h1>
        <p className="text-muted-foreground mt-1">
          Identify discretionary and high-frequency spending patterns that may be avoidable.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-background p-1 w-fit">
        {[30, 60, 90].map((windowDays) => (
          <Button
            key={windowDays}
            variant={days === windowDays ? "default" : "ghost"}
            size="sm"
            onClick={() => setDays(windowDays)}
            data-testid={`button-leak-window-${windowDays}`}
          >
            {windowDays}D
          </Button>
        ))}
      </div>

      <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-warning/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <CardTitle>Potential Savings Identified</CardTitle>
          </div>
          <CardDescription>
            {leaks.length} discretionary spending pattern
            {leaks.length !== 1 ? "s" : ""} detected in the last {days} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <>
              <div
                className="text-4xl font-bold text-foreground mt-2"
                data-testid="text-total-window-leak-spend"
              >
                {fmt(totalWindowSpend)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Flagged discretionary spend inside the selected {days}-day window
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : leaks.length === 0 ? (
        <Card className="shadow-sm border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No leak patterns detected in the selected time window.
            </p>
            <Link href="/upload">
              <Button>Upload CSV to analyze</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <h3 className="text-lg font-semibold mt-8 mb-4">
            Ranked by Recent Window Spend
          </h3>
          <div className="space-y-4">
            {leaks.map((leak, i) => (
              <Card
                key={i}
                className="overflow-hidden transition-all hover:shadow-md"
                data-testid={`card-leak-${i}`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg">{leak.merchant}</h4>
                      <p className="text-sm text-muted-foreground">
                        {leak.label} ·{" "}
                        {leak.occurrences} occurrence
                        {leak.occurrences !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {leak.category.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          leak.confidence === "High"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : leak.confidence === "Medium"
                              ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400"
                              : "bg-muted text-muted-foreground"
                        }
                      >
                        {leak.confidence} Confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Monthly</p>
                      <p className="font-semibold">{fmt(leak.monthlyAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        {days}-Day Spend
                      </p>
                      <p className="font-bold text-destructive">
                        {fmt(leak.recentSpend)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Last Seen</p>
                      <p className="font-medium">{leak.lastDate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Avg Ticket</p>
                      <p className="font-medium">{fmt(leak.averageAmount)}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Link
                      href={`/transactions?merchant=${encodeURIComponent(leak.merchantFilter)}&category=${encodeURIComponent(leak.category)}&transactionClass=${leak.transactionClass}&days=${days}${leak.recurrenceType ? `&recurrenceType=${leak.recurrenceType}` : ""}`}
                    >
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 text-xs text-muted-foreground hover:text-primary"
                      >
                        View related transactions{" "}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

### Key implementation notes

- **State:** `const [days, setDays] = useState(90)` — completely local, initialized at 90, no connection to Dashboard state
- **Query key:** The full URL `/api/leaks?days=${days}` is the TanStack Query cache key. Changing `days` triggers a new fetch automatically.
- **`totalWindowSpend`:** Sums `leak.recentSpend` (not `monthlyAmount`) across all leaks — this is the raw dollar total in the window
- **Sorting:** The server returns leaks pre-sorted by `recentSpend` descending; the page renders them in that order
- **Drilldown link:** Passes `merchant`, `category`, `transactionClass`, `days`, and optionally `recurrenceType` as URL params to `/transactions`

---

## 6. Dashboard Connection

**File:** `client/src/pages/Dashboard.tsx`

### Leak data fetch (lines 76–88)

```typescript
export default function Dashboard() {
  const [days, setDays] = useState(90);
  const cashflowUrl = useMemo(() => `/api/cashflow?days=${days}`, [days]);
  const leaksUrl = useMemo(() => `/api/leaks?days=${days}`, [days]);

  const { data: cashflow, isLoading: cfLoading } = useQuery<CashflowSummary>({
    queryKey: [cashflowUrl],
  });

  const { data: leaks } = useQuery<LeakItem[]>({
    queryKey: [leaksUrl],
  });

  const totalLeakMonthly = leaks?.reduce((s, l) => s + l.monthlyAmount, 0) ?? 0;
```

The Dashboard's `days` state is **independent** from the Leaks page's `days` state. Both start at 90, but toggling one has no effect on the other.

### The Dashboard leak summary card (lines 188–209)

```tsx
<Card className="bg-gradient-to-br from-card to-card/50 shadow-sm border-warning/30">
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardDescription className="font-medium text-sm">Expense Leaks</CardDescription>
      <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
        <AlertTriangle className="h-4 w-4 text-warning" />
      </div>
    </div>
    <CardTitle
      className="text-3xl font-bold tracking-tight mt-1"
      data-testid="text-leak-count"
    >
      {leaks?.length ?? 0} items
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground mb-4">
      ~{fmt(totalLeakMonthly)}/mo in recurring charges.
    </p>
    <Link href="/leaks">
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs font-medium border-warning/50 hover:bg-warning/10"
        data-testid="button-review-leaks"
      >
        Review Leaks
      </Button>
    </Link>
  </CardContent>
</Card>
```

Note that `~{fmt(totalLeakMonthly)}/mo` sums `monthlyAmount` values (normalized monthly cost), not `recentSpend`. The "Review Leaks" button navigates to `/leaks` with no params — it does not carry the Dashboard's current `days` value.

### The Dashboard time toggle (lines 130–142)

```tsx
<div className="flex items-center gap-2 rounded-md border bg-background p-1">
  {[30, 60, 90].map((windowDays) => (
    <Button
      key={windowDays}
      variant={days === windowDays ? "default" : "ghost"}
      size="sm"
      onClick={() => setDays(windowDays)}
      data-testid={`button-window-${windowDays}`}
    >
      {windowDays}D
    </Button>
  ))}
</div>
```

---

## 7. The Disconnect — Current Limitation

There are two separate problems with the current implementation:

### Problem 1: Window state is not shared between Dashboard and Leaks page

When a user sets the Dashboard to 30 days and clicks "Review Leaks", they land on the Leaks page which always initializes at its own `useState(90)` default — 90 days. The context from the Dashboard is entirely lost in navigation.

The `href="/leaks"` on the "Review Leaks" button passes no params. The Leaks page has no way of knowing what window the user was looking at on the Dashboard. These are two isolated pieces of React state with no bridge.

### Problem 2: Rolling days is the wrong unit for the new version

The current system offers 30D / 60D / 90D rolling windows from today. The desired behavior for the new version is: **the user picks a specific calendar month on the Dashboard, and the Leaks page should show leaks for that exact month.** This is better because:

- "April 2026" is a natural unit of review for a business owner doing month-end reconciliation
- Month-to-month pattern comparison is more meaningful than arbitrary rolling windows
- Leak patterns within a month (e.g., "8 Starbucks visits in April") are more actionable
- The `monthlyAmount` field becomes redundant when `rangeDays ≈ 30` — `monthFactor ≈ 1` and `monthlyAmount ≈ recentSpend`

---

## 8. What Needs to Change for the Month-Based Version

The backend **does not need to change**. The `/api/leaks` route already accepts `startDate` and `endDate` params through `buildTransactionFilters()`. All five changes are on the frontend only.

### Change 1: Replace the Dashboard time selector with a month picker

Replace the `30D / 60D / 90D` button group with a month selector. Options:
- A `<Select>` populated with months derived from the user's actual transaction history (query the transaction date range from the API)
- An `<Input type="month" />` field for free entry
- A preset list like "This Month / Last Month / 2 Months Ago / 3 Months Ago"

The selected month produces:
```typescript
const startDate = "2026-04-01"  // first of selected month
const endDate = "2026-04-30"    // last of selected month
```

### Change 2: Pass date context through navigation to the Leaks page

When the user clicks "Review Leaks" from the Dashboard, the selected month's `startDate` and `endDate` must travel with the navigation. The cleanest approach is URL params:

```typescript
// Dashboard "Review Leaks" button:
<Link href={`/leaks?startDate=${startDate}&endDate=${endDate}`}>
  <Button>Review Leaks</Button>
</Link>
```

Alternatively, use the existing `sessionStorage` drilldown pattern already used for the Ledger:
```typescript
window.sessionStorage.setItem("leaks-context", JSON.stringify({
  startDate,
  endDate,
  label: "April 2026",
}));
window.location.href = "/leaks";
```

### Change 3: Leaks page reads the month context instead of using local day state

Replace `const [days, setDays] = useState(90)` with:

```typescript
// Read from URL params
const [searchParams] = useSearchParams();  // or parse window.location.search with wouter
const startDate = searchParams.get("startDate") ?? firstDayOfCurrentMonth();
const endDate = searchParams.get("endDate") ?? lastDayOfCurrentMonth();

// Build API URL
const leaksUrl = `/api/leaks?startDate=${startDate}&endDate=${endDate}`;
```

Remove the 30/60/90 toggle entirely or replace it with a month picker component that updates the URL params.

### Change 4: Update all label text that references days

| Current text | New text |
|---|---|
| `"detected in the last {days} days"` | `"detected in {monthLabel}"` (e.g., "April 2026") |
| `"{days}-Day Spend"` | `"Month Spend"` or `"{monthLabel} Spend"` |
| `&days=${days}` in Ledger drilldown links | `&startDate=${startDate}&endDate=${endDate}` |

### Change 5: Simplify or remove the "Monthly" stats column

When the range is a single calendar month (28–31 days), `monthFactor = max(1, rangeDays/30) ≈ 1.0`. This makes `monthlyAmount ≈ recentSpend`. Showing both values in the card is redundant. Consider:
- Removing the "Monthly" column and keeping only the single "Month Spend" value
- Or renaming "Monthly" to "Annualized" and computing `recentSpend * 12` to show yearly cost projection

---

## 9. Complete Data Flow Diagram

### Current flow (rolling days)

```
User sets Dashboard to 30D
        │
        ├──► GET /api/leaks?days=30
        │         │
        │         ▼
        │    buildTransactionFilters({ days: "30" }, { fallbackToRecent: true })
        │    resolveDateRange({ days: 30 })
        │    → startDate = today - 29 days
        │    → endDate   = today
        │    → rangeDays = 30
        │         │
        │         ▼
        │    storage.getTransactions(userId, { startDate, endDate })
        │    → SQL: WHERE date >= '...' AND date <= '...'
        │         │
        │         ▼
        │    detectLeaks(txns, { rangeDays: 30 })
        │    → monthFactor = max(1, 30/30) = 1.0
        │    → filter to expense + non-excluded categories
        │    → group by merchant::category
        │    → apply thresholds (isMicroSpend, isConvenience, isRepeatDiscretionary, isRecurring)
        │    → assign confidence
        │    → sort by recentSpend desc
        │         │
        │         ▼
        │    JSON: LeakItem[]
        │    → Dashboard renders leak count + totalLeakMonthly
        │
        └──► User clicks "Review Leaks"
                  │
                  ▼
             /leaks   ← NO params passed
                  │
                  ▼
             Leaks page: useState(90) initializes
             → GET /api/leaks?days=90  ← DIFFERENT window than Dashboard!
             → user sees different results than what Dashboard showed
```

### Target flow (calendar month)

```
User selects "April 2026" on Dashboard
        │
        ├──► GET /api/leaks?startDate=2026-04-01&endDate=2026-04-30
        │         │
        │         ▼
        │    buildTransactionFilters({ startDate: "2026-04-01", endDate: "2026-04-30" })
        │    resolveDateRange({ startDate: "2026-04-01", endDate: "2026-04-30" })
        │    → rangeDays = 30
        │         │
        │         ▼
        │    storage.getTransactions(userId, { startDate, endDate })
        │    → SQL: WHERE date >= '2026-04-01' AND date <= '2026-04-30'
        │         │
        │         ▼
        │    detectLeaks(txns, { rangeDays: 30 })
        │    → monthFactor = 1.0
        │    → monthlyAmount ≈ recentSpend (no normalization needed for a full month)
        │         │
        │         ▼
        │    JSON: LeakItem[] for April 2026
        │    → Dashboard renders leak count + "~$X/mo" for April
        │
        └──► User clicks "Review Leaks"
                  │
                  ▼
             /leaks?startDate=2026-04-01&endDate=2026-04-30
                  │
                  ▼
             Leaks page reads URL params
             → GET /api/leaks?startDate=2026-04-01&endDate=2026-04-30
             → SAME cache entry as Dashboard — no extra API call
             → header shows "April 2026"
             → results are identical to what Dashboard showed
```

---

## 10. Summary of All Files Involved

| File | Role | What it contributes |
|---|---|---|
| `server/cashflow.ts` | Core algorithm | `detectLeaks()` function, `LeakItem` interface, `ESSENTIAL_LEAK_EXCLUSIONS`, `DISCRETIONARY_CATEGORIES`, `getMonthFactor()`, `getRangeDaysFromTransactions()` |
| `server/routes.ts` | API route | `GET /api/leaks` — wires `buildTransactionFilters()` + `storage.getTransactions()` + `detectLeaks()` |
| `server/dateRanges.ts` | Date resolution | `resolveDateRange()` — converts any input format (`days`, `preset`, `startDate`/`endDate`, `year`) to a normalized `{ startDate, endDate, rangeDays, label }` object |
| `server/storage.ts` | Data access | `getTransactions(userId, filters)` — executes the SQL query with date and other filters applied |
| `client/src/pages/Leaks.tsx` | Standalone UI | Full leaks list page: 30/60/90 toggle, summary card, individual leak cards with all metadata and Ledger drilldown links |
| `client/src/pages/Dashboard.tsx` | Dashboard surface | Compact leak summary card: count, `~$X/mo` total, "Review Leaks" button |

### Files that do NOT need changes for the month-based version

- `server/cashflow.ts` — already accepts any `rangeDays`
- `server/routes.ts` — already accepts `startDate`/`endDate`
- `server/dateRanges.ts` — already handles `startDate`/`endDate` input
- `server/storage.ts` — already filters by `startDate`/`endDate`

### Files that DO need changes for the month-based version

- `client/src/pages/Dashboard.tsx` — replace rolling-day toggle with month picker; update "Review Leaks" link to pass date params
- `client/src/pages/Leaks.tsx` — remove local `days` state; read `startDate`/`endDate` from URL; update all labels that reference a day count

---

*This document was generated from a full source audit of the PocketPulse codebase (April 2026). All inline code is copied directly from the actual source files.*
