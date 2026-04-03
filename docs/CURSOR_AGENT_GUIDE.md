# PocketPulse — Cursor Agent Guide

> **Purpose:** This document is the single reference you need to make changes to PocketPulse without ingesting the entire repo. Read this before touching any file.

---

## 1. What Is This App

**PocketPulse** is a cashflow analysis web app for small-business owners.

| Phase | Feature |
|---|---|
| 1 | Auth + onboarding (register → create accounts) |
| 2 | CSV upload (multi-file, per-file account assignment) |
| 3 | Ledger review (filter, edit, exclude, export transactions) |
| 4 | Recurring leak review (flag/approve/dismiss recurring charges) |
| 5 | Dashboard + auto-reclassify |

All five phases are **complete and in production**.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Wouter (routing), TanStack Query v5 |
| Backend | Node.js, Express, TypeScript (`tsx` for dev, compiled for prod) |
| Database | PostgreSQL via Drizzle ORM |
| Auth | `express-session` + bcrypt |
| Security | `helmet`, `express-rate-limit`, `csrf-csrf` (double-submit CSRF) |
| Styling | Plain CSS (no Tailwind) — light-mode only by design |

---

## 3. Repository Layout

```
/
├── client/
│   ├── index.html                  ← OG / Twitter meta tags live here
│   └── src/
│       ├── App.tsx                 ← Route declarations (wouter)
│       ├── index.css               ← ALL styles — single file, light-mode only
│       ├── main.tsx
│       ├── hooks/
│       │   ├── use-auth.ts         ← Auth + accounts state
│       │   ├── use-transactions.ts ← Transactions CRUD, wipe, reset
│       │   ├── use-uploads.ts      ← CSV upload mutations
│       │   ├── use-dashboard.ts    ← Dashboard summary + reclassify
│       │   └── use-recurring.ts    ← Recurring-leak review state
│       ├── lib/
│       │   ├── api.ts              ← apiFetch (CSRF-aware fetch wrapper) ⚠️ USE THIS
│       │   └── queryClient.ts      ← TanStack Query client factory
│       ├── pages/
│       │   ├── Auth.tsx            ← Login / register
│       │   ├── AccountSetup.tsx    ← Post-register account creation
│       │   ├── Upload.tsx          ← CSV upload UI
│       │   ├── Ledger.tsx          ← Transaction table + wipe/reset
│       │   ├── Leaks.tsx           ← Recurring leak review
│       │   └── Dashboard.tsx       ← KPI cards + cashflow analysis
│       └── components/
│           └── layout/
│               └── AppLayout.tsx   ← Sidebar nav + page shell
├── server/
│   ├── index.ts                    ← Express entry point (port logic, SKIP_VITE)
│   ├── routes.ts                   ← All API routes (thin — delegates to storage)
│   ├── storage.ts                  ← All DB queries (IStorage interface + impl)
│   ├── db.ts                       ← Drizzle client singleton
│   ├── auth.ts                     ← requireAuth middleware
│   ├── csrf.ts                     ← doubleCsrf configuration
│   ├── classifier.ts               ← Transaction auto-classifier
│   ├── recurrenceDetector.ts       ← Recurring charge detection logic
│   ├── reclassify.ts               ← Bulk reclassify worker
│   ├── csvParser.ts                ← CSV → transaction row parser
│   ├── dashboardQueries.ts         ← Heavy aggregation queries for dashboard
│   └── transactionUtils.ts         ← Shared transaction helpers
├── shared/
│   └── schema.ts                   ← Drizzle schema + Zod insert types (source of truth)
├── drizzle.config.ts
├── vite.config.ts                  ← Vite on :5000, proxy /api → :5001
└── docs/
    └── CURSOR_AGENT_GUIDE.md       ← You are here
```

---

## 4. Database Schema

All tables are defined in **`shared/schema.ts`**. Never write raw SQL — use `npm run db:push` to sync schema changes.

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Account owners | `id`, `email`, `passwordHash`, `displayName`, `companyName` |
| `user_preferences` | Per-user settings | `userId`, `currency`, `timezone` |
| `accounts` | Bank/card accounts per user | `id`, `userId`, `label`, `lastFour`, `accountType` |
| `uploads` | CSV upload records | `id`, `userId`, `accountId`, `filename`, `rowCount`, `status` |
| `transactions` | All transaction rows | `id`, `userId`, `uploadId`, `accountId`, `date`, `amount`, `merchant`, `flowType`, `transactionClass`, `recurrenceType`, `category`, `labelSource`, `aiAssisted`, `userCorrected`, `excludedFromAnalysis` |
| `recurring_reviews` | User decisions on recurring charges | `id`, `userId`, `candidateKey`, `status` (`unreviewed`/`essential`/`leak`/`dismissed`), `reviewedAt` |
| `session` | Express session store | (managed by `connect-pg-simple`) |

**⚠️ Never change ID column types.** `id: serial(...)` must stay `serial`. Changing to UUID breaks migrations.

