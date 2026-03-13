# Batch CSV Upload Workflow

## Overview

The upload flow now treats CSV import as a staged batch process instead of a single-file action.

Users can:
- add one or many CSV files at once
- review each file in a staging list
- set the account name and last four for each file
- reuse an existing account or let the system auto-match one
- submit the entire batch in a single request

The logic is split between the upload page in `client/src/pages/Upload.tsx` and the batch upload endpoint in `server/routes.ts`.

## Client Workflow

The upload page keeps an in-memory array of `PendingUpload` rows. Each row stores:
- the original `File`
- a stable client-side identifier
- the filename
- editable account metadata
- the selected account override, if any
- per-file import status and error state

When files are added:
1. Non-CSV files are skipped immediately.
2. Duplicate files in the current batch are skipped using `filename + size + lastModified`.
3. Each accepted file becomes a pending row.
4. The account name is prefilled from the filename without the `.csv` extension.

Each row supports three account outcomes:
1. Explicit existing account: the user chooses an account from the match dropdown.
2. Exact auto-match: the entered account name and last four exactly match an existing account.
3. New account creation: no explicit selection or exact match exists, so the backend creates a new account during import.

Validation rules on the client:
- account name is required
- last four must be exactly four digits if provided
- rows that already imported successfully are excluded from later retry submissions

## Batch Request Contract

The upload page submits a multipart `POST` request to `/api/uploads/batch`.

Form fields:
- `files`: one entry per CSV file
- `metadata`: JSON array in the same order as the files

Each metadata item includes:
- `clientId`: stable client-side row identifier
- `filename`: original filename
- `proposedAccountName`: edited account name from the row
- `proposedLastFour`: optional four-digit suffix
- `selectedExistingAccountId`: optional existing account override

Order matters. The server validates that:
- at least one file was uploaded
- metadata is valid JSON
- metadata count matches file count
- metadata filenames line up with the uploaded files

## Server Processing Logic

The batch endpoint processes files sequentially and returns a result per file.

For each metadata row and file pair:
1. Validate that the file looks like a CSV by extension and MIME type.
2. Resolve the account:
   - use `selectedExistingAccountId` if provided
   - otherwise reuse an exact existing `name + lastFour` match
   - otherwise create a new account
3. Call the shared `importCsvForAccount(...)` helper.
4. Store either a success result or a scoped error for that file.

The endpoint always returns:
- `summary`: total files, succeeded, failed, and total imported transactions
- `results[]`: per-file status, resolved account, upload id, transaction count, and error if applicable

This structure allows partial success. One malformed CSV does not prevent the other files from importing.

## Shared Import Helper

The `importCsvForAccount(...)` helper centralizes the actual CSV import logic used by both:
- the legacy single-file endpoint at `/api/upload`
- the new batch endpoint at `/api/uploads/batch`

The helper performs the existing import pipeline:
1. create an `uploads` record
2. parse CSV rows with `parseCSV(...)`
3. enrich labels with `maybeApplyLlmLabels(...)`
4. insert transactions with `storage.createTransactions(...)`
5. update the upload `rowCount` with the final inserted transaction count

Keeping this logic in one place prevents the single-file and batch flows from drifting apart.

## Account Matching Notes

Account matching is intentionally conservative.

Exact matching uses:
- trimmed, case-insensitive account names
- the exact four-digit suffix, when present

If only the account name matches, the UI shows that there are similarly named accounts, but it does not silently guess. The user can either:
- enter the correct last four to trigger an exact auto-match
- explicitly choose an existing account from the dropdown

## Error Handling

There are two error levels:
- request-level errors: invalid batch metadata or mismatched file payloads reject the whole request
- file-level errors: parsing or import failures are attached to the specific file result

This gives the UI enough detail to:
- keep successful rows marked as imported
- leave failed rows visible with their error messages
- let the user correct and retry only the remaining rows
