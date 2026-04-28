# AccountService (within CoreBankingApi)

## Purpose
Management of all deposit account types: Savings (CASA), Current, Fixed Deposit (FD), Recurring Deposit (RD), Cash Credit (CC), and Overdraft (OD).

## Module
Part of `CoreBankingApi` (not a standalone service). Module path: `CoreBankingApi/Modules/Account/`

## Responsibilities
- Account opening (CASA, FD, RD, CC, OD)
- Balance enquiry and transaction history
- Cash deposit and withdrawal
- Fund transfers (within bank)
- Standing Instructions (recurring transfers)
- Dormant/inoperative account management
- Interest posting (from EOD results)
- Account closure process
- Nomination management

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/account` | List accounts (branch-scoped) |
| GET | `/api/account/{id}` | Get account details + balance |
| POST | `/api/account` | Open new account (auto-generates AccountNumber = "ACC{id:D8}" if not provided — SAAR-STMT-001) |
| POST | `/api/account/{id}/deposit` | Cash deposit |
| POST | `/api/account/{id}/withdraw` | Cash withdrawal |
| POST | `/api/account/{id}/transfer` | Inter-account transfer |
| GET | `/api/account/{id}/transactions` | Transaction history (paginated) |
| GET | `/api/account/{id}/statement` | Account statement (date range, proxies TransactionService by-reference — SAAR-STMT-001) |
| POST | `/api/account/{id}/close` | Initiate account closure |
| POST | `/api/account/{id}/standing-instruction` | Create SI |
| GET | `/api/account/{id}/standing-instructions` | List SIs |

## Account Types
| Type | Code | Description |
|---|---|---|
| Savings Bank | SB | Primary retail deposit |
| Current Account | CA | Business/commercial |
| Fixed Deposit | FD | Term deposit |
| Recurring Deposit | RD | Monthly installment savings |
| Cash Credit | CC | Working capital facility |
| Overdraft | OD | Against securities |

## Data Model
```
Account
├── AccountId (GUID)
├── AccountNumber (formatted: BRANCHCODE + SERIAL)
├── CustomerId (FK → CustomerService)
├── AccountType: SB | CA | FD | RD | CC | OD
├── ProductCode (FK → ProductParameters)
├── BranchId
├── CurrentBalance (NUMERIC 18,2)
├── AvailableBalance (= CurrentBalance - hold amount)
├── HoldAmount (cheque presented, not yet cleared)
├── Status: ACTIVE | DORMANT | FROZEN | CLOSED | NPA
├── OpenDate, CloseDate
├── NomineeDetails
├── InterestRate (for FD/RD — snapshot at opening)
├── MaturityDate (for FD/RD)
├── AutoRenewal (for FD)
└── AuditFields
```

## Domain Events Published
- `AccountOpened` — triggers GL entry creation
- `AccountDebited` / `AccountCredited`
- `FdMatured` — triggers auto-renewal or CASA credit
- `AccountStatusChanged` — dormant/frozen transitions

## IDRBT Requirements Met
- Section 1: Deposit products (SB, CA, FD, RD, CC, OD)
- Section 1.1: Account opening workflow with introducer
- Section 1.3: Standing Instructions
- Section 1.4: Dormant account revival workflow
- Section 1.5: Nomination facility
