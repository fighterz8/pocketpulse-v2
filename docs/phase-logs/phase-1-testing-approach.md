# Phase 1 Testing Approach

**Phase Label:** Phase 1  
**Week:** Week 1  
**Primary Scope:** Authentication, session handling, protected routing, account setup, and protected shell verification

## Purpose
This document explains the testing approach used during Week 1 of PocketPulse. It is written to support both capstone reporting and practical engineering handoff. The goal is to show what was tested, why those tests mattered, how the checks were run, and what limitations or environment caveats still exist.

## Week 1 Testing Objective
The primary testing objective in Phase 1 was to verify that the application's trust boundary behaved correctly before any financial-data workflows were introduced. In practical terms, this meant validating:
- registration
- login and invalid-login handling
- session persistence
- protected account routes
- first-account onboarding
- protected shell access
- logout behavior

Because these behaviors affect every later phase, the testing strategy emphasized correctness of flow and state transitions rather than broad feature coverage.

## Testing Strategy
Week 1 used a blended strategy with four layers:

### 1. Server-focused automated tests
These tests checked backend configuration, schema exports, password helpers, storage behavior, and HTTP route behavior.

### 2. Client-focused automated tests
These tests checked the top-level gating logic in the React application and the logout behavior in the auth hook.

### 3. Manual verification
Manual walkthroughs were used to confirm that the user-visible experience matched the intended onboarding flow.

### 4. Typechecking
TypeScript checking was treated as a lightweight quality gate to confirm that the codebase remained internally consistent after each major checkpoint.

## Test Tooling
The project uses `Vitest` as the primary test runner with two configured projects:
- **server tests:** `node` environment
- **client tests:** `jsdom` environment

This separation is important because the backend tests exercise server-side logic directly, while the client tests need a browser-like DOM environment.

## What the Automated Tests Cover
### `server/project-config.test.ts`
This is a baseline configuration smoke test. It verifies that the project foundation is wired correctly enough for Phase 1 development to proceed.

### `server/schema.test.ts`
This verifies that the shared schema exports the expected Phase 1 tables and gives a quick signal that the schema layer is present and importable.

### `server/auth.test.ts`
This file covers two areas:
- **auth helpers:** email normalization and password hashing/verification
- **storage helpers:** database-backed tests for user creation, default preference creation, normalized email lookup, duplicate email rejection, auth lookup behavior, and account ordering

These tests matter because they validate the data and authentication rules that the rest of the Phase 1 flow depends on.

### `server/routes.test.ts`
This is the main HTTP integration suite for the backend API. It verifies:
- health endpoint behavior
- JSON 404 behavior for unknown API routes
- explicit unauthenticated state from `GET /api/auth/me`
- registration success
- duplicate registration rejection
- login success
- safe invalid-login responses
- logout behavior
- protected `/api/accounts` access
- account list behavior for new users
- account creation behavior for authenticated users

This suite is especially important because it exercises the backend in a way that is close to real application usage.

### `client/src/App.test.tsx`
This file verifies the main front-end state transitions:
- signed-out users see the auth screen
- authenticated zero-account users are routed into onboarding
- authenticated configured users reach the protected shell
- navigation is present in the shell
- logout can be triggered from the shell
- unknown routes render the not-found page inside the protected layout

These tests matter because Phase 1 is as much about workflow gating as it is about authentication itself.

### `client/src/hooks/use-auth.test.tsx`
This test verifies that logout posts to the API and refreshes client auth state correctly so the app becomes signed out after the server session is destroyed.

## Manual Verification Coverage
Manual verification remained useful even with automated tests because Phase 1 depends on visible user-flow behavior. The manual checks for Week 1 were:
1. register a new user
2. confirm invalid login is rejected safely
3. refresh and confirm session persistence
4. confirm a zero-account user is sent to account setup
5. create the first account and confirm entry to the protected shell
6. logout and confirm return to signed-out state

These checks are also suitable for screenshots or demonstration evidence in the capstone report.

## Environment-Dependent Tests
Some of the most important server tests are intentionally environment-gated. The storage-backed tests in `server/auth.test.ts` and the API integration tests in `server/routes.test.ts` only run when:

```env
DATABASE_URL=<reachable postgres connection string>
POCKETPULSE_STORAGE_TESTS=1
```

This gating was used so local runs without a working database would not fail by default. The trade-off is that the strongest integration coverage can be missed unless the environment is configured explicitly.

## Commands Used in Practice
### Standard checks
```bash
npm test
npm run check
```

### Database-backed Phase 1 verification
```bash
DATABASE_URL='postgresql://postgres:password@helium/heliumdb?sslmode=disable' \
POCKETPULSE_STORAGE_TESTS=1 \
npm test
```

### Targeted database-backed server verification
```bash
DATABASE_URL='postgresql://postgres:password@helium/heliumdb?sslmode=disable' \
POCKETPULSE_STORAGE_TESTS=1 \
npx vitest run server/auth.test.ts server/routes.test.ts
```

## Verified Week 1 Result
With the database-backed environment enabled, the Phase 1 suite was successfully re-run and passed:
- **full test suite:** 35/35 tests passed
- **database-backed server suites:** `server/auth.test.ts` and `server/routes.test.ts` passed
- **typecheck:** `npm run check` passed

This is important because it confirms that the previously skipped integration coverage is not only planned, but currently runnable and passing.

## Schema Push Caveat
During database verification, `npm run db:push` reached an interactive Drizzle prompt related to adding the `users_email_unique` constraint to a table that already contained data. Because the command was run in a non-interactive shell, that prompt could not be answered automatically.

This does not invalidate the passing test results, but it does matter for documentation. It shows that:
- the current database already contains prior rows
- schema management may require an interactive decision or cleanup step
- database migration workflow should be documented more explicitly for later phases

## Quality Assurance Interpretation
From a reporting perspective, the Week 1 testing approach demonstrates that quality assurance was not postponed until the end of development. Testing was embedded in the phase and used to verify both technical correctness and user-facing workflow behavior. This is especially relevant for Phase 1 because secure onboarding and access control form the base for all later product features.

## Limitations and Deferred Testing Work
Week 1 testing was strong for the implemented scope, but it was still intentionally limited. The following remain for later phases or later hardening:
- upload and parsing validation tests
- ledger editing and exclusion behavior tests
- recurring review behavior tests
- dashboard calculation tests
- broader migration workflow testing
- stronger production-like security and performance verification

## Relevance to the Capstone Report
This testing approach is useful for the capstone because it shows a clear relationship between risk, implementation order, and verification. The tests did not attempt to prove everything about the final system. Instead, they focused on proving that the Phase 1 trust boundary and onboarding path behaved correctly before more complex financial workflows were introduced.

## Summary
The Week 1 testing strategy combined server tests, client tests, manual verification, and typechecking to validate the most important behaviors in Phase 1. The most important outcome is that the full Phase 1 test suite, including the previously skipped database-backed tests, is now passing when the correct environment variables are provided.