---

## 5. API Endpoints

All routes are registered in `server/routes.ts`. Routes marked `[auth]` require a valid session.

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/csrf-token` | Returns `{ token }` — fetch before any mutation |
| GET | `/api/auth/me` | Returns `{ authenticated, user }` |
| POST | `/api/auth/register` | Body: `{ email, password, displayName, companyName? }` |
| POST | `/api/auth/login` | Body: `{ email, password }` |
| POST | `/api/auth/logout` | Destroys session |

### Accounts `[auth]`
| Method | Path | Description |
|---|---|---|
| GET | `/api/accounts` | List user's accounts |
| POST | `/api/accounts` | Body: `{ label, lastFour?, accountType? }` |

### Upload `[auth]`
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Multipart `files[]` + `metadata` JSON field |
| GET | `/api/uploads` | List upload records |

### Transactions `[auth]`
| Method | Path | Description |
|---|---|---|
| GET | `/api/transactions` | Paginated list with filters (see below) |
| PATCH | `/api/transactions/:id` | Edit a transaction |
| DELETE | `/api/transactions` | Body: `{ confirm: true }` — wipes all user transactions |
| GET | `/api/export/transactions` | CSV download |

Transaction filter query params: `page`, `limit`, `accountId`, `search`, `category`, `transactionClass`, `recurrenceType`, `dateFrom`, `dateTo`, `excluded`

### Dashboard `[auth]`
| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard-summary` | KPI aggregation |
| POST | `/api/dashboard-summary/reclassify` | Runs bulk AI reclassifier |

### Recurring Leaks `[auth]`
| Method | Path | Description |
|---|---|---|
| GET | `/api/recurring-candidates` | Detected recurring charges |
| PATCH | `/api/recurring-reviews/:candidateKey` | Body: `{ status: "essential"|"leak"|"dismissed" }` |
| GET | `/api/recurring-reviews` | Saved review decisions |

### Workspace `[auth]`
| Method | Path | Description |
|---|---|---|
| DELETE | `/api/workspace-data` | Body: `{ confirm: true }` — wipes uploads + transactions + reviews |

---

## 6. CSRF Protection — Critical

The app uses **double-submit CSRF** (`csrf-csrf` package). **Every non-GET API request must include a valid CSRF token.**

### How it works
1. On app load (or before a mutation), call `GET /api/csrf-token` → `{ token }`
2. Include the token as `x-csrf-token` header on every POST / PATCH / DELETE request
3. The server validates it before processing

### How to make API calls

**Always use `apiFetch` from `client/src/lib/api.ts` for any mutating request.** Never use raw `fetch()` for POST/PATCH/DELETE:

```ts
import { apiFetch } from "../lib/api";

// Correct — CSRF token injected automatically
const res = await apiFetch("/api/some-endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

// Wrong — will get 403 CSRF error
const res = await fetch("/api/some-endpoint", { method: "POST", ... });
```

`apiFetch` caches the token and auto-retries once if the token expires.

**GET requests** can use raw `fetch()` — CSRF is not required for reads.

---

## 7. Frontend Patterns

### Routing
Defined in `client/src/App.tsx` using `wouter`:
- `/` → Dashboard
- `/upload` → Upload
- `/transactions` → Ledger
- `/leaks` → Recurring Leaks
- Unauthenticated users are redirected to the Auth page

### Data Fetching
All server state lives in TanStack Query via custom hooks. **Don't add fetch calls to components directly — add them to the relevant hook.**

| Hook | Manages |
|---|---|
| `useAuth()` | Session, user info, accounts, login/register/logout/createAccount |
| `useTransactions(filters)` | Transaction list, update, wipeData, resetWorkspace |
| `useUploads()` | Upload history and the upload mutation |
| `useDashboard()` | KPI data and reclassify trigger |
| `useRecurring()` | Recurring candidates and review mutations |

### Test IDs
Every interactive and meaningful data element must have a `data-testid` attribute:
- Interactive: `{action}-{target}` → e.g. `button-submit`, `input-email`
- Display: `{type}-{content}` → e.g. `text-username`, `status-payment`
- Dynamic lists: `{type}-{description}-{id}` → e.g. `card-transaction-${tx.id}`

### Styling
- Single CSS file: `client/src/index.css`
- **Light mode only** — `color-scheme: light` is set globally and inside `.app-protected`
- No `@media (prefers-color-scheme: dark)` overrides inside `.app-protected` — they cause white-on-white text bugs
- Uses CSS custom properties for color tokens (`--color-*`, `--surface-*`, etc.)
- Glassmorphism: `.app-sidebar`, `.dash-kpi`, `.dash-card` use `backdrop-filter: blur` + translucent gradients
- Dark mode toggle is **intentionally not implemented yet** — will be added as a feature later

---

## 8. Development Environment

