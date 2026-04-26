# SAAR-RPT-001 — MIS Reports & Compliance Dashboard

**Ticket ID:** SAAR-RPT-001
**Epic:** Reporting & MIS
**Status:** IN_PROGRESS
**Priority:** Medium
**Sprint:** Q2 2026 — Sprint 1
**Created:** 2026-04-25
**Author:** saaritsolutions

---

## Summary
Convert the empty `Reports & MIS` page stub into a functional 3-tab MIS Reports dashboard. The page will surface GL balance summaries, daily transaction volume charts with CSV audit export, compliance alert management, and a deposit maturity report — all from APIs that already exist across TransactionService and AccountService. One new backend endpoint (daily transaction summary) is added to TransactionService.

---

## Background
- The `features/reports/Reports.tsx` has been a placeholder since session 14 (UI redesign).
- Multiple backend APIs that can power reports already exist: `GET /api/ledger/balances`, `GET /api/journal`, `GET /api/compliance/alerts`, `GET /api/account/upcoming-maturities`.
- The TASK_QUEUE medium priority has listed "ReportingMIS v1" as overdue since Q1 2026.
- No EF migration needed — all data comes from tables already in production.

---

## Functional Requirements

### FR-1: GL Balance Summary Table
- The Financial Reports tab SHALL display a table of all GL accounts with their current balances.
- Columns: Account Code | Account Name | Debit Total | Credit Total | Net Balance | Normal Balance
- Data source: `GET /api/ledger/balances` (TransactionService)
- Skeleton loader shown while loading; empty-state if no accounts.

### FR-2: Daily Transaction Volume Chart
- The Financial Reports tab SHALL display a Recharts `BarChart` showing daily debit and credit totals.
- Default date range: last 30 days (today − 29 days to today).
- User can change from/to dates and click "Load" to refresh the chart.
- New backend endpoint: `GET /api/journal/daily-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Two bar series: Debits (blue `#2563EB`) and Credits (green `#16A34A`).
- Grand total line below chart: Total Journals | Total Debit | Total Credit.

### FR-3: CSV Audit Export
- A "Export CSV" button on the Financial Reports tab SHALL trigger a client-side CSV download.
- The CSV contains the same daily-summary rows currently displayed in the chart.
- Format: `Date,Journal Count,Total Debit,Total Credit` with header row.
- File name: `journal-summary-{from}-to-{to}.csv`.
- No new backend endpoint; export is derived from the already-fetched summary data.

### FR-4: Compliance Alerts List
- The Compliance Alerts tab (at `/reports/regulatory`) SHALL display a paginated table of CTR/STR alerts.
- Data source: `GET /api/compliance/alerts?status=&alertType=` (TransactionService, already exists).
- Columns: Alert Type | Journal # | Amount | Status chip | Created Date | Action.
- Status filter chips: ALL | PENDING | FILED | DISMISSED.
- PENDING alerts show "Mark as Filed" and "Mark as Dismissed" action buttons.

### FR-5: Alert Review Action
- Clicking a review action on a PENDING alert SHALL open a confirmation dialog.
- Dialog contains a notes text field and action buttons (Confirm / Cancel).
- On confirm: `PATCH /api/compliance/alerts/{id}` with `{ action, notes }` (already exists).
- On success: alert refreshes in the list with updated status.

### FR-6: Deposit Maturity Report
- The Deposit Maturity tab SHALL display upcoming FD/RD maturities (next 30 days).
- Data source: `GET /api/account/upcoming-maturities?days=30` (AccountService, already exists).
- Columns: Account # | Customer ID | Type | Principal | Rate | Maturity Date | Projected Payout | Days Left.
- Days Left urgency chip: red (<7 days), amber (7–14 days), green (>14 days).
- Zero-state message when no maturities in the window.

### FR-7: Fail-Silent Offline Resilience
- All three tabs SHALL load independently.
- If any API fails (503, network error), the affected section shows an empty state or error chip — it does NOT block other tabs.
- Consistent with DFS offline pattern from SAAR-DFS-003/004.

---

## Acceptance Criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-1 | User navigates to `/reports` | Page loads | Financial Reports tab is active; GL balance table renders with skeleton loader then data |
| AC-2 | GL balances API returns 3 accounts | Tab 0 loads | Table shows 3 rows with Code, Name, Debits, Credits, Net Balance |
| AC-3 | User sets date range and clicks Load | Chart loads | BarChart shows bars for each date with Debit and Credit series |
| AC-4 | User clicks Export CSV | — | Browser downloads a `.csv` file with journal summary rows |
| AC-5 | User navigates to `/reports/regulatory` | Tab 1 activates | Compliance Alerts table loads with status filter chips |
| AC-6 | 1 PENDING alert exists | Tab 1 data loads | "Mark as Filed" button appears on that row |
| AC-7 | User clicks Mark as Filed | Dialog opens, confirms | Alert status updates to FILED in the list |
| AC-8 | User clicks Deposit Maturity tab | Tab 2 loads | Maturity table renders; <7 day rows show red chip |
| AC-9 | No maturities in next 30 days | Tab 2 loads | Zero-state message shown |
| AC-10 | TransactionService offline | Any tab loads | Section shows empty state / error chip; other sections unaffected |

