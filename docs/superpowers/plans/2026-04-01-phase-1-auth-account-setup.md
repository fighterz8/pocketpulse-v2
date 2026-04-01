# Phase 1 Authentication and Account Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fresh-start PocketPulse Phase 1 foundation: registration, login, logout, session persistence, account-setup onboarding, and a protected app shell with placeholder pages.

**Architecture:** Create a new TypeScript full-stack app matching the approved PocketPulse spec: Express + PostgreSQL + session auth on the backend, React + `wouter` + TanStack Query on the frontend, with `shared/schema.ts` as the schema source and `storage.ts` as the persistence boundary. Account setup sits between authentication and the wider shell so later import and review flows always start from an initialized workspace.

**Tech Stack:** TypeScript, Node.js, Express, React, Vite, Wouter, TanStack Query, PostgreSQL, Drizzle ORM, express-session, connect-pg-simple, bcrypt, Vitest

---

## File Structure
Create the following initial Phase 1 structure.

**Core app files**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vite.config.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Create: `README.md`
- Create: `script/build.ts`

**Shared**
- Create: `shared/schema.ts`

**Server**
- Create: `server/index.ts`
- Create: `server/db.ts`
- Create: `server/auth.ts`
- Create: `server/routes.ts`
- Create: `server/storage.ts`
- Create: `server/vite.ts`
- Create: `server/static.ts`

**Client**
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/index.css`
- Create: `client/src/lib/queryClient.ts`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/test/setup.ts`
- Create: `client/src/hooks/use-auth.ts`
- Create: `client/src/components/layout/AppLayout.tsx`
- Create: `client/src/pages/Auth.tsx`
- Create: `client/src/pages/AccountSetup.tsx`
- Create: `client/src/pages/Dashboard.tsx`
- Create: `client/src/pages/Upload.tsx`
- Create: `client/src/pages/Ledger.tsx`
- Create: `client/src/pages/Leaks.tsx`
- Create: `client/src/pages/not-found.tsx`

**Tests**
- Create: `server/project-config.test.ts`
- Create: `server/schema.test.ts`
- Create: `server/auth.test.ts`
- Create: `server/routes.test.ts`
- Create: `client/src/App.test.tsx`

**Docs**
- Modify: `docs/phase-logs/phase-1-auth-account-setup-log.md`
- Modify: `docs/superpowers/specs/2026-04-01-phase-1-auth-account-setup-design.md`

## Task 1: Initialize git, tooling, and the fresh repo foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vite.config.ts`
- Create: `.env.example`
- Create: `README.md`
- Create: `script/build.ts`

- [ ] **Step 1: Create the repository baseline**

Run:
```bash
if [ ! -d .git ]; then git init; fi
git checkout -b feature/phase-1-auth-account-setup || git checkout feature/phase-1-auth-account-setup
```

Expected: an initialized git repository and a dedicated Phase 1 branch.

- [ ] **Step 1.1: Verify remote and session workflow before implementation**

Run:
```bash
git remote -v
git branch --show-current
git status
```

Expected:
- the intended GitHub remote is configured
- the active branch is the dedicated Phase 1 branch
- the working tree is clean before implementation begins

Record in working notes or the phase log:
- current branch
- intended push cadence for the session
- next verification point before the first major push

- [ ] **Step 2: Write a failing environment smoke test**

```ts
import { describe, expect, it } from "vitest";

describe("project config", () => {
  it("defines a Phase 1 typecheck script", async () => {
    const pkg = await import("../package.json");
    expect(pkg.default.scripts.check).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/project-config.test.ts`
Expected: FAIL because `package.json` and test setup do not exist yet.

- [ ] **Step 4: Add the package and TypeScript baseline**

Create:
- `package.json` with scripts for `dev`, `build`, `start`, `check`, `test`, `db:push`
- runtime dependencies for Express, React, Drizzle, auth/session, and routing
- dev dependencies for TypeScript, Vite, Vitest, and build tooling
- `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `.env.example`, `script/build.ts`, and `README.md`

Include in `.env.example`:
- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV`
- `APP_ORIGIN`

- [ ] **Step 5: Run install and typecheck**

Run: `npm install && npm run check`
Expected: typecheck may still fail on missing app files, but package installation succeeds and scripts are available.

- [ ] **Step 6: Commit the repo foundation**

