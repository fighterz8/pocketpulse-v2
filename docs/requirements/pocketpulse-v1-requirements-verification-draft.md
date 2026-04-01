# PocketPulse V1 Functional and Nonfunctional Requirements

**Document Purpose:** Verification-ready working copy of the PocketPulse V1 requirements for review, refinement, and later injection into the main project documentation.  
**Source Basis:** Existing project-plan requirements, approved V1 scope, Phase 1 design decisions, and retained mockup/ERD references.  
**Status:** Reconciled draft

## Notes on This Draft
- This file preserves the original module-based numbering approach so the requirements remain traceable.
- Wording has been tightened into clearer "shall" statements for verification use.
- Minor scope alignment changes were made to reflect the approved V1 direction, especially around account setup, protected access, and the removal of analysis-first behavior.
- This file is intended to sit alongside the project plan until manual documentation updates are completed.

## 9.1 Functional Requirements
The functional requirements define what PocketPulse must do to support the V1 MVP. Requirements are grouped into the following modules: Authentication and Account Setup (`AU`), Upload and Import (`UP`), Ledger and Transaction Review (`LD`), Recurring Leak Review (`RL`), Dashboard and Reporting (`DB`), and Export (`EX`).

### Authentication and Account Setup
`AU-01`  
The system shall allow the user to log in using valid credentials.

`AU-01.1`  
When the user submits valid credentials, the system shall authenticate the user and redirect the user into the protected application flow.

`AU-01.2`  
When the user submits invalid credentials, the system shall display an error message and deny access to the workspace.

`AU-01.3`  
The system shall allow a new user to register a workspace using the required onboarding fields.

`AU-02`  
The system shall maintain an authenticated session for the user until logout or session expiration.

`AU-02.1`  
The system shall restrict protected application routes to authenticated users only.

`AU-03`  
The system shall allow the user to log out from the application.

`AU-04`  
The system shall require first-time account setup before the user can proceed into upload and transaction-review workflows.

`AU-04.1`  
During account setup, the system shall allow the user to create at least one account record with an account label and optional account metadata such as last four digits and account type.

### Upload and Import
`UP-01`  
The system shall allow the user to upload one or more CSV transaction files in a single import workflow.

`UP-01.1`  
The system shall display each uploaded file in the upload queue before import is finalized.

`UP-01.2`  
The system shall allow the user to remove an uploaded file from the queue before import.

`UP-02`  
The system shall allow the user to assign an account label to each uploaded file.

`UP-02.1`  
The system shall allow the user to optionally record the last four digits of the account associated with each uploaded file.

`UP-03`  
The system shall validate uploaded files before import.

`UP-03.1`  
If a file is unsupported, unreadable, or improperly formatted, the system shall flag the file and prevent import until the file is corrected or removed.

`UP-04`  
The system shall parse accepted CSV files and extract transaction data for normalization.

`UP-05`  
The system shall create an import record for each upload session, including the import date, source file name, and import status.

### Ledger and Transaction Review
`LD-01`  
The system shall normalize imported transactions into a unified ledger structure.

`LD-01.1`  
Each normalized transaction record shall include, at minimum, transaction date, merchant or description, amount, account label, and transaction type.

`LD-02`  
The system shall display imported transactions in a ledger or transaction-review interface.

`LD-03`  
The system shall assign a category to each transaction using predefined classification logic.

`LD-03.1`  
The system shall allow the user to manually change a transaction category.

`LD-03.2`  
The system shall save user category overrides for future reference.

`LD-04`  
The system shall allow the user to exclude a transaction from analysis.

`LD-04.1`  
Excluded transactions shall remain stored but shall not be included in dashboard, recurring-review, or export calculations unless re-included by the user.

`LD-05`  
The system shall allow the user to filter or search transaction records in the ledger view.

`LD-06`  
The system shall allow the user to edit approved ledger fields needed for review and correction, including category, recurrence type, exclusion state, and other V1-supported transaction fields.

### Recurring Leak Review
`RL-01`  
The system shall detect recurring charges and repeated spend patterns from imported transaction history.

`RL-01.1`  
The system shall evaluate recurring findings using factors such as merchant similarity, frequency, and average amount.

`RL-02`  
The system shall display recurring findings in a recurring leak review interface.

`RL-02.1`  
Each recurring finding shall display the merchant or pattern name, average amount, frequency or recurrence indication, last seen date, and a brief reason for being flagged.

`RL-03`  
The system shall allow the user to mark a recurring finding as essential.

`RL-04`  
The system shall allow the user to mark a recurring finding as leak-related.

`RL-05`  
The system shall allow the user to dismiss a recurring finding.

