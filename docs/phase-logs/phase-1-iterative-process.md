# Phase 1 Iterative Development Process

**Phase Label:** Phase 1  
**Week:** Week 1  
**Primary Scope:** Authentication, session handling, protected app shell, and first-account onboarding

## Purpose
This document explains the iterative process used during Week 1 of the PocketPulse rebuild. It is intended to support capstone reporting by showing how planning, implementation, review, correction, and documentation worked together during the first phase.

## Overall Development Approach
Phase 1 was not treated as a single implementation burst. It was approached as a controlled sequence of small decisions and checkpoints. The week began by reconciling the fresh-start V1 specification, the ERD, and the retained UI mockups. From there, the work was narrowed into a practical first milestone: authentication and account setup before any transaction or reporting features.

The main iterative principle was to make a small amount of progress, review it, correct it, document the reasoning, and only then continue. This made the work slower than a straight build-first approach, but it produced a clearer paper trail and reduced the risk of carrying weak assumptions into later phases.

## Week 1 Iteration Pattern
The repeated cycle used in Phase 1 can be summarized as:
1. define the next small target from the approved design and implementation plan
2. implement the minimum change needed for that target
3. verify behavior with focused tests or manual walkthroughs
4. review the result against the plan and requirements
5. correct gaps, inconsistencies, or quality issues
6. update the documentation log so the reasoning remained visible

This pattern was applied across the week rather than only at the end of the phase.

## Why the Work Was Iterative
An iterative process was chosen for four reasons:
- the project was being rebuilt from a fresh baseline, so assumptions from the earlier prototype had to be checked instead of copied
- authentication and onboarding affect every later workflow, so mistakes early in the stack would have broad consequences
- the capstone requires traceable reasoning, not only a working demo
- the retained diagrams and mockups were useful, but they still had to be reconciled with the fresh-start V1 scope

## Major Iteration Steps in Week 1
### 1. Scope alignment iteration
The first iteration was conceptual rather than technical. The project reduced Week 1 scope to authentication, session handling, protected routing, and account setup. This avoided drifting into upload, ledger, and dashboard behavior before the workspace foundation was stable.

### 2. Architecture and schema iteration
The next iteration focused on the minimum backend and schema shape needed for secure onboarding. Instead of implementing all entities suggested by the ERD, the work narrowed the initial model to users, user preferences, accounts, and session storage.

### 3. Backend auth iteration
Authentication helpers, storage helpers, and route behavior were added in stages so password handling, login behavior, duplicate-user handling, and protected account access could be checked before the client shell depended on them.

### 4. Client gating iteration
The client flow was then refined so users passed through three distinct states:
- signed out
- authenticated but not yet configured
- authenticated and ready for the protected shell

This was an important iteration because it turned authentication into a usable onboarding flow rather than just a login form.

### 5. Verification and correction iteration
Once the full Phase 1 path existed, additional refinement focused on logout behavior, session persistence, route protection, user-scoped query caching, and account-setup gating. These corrections improved consistency across refreshes, sign-out, and multi-state transitions.

### 6. Documentation iteration
The final iteration in Week 1 was documentary rather than functional. README updates, progress logs, and phase notes were added so the implemented behavior, deferred scope, and verification steps were explicit enough for both engineering handoff and capstone reporting.

## Change Management in Practice
Change management in Week 1 was handled through controlled reinterpretation rather than ad hoc redesign. When a mismatch appeared between the V1 specification, the mockups, and the working implementation, the project treated the written spec as the main scope authority. The mockups and ERD were still useful, but only as references.

This meant that changes were accepted when they improved clarity, security, or implementation stability without widening Phase 1 scope. The most important example was keeping the dashboard-like shell structure visible while deferring actual dashboard behavior to later phases.

## Project Scope Change in Week 1
The most important scope change was sequencing, not feature removal. Authentication and account setup were moved to the front of the implementation order so that the product would establish a secure workspace before processing any financial data. This should be understood as controlled scope prioritization rather than as an abandonment of the rest of the V1 plan.

## Version Control and Traceability
Version control supported the iterative process by preserving clear checkpoints. The intended workflow was branch-based development with readable commit summaries and regular pushes at stable boundaries. In reporting terms, version control mattered because it made the evolution of the fresh-start repository visible rather than leaving the implementation history implicit.

The branch and checkpoint workflow also supported reflection. It made it easier to identify when a decision changed, when a fix was introduced, and which part of the system was affected.

## Quality Assurance as Part of Iteration
Quality assurance was embedded into the process instead of being deferred to the end. Week 1 QA focused on:
- registration success
- invalid login handling
- session persistence
- account-setup gating
- protected route behavior
- logout consistency

Focused automated tests and manual walkthroughs complemented each other. Automated tests reduced regression risk for auth-related logic, while manual verification confirmed that the user-visible flow matched the intended onboarding sequence.

## Defect Tracking Process
Defect tracking in Week 1 followed a lightweight but structured pattern. Problems were described in terms of:
- what workflow was affected
- how the issue could be reproduced
- which layer was likely responsible
- how the fix was verified
- whether any follow-up risk remained

This mattered because it turned technical corrections into reportable project evidence. Instead of saying only that a bug was fixed, the process recorded what behavior failed, how it was diagnosed, and why the correction improved reliability.

## Technical Review Process
Technical review operated at two levels during the week:
- **design review:** checking whether the implementation still aligned with the fresh-start V1 scope and retained mockups
- **implementation review:** checking whether code and behavior matched the plan, respected boundaries between layers, and avoided avoidable regressions

This review mindset encouraged changes that improved maintainability and scope discipline, not just changes that made tests pass.

## Revised Project Plan Outcome
By the end of Week 1, the iterative process reinforced a four-phase reporting structure:
1. Phase 1: auth, sessions, protected shell, and initial account setup
2. Phase 2: CSV upload and normalization entry points
3. Phase 3: ledger review, editing, and exclusion controls
4. Phase 4: recurring review, dashboard reporting, export alignment, and final QA/documentation closure

This structure emerged more clearly because the first week exposed which dependencies had to come first.

## Project Management Value
The main project-management contribution of the iterative process was traceability. Each step in Week 1 produced a reasoned record of what changed, why it changed, and what remained deferred. That makes the phase easier to explain in the final report and reduces the need to reconstruct decisions after the fact.

## Lessons Learned
Three lessons stood out in Week 1:
- prototype assets are valuable as inputs, but they should not override the approved written scope
- account setup works best as part of onboarding, not as an afterthought
- iterative documentation is useful because it captures reasoning while it is still accurate, rather than relying on memory later

## Summary
The iterative process in Phase 1 was valuable because it combined design discipline, small implementation steps, focused review, and continuous documentation. This produced a stronger foundation for later phases and a clearer evidence trail for the capstone report.
