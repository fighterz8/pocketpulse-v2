# Phase 1 Security-Focused Approach

**Phase Label:** Phase 1  
**Week:** Week 1  
**Primary Scope:** Authentication, session handling, protected routing, and first-account onboarding

## Purpose
This document explains the security-focused approach used during Phase 1 of PocketPulse. It is intended to support capstone reporting by showing how security concerns influenced scope, architecture, implementation order, and verification during the first week of development.

## Security Objective for Phase 1
The main security objective in Week 1 was to establish the application's trust boundary before any financial data workflows were introduced. Because PocketPulse is intended to handle sensitive business transaction data, the first phase was deliberately limited to identity, session state, and access control. This reduced the risk of building upload, ledger, or dashboard behavior on top of an unstable authentication foundation.

## Security Design Principles
- **Protect the trust boundary first:** authentication and protected access were treated as prerequisites for all later features.
- **Minimize exposed surface area:** Phase 1 only implemented the routes, tables, and UI needed for sign-in, sign-out, current-user lookup, and first-account setup.
- **Use server-managed sessions:** session-based authentication was preferred over token-heavy approaches because the application is a single-owner workspace and does not need distributed client tokens in Phase 1.
- **Gate workflow progression:** a user can authenticate successfully but still be blocked from the wider shell until at least one account is created.
- **Defer non-essential data handling:** transaction ingestion, dashboard calculations, and recurring-review behavior were intentionally delayed so security and onboarding could be verified first.

## Main Risks Identified in Week 1
### 1. Weak identity and access boundaries
If authentication or route protection were unreliable, later financial features would inherit unsafe assumptions about who is allowed to access workspace data.

### 2. Scope drift into later-phase features
If upload, analytics, or ledger logic were introduced too early, the first week could become broad but shallow, making it harder to verify the trust boundary.

### 3. Inconsistent onboarding state
If users could enter the main shell without completing initial account setup, later workflows would have to handle ambiguous workspace state.

### 4. Security decisions hidden inside implementation details
If key choices such as session auth, password hashing, or protected-route behavior were not documented, they would be harder to defend in the final report.

## Security Controls Applied
### Session-based authentication
Phase 1 used server-managed sessions backed by PostgreSQL rather than a token-heavy client authentication model. This kept identity control on the server, reduced unnecessary complexity in the first week, and matched the application's single-owner usage model.

### Password protection
Passwords were not stored in plain text. Hashing was used so that credential storage followed a safer baseline from the first implementation phase.

### Protected routes and APIs
Protected account routes were restricted to authenticated users. Unauthenticated users were directed to the authentication flow rather than being allowed to interact with onboarding or post-setup pages.

### Onboarding gate
Authentication alone was not treated as sufficient application readiness. After login or registration, the system checked whether the user had at least one account. If not, the user was routed to account setup instead of the protected shell.

### Schema minimization
Only the minimum Phase 1 tables were used to support secure onboarding: users, user preferences, accounts, and session storage. This reduced the amount of state that needed to be trusted and tested in Week 1.

## Why Session Authentication Was Chosen
The Week 1 goal was to create a secure but explainable baseline. Session authentication fit that goal for four reasons:
- it kept the identity model simple enough to implement and verify quickly
- it reduced front-end token handling complexity
- it worked naturally with server-side route protection
- it matched the application's single-user workspace model better than a more distributed token design

This choice does not imply that token-based authentication is universally worse. It means session auth was the better fit for the current product shape, timeline, and reporting needs.

## Secure-by-Sequence Development
The development order itself was treated as a security control. The implementation sequence was:
1. establish project and testing baseline
2. add database and session schema support
3. add password and storage helpers
4. expose authentication and account routes
5. connect the client auth flow
6. enforce account-setup gating
7. verify protected-shell access and logout behavior

This order reduced the chance of building insecure feature dependencies too early and made it easier to test each boundary before moving to the next.

## Security Verification Approach
Security verification in Week 1 focused on behavior rather than on broad security claims. The main checks were:
- successful registration and login
- invalid login rejection with safe error messaging
- session persistence across refresh
- restriction of protected account routes when unauthenticated
- enforcement of account setup for zero-account users
- logout behavior and return to signed-out state

Focused automated tests were added around password helpers, auth behavior, application gating, and logout-related client state. Manual walkthroughs were also useful because they demonstrated whether the user-visible flow matched the intended trust boundary.

## Deferred Security Work
Phase 1 established the baseline but did not attempt to finish all security work. The following areas remain for later phases or later hardening passes:
- request throttling or brute-force protection
- password reset and account recovery
- deeper input-validation hardening across future upload flows
- audit logging for sensitive actions
- role expansion or multi-user authorization
- production deployment hardening beyond the Phase 1 prototype baseline

## Relevance to Risk Management
From a capstone reporting perspective, Phase 1 risk management was strongly tied to the security approach. The main risk treatment was not adding many defensive technologies at once; it was narrowing the implementation target so that authentication, session handling, and onboarding state could be understood clearly and verified before financial workflows were introduced.

## Summary
The security-focused approach in Week 1 was based on a simple principle: build the trust boundary before building the financial product behavior that depends on it. This led to a Phase 1 scope centered on authentication, sessions, protected routes, and account setup, with broader ingestion and reporting features deferred until the foundation was stable and reviewable.
