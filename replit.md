# PocketPulse

Small-business cashflow analysis web application. Single-owner microbusiness workflow: upload CSV bank statements from multiple accounts, categorize transactions, identify recurring expense leaks, and view safe-to-spend dashboard insights.

## GitHub
https://github.com/fighterz8/pocketpulse-v1

## Architecture
- **Frontend**: React + Vite on port 5000 (webview port)
- **Backend**: Express + tsx on port 5001 (`PORT=5001 SKIP_VITE=1 npx tsx server/index.ts`)
- **Database**: PostgreSQL via `DATABASE_URL`; Drizzle ORM; schema in `shared/schema.ts`
- **Auth**: express-session + bcrypt; single-owner workspace
- **Styling**: Tailwind CSS v3 + existing plain CSS (coexist via `preflight: false`); config at `tailwind.config.cjs` + `postcss.config.cjs`

## Port Layout
- Vite dev server: 5000 (proxies `/api` to 5001)
- Express API: 5001

## Category System (V1_CATEGORIES — 21 categories)
income, transfers, housing, utilities, groceries, dining, coffee, delivery, convenience, gas, parking, travel, auto, fitness, medical, insurance, shopping, entertainment, software, fees, other

## Key Files
- `shared/schema.ts` — DB schema, V1_CATEGORIES, Zod insert schemas
- `server/classifier.ts` — 12-pass rules-based classifier
- `server/ai-classifier.ts` — GPT-4o-mini batch classifier
- `server/reclassify.ts` — Two-phase rules+AI pipeline (skips user-corrected)
- `server/routes.ts` — All API routes
- `server/storage.ts` — Drizzle DB queries
- `server/transactionUtils.ts` — getDirectionHint() direction detection
- `client/src/pages/Ledger.tsx` — Ledger with inline editing, AI progress bar, Export CSV
- `client/src/pages/Dashboard.tsx` — Tailwind-redesigned: safe-to-spend hero, 30D/60D/90D period selector, recurring/one-time/discretionary KPIs, expense leaks card, category breakdown, trend, recent transactions
- `client/src/hooks/use-dashboard.ts` — PeriodPreset type, presetToRange helper, enhanced DashboardSummary type
- `server/dashboardQueries.ts` — Enhanced: recurringIncome, recurringExpenses, oneTimeIncome, oneTimeExpenses, discretionarySpend, safeToSpend, utilitiesMonthly, softwareMonthly, expenseLeaks
- `client/src/pages/RecurringLeaks.tsx` — Leak review page

## Features Implemented
- User authentication (login/logout, session)
- Multi-file CSV upload with account labeling
- Transaction normalization and unified ledger
- Rules-based + AI categorization (21 categories)
- Inline category/class/recurrence editing in ledger
- Filter/search ledger (account, category, class, recurrence, date, excluded)
- **Export CSV**: `GET /api/transactions/export` — exports current filter view
- AI re-categorization button with animated progress bar
- Recurring charge detection and leak review
- Safe-to-spend dashboard with date range selection
- Wipe/reset workspace actions

## CSRF Rule
All non-GET API calls MUST use `apiFetch` from `client/src/lib/api.ts`

## Spec Alignment (PDF milestone doc)
- AU: Authentication ✅
- UP: Upload and Import ✅
- LD: Ledger and Transaction Review ✅
- RL: Recurring Leak Review ✅
- DB: Dashboard and Reporting ✅
- EX: CSV Export ✅ (filtered ledger export, not raw upload files)
- AI categorization: optional future enhancement per spec, implemented as bonus feature
