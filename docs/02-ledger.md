# Ledger & Transaction Review

This section covers everything on the Ledger page — how transactions are displayed, how you can edit and correct them, how category fixes spread to matching merchants, and how to export your data.

---

## Transaction Ledger Table

The central view of all imported transactions, built so you can quickly find and review individual entries.

**What was built:**
- A paginated table showing every transaction with its date, merchant name, amount, category, and class (business or personal)
- Full-text search across merchant names and descriptions
- Filter controls for account, category, class, recurring status, date range, and whether a transaction has been excluded
- All filters work together simultaneously and persist while you navigate the page

**What you see now:**
- The Ledger page shows your full transaction history with all filter and search controls at the top
- The table updates instantly as you change any filter without reloading the page

---

## Inline Transaction Editing

Allows you to correct any transaction without leaving the ledger.

**What was built:**
- Clicking any row opens edit controls directly in that row
- You can change the category (from the 21-category system), the class (business or personal), and whether the transaction is marked as recurring
- Changes are saved immediately when you confirm

**What you see now:**
- Click a row, adjust the dropdown values, and the row updates in place
- No separate edit page or popup required

---

## Category Propagation

When you fix a category on one transaction, the app offers to apply the same fix to every other transaction from that merchant.

**What was built:**
- After saving an inline edit, a prompt appears asking whether to apply the same category to all other rows from the same merchant
- Accepting updates all matching rows in one step
- Declining saves only the one row you edited

**What you see now:**
- A confirmation prompt appears after each category change, letting you choose "Apply to all [Merchant] transactions" or "Just this one"

---

## Fuzzy Merchant Matching for Propagation

The propagation feature originally only matched merchants with an exact name. This missed cases where the same business appeared with slight variations — for example, "AMAZON.COM" vs. "AMZN MKTP" or a trailing reference code.

**What changed:**
- The matching logic was updated to normalize merchant names before comparing — stripping common prefixes, suffixes, abbreviations, and bank-added codes
- A fuzzy similarity score is used so merchants that are clearly the same business are treated as one, even if the raw text differs

**What you see now:**
- When you fix "AMZN MKTP US" the propagation also catches "AMAZON.COM" and other obvious variations of the same merchant
- You still see how many rows were matched before confirming, so there are no surprises

---

## Persist Manual Edit Rules

When you manually correct a category, that correction was previously only applied to existing rows — new imports of the same merchant would still be classified by the default rules, requiring you to fix them again.

**What changed:**
- After a manual edit, the correction is saved as a merchant-level rule
- Every future upload that includes a transaction from that merchant picks up the saved rule automatically and classifies it correctly from the start

**What you see now:**
- Once you've corrected a merchant, you never have to correct it again — even after uploading new files

---

## CSV Export

Lets you download your transaction data for use in a spreadsheet or other tool.

**What was built:**
- An Export button on the Ledger page downloads the current filtered view as a CSV file
- Whatever filters are active at the time of export are respected — you can export just one account, one category, one date range, etc.
- Excluded transactions are not included in the export

**What you see now:**
- The Export button at the top of the Ledger page downloads your filtered transactions immediately as a spreadsheet-compatible file

---

## Exclusion Toggle

Some transactions (bank fees, internal transfers, refund adjustments) don't represent real spending or income and can distort your reports.

**What was built:**
- Each transaction has an "Excluded" toggle
- Excluded transactions are hidden from dashboard calculations, recurring detection, and leak analysis
- They remain in the ledger and can be un-excluded at any time
- The ledger filter bar has an "Excluded" option to view only the excluded rows when needed

**What you see now:**
- A toggle in each row lets you exclude or include any transaction
- Excluded rows are visually dimmed in the ledger

---

## UX Quick Wins (Beta Test Fixes)

Four quality-of-life improvements raised after a beta testing round.

**What changed:**
- Empty ledger states now show a helpful message and an upload prompt rather than a blank table
- The "Apply to all" propagation button label was reworded to be clearer about what it does
- Active ledger filters now persist when you navigate away and return to the page
- Minor spacing and layout issues on the filter bar were corrected

**What you see now:**
- A more polished, less confusing ledger experience based on real feedback

---

## Propagation Toast Notification

The confirmation message shown after a bulk propagation update used to appear inline inside the table, which caused the table to shift and was easy to miss.

**What changed:**
- The confirmation moved to a fixed-position toast notification that appears in the corner of the screen
- The toast dismisses automatically after a few seconds

**What you see now:**
- After applying a category to multiple rows, a small toast message pops up in the corner confirming how many rows were updated, and the table stays in place