`RL-06`  
The system shall store the result of the user's recurring review actions.

### Dashboard and Reporting
`DB-01`  
The system shall provide a dashboard view that summarizes reviewed spending data.

`DB-01.1`  
The dashboard shall display safe-to-spend as a primary summary metric.

`DB-01.2`  
The dashboard shall display summary insight for income, expenses, and likely leak-related spending.

`DB-02`  
The system shall allow the user to select a preset or custom date range for dashboard review.

`DB-02.1`  
The system shall support preset ranges such as current month, last month, and last 30 days, and may support additional preset periods used in the final dashboard design.

`DB-03`  
The system shall recalculate dashboard metrics when the selected date range changes.

`DB-04`  
The system shall display chart-based or table-based summaries of spending by category.

`DB-05`  
The system shall display leak-related findings and summary metrics in the dashboard.

### Export
`EX-01`  
The system shall allow the user to export reviewed results as CSV output.

`EX-01.1`  
The system shall support export of reviewed transaction-level data for the selected reporting context.

`EX-02`  
The system shall allow the user to export data for the currently selected reporting period.

`EX-03`  
The system shall generate export output that reflects reviewed transaction edits, exclusion state, and recurring leak-status data where applicable.

## 9.2 Nonfunctional Requirements
The nonfunctional requirements define how PocketPulse should perform and what quality attributes it must satisfy. The most relevant categories for this project are performance, modifiability, usability, testability, availability, security, and data integrity.

### Performance Requirements
`NF-PERF-01`  
The system shall load the dashboard within 3 seconds under normal project-demo conditions after the user selects a reporting period.

`NF-PERF-02`  
The system shall complete CSV import and normalization for a typical test file set within 10 seconds for small-to-moderate datasets used in the project demo.

`NF-PERF-03`  
The system shall update dashboard metrics and views within 3 seconds after the user changes the date range.

### Modifiability Requirements
`NF-MOD-01`  
The system shall be organized into separate interface, processing, and data components to support incremental development and future modification.

`NF-MOD-02`  
The system shall support the addition of new spending categories and category rules without requiring major redesign of the overall system.

`NF-MOD-03`  
The system shall allow future enhancement of recurring leak logic or optional AI-assisted explanation without requiring replacement of the core import and review workflow.

### Usability Requirements
`NF-USA-01`  
The system shall provide an interface that allows a new user to complete a basic onboarding, account-setup, import, and review workflow with minimal instruction.

`NF-USA-02`  
The system shall present the main navigation clearly through the dashboard, upload, ledger, and recurring-review views, consistent with the retained design mockups.

`NF-USA-03`  
The system shall present recurring findings and safe-to-spend information in language understandable to non-technical business users.

`NF-USA-04`  
The system shall support review and correction actions without forcing the user through unnecessary screens or redundant steps.

### Testability Requirements
`NF-TST-01`  
The system shall allow authentication, account setup, CSV upload, parsing, transaction review, recurring leak review, and dashboard calculations to be tested independently.

`NF-TST-02`  
The system shall produce visible outcomes for major actions such as login success, validation failure, upload success, category override, leak classification, and export generation.

`NF-TST-03`  
The system shall support validation using representative sample CSV files from multiple account types.

### Availability Requirements
`NF-AVL-01`  
The system shall be available during scheduled team development, review, and demo periods, subject to the normal availability of the selected hosting platform.

`NF-AVL-02`  
If an import, login, or dashboard action fails, the system shall present an understandable error state rather than terminating the user session without feedback.

`NF-AVL-03`  
The system shall preserve previously imported and reviewed data across user sessions unless intentionally removed or replaced by the user.

### Security Requirements
`NF-SEC-01`  
The system shall require user authentication before granting access to imported transaction data.

`NF-SEC-02`  
The system shall restrict financial review data to the authenticated owner account within the MVP's single-owner workspace model.

`NF-SEC-03`  
The system shall use secure transmission methods provided by the selected hosting and application platform when transmitting login and application data.

`NF-SEC-04`  
The system shall avoid exposing sensitive transaction details to unauthorized users during normal operation.

`NF-SEC-05`  
The system shall store only the information required to support onboarding, import, review, and reporting, consistent with the project's lightweight MVP scope.

### Data Integrity Requirements
`NF-DAT-01`  
The system shall preserve imported source data and reviewed user changes in a way that supports later traceability.

`NF-DAT-02`  
The system shall protect user-reviewed transaction decisions from silent overwrite during normal reprocessing behavior.

`NF-DAT-03`  
The system shall ensure that exclusions, recurring review outcomes, and export results remain consistent with the currently stored review state.