Run:
```bash
git add package.json tsconfig.json vitest.config.ts vite.config.ts .env.example script/build.ts README.md
git commit -m "feat(app): add phase 1 project foundation"
```

## Task 2: Add the schema and database/session baseline

**Files:**
- Create: `shared/schema.ts`
- Create: `server/db.ts`
- Create: `drizzle.config.ts`
- Create: `server/schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, expect, it } from "vitest";
import * as schema from "../shared/schema";

describe("phase 1 schema", () => {
  it("exports users and accounts tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.accounts).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/schema.test.ts`
Expected: FAIL because `shared/schema.ts` does not exist yet.

- [ ] **Step 3: Implement the Phase 1 schema**

Create:
- `users` table with email, hashed password field stored as `password`, required `display_name`, optional `company_name`, and timestamps
- `user_preferences` table with deterministic defaults
- `accounts` table tied to `users`
- `drizzle.config.ts` and `server/db.ts` using `DATABASE_URL`

Document and implement the preferences lifecycle in the same task:
- preferred path: create a default `user_preferences` row when a user registers
- fallback path: create the row lazily on first authenticated use
- whichever path is chosen, keep it deterministic and note it in the Phase 1 docs

- [ ] **Step 4: Add session storage support**

In `server/db.ts` or adjacent session configuration code, define the PostgreSQL connection used by `connect-pg-simple` and Express session middleware.

- [ ] **Step 5: Verify schema compiles**

Run: `npm run check`
Expected: schema and DB config typecheck successfully, even if routes/UI still fail.

- [ ] **Step 6: Commit the schema baseline**

Run:
```bash
git add shared/schema.ts server/db.ts drizzle.config.ts server/schema.test.ts
git commit -m "feat(db): add phase 1 schema and database config"
```

## Task 3: Build storage and auth helpers

**Files:**
- Create: `server/storage.ts`
- Create: `server/auth.ts`
- Test: `server/auth.test.ts`

