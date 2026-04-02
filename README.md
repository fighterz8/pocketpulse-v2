# PocketPulse

Small-business cashflow analysis web application.

## Current status

**Phase 1** (auth + account setup) merged to `main`.
**Phase 2** (upload + import) on branch `feature/phase-2-upload-import`.
**Phase 3** (ledger review) on branch `feature/phase-3-ledger-review`.
**Phase 4** (recurring leak review + CSV bug fix) on branch `feature/phase-4-recurring-leak-review`.
**Phase 5** (dashboard + auto re-classify) on branch `feature/phase-5-dashboard`.

### Phase 5 -- what's implemented

- **Auto re-classification** (`server/reclassify.ts`): On each `GET /api/dashboard-summary`, the server re-runs the keyword-first classifier on all transactions for the user that are not `userCorrected`, aligning `amount`, `flowType`, `transactionClass`, and `category` with the current upload pipeline. Idempotent for rows that already match. No UI control — fully silent.
- **Bulk updates** (`server/storage.ts`): `bulkUpdateTransactions(userId, updates)` applies batched corrections inside one SQL transaction with a `userId` guard on every row.
- **Dashboard aggregations** (`server/dashboardQueries.ts`): Parallel queries for total inflow/outflow and transaction count, spending by category (outflows), monthly trend, the 10 most recent transactions, and linked account count. Respects `excludedFromAnalysis === false`.
- **API** (`server/routes.ts`): `GET /api/dashboard-summary` (authenticated) runs re-classify then returns `buildDashboardSummary`.
- **Dashboard UI** (`client/src/pages/Dashboard.tsx`, `client/src/hooks/use-dashboard.ts`, `client/src/index.css`): KPI cards (frosted glass, colored borders: green income, red spending, blue net/count), category bar chart with sky-to-blue gradient fills, monthly table, recent transactions, empty state with upload link. Amount colors use the same classes as the ledger (`.ledger-amount--inflow` / `--outflow`).
- **Ledger** (`client/src/pages/Ledger.tsx`): Category list imported from `shared/schema` (`V1_CATEGORIES`).

### Phase 4 -- what's implemented

- **CSV parser bug fix** (`server/csvParser.ts`): debit/credit columns now take priority over unsigned Amount columns. Fixes the bug where all transactions were classified as income because the parser ignored direction information in debit/credit columns.
- **Recurring detection engine** (`server/recurrenceDetector.ts`): groups outflow transactions by normalized merchant key, sub-groups by amount bucket (25% tolerance), detects frequency via median interval matching (weekly/monthly/quarterly/annual), and scores confidence from 4 weighted signals (interval regularity 0.35, amount consistency 0.25, count 0.20, recency 0.20). Candidate key format: `merchantKey|roundedAmount`.
- **Review persistence** (`shared/schema.ts`, `server/storage.ts`): `recurring_reviews` table with unique index on `(userId, candidateKey)`. Atomic upsert via `onConflictDoUpdate`. Statuses: unreviewed, essential, leak, dismissed.
- **API routes** (`server/routes.ts`): `GET /api/recurring-candidates` (runs detector, merges reviews), `PATCH /api/recurring-reviews/:candidateKey` (upsert review), `GET /api/recurring-reviews` (list all).
- **Leaks page** (`client/src/pages/Leaks.tsx`): card-based review UI with filter tabs (All/Unreviewed/Essential/Leak/Dismissed), summary bar with status counts, candidate cards showing merchant name, average amount, frequency, confidence badge, reason flagged, and action buttons.

### Phase 3 -- what's implemented

- **Ledger table** (`client/src/pages/Ledger.tsx`): full transaction table with columns for date, merchant, amount, category, class, recurrence, and status badges. Paginated with previous/next controls.
- **Search and filters:** debounced merchant/description search, filter dropdowns for account, category, transaction class, recurrence type, excluded status, and date range (from/to). Clear filters button.
- **Inline editing:** click any row to expand an edit panel with all approved fields (date, merchant, amount, category, class, recurrence, exclusion toggle + reason). Saves via `PATCH /api/transactions/:id` and sets `userCorrected=true`, `labelSource=manual`.
- **Exclusion toggle:** per-row quick exclude/include button directly in the table without opening the full editor.
- **CSV export:** export button downloads filtered transactions as CSV via `GET /api/export/transactions`.
- **Wipe/reset:** Data Management danger zone with two-click confirmation for "Wipe Imported Data" (transactions + uploads) and "Reset Workspace" (everything including accounts).
- **Enhanced API:** `PATCH /api/transactions/:id` (edit with validation), `DELETE /api/transactions` (wipe), `DELETE /api/workspace-data` (reset), `GET /api/export/transactions` (CSV), enhanced `GET /api/transactions` with full filter query params.
- **Storage layer:** `updateTransaction`, `getTransactionById`, `deleteAllTransactionsForUser`, `deleteWorkspaceDataForUser`, `listAllTransactionsForExport`, enhanced `listTransactionsForUser` with 8 filter dimensions.
- **use-transactions hook** (`client/src/hooks/use-transactions.ts`): TanStack Query integration with mutations for update, wipe, and reset.

