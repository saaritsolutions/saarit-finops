# Next Phase Implementation Plan (Sessions 58+)

**Created:** 2026-05-10
**Status:** Ready for Implementation
**Priority:** High

---

## Context

SAAR-LRP-003 (Loan Restructuring Tracking) was deployed in session 57 (commit 834e262). CI status:
- ✅ CI (backend tests) — success
- ✅ Backend CI/CD — success
- ✅ Security Scan — success
- ✅ Full Stack CI/CD — success
- ⚠️ Cypress E2E Tests — failure (likely timing/environment issue; code inspection shows tests are correct)

The loan portfolio lifecycle needs continuation with three alternative next features. User wants to implement ALL and check CI status in between.

---

## Task 1: Fix Cypress E2E Test Failure (SAAR-LRP-003)

### Why Now
Unblocks CI pipeline and validates SAAR-LRP-003 deployment correctness.

### Investigation Findings
- LoanDetail.tsx: All aria-labels (`restructure loan`, `confirm restructure`) present ✓
- RestructureDialog: All 4 input fields correctly ordered (NewMonthlyEmi, NewTenure, NewInterestRate, Reason) ✓
- loanOriginationService.ts: `restructureLoan()` API call uses correct URL + request shape ✓
- Cypress test file (16-restructured-loans.cy.ts): Test assertions correct ✓

### Root Cause Analysis Needed
- Check GitHub Actions logs for specific failure message
- Likely causes: timing/race condition, stubbed API URL mismatch, or CI environment state

### Fix Steps
1. Review full Cypress test output from GitHub Actions
2. If timing issue: add longer waits or retry logic
3. If URL mismatch: update intercept patterns
4. If missing stub: update test mock data shape
5. Re-run CI to verify all 4 workflows pass

---

## Task 2: SAAR-LRP-004 — Restructured Loan Upgrade (1-year satisfactory performance)

### Scope
After 1 year of satisfactory repayment post-restructuring, upgrade loan back to original terms (if beneficial):
- Detect: isRestructured=true + RestructuredDate < (today - 365 days) + SmaStatus=STANDARD (last 6 months)
- Action: POST `/api/loans/{id}/restructure-upgrade` → reset to original EMI/tenure/rate
- Frontend: "Upgrade to Original Terms" button on LoanDetail (DISBURSED + isRestructured + eligibility)
- Backend: Guard against non-restructured loans + already-upgraded loans
- Reports: Tab 6 "Loan Upgrades" (KPI count, upgraded loans table, CSV export)

### Key Files to Modify
**Backend:**
- `LoanApplication.cs` — add `IsUpgraded` (bool), `UpgradedDate` (DateTime?), `UpgradedReason` (string?)
- `LoanDbContext.cs` — add columns, EF migration `AddLoanUpgradeFields`
- `LoanApplicationsController.cs` — `POST /api/loans/{id}/restructure-upgrade` endpoint
- `LoanUpgradeTests.cs` — 3 NUnit (success, already-upgraded, non-restructured)
- `ITransactionServiceClient` — `PostLoanUpgradeJournalAsync` (DR/CR codes TBD)
- All stub clients — add `PostLoanUpgradeJournalAsync` no-op

**Frontend:**
- `loanOriginationService.ts` — `UpgradedLoanItem`, `UpgradeLoanRequest`, `upgradeLoan()`
- `LoanDetail.tsx` — "Upgrade to Original Terms" button + dialog + KPI chips
- `Reports.tsx` — Tab 6 "Loan Upgrades" (KPI, table, CSV)
- `npaBoardService.ts` — fetch upgraded loans list
- `17-loan-upgrades.cy.ts` — 3 Cypress tests (T-01/T-02/T-03)

---

## Task 3: SAAR-RPT-002 — RBI Regulatory Reporting (restructured portfolio)

