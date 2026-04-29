# SAAR-LRP-003 — Loan Restructuring Tracking

**Ticket ID:** SAAR-LRP-003
**Status:** In Progress
**Priority:** High
**Session:** 57 (2026-04-29)
**Parent Feature:** Loan Repayment & Portfolio Management
**Depends On:** SAAR-LRP-001 (EMI Collection — DONE), SAAR-LRP-002 (Overdue Loans Report — DONE)

---

## 1. Background

Loan restructuring is a risk-mitigation mechanism where the bank modifies the terms of a stressed loan
to help a borrower avoid default. RBI guidelines require banks to classify and separately report
restructured loans in the portfolio.

This feature enables:
- Marking a DISBURSED loan as **Restructured** with revised EMI / tenure / interest rate
- Tracking the restructured portfolio separately from standard and NPA loans
- Surfacing restructured loans in the Reports module

### RBI Classification
| Category | Provisioning | Sub-standard upgrade |
|---|---|---|
| Restructured Standard Asset | 5% (higher than standard 0.4%) | After 1 year of satisfactory repayment |
| Restructured NPA | Same as NPA sub-class | After 1 year performing |

For this MVP: we store the restructured flag + new terms and show 5% provisioning requirement for
restructured standard accounts.

---

## 2. Functional Requirements

### FR-1 — Restructure Action
- `POST /api/loans/{id}/restructure` (absolute route, AllowAnonymous)
- Only `DISBURSED` loans may be restructured
- Already-restructured loans may not be restructured again (400)
- Request body:
  ```json
  {
    "newMonthlyEmi": 8500,
    "newTenureMonths": 84,
    "newInterestRate": 9.5,
    "reason": "Borrower lost primary income source — revised repayment agreed"
  }
  ```
- On success: sets `IsRestructured=true`, stores new terms + date + reason, resets `NextDueDate` to today+1 month, advances `TenureMonths` to `newTenureMonths`

### FR-2 — New Fields on LoanApplication
| Field | Type | Notes |
|---|---|---|
| `IsRestructured` | `bool` | default false |
| `RestructuredDate` | `DateTime?` | UTC timestamp |
| `RestructuredReason` | `string?` max 500 | free-text |
| `RestructuredNewEmi` | `decimal?` | revised EMI amount |
| `RestructuredNewTenureMonths` | `int?` | revised tenure |
| `RestructuredNewInterestRate` | `decimal?` | revised rate |

### FR-3 — Restructured Loans List Endpoint
- `GET /api/loans/applications/restructured` (existing controller prefix: `/api/loans/applications`)
- Returns all `IsRestructured=true` loans regardless of SMA status
- Response: `{ total, items: [ RestructuredLoanDto ] }`
- `RestructuredLoanDto` includes: id, applicationNumber, applicantName, productType,
  outstandingPrincipal, smaStatus, overdueDays, restructuredDate, restructuredNewEmi,
  restructuredNewTenureMonths, restructuredNewInterestRate, restructuredReason,
  requiredProvisioningPct (5% flat for restructured standard; same as NPA class if NPA)

### FR-4 — LoanDetail Restructure Button
- Shown only for `Status == "DISBURSED"` and `IsRestructured == false`
- Opens `RestructureDialog` with fields: New Monthly EMI (number), New Tenure (months), New Interest Rate (%), Reason (multi-line text)
- All 4 fields required before submit button enables
- On success: refresh loan detail; show success snackbar "Loan restructured successfully"

### FR-5 — Restructured Badge on Loan Detail
- When `isRestructured == true`, show an amber **RESTRUCTURED** chip near the loan status chip
- Show revised terms card: "Restructured Terms — EMI: ₹X, Tenure: Y months, Rate: Z%"

### FR-6 — Reports Tab: Restructured Loans
- New tab "Restructured" (Tab 5) added to Reports.tsx after "Overdue Loans" tab
- KPI row: Restructured Count, Total Outstanding, Required Provisioning (5% of outstanding)
- Table: Application #, Applicant, Product, Outstanding, SMA Status, DPD, Restructured Date, New EMI, Required Prov.
- CSV export button

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| NFR-1 | Idempotency: restructuring twice returns 400 |
| NFR-2 | Fail-safe: no GL journal for restructuring (admin action, no cash movement) |
| NFR-3 | Performance: restructured list uses indexed `IsRestructured` column query |
| NFR-4 | Audit: `RestructuredDate` + `RestructuredReason` persisted permanently |

---

## 4. Provisioning Logic

```
restructuredProvisioningPct =
  SmaStatus == "NPA" ? RequiredProvisioningPct   // existing NPA class provisioning
                     : 5m                         // RBI mandated 5% for restructured standard
```

---

## 5. API Contract

### `POST /api/loans/{id}/restructure`
**Response 200:**
```json
{
  "applicationNumber": "LOAN-0001",
  "isRestructured": true,
  "restructuredDate": "2026-04-29T09:00:00Z",
  "newMonthlyEmi": 8500,
  "newTenureMonths": 84,
  "newInterestRate": 9.5
}
```
**Errors:** `400` — not DISBURSED or already restructured

### `GET /api/loans/applications/restructured`
**Response 200:**
```json
{
  "total": 1,
  "items": [ { "applicationNumber": "LOAN-0001", "smaStatus": "SMA-1", ... } ]
}
```

---

## 6. Out of Scope

- Upgrade of restructured standard asset after 1 year satisfactory performance (SAAR-LRP-004)
- Multiple restructurings (SAAR-LRP-004)
- GL journal for restructuring fee (future)
- RBI regulatory reporting of restructured portfolio (SAAR-RPT-002)

---

## 7. Test Plan

| Test ID | Description | Type |
|---|---|---|
| T-01 | `Restructure_DisbursedLoan_Returns200AndSetsFields` | NUnit |
| T-02 | `Restructure_AlreadyRestructured_Returns400` | NUnit |
| T-03 | `Restructure_NonDisbursed_Returns400` | NUnit |
| T-04 | Restructure button visible on DISBURSED non-restructured loan detail | Cypress |
| T-05 | Restructure dialog submits and shows RESTRUCTURED chip | Cypress |
| T-06 | Reports Restructured tab loads table | Cypress |

---

## 8. Files Changed

| Action | File |
|--------|------|
| MODIFY | `LoanService/Models/LoanApplication.cs` — add 6 restructure fields |
| CREATE | `LoanService/Migrations/AddRestructureFields.cs` — EF migration |
| MODIFY | `LoanService/Controllers/LoanApplicationsController.cs` — POST restructure + GET restructured |
| CREATE | `LoanService.Tests/RestructuredLoanTests.cs` — 3 NUnit tests |
| MODIFY | `frontend-react/src/services/loanOriginationService.ts` — restructure API calls + types |
| MODIFY | `frontend-react/src/pages/LoanDetail.tsx` — Restructure button + dialog + RESTRUCTURED chip |
| MODIFY | `frontend-react/src/pages/Reports.tsx` — Tab 5 Restructured Loans |
| CREATE | `frontend-react/cypress/e2e/regression/16-restructured-loans.cy.ts` — 3 Cypress tests |
