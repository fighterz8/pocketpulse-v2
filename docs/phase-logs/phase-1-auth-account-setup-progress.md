# Phase 1 — branch progress log

**Branch:** `feature/phase-1-auth-account-setup`

**Last updated:** 2026-04-01

## Checkpoint (Tasks 1–4)

| Task | Status (this branch) |
|------|----------------------|
| **1** — Tooling & foundation | `package.json` scripts (`dev`, `build`, `start`, `check`, `test`, `db:push`), TypeScript/Vite/Vitest baseline, `script/build.ts`, `.env.example`, `README`, failing→passing `server/project-config.test.ts`. |
| **2** — Schema & DB/session | `shared/schema.ts` (users, accounts, user_preferences, session table), `drizzle.config.ts`, `server/db.ts` with pool + `ensureUserPreferences`, `connect-pg-simple` session store wiring, `server/schema.test.ts`. |
| **3** — Auth & storage | `server/auth.ts` (bcrypt hash/verify), `server/storage.ts` (user/account CRUD, duplicate-email handling), `server/auth.test.ts`. |
| **4** — HTTP API & server shell | `server/routes.ts` (`createApp`, session middleware, auth guards): register/login/logout, `GET /api/auth/me`, account list/create + onboarding-aware behavior, `GET /api/health`; `server/index.ts` (dev Vite / prod static); `server/vite.ts`, `server/static.ts`; `server/routes.test.ts` (supertest + `MemoryStore`). |

## Checkpoint (Tasks 5–8) — stable

**Tasks 5, 6, 7, and 8 are complete** on this branch.

- **Client shell (Task 5):** TanStack Query provider, `wouter` route shell, test setup (`client/src/test/setup.ts`, `App.test.tsx`), shared `queryClient` / utilities as implemented in the branch.
- **Auth hook & signed-out gating (Task 6):** `client/src/hooks/use-auth.ts` wired to `/api/auth/me` and auth mutations; `client/src/pages/Auth.tsx` for login/register; `App.tsx` routes signed-out users to auth and gates the rest accordingly.
- **Account setup gating & first account (Task 7):** Authenticated users with no accounts are steered through setup (create first account / onboarding path) instead of the main app; first-account creation is coordinated with the existing account API so the client lands in a valid post-setup state.
- **Accounts cache:** Query cache for accounts is **user-scoped** (invalidated / keyed per authenticated user) so switching users or sessions does not show another user’s account list.
- **Protected layout & post-setup routes (Task 8):** Authenticated shell after setup includes a protected layout (nav/shell) and placeholder routes for the main app areas so navigation structure is in place before real feature pages land.

## Checkpoint (Task 9) — stable

**Task 9 is complete** on this branch.

- **Logout wiring:** UI calls the logout API; session ends server-side; client auth and account queries are cleared or invalidated so signed-out state and redirects behave consistently.
- **Protected-route / session verification:** Unauthenticated users are kept off post-setup routes; session is re-checked via `/api/auth/me` (and related flows) so protected navigation and post-setup entry match the plan.

**Route integration tests** (storage-backed / DB paths): set **`DATABASE_URL`** and **`POCKETPULSE_STORAGE_TESTS=1`** or those tests are skipped or cannot run as intended.

**Suitable for a GitHub checkpoint push** — verification and logout are in place; a good point to push a remote milestone before documentation and evidence work.

## Development ports

- **Default (`npm run dev`):** Express + Vite middleware on **PORT** (default **5000**); Replit preview runs this single process.
- **Optional `npm run dev:vite`:** standalone Vite on **5000** (`vite.config.ts`); proxy `/api` to a server on **5001** (or `API_PORT`) via `PORT=5001 tsx server/index.ts`.

## Git

A **local checkpoint commit** exists on this branch (e.g. foundation/auth work captured in history). **Push to GitHub at stable checkpoints** rather than every micro-edit; align pushes with plan task boundaries when practical.

## Next steps (Task 10)

Per Phase 1 plan (`docs/superpowers/plans/2026-04-01-phase-1-auth-account-setup.md`):

- **Task 10 — final documentation and Phase 1 evidence** (requirements traceability, verification notes, and any plan-specified deliverables to close Phase 1).