### Scope
Monthly/quarterly RBI reporting on restructured loans per RBI Circular Master Direction (IRAC norms):
- Report header: Bank name, period, total portfolio, total restructured %, outstanding restructured
- Report body: Loan-wise details (app#, applicant, original amount, current outstanding, restructured date, new terms, SMA status, provisioning)
- Compliance: RBI Circular DBOD.BP.11469 / June 2023 (Restructuring of Advances)
- Export: PDF (with formatting) + Excel (tabular)
- Approval: Mark as "Approved by [Maker] on [Date]" with digital footprint

### Key Files to Modify
**Backend:**
- `ReportingController.cs` — `GET /api/reporting/restructured-portfolio?from=&to=&format=pdf|excel`
- `RestructuredPortfolioReportService.cs` — query construction, grouping, calculations
- `RestructuredPortfolioTests.cs` — 2 NUnit (empty DB, multi-loan portfolio)
- RBI compliance doc: `ARCHITECTURE/components/rbi-compliance.md` (append Restructured Portfolio section)

**Frontend:**
- `Reports.tsx` — Tab 7 "RBI Compliance" (sub-tabs: Restructured Portfolio, NPA Status, KYC) — Tab 0
- `reportService.ts` — `getRestructuredPortfolioReport(from, to, format)` + `approveReport()`
- `RestructuredPortfolioReport.tsx` (new) — header KPIs, loan-wise table, approval dialog, export buttons
- `18-rbi-compliance.cy.ts` — 3 Cypress tests (report load, export PDF, approve)

---

## Task 4: SAAR-NPA-003 — NPA Recovery Tracking

### Scope
Post-write-off recovery workflow + write-back to standard loan:
- Recovery action: `POST /api/loans/{id}/recovery` (WRITTEN_OFF only) → update RecoveredAmount, RecoveryDate, RecoveryJournalNumber
- Write-back: POST `/api/loans/{id}/write-back` (WRITTEN_OFF + RecoveredAmount > 0) → status → NPA reversal + GL reversal journal (CR 5040 / DR 1020)
- Frontend: Recovery dialog on NpaBoard (recovered amount + date + notes), Write-Back button, recovery history table
- Reports: NPA Board extended with "Recoveries (YTD)" KPI + recoveries table
- Provisioning impact: Write-back recalculates provisioning based on new SMA status

### Key Files to Modify
**Backend:**
- `LoanApplication.cs` — add `RecoveredAmount` (decimal?), `RecoveryDate` (DateTime?), `WriteBackDate` (DateTime?), `WriteBackJournalNumber` (string?)
- `LoanDbContext.cs` — columns + EF migration `AddNpaRecoveryFields`
- `LoanApplicationsController.cs` — `POST /api/loans/{id}/recovery`, `POST /api/loans/{id}/write-back`
- `ITransactionServiceClient` — `PostRecoveryJournalAsync`, `PostWriteBackJournalAsync`
- `NpaRecoveryTests.cs` — 4 NUnit (recovery success, write-back success, guard conditions)
- All stub clients — add recovery + write-back journal methods

**Frontend:**
- `npaBoardService.ts` — `NpaRecoveryRequest`, `recoveryLoan()`, `writeBackLoan()`
- `NpaBoard.tsx` — Recovery dialog (amount + date + notes), Write-Back button per recovered loan, recovery history table
- `Reports.tsx` — "Recoveries (YTD)" KPI card, recoveries table on NPA Board tab
- `19-npa-recovery.cy.ts` — 4 Cypress tests (T-10/T-11/T-12/T-13)

---

## Implementation Sequence

**Parallel workstreams (minimal dependencies):**

| # | Task | Est. Scope | Blocker Dependencies |
|---|---|---|---|
| 1 | Fix Cypress SAAR-LRP-003 | 0.5 day | None (immediate) |
| 2a | SAAR-LRP-004 backend | 1 day | TransactionServiceClient GL codes TBD |
| 2b | SAAR-LRP-004 frontend | 0.5 day | (2a) complete |
| 3a | SAAR-RPT-002 backend | 0.5 day | None |
| 3b | SAAR-RPT-002 frontend | 0.75 day | (3a) complete |
| 4a | SAAR-NPA-003 backend | 1 day | TransactionServiceClient GL codes TBD |
| 4b | SAAR-NPA-003 frontend | 0.75 day | (4a) complete |
| 5 | CI verify + Hetzner deploy | 0.5 day | All (2-4) code complete |

---

## Success Criteria

### CI Pipeline
- ✅ All 4 workflows pass: CI, Backend CI/CD, Security Scan, Full Stack CI/CD
- ✅ Cypress E2E tests all green (86+ tests)

### Code Quality
- 0 C# compilation errors
- 0 TypeScript errors
- All NUnit tests passing (LoanService.Tests, WorkflowOrchestrationService.Tests, etc.)
- All Cypress tests passing locally + in CI

### Functional
- SAAR-LRP-004: Button visible/hidden per eligibility, dialog submits, chip appears, Reports tab loads
- SAAR-RPT-002: Report endpoint responds, export formats work (PDF readable, Excel parseable), approval saved
- SAAR-NPA-003: Recovery dialog opens, write-back updates status, recovery history shows, provisioning recalculated

### Deployment
- All 11 containers deployed to Hetzner ✓
- Smoke tests pass: `GET /api/loans/applications/{id}` (restructured + upgraded fields), etc.
- Frontend accessible at demobank.saaritsolutions.com

---

## Tracking Documents to Update After Each Feature

After completing each feature (whether 2a, 3a, or 4a), update:
1. **TASK_QUEUE.md** — move task from "Current Focus" to "Recently Completed" with commit hash
2. **PROJECT_STATE.md** — update Last Updated date, Recent Work Done, Pending Work
3. **CONTEXT.md** — move task from "In Progress" to "Completed (continued)" section with commit details
4. **DECISIONS_LOG.md** — add entry if architectural decision made (e.g. recovery GL account codes)
5. **Git commit** — staged changes + author `saaritsolutions <githubsaarit@gmail.com>`

---

## Notes

- **Active expression ID:** `EXPR_1755237353842` (do not delete)
- **Dev ports:** ExpressionBuilderService 5004, TransactionService 5005, DynamicFieldsSchemaService 5013, WorkflowOrchestrationService 5012, LoanService 5130, AccountService 5217, InterestFeeService 5218, frontend-react 3002
- **Start all services locally:** `./start-all.sh` or `./saar-core-banking-services/scripts/start-all.sh`
- **Required env var:** `ASPNETCORE_ENVIRONMENT=Development` for feature flags + CORS + Swagger
- **Test command (once Kaspersky fixed):** `cd saar-core-banking-services && dotnet test`
- **Cypress regression:** `npm run cypress:regression` (from frontend-react/)
- **Hetzner deploy:** `git push` → CI runs → manual `docker compose up --build -d [services]` on VPS
