# GL/AccountingService (within CoreBankingApi)

## Purpose
Double-entry general ledger — the financial backbone of the bank. Every money movement creates balanced journal entries.

## Module
Part of `CoreBankingApi`. Module path: `CoreBankingApi/Modules/GeneralLedger/`

## Responsibilities
- Chart of Accounts (CoA) management
- Double-entry journal posting (every Dr must have a matching Cr)
- Trial Balance generation
- P&L (Profit and Loss) statement
- Balance Sheet
- Interest accrual entries (from EOD)
- Provision entries (NPA provisioning)
- Branch-level GL reconciliation
- Inter-branch accounting (IBA entries)
- Day-end GL balancing check

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/gl/chart-of-accounts` | List GL accounts |
| POST | `/api/gl/journal` | Post journal entry |
| GET | `/api/gl/{accountId}/ledger` | GL account ledger |
| GET | `/api/gl/trial-balance` | Trial balance as of date |
| GET | `/api/gl/profit-loss` | P&L for period |
| GET | `/api/gl/balance-sheet` | Balance sheet as of date |
| GET | `/api/journal/{id}` | Get journal entry |
| GET | `/api/ledger/{accountId}/statement` | Account statement |

## Chart of Accounts Structure
```
ASSETS (1000–1999)
├── 1001  Cash in Hand
├── 1002  Balances with RBI
├── 1003  Balances with Other Banks
├── 1100  Loans and Advances
│   ├── 1101  Personal Loans
│   ├── 1102  Home Loans
│   └── 1103  Agricultural Loans
└── 1200  Fixed Assets

LIABILITIES (2000–2999)
├── 2001  Savings Deposits
├── 2002  Current Deposits
├── 2003  Fixed Deposits
├── 2004  Borrowings
└── 2100  Other Liabilities

INCOME (3000–3999)
├── 3001  Interest Income — Loans
├── 3002  Interest Income — Investments
├── 3003  Fee and Commission Income
└── 3004  Other Operating Income

EXPENSES (4000–4999)
├── 4001  Interest Expense — Deposits
├── 4002  Staff Expenses
├── 4003  Provisions for NPA
└── 4004  Other Operating Expenses
```

## Journal Entry Rules (Double-Entry Accounting)
```
Rule 1: Every journal entry must have equal Debit and Credit totals
Rule 2: Entries cannot be deleted — only reversed (with audit trail)
Rule 3: Entries for a closed day cannot be posted (requires day re-opening)
Rule 4: Inter-branch entries must be matched within 24 hours

Example — Cash Deposit of ₹10,000:
  Dr  Cash in Hand (1001)       10,000
  Cr  Savings Deposit (2001)    10,000

Example — Interest Accrual on FD ₹100,000 @ 7% (1 day):
  Dr  Interest Expense (4001)   19.18   (100000 × 7% / 365)
  Cr  Interest Accrued (2005)   19.18
```

## Data Model
```
JournalEntry
├── EntryId (GUID)
├── EntryDate
├── EntryType: REGULAR | REVERSAL | SYSTEM | EOD_ACCRUAL
├── Narration
├── ReferenceType: DEPOSIT | WITHDRAWAL | LOAN | PAYMENT | ...
├── ReferenceId (FK to the originating transaction)
├── PostedBy, PostedAt
├── IsReversed, ReversalEntryId
└── Lines: [
     { GlAccountId, DrAmount, CrAmount, CostCentre }
   ]
  (Sum of all DrAmount must equal Sum of all CrAmount)
```

## Validation
```csharp
// Every journal entry validated before posting
public void ValidateBalance(JournalEntry entry)
{
    var totalDr = entry.Lines.Sum(l => l.DrAmount);
    var totalCr = entry.Lines.Sum(l => l.CrAmount);
    if (totalDr != totalCr)
        throw new AccountingException($"Journal not balanced: Dr={totalDr}, Cr={totalCr}");
}
```

## IDRBT Requirements Met
- Section 15: General Ledger and accounting
- Section 15.1: Double-entry bookkeeping
- Section 15.2: Trial balance and financial statements
- Section 15.3: Inter-branch reconciliation
- RBI IRAC: Provision entries for NPA accounts