### Ports
| Service | Port | Notes |
|---|---|---|
| Vite (frontend) | 5000 | Proxies `/api/*` to :5001 |
| Express API | 5001 | `PORT=5001 SKIP_VITE=1 npx tsx server/index.ts` |

### Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (managed by Replit) |
| `SESSION_SECRET` | Yes (prod) | Express session signing key |
| `CSRF_SECRET` | No | Falls back to `SESSION_SECRET` then `"dev-csrf-secret"` |
| `NODE_ENV` | Auto | `"production"` in prod — changes cookie security flags |
| `PORT` | Auto | Defaults to 5001 in dev, 5000 in prod |
| `SKIP_VITE` | Dev only | Set to `1` when running Express separately from Vite |

**⚠️ Never hardcode secrets. Environment variables are managed by Replit — do not add them to `.env` files.**

### Workflows (Replit)
Two persistent processes:
1. **Frontend (Vite)** — `npx vite` — serves the React app on :5000
2. **Start application** — `PORT=5001 SKIP_VITE=1 npx tsx server/index.ts` — Express API on :5001

The Replit agent manages starting/stopping/restarting these. Cursor agents should not attempt to run or kill these processes.

### Database Migrations
Schema changes flow: edit `shared/schema.ts` → run `npm run db:push`.  
**Do not write manual SQL migrations.**

### GitHub
Remote: `https://github.com/fighterz8/pocketpulse-v1`  
Branch: `main`  
GitHub pushes are handled by the Replit agent using a stored `GITHUB_TOKEN`. Cursor agents should commit locally; the Replit agent will push.

---

## 9. What Replit Agent Handles (Don't Replicate in Cursor)

The Replit environment has capabilities Cursor cannot access:

| Capability | Replit Agent | Cursor Agent |
|---|---|---|
| Starting / stopping workflows | ✅ | ❌ |
| Setting environment variables / secrets | ✅ | ❌ |
| Pushing to GitHub (token-based) | ✅ | ❌ |
| PostgreSQL access (direct DB queries) | ✅ | ❌ |
| Installing npm packages | ✅ | ✅ (via package.json edits) |
| Editing source files | ✅ | ✅ |
| Running `npm run db:push` | ✅ | ✅ (if DB is accessible) |
| Running tests (`npm test`) | ✅ | ✅ |

---

## 10. Adding a New Feature — Checklist

1. **Schema first** — add/modify tables in `shared/schema.ts`, run `npm run db:push`
2. **Storage** — add CRUD methods to `IStorage` interface + `DatabaseStorage` implementation in `server/storage.ts`
3. **Routes** — add thin route handlers in `server/routes.ts` (validate input with Zod, call storage, return JSON)
4. **Hook** — add or extend a hook in `client/src/hooks/` using `useQuery` / `useMutation` + `apiFetch`
5. **UI** — add/edit page in `client/src/pages/`, register new routes in `client/src/App.tsx`
6. **Test IDs** — add `data-testid` to every interactive and data-display element
7. **CSS** — add styles to `client/src/index.css` (light-mode only, no dark-mode overrides)

---

## 11. Common Pitfalls

| Pitfall | Fix |
|---|---|
| POST/PATCH/DELETE returns 403 | You used raw `fetch()` — switch to `apiFetch` from `client/src/lib/api.ts` |
| `TypeError: Cannot read properties of undefined (reading 'pocketpulse.csrf')` | `cookie-parser` middleware must be registered BEFORE `doubleCsrfProtection` in `createApp()`. Never remove `app.use(cookieParser())` from `server/routes.ts` |
| Text invisible on light background | You added a `@media (prefers-color-scheme: dark)` block inside `.app-protected` — remove it |
| DB push fails with ALTER TABLE error | You changed an ID column type — revert to the original (`serial` stays `serial`) |
| Upload page crashes after adding an account field | Ensure `metadata` JSON field is passed alongside `files[]` in the FormData |
| Recurring reviews not deleted on wipe | `deleteWorkspaceDataForUser` in `storage.ts` must delete `recurring_reviews` before `transactions` (FK constraint) |
| Session not persisting in dev | Ensure `SESSION_SECRET` is set — even in dev a random value is fine; the server logs a warning if it's missing |
| Reclassify endpoint times out | The bulk reclassifier is CPU-heavy — it's expected to be slow for large datasets; do not lower the Express timeout |

---

## 12. Transaction Data Model (Key Fields)

```
flowType:          "income" | "expense" | "transfer"
transactionClass:  "fixed" | "variable" | "discretionary"
recurrenceType:    "recurring" | "one-time" | "unknown"
category:          one of V1_CATEGORIES (see shared/schema.ts)
labelSource:       "ai" | "user" | "rule"
labelConfidence:   "high" | "medium" | "low" | null
excludedFromAnalysis: boolean  (excluded transactions don't appear in dashboard)
userCorrected:     boolean     (true after user manually edits the row)
```

---

*Last updated: Phase 5 complete. CSRF protection fully wired. Light-mode styling locked.*
