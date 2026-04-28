# SAAR-NPA-001 — NPA Classification Board

**Ticket ID:** SAAR-NPA-001
**Status:** IN PROGRESS
**Created:** 2026-04-28
**Session:** 55
**Priority:** High
**Module:** Loan Management / Risk Management
**Services affected:** LoanService (backend), React frontend

---

## Background

The RBI IRAC (Income Recognition and Asset Classification) norms require banks to:
1. Classify loans as Standard, SMA (Special Mention Account), or NPA (Non-Performing Asset)
2. Sub-classify NPA into Sub-Standard, Doubtful (D1/D2/D3), and Loss categories
3. Maintain provisioning for NPA accounts as prescribed percentages of outstanding

We already compute `SmaStatus` (STANDARD/SMA-0/SMA-1/SMA-2/NPA) as a `[NotMapped]` property on `LoanApplication` (SAAR-LRP-001). This feature adds:
- NPA sub-classification with RBI-compliant duration bands
- Provisioning calculation per RBI IRAC norms
- A dedicated NPA Board dashboard page
- Expression engine override hook (`EXPR_NPA_CLASSIFICATION`, already seeded)

---

## Functional Requirements

### FR-1 — NPA Sub-Classification
The system SHALL classify NPA loans into sub-categories based on days overdue:

| Days Past Due | SmaStatus   | NPA Sub-Class  | Notes                  |
|---------------|-------------|----------------|------------------------|
| 0             | STANDARD    | —              | Normal                 |
| 1–30          | SMA-0       | —              | Early warning          |
| 31–60         | SMA-1       | —              | Moderate watch         |
| 61–90         | SMA-2       | —              | High watch             |
| 91–365        | NPA         | SUB_STANDARD   | NPA <12 months         |
| 366–730       | NPA         | DOUBTFUL_1     | NPA 12–24 months       |
| 731–1095      | NPA         | DOUBTFUL_2     | NPA 24–36 months       |
| >1095         | NPA         | DOUBTFUL_3     | NPA >36 months         |

**Acceptance Criteria:**
- `NpaSubClassification` computed as `[NotMapped]` on `LoanApplication` from `OverdueDays`
- Sub-classification only applies when `SmaStatus == "NPA"` (overdueDays > 90)
- `null` for STANDARD and SMA accounts

### FR-2 — Provisioning Calculation
The system SHALL calculate required provisioning per RBI IRAC norms:

| Classification | Secured (%) | Unsecured (%) |
|----------------|-------------|---------------|
| SUB_STANDARD   | 15          | 25            |
| DOUBTFUL_1     | 25          | 100           |
| DOUBTFUL_2     | 40          | 100           |
| DOUBTFUL_3     | 100         | 100           |

**Acceptance Criteria:**
- Default: treat all loans as secured (conservative approach for demo; real impl adds collateral field)
- Provisioning amount = `OutstandingPrincipal × provisioning%`
- For SMA accounts: provisioning = 0 (SMA is watch, not NPA)

### FR-3 — NPA Board Endpoint
The system SHALL expose `GET /api/loans/npa-board` returning:

```json
{
  "asOfDate": "2026-04-28",
  "totalLoanBook": 5000000,
  "totalNpaOutstanding": 150000,
  "npaRatio": 0.030,
  "totalRequiredProvisioning": 22500,
  "smaWatchCount": 3,
  "smaWatchOutstanding": 300000,
  "npaLoans": [
    {
      "id": "3",
      "applicationNumber": "LOAN-2026-003",
      "applicantName": "Anil Patel",
      "productType": "Business Loan",
      "outstandingPrincipal": 150000,
      "overdueDays": 95,
      "smaStatus": "NPA",
      "npaSubClassification": "SUB_STANDARD",
      "requiredProvisioning": 22500
    }
  ],
  "smaWatchList": [
    {
      "id": "2",
      "applicationNumber": "LOAN-2026-002",
      "overdueDays": 45,
      "smaStatus": "SMA-1",
      "outstandingPrincipal": 100000
    }
  ]
}
```

**Acceptance Criteria:**
- Only DISBURSED loans with `NextDueDate` set are included
- `npaRatio` = `totalNpaOutstanding / totalLoanBook` (0 if no loan book)
- `totalLoanBook` = sum of `OutstandingPrincipal` across all DISBURSED loans
- Response is fail-safe: if DB empty, returns zeroes with empty arrays
- No authentication required (`[AllowAnonymous]`) for demo — same as `interest-eligible`

### FR-4 — NPA Board Frontend Page
The system SHALL display a dedicated `/npa-board` page with:

**KPI Cards (top row):**
- NPA Ratio (percentage, red if > 5%)
- Total NPA Outstanding (INR)
- Required Provisioning (INR)
- SMA Watch Count (count of SMA-0/1/2 loans)

**NPA Loans Table:**
- Columns: Application #, Applicant, Product, Outstanding, Overdue Days, Sub-Class, Provisioning Required
- Sub-class chip with colour coding: SUB_STANDARD=orange, DOUBTFUL_1=red, DOUBTFUL_2=dark-red, DOUBTFUL_3=black

**SMA Watch List Table:**
- Columns: Application #, Applicant, Product, Outstanding, Overdue Days, SMA Status
- SMA status chip: SMA-0=yellow, SMA-1=orange, SMA-2=red

**Empty State:**
- When no NPA loans: "No NPA accounts. All loans are current." with green check icon

**Acceptance Criteria:**
- Page accessible at `/npa-board`
- Loads data from `GET /api/loans/npa-board` on mount
- Skeleton loader while fetching
- Refresh button to reload

### FR-5 — Sidebar + Router
The system SHALL:
- Add "NPA Board" entry to the Sidebar under the Loans section
- Feature-gated: visible when `featureFlags.featureGoldLoan` is false (i.e., always visible unless explicitly disabled — use existing `featureExpressions` or no gating for now, just add it unconditionally under Loans)
- Lazy-loaded route in AppRouter

### FR-6 — nginx Route
`/api/loans/npa-board` must be proxied through nginx.
The existing `/api/loans/` location block in nginx.conf already covers this — no change needed.

---

## Non-Functional Requirements

- NFR-1: Endpoint response < 500ms for up to 1000 loans (in-memory computation, no DB aggregation)
- NFR-2: Page renders within 2s on first load
- NFR-3: All numbers INR-formatted with ₹ symbol (use existing `INR()` helper)

---

## Out of Scope

- Actual RBI reporting file generation (CRILC, NPA returns)
- Real collateral tracking (secured vs unsecured split)
- Automated NPA notification / alerting
- NPA upgrade path (Doubtful → Sub-Standard → Standard on regularization)
- Loss classification (requires board approval + write-off workflow)

---

## Data Model

No new EF entities required. Computed fields only:
- `[NotMapped] NpaSubClassification` on `LoanApplication` (string? — "SUB_STANDARD"|"DOUBTFUL_1"|"DOUBTFUL_2"|"DOUBTFUL_3"|null)
- `[NotMapped] RequiredProvisioningPct` on `LoanApplication` (decimal — RBI table lookup)
- `[NotMapped] RequiredProvisioning` on `LoanApplication` = `OutstandingPrincipal × RequiredProvisioningPct / 100`

DTO: `NpaBoardResult` (in LoanService/DTOs/ or inline in controller)

---

## API Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/loans/npa-board` | AllowAnonymous | Portfolio NPA summary |

---

## Test Plan

| ID | Type | Description | Pass Criteria |
|----|------|-------------|---------------|
| T-01 | NUnit | `NpaBoard_NoLoans_ReturnsZeroTotals` | Empty DB → npaRatio=0, empty arrays |
| T-02 | NUnit | `NpaBoard_95DaysOverdue_ClassifiedAsSubStandard` | Loan 95 DPD → SUB_STANDARD, 15% provisioning |
| T-03 | NUnit | `NpaBoard_370DaysOverdue_ClassifiedAsDoubtful1` | Loan 370 DPD → DOUBTFUL_1, 25% provisioning |
| T-04 | Cypress | NPA Board page loads and shows KPI cards | Page at `/npa-board` renders KPI sections |
| T-05 | Cypress | NPA loans table renders seeded NPA entry | Table row with SUB_STANDARD chip visible |
| T-06 | Cypress | SMA Watch List shows SMA-1 entry | SMA-1 chip visible in watch list |

---

## Implementation Notes

- `NpaSubClassification` computed in `LoanApplication.cs` using same `[NotMapped]` pattern as `SmaStatus`
- `OverdueDays` already computed on `LoanApplication` — reuse it
- `GET /api/loans/npa-board` in `LoanApplicationsController.cs` — loads all DISBURSED loans with `NextDueDate` set, computes in-memory, returns `NpaBoardResult`
- Frontend: new `NpaBoard.tsx` page in `src/pages/`; `npaBoardService.ts` (or extend `loanOriginationService.ts`); Sidebar entry under Loans section
- nginx: covered by existing `/api/loans/` block in nginx.conf
