# Spending Insights & Analysis

This section covers the features that turn raw transaction data into actionable information — recurring charge detection, the safe-to-spend dashboard, and the leak detection system.

---

## Recurring Charge Detection

The app automatically scans your transactions to identify charges that repeat on a regular schedule.

**What was built:**
- An engine that groups transactions by merchant and looks for ones that appear at consistent intervals — weekly, monthly, or annually
- Each detected pattern is assigned a "monthly equivalent" dollar amount so you can compare costs on the same scale
- Recurring charges are flagged in the ledger and factored into the dashboard calculations separately from one-time purchases

**What you see now:**
- The Dashboard shows a dedicated recurring expenses total
- Individual transactions marked as recurring are labeled in the ledger
- The Leaks page lists all detected recurring patterns ranked by cost

---

## Safe-to-Spend Dashboard

A top-level view of your financial picture for any selected month.

**What was built:**
- A hero card showing an estimated "safe to spend" amount — calculated as income minus recurring expenses, taxes, and committed bills
- Four key performance indicator (KPI) tiles: total income, total recurring expenses, total one-time expenses, and total discretionary spending
- A month selector so you can review any past month, not just the current one
- A category breakdown chart showing where spending went
- A recent transactions strip at the bottom of the page

**What you see now:**
- The Dashboard page opens to the current month with a large "Safe to Spend" number front and center
- Switching months updates all tiles and charts instantly

---

## KPI Card Subtitle Clarification

Some of the small descriptive labels below the KPI tile numbers were ambiguous — testers were unsure whether "Recurring" meant subscriptions only or all regular bills.

**What changed:**
- The subtitle text on each KPI card was reworded to be explicit about what it counts
- "Recurring expenses" is now labeled to clarify it includes subscriptions, regular bills, and other scheduled charges
- "One-time expenses" is labeled to distinguish it from recurring costs

**What you see now:**
- Each KPI tile has a short, clear label that explains exactly what the number represents without requiring any guesswork

---

## Import History List

There was no way to see a record of past uploads — you had to trust that your data was there without any confirmation log.

**What changed:**
- The upload page now includes an import history section listing every previous upload
- Each entry shows the file name, the account it was imported into, the date of import, and how many rows were added

**What you see now:**
- Below the upload form, a history table shows all your past imports in reverse chronological order

---

## Account Selector Fix

The account picker on the upload page would sometimes stay open after you made a selection, requiring an extra click to close it.

**What changed:**
- The dropdown now closes automatically as soon as you select an account

**What you see now:**
- Choosing an account in the upload form works in a single click with no stray open dropdowns

---

## Leak Detection — First Version

The initial leak detection system flagged transactions that looked like "leaky" spending patterns — small, frequent, easily-overlooked charges.

**What was built:**
- Detection rules for three patterns: high-frequency micro-charges (many small charges from the same merchant in a month), repeat discretionary spending (entertainment, delivery, convenience), and charges that look like forgotten subscriptions
- A dedicated Leaks page listing every detected pattern, ranked by estimated monthly cost
- Each leak card shows the merchant, estimated monthly total, and how many times it appeared

**What you see now:**
- The Leaks page gives a ranked list of spending patterns that may be worth reviewing or canceling

---

## Leak Detection Overhaul — Merchant-First Grouping

The first version grouped leaks by spending category (e.g. all "delivery" charges together) which made it hard to see which specific merchant was costing the most. A pattern like "DoorDash" and "Uber Eats" would be merged into one vague "delivery" card.

**What changed:**
- The detection engine was rebuilt to group first by merchant, then report the category breakdown within each merchant
- Each leak card now represents a single merchant (e.g. "DoorDash") with a total monthly cost and a breakdown of which transaction categories it appeared under
- The ranking changed to sort by total monthly cost per merchant, making it easier to see which specific service is the biggest leak

**What you see now:**
- The Leaks page shows one card per merchant with the merchant name as the headline
- Each card shows the estimated monthly total, frequency, and a small category breakdown below

---

## Merchant Normalization — DoorDash & Amazon Variants

Even after the merchant-first overhaul, DoorDash and Amazon transactions were still being split into multiple entries because different charges appeared with different abbreviations in bank statements.

**What changed:**
- DoorDash: charges appearing as "DD *", "Dd*", "DOORDASH", and similar variants are now all grouped under a single "DoorDash" entry
- Amazon: charges appearing as "AMZN", "AMAZON.COM", "AMZN MKTP", and other variants are grouped under "Amazon"
- The normalization also ensures these merchants are keyed correctly in recurring charge detection, so an Amazon charge and an AMZN charge are counted as the same recurring merchant

**What you see now:**
- DoorDash and Amazon each appear as a single entry on the Leaks page and in recurring charge detection, with all their variants counted together
