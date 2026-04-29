# SAAR-NPA-002 — NPA Loan Write-Off Workflow

**Ticket ID:** SAAR-NPA-002
**Status:** In Progress
**Priority:** High
**Session:** 56 (2026-04-28)
**Parent Feature:** Risk Management / NPA Lifecycle
**Depends On:** SAAR-NPA-001 (NPA Classification Board — DONE)

---

## 1. Background

Once a loan is classified as NPA (Sub-Standard → Doubtful-1 → Doubtful-2 → Doubtful-3), and the bank has provisioned 100% of the outstanding principal, the loan may be written off the balance sheet.

Write-off does **not** mean the bank forgives the debt — recovery efforts continue — but it removes the asset from the active loan book and adjusts the GL accordingly.

This feature completes the NPA lifecycle: Classification (SAAR-NPA-001) → Write-Off (SAAR-NPA-002).

---

## 2. Functional Requirements

### FR-1 — Write-Off Action
- A `DISBURSED` loan with `SmaStatus = "NPA"` can be written off via `POST /api/loans/{id}/write-off`
- Only loans with `NpaSubClassification = "DOUBTFUL_3"` (≥ 1096 DPD, 100% provisioned) are eligible for write-off
- Request body: `{ "reason": "string", "authorizedBy": "string" }`

### FR-2 — Write-Off Status
- On write-off, `LoanApplication.Status` transitions to `"WRITTEN_OFF"`
- New fields added to `LoanApplication`:
  - `WriteOffDate` (`DateTime?`) — UTC timestamp of write-off
  - `WriteOffReason` (`string?`) — reason text (max 500 chars)
  - `WriteOffAuthorizedBy` (`string?`) — user who authorized
- `WrittenOffAt` (alias for display) exposed in DTO

### FR-3 — GL Journal Posting
- Write-off posts a double-entry journal via TransactionService:
  - **DR 5040** — Provision for NPA (reduces balance sheet provision)
  - **CR 1020** — Loans & Advances (removes loan asset from balance sheet)
  - Amount = `OutstandingPrincipal`
  - Idempotency key: `WRITEOFF-{applicationNumber}`
  - Fail-open: if TransactionService is unavailable, write-off still succeeds; journal is marked as "failed"

### FR-4 — Written-Off Section in NPA Board
- `GET /api/loans/npa-board` response gains a new field: `writtenOffLoans` (list)
- `writtenOffCount` and `writtenOffOutstanding` added to KPI section
- Written-off loans are **excluded** from `npaLoans` (no double-counting)

### FR-5 — Write-Off Button on NPA Board
- NPA Board table row shows a "Write Off" `IconButton` for `DOUBTFUL_3` loans
- Clicking opens a confirmation dialog with: reason field (required), authorized-by field (required)
- On submit: calls `POST /api/loans/{id}/write-off`; page refreshes on success
- Button has `aria-label="Write off {applicationNumber}"` for Cypress testability

### FR-6 — Written-Off Table
- New collapsible section at bottom of NPA Board: "Written-Off Loans"
- Shows: Application #, Applicant, Product, Outstanding (at time of write-off), Write-Off Date, Reason
- Displayed with `opacity: 0.75` and `WRITTEN_OFF` dark-grey chip

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| NFR-1 Idempotency | Calling write-off twice for the same loan returns 400 (already written off) |
| NFR-2 Audit | WriteOffDate + WriteOffAuthorizedBy persisted to DB; not editable after write-off |
| NFR-3 Fail-open | GL journal failure does not block write-off; `writeOffJournalNumber` is null if failed |
| NFR-4 Performance | NPA Board endpoint adds `writtenOffLoans` from same query — no N+1 |

---

## 4. RBI IRAC Context

| Sub-Class | DPD Range | Provisioning | Write-Off Eligible |
|-----------|-----------|--------------|-------------------|
| SUB_STANDARD | 90–365 | 15% | No |
| DOUBTFUL_1 | 366–730 | 25% | No |
| DOUBTFUL_2 | 731–1095 | 40% | No |
| **DOUBTFUL_3** | **1096+** | **100%** | **Yes** |

---

## 5. GL Account Mapping

| Account Code | Name | Normal Balance | Write-Off Role |
|---|---|---|---|
| 5040 | Provision for NPA | Credit | Debited (provision consumed) |
| 1020 | Loans & Advances | Debit | Credited (removes from books) |

> Note: Account 5040 "Provision for NPA" will be added to `LedgerSeedService` if not already present.

---

## 6. API Contract

### `POST /api/loans/{id}/write-off`
**Route:** Absolute `/api/loans/{id}/write-off` (bypasses controller prefix)
**Auth:** `[AllowAnonymous]` (same pattern as npa-board)
**Request:**
```json
{
  "reason": "Borrower deceased, no recovery possible",
  "authorizedBy": "branch.manager@ucb-demo.com"
}
```
**Response 200:**
```json
{
  "applicationNumber": "LOAN-0001",
  "status": "WRITTEN_OFF",
  "writeOffDate": "2026-04-28T10:30:00Z",
  "writeOffJournalNumber": "JNL-20260428-000001",
  "outstanding": 150000.00
}
```
**Errors:**
- `400` — Loan not eligible (not DOUBTFUL_3, already written off, or not DISBURSED)

---

## 7. Out of Scope

- Recovery tracking after write-off (SAAR-NPA-003)
- Partial write-off (always full outstanding principal)
- Regulatory reporting of written-off amounts to RBI (SAAR-RPT-002)
- Approval workflow for write-off (added as enhancement later)

---

## 8. Test Plan

| Test ID | Description | Type |
|---------|-------------|------|
| T-01 | `WriteOff_Doubtful3_Returns200AndStatusWrittenOff` | NUnit |
| T-02 | `WriteOff_SubStandardLoan_Returns400NotEligible` | NUnit |
| T-03 | `WriteOff_AlreadyWrittenOff_Returns400Idempotent` | NUnit |
| T-04 | NPA Board — Write-off button visible for DOUBTFUL_3 row | Cypress |
| T-05 | Write-off dialog submits and page refreshes | Cypress |
| T-06 | Written-off loans appear in Written-Off section | Cypress |

---

## 9. Files Changed

| Action | File |
|--------|------|
| MODIFY | `LoanService/Models/LoanApplication.cs` — add `WriteOffDate`, `WriteOffReason`, `WriteOffAuthorizedBy` |
| CREATE | `LoanService/Migrations/AddWriteOffFields.cs` — EF migration |
| MODIFY | `LoanService/Controllers/LoanApplicationsController.cs` — `POST /api/loans/{id}/write-off` + update `GetNpaBoard` |
| MODIFY | `LoanService/Services/ITransactionServiceClient.cs` — add `PostWriteOffJournalAsync` |
| MODIFY | `LoanService/Services/TransactionServiceClient.cs` — implement `PostWriteOffJournalAsync` |
| CREATE | `LoanService.Tests/WriteOffTests.cs` — 3 NUnit tests |
| MODIFY | `frontend-react/src/pages/NpaBoard.tsx` — write-off button + dialog + written-off section |
| MODIFY | `frontend-react/src/services/npaBoardService.ts` — `WriteOffLoanItem` type + `writeOff()` call |
| MODIFY | `frontend-react/cypress/e2e/regression/15-npa-board.cy.ts` — T-07 through T-09 |
