# PocketPulse — Project Documentation

PocketPulse is a web application built for small-business owners to understand where their money is going. You upload bank statement files from one or more accounts, and the app automatically sorts every transaction into a category, spots recurring charges and subscription leaks, and gives you a live dashboard showing how much you can safely spend. Everything is private and runs under a single owner login.

---

## What's in This Folder

| File | What It Covers |
|------|----------------|
| [01-upload-import.md](01-upload-import.md) | How bank statement files are uploaded, parsed, and deduplicated |
| [02-ledger.md](02-ledger.md) | Reviewing, editing, and exporting your transaction list |
| [03-insights.md](03-insights.md) | Recurring charges, leak detection, and the spending dashboard |
| [04-foundation.md](04-foundation.md) | Login, app structure, and the core technology underneath |

---

## All Completed Work — Quick Reference

### Data Import & Upload
| Topic | Summary |
|-------|---------|
| CSV Upload Pipeline | Upload one or many bank statement files, assign them to an account, and import all rows in one step |
| Bank of America Format Fixes | Fixed two separate parsing failures specific to Bank of America exports (summary blocks and unescaped quote characters) |
| Inline Account Creation | Added the ability to create a new account directly on the upload page instead of navigating away |
| Upload Deduplication | Re-uploading the same file no longer creates duplicate transactions; already-seen rows are silently skipped |
| AI Format Detection | When the app doesn't recognize a file's layout, it uses AI to figure out which column is the date, amount, and description |
| Skip Count Messaging | The upload summary now shows two separate counts: rows already in your ledger vs. duplicate rows within the file itself |

### Ledger & Transaction Review
| Topic | Summary |
|-------|---------|
| Ledger Table | A searchable, filterable, paginated table showing every imported transaction |
| Inline Editing | Change a transaction's category, business/personal class, or recurring flag directly in the table row |
| CSV Export | Download the current filtered view of your ledger as a spreadsheet |
| Category Propagation | Fix one transaction's category and offer to apply the same fix to all other rows from the same merchant |
| Fuzzy Merchant Matching | Propagation now catches slight spelling variations of the same merchant name (e.g. "AMZN" and "AMAZON") |
| Persist Edit Rules | When you manually fix a category, that rule is saved so future uploads of the same merchant are classified correctly from the start |
| UX Quick Wins | Four beta-test quality-of-life fixes: better empty states, clearer button labels, filter persistence, and layout polish |
| Propagation Toast | The "changes applied" confirmation moved from an inline notice to a floating toast so it doesn't push the table around |

### Spending Insights
| Topic | Summary |
|-------|---------|
| Recurring Charge Detection | The app automatically identifies charges that appear on a regular schedule (weekly, monthly, annual) |
| Safe-to-Spend Dashboard | A hero card showing estimated money available to spend, supported by KPI tiles for income, recurring costs, and discretionary spending |
| KPI Card Subtitles | Reworded the small descriptive labels on each dashboard tile to be clearer and less ambiguous |
| Import History | The upload page now shows a log of every previous import with row counts and timestamps |
| Account Selector Fix | Fixed a bug where the account picker on the upload page wouldn't close after making a selection |
| Leak Detection (v1) | First version of automatic leak detection, flagging high-frequency micro-charges and repeat discretionary spending |
| Leak Detection Overhaul | Rebuilt the detection engine to group suspected leaks by merchant first, giving more accurate and actionable results |
| Merchant Normalization | DoorDash and Amazon purchases now correctly group under one merchant name regardless of how the bank abbreviates them |

### App Foundation
| Topic | Summary |
|-------|---------|
| Authentication | Secure login and logout with password hashing; all pages are protected until you sign in |
| First-Account Gate | New users are guided to create their first account before any data entry is possible |
| Database Schema | Core data tables for transactions, uploaded files, accounts, and recurring charge reviews |
| CSV Parsing Engine | The rules-based system that extracts dates, amounts, and merchants from raw bank file rows |
| AI Categorization | An optional AI pass that classifies transactions the rules engine couldn't confidently categorize |
| Wipe & Reset Controls | Buttons to clear all transactions or the entire workspace when starting fresh |
| Design System | Consistent glass-card visual style with a fixed sidebar, animated page transitions, and a responsive layout |
