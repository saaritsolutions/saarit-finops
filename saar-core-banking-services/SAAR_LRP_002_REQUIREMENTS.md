# SAAR-LRP-002 — Overdue Loans Report

**Ticket ID:** SAAR-LRP-002
**Status:** In Progress
**Session:** 52 (2026-04-27)
**Module:** LoanService + Reports UI
**Depends On:** SAAR-LRP-001 (OutstandingPrincipal + NextDueDate + SmaStatus already on LoanApplication)

---

## Problem Statement

SAAR-LRP-001 added per-loan SMA classification (`OverdueDays`, `SmaStatus` as computed properties). However, operations staff have no way to see **all overdue loans at once** — LoanManagement only supports filtering by Status (DISBURSED/SUBMITTED etc.), not by overdue days or SMA band. This feature adds an aggregated Overdue Loans view accessible from the Reports page.

---

## Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-1 | `GET /api/loans/applications/overdue` endpoint in LoanService | Returns HTTP 200 with `{ total, page, pageSize, items }`. Items include all DISBURSED loans where `NextDueDate < today (UTC)`. |
| FR-2 | Optional query filter `?smaStatus=SMA-0\|SMA-1\|SMA-2\|NPA` | When smaStatus=SMA-0 is passed, only SMA-0 loans are returned. Passing `ALL` or omitting returns all overdue. |
| FR-3 | Optional pagination `?page=&pageSize=` (default pageSize=50) | Skip/Take applied before in-memory SmaStatus computation. |
| FR-4 | Response includes `overdueDays` and `smaStatus` per loan | Computed in-memory from `NextDueDate` after EF fetch (OverdueDays/SmaStatus are `[NotMapped]` — cannot use in EF WHERE clause). |
| FR-5 | Tab 4 "Overdue Loans" in Reports.tsx | Visible as 5th tab. Clicking it calls `getOverdueLoans()`. Loads lazily (only on first tab activation). |
| FR-6 | SMA band filter chips in Reports UI | ALL / SMA-0 / SMA-1 / SMA-2 / NPA chips. Clicking a chip reloads the table with that filter. |
| FR-7 | CSV export of overdue loans list | "Export CSV" button enabled when data is loaded. Downloads `overdue-loans.csv` with columns: Application No, Applicant, Product, Outstanding, Overdue Days, SMA Status, Next Due Date. |
| FR-8 | Empty state when no overdue loans | Shows "No overdue loans — all accounts are current." message with appropriate styling. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | No new EF migration — uses existing `OutstandingPrincipal` and `NextDueDate` columns added by SAAR-LRP-001 (`AddRepaymentTable` migration). |
| NFR-2 | OverdueDays/SmaStatus computed at request-time — no background job, no stored column. |
| NFR-3 | Fail-open frontend — if `/overdue` returns an error, the tab shows the empty state rather than crashing. |

---

## Out of Scope

- Provisioning percentage calculation (SAAR-NPA-001)
- Write-off flagging
- Pagination UI on overdue table (pageSize=50 sufficient for demo — UCBs have few disbursed loans)
- Email/SMS alerts for overdue accounts
- Overdue aging buckets beyond SMA classification

---

## Data Model

No new entities or migrations needed. Uses:

```
LoanApplication
  - Status (string) — filter: "DISBURSED"
  - NextDueDate (DateTime?) — filter: < UTC today
  - OutstandingPrincipal (decimal?) — display
  - ApplicationNumber (string) — display
  - ApplicantName (string) — display
  - [NotMapped] OverdueDays — computed in-memory
  - [NotMapped] SmaStatus — computed in-memory
```

Response DTO: `OverdueLoanDto`
```
Id, ApplicationNumber, ApplicantName, MobileNumber, ProductType,
OutstandingPrincipal, NextDueDate, OverdueDays, SmaStatus,
InterestRate, TenureMonths, DisbursedAt
```

---

## API Specification

### GET /api/loans/applications/overdue

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| smaStatus | string? | null (all) | Filter by SMA band: SMA-0, SMA-1, SMA-2, NPA, ALL |
| page | int | 1 | Page number |
| pageSize | int | 50 | Items per page |

**Response 200:**
```json
{
  "total": 3,
  "page": 1,
  "pageSize": 50,
  "items": [
    {
      "id": "...",
      "applicationNumber": "LOAN-2026-005",
      "applicantName": "Ramesh Kumar",
      "mobileNumber": "9876543210",
      "productType": "PERSONAL_LOAN",
      "outstandingPrincipal": 85000.00,
      "nextDueDate": "2026-03-15T00:00:00Z",
      "overdueDays": 43,
      "smaStatus": "SMA-1",
      "interestRate": 12.50,
      "tenureMonths": 24,
      "disbursedAt": "2025-12-15T08:00:00Z"
    }
  ]
}
```

---

## Test Plan

| ID | Type | Test | Expected |
|----|------|------|----------|
| T-1 | NUnit | `GetOverdueLoans_NoDisbursedLoans_ReturnsEmpty` | total=0, items=[] |
| T-2 | NUnit | `GetOverdueLoans_WithPastDueDate_ReturnsLoan` | DISBURSED loan with NextDueDate-15 days → overdueDays=15, smaStatus="SMA-0" |
| T-3 | NUnit | `GetOverdueLoans_SmaStatusFilter_FiltersCorrectly` | 2 loans (SMA-0 + SMA-2); filter=SMA-0 → 1 item returned |
| T-16 | Cypress | Overdue Loans tab visible in Reports | 5th tab renders |
| T-17 | Cypress | Tab click loads table with 2 rows from stub | Table rows visible |
| T-18 | Cypress | SMA-1 chip click triggers API reload | `cy.wait('@overdueLoans')` fires again |
| T-19 | Cypress | Export CSV button present and enabled | aria-label="Export Overdue CSV" exists and not disabled |