### Phase 2 -- what's implemented

- **Schema:** `uploads` and `transactions` tables added to `shared/schema.ts` alongside Phase 1 tables (users, accounts, user_preferences, session). V1 category set exported as `V1_CATEGORIES`.
- **CSV parser** (`server/csvParser.ts`): auto-detects date/description/amount columns, supports single-amount and split debit/credit formats, common date formats, quoted fields, currency amounts. Skips bad rows with warnings.
- **Classifier** (`server/classifier.ts`): rules-based keyword matching across 16 V1 categories, transaction class detection (income/expense/transfer/refund), recurrence hints for known subscription merchants.
- **Transaction utilities** (`server/transactionUtils.ts`): amount normalization, signed-amount derivation, flow-type inference, merchant cleanup (POS prefix stripping, title-casing).
- **Upload API:** `POST /api/upload` (multipart CSV + per-file account mapping), `GET /api/uploads` (upload history), `GET /api/transactions` (paginated, optional account filter).
- **Upload UI** (`client/src/pages/Upload.tsx`): drag-and-drop / file picker, queued file list with per-file account selector, file removal, client-side validation (CSV-only, 5 MB, non-empty), import with per-file results and row counts, post-import link to ledger.

### Phase 1 -- what's implemented

- **Backend:** Express app with auth routes (`register`, `login`, `logout`, `me`), account CRUD, health check. Sessions in PostgreSQL via `connect-pg-simple`.
- **Frontend:** React + Wouter + TanStack Query; auth gating, first-account onboarding, protected app shell with sidebar navigation.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, and `APP_ORIGIN` (and `PORT` if needed).
2. `npm install`
3. `npm run db:push` -- applies `shared/schema.ts` (including the `session`, `uploads`, and `transactions` tables) to your database.

## Manual verification

