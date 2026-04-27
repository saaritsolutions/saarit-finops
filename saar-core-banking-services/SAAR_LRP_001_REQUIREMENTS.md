# SAAR-LRP-001 — Loan Repayment: EMI Collection + SMA Status

| Field | Value |
|---|---|
| **Ticket ID** | SAAR-LRP-001 |
| **Status** | In Progress |
| **Session** | 49 — 2026-04-27 |
| **Service** | LoanService (port 5130) |
| **Priority** | High |

---

## Problem Statement

LoanService handles the full origination lifecycle (DRAFT → DISBURSED) but has no post-disbursal repayment tracking. Once a loan is DISBURSED:
- `OutstandingPrincipal` is not tracked
- No EMI collections are recorded
- SMA/NPA classification is absent (required by RBI IRAC norms)

This gap means the demo has no live repayment data, no compliance signal, and no way to demonstrate a realistic loan lifecycle.

---

## Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1 | **CollectEmi endpoint** | `POST /api/loans/applications/{id}/collect-emi` accepts `{ amount, paymentMode, paymentReference?, paymentDate? }`. Returns 404 if loan not found; 400 if not DISBURSED; 400 if outstanding ≤ 0. |
| FR-2 | **GL journal on collection** | DR 1010 (Cash and Bank) for full EMI amount; CR 1020 (Loans and Advances) for principal component; CR 4010 (Interest Income) for interest component. Idempotency key `EMI-{appNo}-{installmentNum:D3}`. Fail-open: journal failure logs warning but does not block EMI recording. |
| FR-3 | **Outstanding principal tracked** | `LoanApplication.OutstandingPrincipal` set on DISBURSE to `SanctionedAmount ?? RequestedAmount`. Decremented by `principalComponent` on each CollectEmi. |
| FR-4 | **NextDueDate advanced** | `LoanApplication.NextDueDate` set on DISBURSE to `today + 1 month`. Advanced by +1 month on each successful CollectEmi. |
| FR-5 | **SMA status computed** | `OverdueDays` and `SmaStatus` computed at request time from `NextDueDate` — no stored column, no background job. Bands: STANDARD (0 days), SMA-0 (1–30), SMA-1 (31–60), SMA-2 (61–90), NPA (90+). |
| FR-6 | **Repayment history endpoint** | `GET /api/loans/applications/{id}/repayment-history` returns `{ applicationNumber, outstandingPrincipal, nextDueDate, smaStatus, overdueDays, repayments[] }`. |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Idempotency key `EMI-{appNo}-{installmentNum:D3}` prevents double GL posting if endpoint is called twice with the same installment number |
| NFR-2 | Fail-open — TransactionService unavailability logs a warning but the EMI record is still saved |
| NFR-3 | Backward compat — existing DISBURSED loans with `null OutstandingPrincipal` are handled gracefully (default to `SanctionedAmount` on first EMI call) |
| NFR-4 | At least 4 NUnit unit tests + 5 Cypress regression tests |

---

## Out of Scope

- Background job for daily SMA reclassification (OverdueDays computed at request time)
- Penalty/penal interest on overdue EMIs
- Overdue Loans report tab in Reports.tsx (future ticket SAAR-LRP-002)
- Partial prepayment or loan foreclosure endpoint
- NACH/auto-debit mandate registration

---

## Data Model

### New: LoanRepayment entity
| Column | Type | Notes |
|---|---|---|
| Id | Guid (PK) | NewGuid() |
| LoanApplicationId | Guid (FK → LoanApplications) | Cascade delete |
| InstallmentNumber | int | Unique per loan |
| PrincipalComponent | decimal(18,2) | |
| InterestComponent | decimal(18,2) | |
| TotalAmount | decimal(18,2) | |
| DueDate | DateTime | |
| PaidAt | DateTime | defaults to UtcNow |
| PaymentMode | string(20) | CASH\|NEFT\|RTGS\|UPI\|CHEQUE |
| PaymentReference | string(100)? | |
| JournalNumber | string(50)? | from TransactionService |
| TenantId | string(50) | |
| CreatedAt | DateTime | |

### Modified: LoanApplication (new columns)
| Column | Type | Notes |
|---|---|---|
| OutstandingPrincipal | decimal(18,2)? | Set on DISBURSE |
| NextDueDate | DateTime? | Set on DISBURSE, advanced monthly |
| OverdueDays | int [NotMapped] | Computed from NextDueDate |
| SmaStatus | string [NotMapped] | Computed from OverdueDays |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/api/loans/applications/{id}/collect-emi` | Collect one EMI payment |
| GET | `/api/loans/applications/{id}/repayment-history` | Fetch all payments + outstanding summary |

---

## GL Journal on EMI Collection

| Entry | Account | Code | Amount |
|---|---|---|---|
| DR | Cash and Bank | 1010 | principal + interest |
| CR | Loans and Advances | 1020 | principal component |
| CR | Interest Income | 4010 | interest component |

---

## SMA Classification (RBI IRAC Norms)

| Status | Overdue Days | Description |
|---|---|---|
| STANDARD | 0 | No overdue |
| SMA-0 | 1–30 | Special Mention Account — early warning |
| SMA-1 | 31–60 | Special Mention Account — medium stress |
| SMA-2 | 61–90 | Special Mention Account — high stress |
| NPA | 90+ | Non-Performing Asset |

---

## Test Plan

| ID | Type | Test |
|---|---|---|
| T-1 | NUnit | `CollectEmi_ValidDisbursedLoan_UpdatesOutstandingPrincipal` |
| T-2 | NUnit | `CollectEmi_LoanNotDisbursed_Returns400` |
| T-3 | NUnit | `CollectEmi_ComputesCorrectInterestSplit` (₹1L @ 12% → interestComp = ₹1000) |
| T-4 | NUnit | `GetRepaymentHistory_After2Collections_ReturnsBoth` |
| T-5 | Cypress | Repayment card visible on DISBURSED loan |
| T-6 | Cypress | Repayment card NOT shown on SUBMITTED loan |
| T-7 | Cypress | Collect EMI button + dialog + API stub |
| T-8 | Cypress | SMA chip shows STANDARD |
| T-9 | Cypress | Payment history table renders stub data |
