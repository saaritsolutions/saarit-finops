# SAAR-STMT-001 — Account Statement: Transaction History Endpoint + UI

| Field | Value |
|---|---|
| **Ticket ID** | SAAR-STMT-001 |
| **Status** | In Progress |
| **Session** | 53 — 2026-04-28 |
| **Services** | AccountService (port 5217), TransactionService (port 5005) |
| **Priority** | High |

---

## Problem Statement

AccountService has no way to return the transaction history for a specific customer account. UCBs are required by RBI to provide passbook / statement functionality. The TransactionService already stores journals with a `ReferenceId` field (account number), and AccountService already passes `accountNumber` as `referenceId` when posting maturity/closure/fee journals — but there is no query endpoint to retrieve them by reference, and no account statement surface in the UI.

Two secondary gaps are also fixed:
- `CreateAccount` does not auto-generate `AccountNumber` — it is null unless the client provides it, causing the fallback `id.ToString()` to be used as `referenceId` in all journal posts.
- TransactionService has no query endpoint to retrieve journals by `ReferenceId`.

---

## Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1 | **Auto-generate AccountNumber on create** | When `CreateAccount` is called and `AccountNumber` is null/empty, auto-set `AccountNumber = "ACC{AccountId:D8}"` (e.g., "ACC00000001") after the first `SaveChangesAsync`. Persist with a second save. Accounts created with an explicit AccountNumber are not overwritten. |
| FR-2 | **TransactionService: GET /api/journal/by-reference/{referenceId}** | Returns all journals whose `ReferenceId == referenceId`, ordered by `PostedAt` descending. Supports optional query params `?from=&to=&page=&pageSize=`. `from` defaults to 90 days ago; `to` defaults to today. `page` defaults to 1; `pageSize` defaults to 50 (max 200). Returns `{ total, page, pageSize, items: [Journal + Entries] }`. Returns 200 with empty list if no journals found (not 404). |
| FR-3 | **AccountService: GET /api/account/{id}/statement** | Fetches the statement for account `id`. Accepts `?from=&to=&page=&pageSize=`. Resolves `referenceId = account.AccountNumber ?? account.AccountId.ToString()`. Calls TransactionService `GET /api/journal/by-reference/{referenceId}`. Returns `AccountStatementResponse { AccountId, AccountNumber, CustomerName, ProductType, CurrentBalance, From, To, Total, Page, PageSize, Entries[] }`. Returns 404 if account not found. Fail-open: if TransactionService is unreachable, returns statement with empty entries and a `warning` field. |
| FR-4 | **Statement entry shape** | Each `StatementEntry` has: `JournalNumber`, `PostedAt`, `Description`, `Debit` (sum of debit entries for this referenceId account), `Credit` (sum of credit entries), `JournalId`. |
| FR-5 | **Frontend: Statement button per account row** | In `AccountManagement.tsx`, each row in the accounts table has a "Statement" icon button (ReceiptLong icon, MUI Tooltip "View Statement"). Opens a dialog: date range pickers (`From` / `To`, default last 30 days), a MUI Table of statement entries (Date | Description | Credit | Debit | Journal#), total row count, pagination (pageSize=10). Displays account number in dialog header. |
| FR-6 | **Frontend: CSV export** | "Export CSV" button in the statement dialog downloads the visible date-range entries as CSV with columns: Date, Description, Credit(INR), Debit(INR), JournalNumber. |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | `AccountNumber` auto-generation is idempotent — calling `CreateAccount` twice with the same body does not create duplicate accounts (enforced by unique constraint on mobile/email at business logic level, not this ticket) |
| NFR-2 | TransactionService `by-reference` endpoint returns paged results (max pageSize=200) to avoid unbounded queries |
| NFR-3 | AccountService statement endpoint is fail-open — TransactionService down returns `{ ..., entries: [], warning: "Transaction service unavailable" }` with HTTP 200 |
| NFR-4 | At least 3 NUnit tests in AccountService.Tests + 2 in TransactionService.Tests + 3 Cypress regression tests |
| NFR-5 | nginx.conf: no change needed — `GET /api/journal/by-reference` is a service-to-service call (AccountService → TransactionService on internal Docker network); only `GET /api/account` routes through nginx |

---

## Out of Scope

- Running balance column (would require cumulative sum across all time — complex for multi-tenant setup)
- PDF passbook generation
- Mini statement (SMS/email delivery)
- Debit/credit card transaction statement
- Cheque transactions
- UPI / NEFT / RTGS leg (these go through RemittanceService, not yet built)
- Backdating journals or correcting existing journal referenceIds for legacy accounts

---

## Data Model

### TransactionService: No model change
`Journal.ReferenceId` and `Journal.ReferenceType` already exist. No migration needed.

### AccountService: No model change
`Account.AccountNumber` already exists as `string?`. FR-1 auto-populates it post-insert.

---

## API Endpoints

| Method | Route | Service | Description |
|---|---|---|---|
| GET | `/api/journal/by-reference/{referenceId}` | TransactionService | Journals by referenceId with date range + pagination |
| GET | `/api/account/{id}/statement` | AccountService | Account statement (proxies TransactionService) |

---

## GL Account Mapping (for statement display)

| GL Code | Account Name | Typical Statement Line |
|---|---|---|
| 1010 | Cash and Bank | Cash deposit / withdrawal |
| 2010 | Customer Deposits (Savings) | Savings deposit / closure payout |
| 2020 | Customer Deposits (FD/RD) | FD/RD deposit / maturity payout |
| 4010 | Interest Income | Interest credited |
| 4020 | Fee Income | Account maintenance fee |
| 5010 | Interest Expense | Interest paid on deposits |

---

## Test Plan

| Test | Type | Target |
|---|---|---|
| T-01: GetByReference_WithMatchingJournals_ReturnsPaged | NUnit | TransactionService |
| T-02: GetByReference_NoMatchingJournals_ReturnsEmptyList | NUnit | TransactionService |
| T-03: GetStatement_AutoGeneratedAccountNumber_UsedAsReferenceId | NUnit | AccountService |
| T-04: GetStatement_TransactionServiceDown_ReturnsFailOpenWithWarning | NUnit | AccountService |
| T-05: GetStatement_AccountNotFound_Returns404 | NUnit | AccountService |
| T-06: [REGRESSION] Statement dialog opens with date range pickers | Cypress | Frontend |
| T-07: [REGRESSION] Statement dialog shows entries from stub | Cypress | Frontend |
| T-08: [REGRESSION] Export CSV button triggers download | Cypress | Frontend |
