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
Phase 1 risk management focused on preventing early decisions from destabilizing the rest of the capstone. The main identified risks were scope drift, weak trust boundaries around financial data, and premature implementation of later-phase features before the workspace foundation was stable. To reduce these risks, the project deliberately limited the first milestone to authentication, session handling, protected routing, and account setup. This made the initial build easier to validate and reduced the chance of needing to redesign onboarding after upload and reporting features were introduced.

A second risk management practice was using the written V1 specification as the primary scope authority while treating older mockups and prototype assets as reference material only. This reduced the risk of silently reintroducing removed features such as the dedicated Analysis page. A third risk control was deferring transaction ingestion, recurring analysis, and dashboard calculations until the identity and account model were clearly defined. That sequencing helped ensure that later work would build on a stable and explainable data model rather than on assumptions carried over from the prototype.

## 11.2 Change Management Processes
Change management in Phase 1 was handled by reconciling three inputs before any implementation decision was approved: the fresh-start V1 technical specification, the ERD, and the retained UI mockups. Changes were accepted only when they supported the class-aligned MVP and could be justified in terms of trust, traceability, or reduced complexity. This meant prototype ideas were not copied forward automatically; they had to be explicitly reinterpreted for the fresh V1 repository.

The main procedural rule was that design changes should be logged when they materially affected architecture, onboarding, or later reporting logic. This log therefore serves not only as a planning note but also as a change-history artifact for the research paper. Future phase logs should continue this pattern so that the paper can show how design decisions evolved rather than presenting the final system as if it appeared fully formed.

## 11.2.1 Project Scope Change
The most important scope-change decision in Phase 1 was to prioritize authentication and account setup ahead of import, ledger, recurring review, and dashboard behavior. This was a deliberate narrowing of the immediate build target, not a removal of those features from V1. The goal was to establish a secure and reviewable workspace foundation before introducing transaction data and financial calculations.

Another important scope decision was to treat the older prototype’s broader analytics surface as out of scope unless it directly supported the fresh V1 specification. In practical terms, the dashboard mockup remains useful as a layout reference, but advanced analysis behavior does not belong in the early implementation plan. This distinction is important for the project paper because it shows that changes were made through controlled scope alignment rather than through ad hoc feature loss.

## 11.2.2 Version Control
Version control is part of the project process rather than a purely technical afterthought. The V1 specification already defines branch-based development, conventional commit messages, regular pushes, and remote verification against GitHub. For Phase 1, these rules are especially important because the repository is being rebuilt from a fresh baseline and must tell a clear development story.

The intended Phase 1 workflow is to complete authentication and account-setup work on a dedicated feature branch, push changes at least once per active work session, and keep commit summaries readable enough for milestone review. This supports the project paper by providing traceable evidence of when architectural decisions were made, what changed, and why specific adjustments were introduced during the rebuild.

## 11.3 Quality Assurance Processes
Quality assurance in Phase 1 is centered on proving that the workspace foundation behaves correctly before more advanced features are added. The main QA goal is not feature breadth, but confidence that authentication, protected routes, session persistence, and first-time account onboarding work consistently. This means Phase 1 validation should combine implementation checks with user-flow verification.

The expected QA approach includes verifying successful registration, login failure handling, persistent session behavior, logout behavior, route protection for unauthenticated users, and account-setup gating for newly created workspaces. Because this is an early phase, manual walkthroughs are acceptable as long as they are explicit and repeatable. Where practical, focused automated tests should be added around the auth and persistence boundaries because failures there would affect every later phase.

## 11.3.1 Defect Tracking Process
Defects in Phase 1 should be tracked by recording the observed problem, affected workflow, likely layer, reproduction steps, fix status, and follow-up risk. A lightweight issue log or phase summary entry is sufficient as long as it is consistent. The important process point is that defects should be tied to a user-visible workflow such as login, logout, session persistence, or account creation, rather than being described only as isolated code problems.

This is useful for the research paper because it demonstrates a structured debugging and correction approach. For example, a defect entry might state that a newly registered user was not redirected into account setup, identify the issue as a routing or session-state defect, describe how it was reproduced, and record how the correction was verified. Tracking issues this way makes it easier to explain quality improvements across phases.

## 11.3.2 Technical Reviews Process
Technical review in Phase 1 should happen at two levels. First, design review should confirm that the selected data model and onboarding flow still align with the written V1 scope and the retained mockups. Second, implementation review should confirm that code changes preserve separation of concerns between UI, route/controller logic, business logic, and persistence.

For reporting purposes, technical review should also verify that non-obvious decisions are documented. Examples include why session auth was chosen over token-heavy alternatives, why account setup is part of onboarding, and why later-phase tables were intentionally deferred. This is valuable for the paper because it demonstrates that review was not limited to code style but also covered architectural fit, scope discipline, and maintainability.

## 12. Revised Project Plan
The revised plan for the capstone should be presented as a four-phase build sequence:

1. Phase 1: authentication, session handling, protected app shell, and initial account setup.
2. Phase 2: CSV upload workflow, account-linked import records, validation, and normalization entry points.
3. Phase 3: ledger review, manual editing, exclusion-from-analysis behavior, and safe workspace cleanup controls.
4. Phase 4: recurring leak review, dashboard reporting, export alignment, QA pass, and documentation closure.

This revised plan reflects a more disciplined progression than the earlier prototype. Instead of expanding breadth early, it establishes a secure and explainable foundation, then layers ingestion, review, insight, and reporting on top of that base.

## 13. Project Management Section
From a project-management perspective, Phase 1 established the governance pattern for the rest of the work. The project uses phase-based delivery, explicit scope boundaries, documentation logs, and version-control rules to keep the capstone traceable. Each phase should end with a short summary of what changed, which requirements were affected, what risks remain, and what the next phase depends on.

This structure supports coordination between implementation and academic reporting. It also reduces the common capstone problem where the final paper is written separately from the development process and therefore lacks evidence of how decisions were made over time. By producing phase logs as work progresses, the project creates a built-in paper trail for management, technical, and reflection sections.

## 14. Lessons Learned
The early lesson from Phase 1 is that prototype artifacts are most useful when treated as decision inputs rather than direct implementation instructions. The ERD and UI mockups helped clarify the intended product shape, but the written V1 specification was necessary to decide what should actually be built first. This reinforced the importance of separating visual inspiration from approved scope.

Another lesson is that account setup belongs conceptually with authentication, not only with later financial workflows. Framing account creation as part of onboarding produced a cleaner user journey and a more stable foundation for future upload behavior. A final lesson is that maintaining short reasoning logs during development is likely to reduce the amount of reconstruction required when writing the final research paper and project-management sections.

## Suggested Supporting Evidence
The following artifacts can be reused later in the paper if needed:
- `Diagrams and mockups/ERD.png` for database-design discussion
- `Diagrams and mockups/Dashboard.png` for early UI direction and later scope-comparison discussion
- `Diagrams and mockups/ledger.png` for ledger workflow planning context
- `Diagrams and mockups/recurring_leak.png` for recurring-review workflow intent
- future screenshots of the implemented auth page, account setup flow, and protected app shell
