# Data Import & Upload

This section covers everything related to getting your bank statement files into PocketPulse — from the initial upload flow to how the app handles unusual file formats and prevents duplicate data.

---

## CSV Upload Pipeline

The first major piece of the import system, which lets you bring real bank data into the app.

**What was built:**
- A multi-file upload screen where you pick one or more bank statement files and assign each one to a named account
- A parsing engine that reads each file row by row, extracts the date, amount, and merchant description, and saves every transaction to your ledger
- An import summary shown after each upload with a count of how many transactions were added

**What you see now:**
- The Upload page lets you drag-and-drop or select files, choose or create an account, and click Import
- After importing, a results card shows how many rows were added successfully

---

## Bank of America: Zelle & Description Parsing Fix

Bank of America statement files sometimes include Zelle payment descriptions with commas inside them, which confused the parser into thinking a single cell was two separate columns.

**What changed:**
- The parser now correctly handles descriptions that contain commas by respecting how the file's quoting characters work
- Zelle transactions no longer cause the entire row to be silently dropped or misread

**What you see now:**
- Zelle payments from Bank of America files import correctly with the full merchant description intact

---

## Bank of America: Summary Block & Unescaped Quote Fix

A second Bank of America-specific problem: their exported files sometimes include a short summary section at the top (account number, date range, opening/closing balance) before the actual transaction rows begin. They also occasionally include quote characters inside description fields without properly escaping them.

**What changed:**
- The parser now detects and skips the summary header block before looking for transaction rows
- It also handles unescaped quote characters inside description fields without crashing

**What you see now:**
- Bank of America files with summary blocks or unusual description formatting import cleanly without errors

---

## Inline Account Creation

Previously, if you wanted to import a file into a new account, you had to leave the upload page, create the account elsewhere, then come back.

**What changed:**
- A "Create new account" option was added directly in the account selector on the upload page
- You type the new account name, confirm it, and the account is created immediately — the file is then queued to that new account

**What you see now:**
- The account dropdown on the upload page includes a "+ New account" option that opens a small inline form without leaving the page

---

## Incremental Upload Deduplication

Early versions of the app would create duplicate transactions if you uploaded the same file twice, or if two files from different exports happened to share some of the same rows.

**What changed:**
- Every transaction row is fingerprinted based on its date, amount, and description
- Before saving, the app checks whether a matching fingerprint already exists in your ledger for that account
- Rows that are already there are silently skipped — nothing is duplicated

**What you see now:**
- Re-uploading a file you've already imported produces zero new rows and shows a "previously imported" count in the results summary
- You can safely re-import an updated export and only the genuinely new rows will be added

---

## AI-Powered CSV Format Detection

Some bank statement files use column orders or header names that the standard parser doesn't recognize. Previously these files would fail to import or import with wrong data in the wrong fields.

**What changed:**
- When the app sees an unfamiliar file layout, it sends a sample of the column headers to an AI service that identifies which column holds the date, which holds the amount, and which holds the merchant description
- The detected layout is saved so future files from the same bank are recognized instantly without calling the AI again
- The AI is only used when the file format is genuinely ambiguous — recognized formats go through the fast built-in parser as before
- Only column header names are shared with the AI, never the actual transaction values, to protect your privacy

**What you see now:**
- Files from unusual or unsupported banks now import correctly rather than failing
- First-time imports of an unknown format may take a moment longer; subsequent imports of the same format are instant

---

## Clearer Skip Count Messaging

The original import results summary showed a single "skipped rows" number, which was confusing because it lumped together two very different situations: rows that were already in your ledger from a previous import, and duplicate rows within the file itself (e.g. the same transaction listed twice in the same export).

**What changed:**
- The import results now show two separate counts with distinct labels
- "Already in your ledger" covers rows that match something you imported before
- "Duplicate rows in this file" covers rows that appeared more than once within the file you just uploaded

**What you see now:**
- After every import, the results card shows both numbers separately so you know exactly why each row was skipped