- [ ] **Step 1: Write failing tests for auth helpers**

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("auth helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("demo-password");
    expect(hash).not.toBe("demo-password");
    await expect(verifyPassword("demo-password", hash)).resolves.toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/auth.test.ts`
Expected: FAIL because auth helpers are not implemented.

- [ ] **Step 3: Implement auth and storage helpers**

Create:
- password hashing and verification helpers in `server/auth.ts`
- storage functions for creating users, retrieving users by email/id, listing accounts, and creating accounts in `server/storage.ts`

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run server/auth.test.ts`
Expected: PASS for password helper coverage.

- [ ] **Step 5: Commit auth/storage helpers**

Run:
```bash
git add server/auth.ts server/storage.ts server/auth.test.ts
git commit -m "feat(auth): add password helpers and storage layer"
```

## Task 4: Add authentication and account routes

**Files:**
- Create: `server/routes.ts`
- Create: `server/index.ts`
- Create: `server/vite.ts`
- Create: `server/static.ts`
- Test: `server/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

```ts
import { describe, expect, it } from "vitest";

describe("auth routes", () => {
  it("registers auth endpoints", async () => {
    const { registerRoutes } = await import("./routes");
    expect(registerRoutes).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/routes.test.ts`
Expected: FAIL because route registration is not implemented.

- [ ] **Step 3: Implement API routes**

Add:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/accounts`
- `POST /api/accounts`

Include:
- session middleware
- auth guard for protected routes
- onboarding-aware account list behavior
- Vite middleware for development through `server/vite.ts`
- production static serving through `server/static.ts`

- [ ] **Step 4: Verify route tests and typecheck**

Run: `npx vitest run server/routes.test.ts && npm run check`
Expected: route tests pass and server files typecheck.

- [ ] **Step 5: Commit the route layer**

Run:
```bash
git add server/index.ts server/routes.ts server/vite.ts server/static.ts server/routes.test.ts
git commit -m "feat(auth): add session auth and account setup routes"
```

## Task 5: Set up the client entry, query client, and route shell

**Files:**
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/lib/queryClient.ts`
- Create: `client/src/lib/utils.ts`
- Create: `client/src/index.css`
- Create: `client/src/test/setup.ts`
- Test: `client/src/App.test.tsx`

- [ ] **Step 1: Write a failing client test-harness smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("app shell", () => {
  it("renders the app root", () => {
    render(<App />);
    expect(screen.getByTestId("app-root")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/App.test.tsx`
Expected: FAIL because the app entry and component tree do not exist.

- [ ] **Step 3: Implement the client baseline**

Create:
- React app entry in `main.tsx`
- query client setup
- root `App` route tree using `wouter`
- base styles and app-wide utility helpers
- `client/src/test/setup.ts` with jsdom/RTL setup for Vitest

In `client/src/App.test.tsx`, establish one reusable mock strategy for `use-auth`, such as:
- a hoisted mutable auth-state object returned by the mock, or
- a mock function with `beforeEach` overrides

Do not define separate static `vi.mock()` blocks per test case.

- [ ] **Step 4: Re-run the client test**

Run: `npx vitest run client/src/App.test.tsx`
Expected: PASS for root render and test harness setup.

- [ ] **Step 5: Commit the client shell baseline**

Run:
```bash
git add client/index.html client/src/main.tsx client/src/App.tsx client/src/lib/queryClient.ts client/src/lib/utils.ts client/src/index.css client/src/test/setup.ts client/src/App.test.tsx
git commit -m "feat(app): add client entry and route shell"
```

## Task 6: Build the auth UI and auth hook

**Files:**
- Create: `client/src/hooks/use-auth.ts`
- Create: `client/src/pages/Auth.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/App.test.tsx`

- [ ] **Step 1: Extend the failing UI test using the shared mocked auth state**

```tsx
mockAuthState.user = null;
mockAuthState.accounts = [];
mockAuthState.isLoading = false;

it("shows an auth form for unauthenticated users", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/App.test.tsx`
Expected: FAIL because `use-auth` and `Auth.tsx` are not implemented.

- [ ] **Step 3: Implement auth state and UI**

Create:
- `use-auth.ts` to fetch `GET /api/auth/me` and expose loading/authenticated states
- `Auth.tsx` with login and registration modes, form submission, error feedback, and registration fields for email, password, and display name, with optional company/workspace name
- `App.tsx` logic that routes signed-out users to auth

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run client/src/App.test.tsx`
Expected: PASS for signed-out auth rendering behavior.

- [ ] **Step 5: Commit auth UI**

Run:
```bash
git add client/src/hooks/use-auth.ts client/src/pages/Auth.tsx client/src/App.tsx client/src/App.test.tsx
git commit -m "feat(auth): add auth hook and login registration page"
```

## Task 7: Add account setup gating and first-account creation

**Files:**
- Create: `client/src/pages/AccountSetup.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/hooks/use-auth.ts`
- Modify: `server/routes.ts`
- Modify: `server/storage.ts`

- [ ] **Step 1: Write a failing onboarding test with authenticated no-account state**

```tsx
mockAuthState.user = { id: 1, email: "demo@example.com" };
mockAuthState.accounts = [];
mockAuthState.isLoading = false;

it("routes authenticated users without accounts to account setup", () => {
  render(<App />);
  expect(screen.getByText(/account setup/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/App.test.tsx`
Expected: FAIL because onboarding gating is not implemented.

- [ ] **Step 3: Implement account setup**

Create or update:
- `AccountSetup.tsx` with fields for account name, optional last four, and optional account type
- `App.tsx` routing gate that sends authenticated users with zero accounts to setup
- supporting route and storage behavior for account creation

- [ ] **Step 4: Verify tests and manual behavior**

Run: `npx vitest run client/src/App.test.tsx && npm run check`
Expected: onboarding test passes and typecheck succeeds.

- [ ] **Step 5: Commit onboarding**

Run:
```bash
git add client/src/pages/AccountSetup.tsx client/src/App.tsx client/src/hooks/use-auth.ts server/routes.ts server/storage.ts client/src/App.test.tsx
git commit -m "feat(auth): add first account setup onboarding"
```

## Task 8: Add the protected layout and placeholder pages

**Files:**
- Create: `client/src/components/layout/AppLayout.tsx`
- Create: `client/src/pages/Dashboard.tsx`
- Create: `client/src/pages/Upload.tsx`
- Create: `client/src/pages/Ledger.tsx`
- Create: `client/src/pages/Leaks.tsx`
- Create: `client/src/pages/not-found.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Write a failing protected-shell assertion with authenticated state**

```tsx
mockAuthState.user = { id: 1, email: "demo@example.com" };
mockAuthState.accounts = [{ id: 1, name: "Main Account" }];
mockAuthState.isLoading = false;

it("shows PocketPulse navigation for authenticated users with accounts", () => {
  render(<App />);
  expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/upload/i)).toBeInTheDocument();
  expect(screen.getByText(/ledger/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/App.test.tsx`
Expected: FAIL because the layout and placeholder pages do not exist.

- [ ] **Step 3: Implement the shell**

Create:
- `AppLayout.tsx` with the left-side navigation based on the approved mockups
- placeholder protected pages for `/`, `/upload`, `/transactions`, `/leaks`
- not-found fallback

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run client/src/App.test.tsx`
Expected: PASS for protected-shell navigation assertions.

- [ ] **Step 5: Commit the protected shell**

Run:
```bash
git add client/src/components/layout/AppLayout.tsx client/src/pages/Dashboard.tsx client/src/pages/Upload.tsx client/src/pages/Ledger.tsx client/src/pages/Leaks.tsx client/src/pages/not-found.tsx client/src/App.tsx client/src/App.test.tsx
git commit -m "feat(app): add protected shell and phase 1 placeholder pages"
```

## Task 9: Verify sessions, route protection, and logout

**Files:**
- Modify: `server/routes.test.ts`
- Modify: `client/src/App.test.tsx`
- Modify: `server/routes.ts`
- Modify: `client/src/hooks/use-auth.ts`

- [ ] **Step 1: Add failing tests for auth edge cases**

```ts
describe("route protection", () => {
  it("rejects invalid login credentials", async () => {
    expect(true).toBe(false);
  });

  it("rejects unauthenticated account access", async () => {
    expect(true).toBe(false);
  });
});

describe("logout behavior", () => {
  it("clears the session on logout", async () => {
    expect(true).toBe(false);
  });
});
```

Place the first two route-protection tests in `server/routes.test.ts` using an Express app instance and request-based assertions.
Place the logout state-refresh test in `client/src/App.test.tsx` only if the client has explicit logout state handling worth testing there; otherwise keep logout verification at the route layer and through manual QA.

- [ ] **Step 2: Run tests to verify failures**

Run: `npm test`
Expected: FAIL on at least one logout or protection assertion.

- [ ] **Step 3: Complete missing auth behavior**

Ensure:
- duplicate registration email is rejected cleanly
- invalid login returns a safe error
- logout destroys the server session
- protected account routes reject unauthenticated access
- client auth state refreshes correctly after logout

- [ ] **Step 4: Run the full automated checks**

Run: `npm test && npm run check`
Expected: PASS for Phase 1 test suite and typecheck.

- [ ] **Step 5: Commit auth verification fixes**

Run:
```bash
git add server/routes.ts server/routes.test.ts client/src/hooks/use-auth.ts client/src/App.test.tsx
git commit -m "test(auth): verify logout and protected route behavior"
```

## Task 10: Final documentation and Phase 1 evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/phase-logs/phase-1-auth-account-setup-log.md`
- Modify: `docs/superpowers/specs/2026-04-01-phase-1-auth-account-setup-design.md`

- [ ] **Step 1: Add a failing documentation checklist**

Record this checklist in the Phase 1 log:
- current branch
- latest completed auth behavior
- next intended task
- manual verification path

- [ ] **Step 2: Update docs**

Add:
- setup and run instructions in `README.md`
- a short Phase 1 completion summary in the phase log
- any design clarifications discovered during implementation back into the Phase 1 spec

- [ ] **Step 3: Run the final verification commands**

Run:
- `npm test`
- `npm run check`
- `npm run build`

Expected:
- tests pass
- typecheck passes
- production build succeeds
- current branch is the intended Phase 1 branch and is ready for push/PR creation

- [ ] **Step 3.1: Verify push-readiness and session-end sync notes**

Run:
```bash
git branch --show-current
git status
git log -1 --oneline
```

Expected:
- the current branch is still the intended Phase 1 branch
- the working tree is clean after the final commit
- the latest commit summarizes the latest completed Phase 1 task

Record one short session-end note in the phase log or PR draft:
- current branch
- last completed task
- next intended task

- [ ] **Step 4: Commit the Phase 1 documentation pass**

Run:
```bash
git add README.md docs/phase-logs/phase-1-auth-account-setup-log.md docs/superpowers/specs/2026-04-01-phase-1-auth-account-setup-design.md
git commit -m "docs(phase-1): add auth and account setup verification notes"
```
