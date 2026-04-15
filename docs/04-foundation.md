# App Foundation

This section covers the core technology and infrastructure that every other feature is built on — login, data storage, the categorization engine, and the overall visual design.

---

## Authentication

Secures the app so that only the owner can access their financial data.

**What was built:**
- A login page with username and password
- Passwords are stored in encrypted form — the actual password is never saved in plain text
- All pages in the app are protected: navigating to any URL while logged out redirects to the login page
- A logout button clears the session immediately

**What you see now:**
- Visiting the app goes directly to a login screen
- After signing in, you have access to all pages until you log out or the session expires

---

## First-Account Onboarding Gate

New users had no accounts to assign transactions to, which would cause errors when they tried to upload files.

**What was built:**
- On first login, users are shown a guided prompt to create their first account (e.g. "Chase Checking") before accessing any other part of the app
- The prompt explains why an account is needed and keeps the flow simple — just a name field and a confirm button
- Once the first account exists, the prompt never appears again

**What you see now:**
- Brand-new users are walked through account creation in one step immediately after login
- Returning users go straight to the dashboard

---

## Database & Data Storage

The underlying storage system that keeps your transactions, uploads, and settings safe.

**What was built:**
- A structured database with separate tables for accounts, uploaded files, individual transactions, recurring charge reviews, and AI format detection results
- All data is tied to the logged-in owner so nothing is mixed between users
- The schema was designed to support filtering, deduplication, and recurring pattern detection efficiently

**What you see now:**
- All your data persists between sessions — closing the browser and coming back shows everything exactly as you left it

---

## CSV Parsing Engine

The rules-based system that reads raw bank statement rows and turns them into structured transactions.

**What was built:**
- A parser that reads each row of a CSV file and extracts the date, amount (handling both positive and negative conventions), and merchant description
- Amount sign detection: figures out whether a positive number means money in or money out based on the column names in the file (e.g. a "Debit" column is always outflow)
- Merchant normalization: strips bank-added codes, POS prefixes (like "POS *", "SQ *", "ACH"), and trailing reference numbers so the merchant name is clean
- A 13-pass categorization rules engine that assigns each transaction to one of 21 categories based on the merchant name and amount

**What you see now:**
- Imported transactions have clean merchant names and categories automatically filled in, with no manual work required for recognized merchants

---

## AI Categorization

An optional second pass that classifies transactions the rules engine wasn't confident about.

**What was built:**
- After the rules engine runs, any transactions it couldn't confidently categorize are batched and sent to an AI service (GPT-4o-mini)
- The AI is given the merchant name, amount, and a short description and returns a category
- Only uncategorized transactions are sent — already-categorized rows are never re-processed unless you click the manual Re-categorize button
- A progress bar on the Ledger page shows the AI pass completing in real time

**What you see now:**
- Unusual or uncommon merchants that the rules engine doesn't recognize are still categorized, often correctly
- The "Re-categorize with AI" button on the Ledger page lets you trigger a fresh AI pass at any time

---

## Wipe Data & Reset Controls

Allows you to clear your data and start over without having to delete and recreate the whole workspace.

**What was built:**
- A "Wipe transactions" action that removes all imported transaction data while keeping your accounts and settings
- A "Reset workspace" action that removes everything — transactions, accounts, uploads, and all settings — returning the app to a blank slate

**What you see now:**
- Both options are available in the app settings area with a confirmation step before anything is deleted
- The upload results page notes that the "previously imported" skip count resets after a wipe

---

## Design System

The visual language used consistently across all pages.

**What was built:**
- A glass-card style: white semi-transparent cards with a soft shadow on a light blue gradient background
- A fixed left sidebar with the PocketPulse wordmark, an ECG-style pulse icon, and navigation links to Dashboard, Ledger, and Upload
- Animated page transitions using smooth fade-in and slide-up effects
- A consistent set of KPI card styles — bold headline number, small uppercase label, subdued supporting text
- All pages (Dashboard, Ledger, Leaks, Upload) use the same card and spacing system for a unified look

**What you see now:**
- A consistent, polished interface that looks the same across all pages with smooth transitions between them
