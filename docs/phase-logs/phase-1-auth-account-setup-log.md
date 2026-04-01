# Phase 1 Log: Authentication and Account Setup

**Phase Label:** Phase 1  
**Primary Focus:** Authentication, session handling, protected app shell, and initial account setup  
**Design Basis:** `POCKETPULSE_REPO_MAP_V1_FRESH_START.md`, `Diagrams and mockups/ERD.png`, `Diagrams and mockups/Dashboard.png`, `Diagrams and mockups/ledger.png`, `Diagrams and mockups/recurring_leak.png`

## Purpose
This log records the reasoning behind the Phase 1 design choices so they can be reconciled later during capstone reporting and research-paper writing.

## Why Phase 1 Prioritizes Authentication and Account Setup
- Authentication is the trust boundary for the whole product because PocketPulse handles sensitive financial data.
- Account setup is the minimum workspace configuration needed before CSV import, ledger review, or dashboard reporting can make sense.
- Building these first creates a usable prototype milestone without prematurely committing to later-phase transaction and reporting logic.

## Reconciliation Between Spec and Mockups
- The written V1 spec defines the official scope and remains the source of truth for what is in and out of V1.
- The UI mockups are treated as the visual basis for the protected app shell and future page structure.
- The ERD is treated as the starting point for database design, but not as a requirement to implement every table immediately in Phase 1.
- Where the mockups or ERD suggest broader prototype behavior, the scope is reduced to match the V1 capstone priorities.

## Phase 1 Decisions
- Use session-based authentication rather than token-heavy auth because the app is a single-owner workspace.
- Include registration for workspace bootstrap, but treat login and protected access as the main product requirement.
- Route new users through account setup after successful authentication if no accounts exist yet.
- Build the app shell navigation early so the prototype already reflects the intended PocketPulse structure.
- Keep non-auth pages present as protected placeholders if their full behavior belongs to later phases.

## Phase 1 Minimum Data Model
The initial implementation focus should be limited to:
- `users`
- `user_preferences`
- `accounts`
- session storage

The following areas are acknowledged in the design but deferred to later phases:
- uploads/import batches
- transactions
- transaction reviews
- recurring patterns or leak review persistence
- dashboard reporting outputs

## Why This Sequence Was Chosen
- It provides a clear weekly milestone that is easy to demonstrate and explain.
- It supports later upload and review workflows without redesigning onboarding.
- It prevents scope drift into analytics or ingestion features before the workspace foundation is stable.
- It aligns with the class requirement for traceable, reviewable implementation decisions.

## Deferred Items
- CSV import workflow
- transaction normalization
- ledger editing and exclusion logic
- recurring leak review actions
- safe-to-spend dashboard calculations
- export behavior

## Notes For Later Reconciliation
- If the implementation differs from the older prototype, the fresh-start V1 repository should document the difference as intentional scope alignment rather than feature loss.
- Later phase logs should reference this document when explaining why auth and account setup were treated as the system foundation.

## 11.1 Risk Management Processes
Phase 1 risk management centered on two priorities: protecting the application's trust boundary and preventing scope drift. The main practical response was to keep Week 1 focused on authentication, session handling, protected access, and first-account onboarding before any transaction-processing features were introduced. This reduced the risk of building later financial workflows on an unverified identity model.

For fuller Week 1 security rationale, see `docs/phase-logs/phase-1-security-approach.md`.

## 11.2 Change Management Processes
Change management in Phase 1 followed a controlled iteration pattern. The written V1 specification remained the main scope authority, while the ERD and mockups were treated as design references. Changes were accepted when they improved clarity, security, or implementation stability without expanding Week 1 scope.

For the fuller Week 1 process narrative, see `docs/phase-logs/phase-1-iterative-process.md`.

## 11.2.1 Project Scope Change
The most important Week 1 scope change was sequencing. Authentication and account setup were moved to the front of the implementation order so the product could establish a secure and reviewable workspace foundation before CSV import, ledger review, recurring analysis, and dashboard reporting were attempted.

## 11.2.2 Version Control
Version control was used as a traceability mechanism rather than only as a code-storage tool. The intended workflow was branch-based implementation, readable commit history, and regular checkpoint pushes so architectural decisions, fixes, and documentation updates remained visible across the week.

## 11.3 Quality Assurance Processes
Quality assurance in Phase 1 focused on proving that the identity and onboarding boundary behaved correctly. Validation concentrated on registration, invalid login handling, session persistence, protected routes, first-account setup, and logout behavior. This combined focused automated tests with explicit manual walkthroughs of the user flow.

## 11.3.1 Defect Tracking Process
Defects were framed in workflow terms rather than as isolated code issues. A useful defect entry for this phase records the affected behavior, reproduction steps, likely layer, correction, and verification outcome. This makes the debugging process easier to explain in the final paper.

## 11.3.2 Technical Reviews Process
Technical review happened at two levels: design review to confirm alignment with the fresh-start V1 scope, and implementation review to confirm that the resulting code preserved separation between UI, route logic, business logic, and persistence. The review process also checked that non-obvious decisions were documented clearly enough for later reporting.

## 12. Revised Project Plan
The revised capstone plan is best explained as a four-phase sequence:

1. Phase 1: authentication, session handling, protected shell, and initial account setup.
2. Phase 2: CSV upload workflow, validation, and normalization entry points.
3. Phase 3: ledger review, editing, and exclusion-from-analysis controls.
4. Phase 4: recurring review, dashboard reporting, export alignment, final QA, and documentation closure.

This sequencing is intended to keep the project explainable and reduce redesign risk between phases.

## 13. Project Management Section
From a project-management perspective, Phase 1 established the working pattern for the rest of the capstone: clear scope boundaries, phased delivery, iterative review, and written reasoning logs. This supports both implementation control and academic traceability.

## 14. Lessons Learned
The main lessons from Week 1 were that prototype artifacts should inform decisions rather than override the written scope, account setup fits best as part of onboarding, and short documentation updates are valuable because they preserve reasoning while it is still accurate.

## Suggested Supporting Evidence
The following artifacts can be reused later in the paper if needed:
- `docs/phase-logs/phase-1-security-approach.md` for Week 1 security rationale and risk treatment
- `docs/phase-logs/phase-1-iterative-process.md` for Week 1 process, review, and change-management narrative
- `docs/phase-logs/phase-1-testing-approach.md` for Week 1 testing strategy, coverage, and verification results
- `Diagrams and mockups/ERD.png` for database-design discussion
- `Diagrams and mockups/Dashboard.png` for early UI direction and later scope-comparison discussion
- `Diagrams and mockups/ledger.png` for ledger workflow planning context
- `Diagrams and mockups/recurring_leak.png` for recurring-review workflow intent
- future screenshots of the implemented auth page, account setup flow, and protected app shell
