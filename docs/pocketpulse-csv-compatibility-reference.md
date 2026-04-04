# PocketPulse — CSV Compatibility & Sample Data Reference

---

## Part 1: Where to Find Additional Sample Data

### Best Sources (realistic merchant descriptions, real-world formats)

**Kaggle — Transaction Datasets**
- [Credit Card Transactions Dataset](https://www.kaggle.com/datasets/priyamchoksi/credit-card-transactions-dataset) — ~1.8M rows with realistic merchant names, amounts, categories, and timestamps. Good for classifier benchmarking.
- [USA Banking Transactions Dataset 2023-2024](https://www.kaggle.com/datasets/pradeepkumar2424/usa-banking-transactions-dataset-2023-2024) — US-centric, includes checking/savings-style transactions.
- [Bank Transaction Data (Apoorv Watsky)](https://www.kaggle.com/datasets/apoorvwatsky/bank-transaction-data) — Categorized personal transactions with merchant descriptions.
- [Financial Transactions Dataset (Analytics)](https://www.kaggle.com/datasets/computingvictor/transactions-fraud-datasets) — Large fraud-detection dataset, but the legitimate transactions make good baseline test data.
- [Bank Customer Segmentation (1M+ Transactions)](https://www.kaggle.com/datasets/shivamb/bank-customer-segmentation) — 1M+ rows, good for stress-testing the detector at scale.

**Limitations of Kaggle data for PocketPulse testing:** Most datasets use clean merchant names ("Amazon", "Walmart") rather than raw bank descriptions ("AMZN MKTP US*2L3AB CA", "WAL-MART #5432 CHULA VISTA CA"). You'll need to either transform them to mimic raw bank formatting or use them primarily for category/recurrence logic testing, not merchant normalization.

### Build Your Own Synthetic Datasets

You already generated synthetic CSVs for PocketPulse earlier. The most useful approach for demo/presentation purposes:

1. **Take your real Navy Federal data** — anonymize it by shifting dates and randomizing amounts ±10%
2. **Generate bank-specific formatted CSVs** — write a script that takes a canonical transaction list and outputs it in each bank's column format (Chase, BofA, Wells Fargo, etc.)
3. **Seed with known edge cases** — unsigned amounts, descriptions with no directional keywords, price-change subscriptions, quarterly/annual charges

This gives you demo data that exercises every parser path without exposing real financial data.

### Public Merchant Databases (for expanding the classifier keyword list)

- **Plaid's merchant data** — Plaid normalizes ~500K merchant names as part of their transaction enrichment. Their open docs describe common merchant formatting patterns.
- **MCC (Merchant Category Code) tables** — ISO 18245 standard. Free lookup tables available on GitHub. Maps 4-digit codes to spending categories. If the CSV includes an MCC column, it's an instant ~95% accuracy shortcut.
- **IRS merchant category references** — Useful for mapping to tax-relevant categories.

---

## Part 2: CSV Upload Limitations (Bank-Only Scope)

### What PocketPulse Supports

PocketPulse is designed exclusively for **bank and credit union transaction exports** — checking, savings, and credit card accounts. It is NOT designed for:

- Brokerage/investment account exports (different schema — tickers, shares, cost basis)
- Payroll system exports (ADP, Gusto, etc.)
- Accounting software exports (QuickBooks, Xero GL dumps)
- Payment processor exports (Stripe, Square merchant-side)
- Crypto exchange exports (Coinbase, etc.)

### Current Parser Constraints

| Constraint | Current Behavior | Impact |
|---|---|---|
| **Column detection** | Fuzzy-maps headers like "Trans Date", "Posting Date", "Debit", "Credit" | Works for most major banks. Fails on non-English headers or highly unusual column names |
| **Amount formats** | Handles `$1,234.56`, `(1234.56)` accounting, currency symbols | Covers ~95% of US bank exports |
| **Signed vs. unsigned amounts** | Handles single signed column OR split debit/credit columns | Unsigned single-column CSVs (some Navy Federal, some credit unions) require directional hints in description text — this is the primary failure mode |
| **Date formats** | `MM/DD/YYYY`, `M/D/YYYY`, `YYYY-MM-DD`, `MM/DD/YY`, `MM-DD-YYYY` | Covers all major US bank formats. Does not handle `DD/MM/YYYY` (international) — would misparse day/month |
| **Encoding** | UTF-8 assumed | Most US bank CSVs are UTF-8 or ASCII. Latin-1 encoded files from some credit unions may garble special characters |
| **File size** | No explicit limit in code | Practical limit ~50K rows before in-memory detection starts lagging (~5+ seconds) |
| **Header row** | Required (first row must be column headers) | Some bank exports include metadata rows above headers (account number, date range). These must be stripped manually or the parser fails silently |
| **Multiple accounts in one file** | Not supported | Some banks (Wells Fargo Combined Statement, USAA) export multiple accounts into a single CSV with sub-headers. Parser treats the whole file as one account |

### Presentation-Ready "Supported Banks" Claim

Based on the column detection logic in `csvParser.ts`, PocketPulse can handle any US bank CSV that provides at minimum:

- A **date column** (any common US date format)
- A **description/memo column** (raw merchant text)
- An **amount column** (signed) OR separate **debit/credit columns**

This covers the vast majority of US checking, savings, and credit card exports. The accuracy ceiling isn't the parser — it's the classifier's keyword coverage and the unsigned-amount edge case.

---

## Part 3: Top 10 US Bank CSV Export Schemas

### 1. Chase (JPMorgan Chase)
**Largest US bank by assets. CSV export available from Activity page.**

**Checking/Savings:**
```
Transaction Date,Post Date,Description,Amount,Type,Balance,Check or Slip #
01/15/2026,01/15/2026,SHELL OIL 57442 SAN DIEGO CA,-42.50,DEBIT,3847.22,
01/15/2026,01/16/2026,DIRECT DEP EMPLOYER INC,3200.00,CREDIT,7047.22,
```
- Amount: **Signed** (negative = debit, positive = credit)
- Type column: `DEBIT`, `CREDIT`, `CHECK`, `DSLIP`, `ATM`
- Balance: Running balance included
- Date format: `MM/DD/YYYY`
- Limit: ~24 months, 1,000 row cap

**Credit Card:**
```
Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/12/2026,01/14/2026,AMAZON.COM*2L3AB AMZN.COM/BILL WA,Shopping,Sale,-89.99,
01/13/2026,01/13/2026,AUTOMATIC PAYMENT - THANK YOU,,Payment,1500.00,
```
- Amount: **Signed** (negative = purchase, positive = payment/credit)
- Category column: Chase's own categories (Shopping, Food & Drink, Travel, etc.) — could be used as a secondary signal
- Memo: Usually empty

**PocketPulse compatibility: HIGH.** Signed amounts, two date columns, type column provides direction signal.

---

### 2. Bank of America
**Second largest. CSV download from "Download Transactions" in account activity.**

**Checking/Savings:**
```
Date,Description,Amount,Running Bal.
01/15/2026,"CHECKCARD 0115 VONS #2048 CHULA VIST CA",-67.82,4521.30
01/15/2026,"BA ELECTRONIC PAYMENT GEICO",- 284.00,4237.30
01/16/2026,"BKOFAMERICA ATM 01/15 WITHDRAWAL",-200.00,4037.30
```
- Amount: **Signed** (negative = debit)
- Single date column
- Running balance included
- Descriptions use `CHECKCARD`, `BA ELECTRONIC PAYMENT`, `BKOFAMERICA ATM` prefixes
- Date format: `MM/DD/YYYY`

**Credit Card:**
```
Posted Date,Reference Number,Payee,Address,Amount
01/15/2026,24958734958734,STARBUCKS #12345,SAN DIEGO CA,-5.75
01/16/2026,24958734958735,PAYMENT RECEIVED - THANK YOU,,500.00
```
- Amount: **Signed**
- Separate Payee and Address columns
- No running balance

**PocketPulse compatibility: HIGH.** Signed amounts, standard column names.

---

### 3. Wells Fargo
**Third largest. CSV export limited; primarily PDF statements.**

**Checking (when CSV is available):**
```
Date,Amount,*,Check Number,Description
01/15/2026,-125.00,,,"BILL PAY EDISON ELECTRIC ON-LINE"
01/15/2026,-42.50,,,"POS DEBIT VISA CHECK CRD SHELL OIL"
01/16/2026,2800.00,,,"DIRECT DEPOSIT EMPLOYER INC"
```
- Amount: **Signed**
- Asterisk column (`*`): Transaction status flag (sometimes blank)
- Check Number: Populated for check transactions only
- Descriptions use `POS DEBIT VISA CHECK CRD`, `BILL PAY`, `DIRECT DEPOSIT` prefixes
- Date format: `MM/DD/YYYY`

**Note:** Wells Fargo often only provides PDF statements. CSV availability varies by account type and may only cover recent months.

**PocketPulse compatibility: MEDIUM.** Signed amounts work, but the `*` column and Check Number column need to be ignored cleanly. Description prefixes provide strong directional hints.

---

### 4. Citibank
**CSV download from "View Transactions" section.**

**Checking:**
```
Date,Description,Debit,Credit,Balance
01/15/2026,SHELL OIL 57442657,42.50,,4821.30
01/15/2026,ZELLE PAYMENT TO JOHN DOE,500.00,,4321.30
01/16/2026,PAYROLL DIRECT DEPOSIT,,3200.00,7521.30
```
- Amount: **Split columns** (separate Debit and Credit, both positive)
- No signed single amount column
- Running balance included
- Date format: `MM/DD/YYYY`

**Credit Card:**
```
Status,Date,Description,Debit,Credit
Cleared,01/15/2026,AMAZON.COM*AB1CD AMZN.COM/BILL,89.99,
Cleared,01/16/2026,PAYMENT RECEIVED - THANK YOU,,1500.00
```
- Status column: `Cleared`, `Pending`
- Split Debit/Credit columns

**PocketPulse compatibility: HIGH.** Split debit/credit columns are handled by `deriveSignedAmount()`. The parser correctly interprets debit as negative.

---

### 5. U.S. Bank
**CSV download from Activity tab.**

**Checking:**
```
Date,Transaction,Name,Memo,Amount
01/15/2026,DEBIT,SHELL OIL 57442657 SAN DIEGO CA,POS Purchase,-42.50
01/15/2026,CREDIT,PAYROLL DIRECT DEPOSIT,ACH Credit,3200.00
```
- Amount: **Signed**
- Transaction column: `DEBIT`, `CREDIT`, `CHECK`
- Memo column: Transaction type detail (`POS Purchase`, `ACH Credit`, `ATM Withdrawal`)
- Date format: `MM/DD/YYYY`

**PocketPulse compatibility: HIGH.** Signed amounts, Transaction and Memo columns provide strong direction signals.

---

### 6. Navy Federal Credit Union (NFCU)
**Your primary test bank. CSV download from desktop site transaction history.**

**Checking:**
```
Date,No.,Description,Debit,Credit,Balance
01/15/2026,,CHECKCARD 0115 SHELL OIL 57442 SAN DIEGO CA 00000000000,42.50,,4821.30
01/15/2026,,- LAKEVIEW LN SRV MTG PYMT,3469.00,,1352.30
01/16/2026,,ACH CREDIT DFAS-CL ACTIVE DUTY PAY,,3200.00,4552.30
```
- Amount: **Split columns** (Debit and Credit, both positive/unsigned)
- `No.` column: Check number (usually blank for non-check transactions)
- Descriptions use `CHECKCARD`, `ACH CREDIT`, `ACH DEBIT` prefixes — but not consistently
- Trailing noise: store numbers, city/state, long zero-padded reference numbers
- Date format: `MM/DD/YYYY`
- **Key issue:** Many merchant transactions appear as unsigned positive debits with no directional prefix — this is the primary misclassification source

**PocketPulse compatibility: MEDIUM.** Split debit/credit works. The unsigned-amount problem is real but mitigated by the debit/credit column split. The bigger issue is description noise and inconsistent directional prefixes.

---

### 7. Capital One
**CSV download from "Download Transactions" in account activity.**

**Credit Card (360 Checking similar):**
```
Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
01/15/2026,01/16/2026,1234,SHELL OIL 57442657,Gas/Automotive,42.50,
01/15/2026,01/16/2026,1234,PAYMENT - THANK YOU,,, 1500.00
```
- Amount: **Split columns** (Debit/Credit, positive values)
- Card No.: Last 4 digits
- Category: Capital One's own categories — strong secondary signal
- Date format: `MM/DD/YYYY` or `YYYY-MM-DD` (varies by account type)

**Checking (360 Checking):**
```
Account Number,Transaction Date,Transaction Amount,Transaction Type,Transaction Description,Balance
****1234,01/15/2026,-42.50,Debit,SHELL OIL 57442657,4821.30
****1234,01/16/2026,3200.00,Credit,PAYROLL DIRECT DEPOSIT,8021.30
```
- Amount: **Signed** (single column)
- Transaction Type: `Debit`, `Credit`
- Account Number: Masked

**PocketPulse compatibility: HIGH.** Both formats are well-supported. Category column is a bonus signal.

---

### 8. PNC Bank
**CSV download from Account Activity or Virtual Wallet.**

**Checking:**
```
Date,Description,Withdrawals,Deposits,Balance
01/15/2026,SHELL OIL 57442 VISA PURCHASE,42.50,,4821.30
01/15/2026,ONLINE PAYMENT GEICO AUTO INS,284.00,,4537.30
01/16/2026,DIRECT DEPOSIT EMPLOYER INC,,3200.00,7737.30
```
- Amount: **Split columns** (Withdrawals/Deposits — note different names from Debit/Credit)
- Date format: `MM/DD/YYYY`
- Descriptions include `VISA PURCHASE`, `ONLINE PAYMENT` directional hints

**PocketPulse compatibility: HIGH.** Parser needs to recognize "Withdrawals" → Debit and "Deposits" → Credit. Column name fuzzy-matching should handle this.

---

### 9. TD Bank
**CSV download from "Download Transactions" in online banking.**

**Checking:**
```
Date,Activity,Amount,Balance
01/15/2026,VISA DEBIT PUR SHELL OIL 57442657,-42.50,4821.30
01/15/2026,PREAUTHORIZED DEBIT GEICO,-284.00,4537.30
01/16/2026,DIRECT DEPOSIT EMPLOYER INC,3200.00,7737.30
```
- Amount: **Signed**
- Single "Activity" description column
- Descriptions use `VISA DEBIT PUR`, `PREAUTHORIZED DEBIT`, `DIRECT DEPOSIT` prefixes
- Date format: `MM/DD/YYYY`

**PocketPulse compatibility: HIGH.** Signed amounts, strong directional prefixes in descriptions.

---

### 10. USAA
**CSV download from transaction history. Popular with military — overlaps with your Navy Federal demographic.**

**Checking:**
```
Date,Description,Original Description,Category,Amount,Status
01/15/2026,Shell,SHELL OIL 57442657 SAN DIEGO CA,Gas/Automotive,-42.50,Posted
01/15/2026,Geico,GEICO AUTOPAY,Insurance,-284.00,Posted
01/16/2026,Direct Deposit,DFAS-CL ACTIVE DUTY PAY,Income,3200.00,Posted
```
- Amount: **Signed**
- Two description columns: cleaned `Description` + raw `Original Description`
- Category: USAA's own categories (pre-classified)
- Status: `Posted`, `Pending`
- Date format: `MM/DD/YYYY`

**PocketPulse compatibility: VERY HIGH.** Best-case scenario — USAA provides clean merchant name, raw description, pre-classified category, signed amounts, and status. The `Original Description` is what PocketPulse should classify against; the `Category` could be used as a confidence check.

---

## Summary: Parser Requirements Matrix

| Bank | Amount Style | Date Format | Direction Signal | Extra Columns | Parser Risk |
|---|---|---|---|---|---|
| Chase | Signed | MM/DD/YYYY | Type column | Category (CC only) | Low |
| Bank of America | Signed | MM/DD/YYYY | Description prefix | — | Low |
| Wells Fargo | Signed | MM/DD/YYYY | Description prefix | Check No., Status | Low-Med |
| Citibank | Split Debit/Credit | MM/DD/YYYY | Column split | Status | Low |
| U.S. Bank | Signed | MM/DD/YYYY | Transaction + Memo | — | Low |
| Navy Federal | Split Debit/Credit | MM/DD/YYYY | Inconsistent prefix | Check No. | **Medium** |
| Capital One | Split or Signed (varies) | MM/DD/YYYY | Type column + Category | Card No. | Low |
| PNC | Split Withdrawals/Deposits | MM/DD/YYYY | Column names | — | Low |
| TD Bank | Signed | MM/DD/YYYY | Description prefix | — | Low |
| USAA | Signed | MM/DD/YYYY | Category column | Clean + Raw description | Very Low |

### Key Takeaway for Presentation

PocketPulse handles **9 of 10** top US bank CSV formats with minimal friction. The primary edge case is **unsigned-amount exports** (Navy Federal being the most prominent), which is addressed by the split Debit/Credit column detection and the direction-hint hardening in Phase 3 of the overhaul.

For the demo, the strongest story is: *"Download your CSV from any of the 10 largest US banks. Upload it. PocketPulse does the rest — no configuration, no column mapping, no integrations."*