With PostgreSQL available and `npm run dev` running (default [http://localhost:5000](http://localhost:5000)):

### Phase 1 checks (auth)
1. **Register** -- Create account, land in account setup, create first account, enter protected shell.
2. **Invalid login** -- Wrong password shows "Invalid email or password".
3. **Session persistence** -- Reload stays authenticated.
4. **Logout** -- Returns to auth view, no shell access until re-login.

### Phase 2 checks (upload)
1. **Navigate to Upload** -- Click "Upload" in the sidebar; see the drop zone.
2. **Add CSV files** -- Drag or browse to select `.csv` files; files appear in the queue with account selector.
3. **Account assignment** -- If only one account exists, it auto-selects. Otherwise, select an account per file.
4. **Remove queued file** -- Click the X button to remove a file from the queue.
5. **Reject non-CSV** -- Try uploading a non-CSV file; client-side validation rejects it.
6. **Import** -- Click "Import N files"; files are parsed, classified, and stored. Results show per-file row counts.
7. **View results** -- After import, see success banner with link to "Review in Ledger".
8. **Upload history** -- `GET /api/uploads` returns prior upload records.
9. **Transaction listing** -- `GET /api/transactions` returns paginated transactions from the import.

### Phase 4 checks (recurring leak review)
1. **Re-upload CSV files** -- If your CSV has Debit/Credit columns, verify transactions now have correct inflow/outflow classification (not all income).
2. **Navigate to Recurring Leak Review** -- Click "Leaks" in the sidebar; see detected recurring patterns (or empty state if no recurring charges in data).
3. **Review summary** -- Summary bar at the top shows counts: Total, Unreviewed, Essential, Leaks, Dismissed.
4. **Candidate cards** -- Each card shows merchant name, average amount, frequency, confidence badge, last seen date, expected next charge, and reason flagged.
5. **Mark as essential** -- Click "Essential" on a card; card gets green left border, button stays highlighted.
6. **Mark as leak** -- Click "Leak" on a card; card gets amber left border.
7. **Dismiss** -- Click "Dismiss"; card fades out.
8. **Filter tabs** -- Click Unreviewed/Essential/Leaks/Dismissed tabs to filter the view. Verify review decisions persist across tab switches.
9. **Persistence** -- Reload the page; review decisions are still applied.

### Phase 3 checks (ledger)
1. **Navigate to Ledger** -- Click "Ledger" in the sidebar; see the transaction table (or empty state if no data).
2. **Pagination** -- If >50 transactions, use Previous/Next to page through.
3. **Search** -- Type in the search box; table filters by merchant/description after brief debounce.
4. **Filter dropdowns** -- Select values in account, category, class, recurrence, excluded status, or date range filters; table updates.
5. **Clear filters** -- "Clear filters" button resets all filters.
6. **Inline edit** -- Click a row; edit panel expands below. Change any field and click Save. Verify the row shows "edited" badge.
7. **Exclusion toggle** -- Click the checkbox column on a row to toggle exclude/include. Verify "excluded" badge appears.
8. **CSV export** -- Click "Export CSV"; browser downloads `pocketpulse-transactions.csv` with current filters applied.
9. **Wipe data** -- In the danger zone, click "Wipe Imported Data", then "Confirm Wipe". Transactions and uploads are deleted; accounts remain.
10. **Reset workspace** -- Click "Reset Workspace", then "Confirm Reset". All data is deleted; redirected to home page.

### Phase 5 checks (dashboard + auto re-classify)
1. **Open Dashboard** -- After signing in with at least one account, the home route shows the dashboard (not a placeholder). With no transactions, you should see the empty state and a link to Upload.
2. **Import or use existing data** -- Upload a CSV or use existing transactions; reload the dashboard. KPI cards should show income, spending, net cashflow, and count; category bars and monthly table should reflect non-excluded rows only.
3. **Silent re-classify** -- If you have legacy rows that were misclassified as income with positive amounts, opening the dashboard (or calling `GET /api/dashboard-summary`) should correct them automatically; the ledger should then show red outflows/green inflows consistently. User-edited rows (`userCorrected`) are left alone.
4. **Recent activity** -- The "Recent Transactions" section lists up to 10 rows; "View all" goes to the Ledger (`/transactions`).
5. **Exclusions** -- Transactions marked excluded from analysis should not appear in dashboard totals or breakdowns.

Automated checks: `npm test` and `npm run check`. Optional: `npm run build` for a production bundle sanity check.

## Stack

TypeScript, Node.js, Express, React, Vite, Wouter, TanStack Query, PostgreSQL, Drizzle ORM, express-session, connect-pg-simple, bcrypt, Vitest.

## Scripts

| Script    | Description                                      |
| --------- | ------------------------------------------------ |
| `npm run dev` | Development: Express on `PORT` (default `5000`) with Vite dev middleware |
| `npm run dev:vite` | Optional split setup: standalone Vite on port 5000; `/api` proxies to `http://localhost:5001` |
| `npm run build` | Production client bundle and compiled server |
| `npm run start` | Production: compiled Express serves API + static SPA |
| `npm run check` | Typecheck with `tsc --noEmit`                    |
| `npm test`    | Run Vitest                                       |
| `npm run db:push` | Push Drizzle schema to the database          |

## Ports

- **Default development** (`npm run dev`): one process on `PORT` (default `5000`); same-origin `/api` and Vite HMR.
- **Optional split** (`dev:vite` + `tsx server/index.ts`): Vite on `5000`; server on `5001`.
- **Production**: `PORT` (default `5000`).

## Evidence and handoff

Phase logs and design specs live in `docs/`. See:
- `docs/phase-logs/phase-1-auth-account-setup-progress.md`
- `docs/phase-logs/phase-2-upload-import-progress.md`
- `docs/phase-logs/phase-3-ledger-review-progress.md`
- `docs/superpowers/specs/2026-04-01-phase-1-auth-account-setup-design.md`
- `docs/superpowers/specs/2026-04-02-phase-2-upload-import-design.md`
- `docs/superpowers/specs/2026-04-02-phase-3-ledger-review-design.md`
- `docs/phase-logs/phase-4-recurring-leak-review-progress.md`
- `docs/superpowers/specs/2026-04-02-phase-4-recurring-leak-review-design.md`