---

## Non-Functional Requirements

### NFR-1: No New npm Dependencies
All UI components (Tabs, Table, BarChart, Dialog) are already available via MUI v7 and Recharts 2.15.3.

### NFR-2: No EF Migration
The new `daily-summary` endpoint is a read-only query on the existing `Journals` + `JournalEntries` tables. No schema changes.

### NFR-3: No New Backend Models or Services
The new endpoint lives inside the existing `JournalController` and `PostingEngine`. No new controller or service class created.

---

## Out of Scope (SAAR-RPT-001)
- Account Statement (paginated transactions per account) — SAAR-RPT-002
- Key Facts Statement (KFS) generation for loans — SAAR-COMP-001
- RBI regulatory returns (Form BS, SLR, CRR) — SAAR-COMP-002
- Loan portfolio reporting — SAAR-RPT-003
- PDF export — SAAR-RPT-004

---

## New Backend Endpoint

### GET /api/journal/daily-summary
**Service:** TransactionService (port 5005)
**Controller:** `JournalController`
**Auth:** Bearer JWT (consistent with other TransactionService endpoints — currently unauthenticated; add `[Authorize]` if needed)

**Query Parameters:**
| Param | Type | Default | Constraint |
|---|---|---|---|
| `from` | `DateTime?` | today − 29 days | — |
| `to` | `DateTime?` | today | must be ≥ from |
| — | — | — | range ≤ 366 days |

**Response (200 OK):**
```json
{
  "from": "2026-03-26",
  "to": "2026-04-25",
  "days": [
    { "date": "2026-04-24T00:00:00", "journalCount": 5, "totalDebit": 1500000.00, "totalCredit": 1500000.00 }
  ],
  "grandTotalCount": 5,
  "grandTotalDebit": 1500000.00,
  "grandTotalCredit": 1500000.00
}
```

**Response (400 Bad Request):**
```json
{ "error": "from must be <= to." }
```

---

## Test Plan

### Backend Unit Tests (TransactionService.Tests)
| # | Test | Expectation |
|---|---|---|
| T-1 | `DailySummary_EmptyRange_ReturnsZeroCounts` | Empty DB → `Days.Count == 0`, `GrandTotalCount == 0` |
| T-2 | `DailySummary_TwoJournalDates_GroupsCorrectly` | 2 journals yesterday + 1 today → 2 days, grandTotal = 3 |

Target: 22/22 green (was 20/20).

### Cypress Regression Tests (13-reports.cy.ts)
| # | Describe | Test |
|---|---|---|
| 1 | Financial Reports tab | renders GL balance table at /reports/financial |
| 2 | Financial Reports tab | renders BarChart when daily-summary loads |
| 3 | Financial Reports tab | shows Export CSV button |
| 4 | Financial Reports tab | shows date range inputs |
| 5 | Compliance Alerts tab | renders alerts table at /reports/regulatory |
| 6 | Compliance Alerts tab | shows status filter chips (ALL/PENDING/FILED/DISMISSED) |
| 7 | Compliance Alerts tab | shows action buttons for PENDING alert |
| 8 | Compliance Alerts tab | review dialog opens on action button click |
| 9 | Deposit Maturity tab | renders maturity table with data |
| 10 | Deposit Maturity tab | shows red urgency chip for <7 days |
| 11 | Deposit Maturity tab | shows empty-state for no maturities |
| 12 | Tab navigation | Financial Reports tab active by default at /reports |

Target: 12 new tests green; existing 12 specs (108+ tests) unaffected.

---

## Files Modified
| File | Type |
|---|---|
| `TransactionService/Services/IPostingEngine.cs` | EDIT |
| `TransactionService/Controllers/JournalController.cs` | EDIT |
| `frontend-react/src/services/reportService.ts` | CREATE |
| `frontend-react/src/features/reports/Reports.tsx` | EDIT |
| `TransactionService.Tests/PostingEngineTests.cs` | EDIT |
| `frontend-react/cypress/e2e/regression/13-reports.cy.ts` | CREATE |
| `nginx/nginx.conf` | EDIT (if /api/compliance missing) |
