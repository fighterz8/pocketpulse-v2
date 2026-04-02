# Phase 4 -- branch progress log

**Branch:** `feature/phase-4-recurring-leak-review`

**Last updated:** 2026-04-02

## Phase 4 implementation scope: **complete**

Phase 4 fixes the CSV parser sign bug and delivers recurring transaction detection with a review interface for marking patterns as essential, leak-related, or dismissed.

---

## Task tracking

| Task | Status | Summary |
|------|--------|---------|
| **1** -- Branch setup + design spec | done | Created branch, design spec, progress log |
| **2** -- CSV parser sign bug fix | done | Prefer debit/credit over unsigned Amount column |
| **3** -- recurring_reviews schema | done | Table with uniqueIndex on (userId, candidateKey) |
| **4** -- Recurrence detector engine | done | Grouping, frequency detection, confidence scoring, 16 tests |
| **5** -- Storage functions | done | Atomic upsert via onConflictDoUpdate, list function |
| **6** -- API routes | done | Candidate listing, review upsert, review listing, 3 route tests |
| **7** -- Leaks page UI | done | Card-based review with filter tabs, summary bar, action buttons |
| **8** -- Tests + documentation | done | 7 client tests, progress log, README, full suite: 147 tests passing |

---

## Requirement traceability

| Requirement | Implementation |
|-------------|---------------|
| RL-01 (detect recurring charges) | recurrenceDetector.ts detection pipeline |
| RL-01.1 (merchant/frequency/average factors) | Merchant grouping, median interval, amount bucketing |
| RL-02 (display in review interface) | Leaks.tsx card-based UI |
| RL-02.1 (required details) | Card shows merchant, avg amount, frequency, last seen, reason |
| RL-03 (mark as essential) | Essential action button + PATCH review endpoint |
| RL-04 (mark as leak) | Leak action button + PATCH review endpoint |
| RL-05 (dismiss) | Dismiss action button + PATCH review endpoint |
| RL-06 (store review results) | recurring_reviews table + atomic upsert |

---

## Bug fix: CSV parser sign detection

**Root cause:** `csvParser.ts` used the unsigned Amount column even when Debit/Credit columns were present. All amounts stayed positive, so `inferFlowType` returned "inflow" for every row, and the classifier marked everything as "income".

**Fix:** Inverted column priority -- when debit/credit columns exist, always use `deriveSignedAmount` from them. Only fall back to Amount when debit/credit are absent.

---

## Recurring detection algorithm summary

**Pipeline:** Group by merchant key -> bucket by amount (25% tolerance) -> detect frequency (median interval) -> score confidence (4 weighted signals) -> filter (>=0.35) -> sort

**Confidence signals:**
- Interval regularity (0.35): cv = stdDev / medianInterval; score = max(0, 1 - cv*2)
- Amount consistency (0.25): amtCv * 3.33 penalty (2.0 for utilities/insurance/health)
- Transaction count (0.20): min(1, (n-2)/4)
- Recency (0.20): full if last charge <= 1.5x expected interval; zero if >= 3x

**Candidate key:** `merchantKey|roundedAmount` -- separates different subscriptions at same merchant

**Review statuses:**
- `unreviewed` -- not yet reviewed, surfaced in leak review
- `essential` -- user confirms needed, counted in essential recurring expenses
- `leak` -- user flags as wasteful, counted in leak spend
- `dismissed` -- user says ignore, hidden from review

**Storage:** `recurring_reviews` table with unique index on (userId, candidateKey), atomic upsert via onConflictDoUpdate

---

## Hotfix: Unsigned CSV classification

**Problem:** Bank CSVs with only a single Amount column (all positive, no sign) caused every transaction to be classified as income. The classifier's inflow-to-income shortcut (line 425) skipped keyword matching entirely — Netflix with +15.99 got `category: "income"` instead of `"subscriptions"`.

**Fix (3 parts):**
1. **Classifier restructure:** keyword rules now run FIRST, before any transactionClass decision. When keywords match an expense-type category (subscriptions, groceries, dining, etc.) but flowType is "inflow", the classifier returns `flowOverride: "outflow"` and sets `transactionClass: "expense"`.
2. **Route handler:** respects `flowOverride` to correct the stored flowType and negate the amount (positive → negative for outflows).
3. **CSV parser:** detects Type/Transaction Type/DR-CR columns as an additional sign source. Banking convention: Debit = money out (negative), Credit = money in (positive).

**Impact:** Netflix with unsigned +15.99 now correctly classifies as subscriptions/expense instead of income/income. 11 new tests (8 classifier, 1 integration, 2 CSV parser).

**Test suite:** 158 tests passing (up from 147).

---

## Known tuning opportunities

- Confidence thresholds could be adjusted after real user data analysis
- Date floor (e.g. last 18 months) could bound computation for large datasets
- Price change detection (split bucket at >20% shift) is designed but not yet fully tested with edge case data

---

## Files changed

| File | Change |
|------|--------|
| `server/csvParser.ts` | Fix: prefer debit/credit over unsigned Amount; detect Type/DR-CR columns |
| `server/csvParser.test.ts` | 4 tests: sign detection + Type column detection |
| `server/classifier.ts` | Keyword-first restructure, flowOverride, TRANSFER_KEYWORDS extraction |
| `server/classifier.test.ts` | 8 new unsigned-amount classification tests |
| `server/upload-classification.test.ts` | New: integration test for unsigned CSV pipeline |
| `shared/schema.ts` | Add recurringReviews table + REVIEW_STATUSES |
| `server/schema.test.ts` | 2 new tests for schema validation |
| `server/recurrenceDetector.ts` | New: detection engine |
| `server/recurrenceDetector.test.ts` | New: 16 tests |
| `server/storage.ts` | Add upsertRecurringReview, listRecurringReviewsForUser |
| `server/routes.ts` | 3 new routes + flowOverride amount correction in upload path |
| `server/recurring-routes.test.ts` | New: 3 route tests |
| `client/src/hooks/use-recurring.ts` | New: TanStack Query hooks |
| `client/src/pages/Leaks.tsx` | Replace placeholder with full review UI |
| `client/src/pages/Leaks.test.tsx` | New: 7 client tests |
| `client/src/index.css` | Add leaks-* styles |
| `docs/superpowers/specs/2026-04-02-phase-4-recurring-leak-review-design.md` | Design spec |
| `docs/superpowers/plans/2026-04-02-phase-4-recurring-leak-review.md` | Implementation plan |
| `docs/phase-logs/phase-4-recurring-leak-review-progress.md` | This file |
