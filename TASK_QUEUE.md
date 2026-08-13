# TASK_QUEUE.md — Development Backlog

**Last Updated:** 2026-05-10
**Current Focus:** CI/CD & Deployment Verification

---

## Current Focus

### Autonomous Daily Build-Out (Depth-First)
**Status:** ACTIVE — automated daily task, see SCOPE_RBI_STUB_SERVICES.md for stub service specs
**Priority:** CRITICAL
**Order of work (depth-first — deepen existing services before starting new ones):**
1. Real NUnit tests for services with only scaffold tests: GLAccountingService, RegulatoryComplianceService,
   ChequeClearingService, CardATMService, AuditLoggingService, DocumentManagementService, HRMSService,
   NotificationService, RemittancePaymentService, ReportingMISService.Tests
2. Flesh out "partial/skeleton" services to full controller + service layer coverage: GLAccountingService,
   RegulatoryComplianceService, ChequeClearingService, CardATMService, AuditLoggingService,
   DocumentManagementService, HRMSService, NotificationService, RemittancePaymentService,
   ProductParamManagementService (add controller — currently models/migrations only, no controller found),
   LockerService (wire up controller — DbContext/model exist but unwired)
3. Cypress regression suite toward 90+ test target (frontend-react/cypress/, not the unused root cypress/)
4. Empty-stub services, per SCOPE_RBI_STUB_SERVICES.md — only after items 1-3, and only after the 3 open
   decisions logged there are answered by the user (ProductConfigurationService fate, VersioningAuditService
   vs AuditLoggingService merge, ReportingMISService vs LoanService regulatory-summary consolidation)
5. CI/CD & Hetzner VPS deployment verification (deferred until above is stable)

**Git workflow for automated runs:** each day's work lands on a dedicated feature branch
(`auto/<service>-<yyyy-mm-dd>`), never directly on main. User reviews and merges via the daily digest.

**2026-08-13 — Manual dry run of the automation (tier 1, GLAccountingService.Tests):** replaced the scaffold
`Assert.Pass()` test with 10 real NUnit tests covering GeneralLedgerAccountsController and
JournalEntriesController (create/get/getAll/delete + 404 paths), on branch
`auto/glaccounting-tests-2026-08-13`. **Found a pipeline bug during this run:** the sandbox that runs the
daily task has no .NET SDK, no root access, and the network proxy blocks dotnet.microsoft.com/apt installs —
so the "self-verify with dotnet build/test" step in the scheduled prompt cannot execute. The prompt has been
corrected to flag every commit as build-unverified rather than silently skip or falsely claim a pass. **User
must run `dotnet build` + `dotnet test` locally before merging any `auto/*` branch until this is fixed.**

---

## Recently Completed

### ✅ SAAR-NPA-003: NPA Recovery Tracking (Completed 2026-05-10)
**Commits:** e4cc48a (backend), 35b4244 (frontend)
**Backend Deliverables:**
- ✅ LoanApplication: RecoveredAmount, LastRecoveryDate, RecoveryNotes, RecoveryJournalNumber fields
- ✅ ITransactionServiceClient.PostRecoveryJournalAsync (DR 1010 / CR 4050)
- ✅ GET /api/loans/applications/written-off endpoint
- ✅ POST /api/loans/{id}/recovery endpoint with GL posting
- ✅ RecoveryTests.cs: 3 NUnit tests all passing (T-01, T-02, T-03)
- ✅ Updated 9 test files with PostRecoveryJournalAsync stub implementation

**Frontend Deliverables:**
- ✅ WrittenOffLoanItem interface + getWrittenOffLoans() + recordRecovery() functions
- ✅ LoanDetail.tsx: WRITTEN_OFF status chip, write-off info card, RecoveryDialog
- ✅ Reports.tsx Tab 8 "Written-Off" with KPI cards, recovery status table, CSV export
- ✅ 19-written-off-recovery.cy.ts: 4 E2E regression tests

### ✅ SAAR-RPT-002: RBI Regulatory Reporting (Completed 2026-05-10)
**Commits:** 04a1763 (backend), 71772fc (frontend)
**Backend Deliverables:**
- ✅ GET /api/loans/reports/regulatory-summary endpoint
- ✅ RegulatoryMetricsDto with 18 properties (loan book, NPA, provision, restructured, upgraded, written-off, SMA watch, standard)
- ✅ 3 NUnit tests (T-01 mixed portfolio, T-02 all standard, T-03 restructured+upgraded)
- ✅ Idempotency not required (read-only reporting endpoint)

**Frontend Deliverables:**
- ✅ Tab 7 "RBI Regulatory" in Reports.tsx with lazy loading
- ✅ KPI cards for Total Loan Book, NPA Outstanding, NPA Ratio, Provision Coverage
- ✅ KPI cards for Restructured/Upgraded/Written-Off counts and outstanding
- ✅ Summary table with loan category breakdown (Standard, SMA Watch, NPA, Restructured, Upgraded, Written-Off)
- ✅ CSV export functionality
- ✅ Service layer: getRegulatoryMetrics() in loanOriginationService.ts
- ✅ 4 Cypress regression tests (18-regulatory-report.cy.ts)

### ✅ SAAR-LRP-004: Loan Upgrade Feature (Completed 2026-05-10)
**Commits:** ab07403, d7de05a, 528561a (backend) + 793ec27 (frontend)
**Backend Deliverables:**
- ✅ Data model: IsUpgraded, UpgradedDate, UpgradedReason, UpgradeJournalNumber
- ✅ Eligibility checks (365+ days, DISBURSED, isRestructured, SMA=STANDARD)
- ✅ GL posting endpoint (DR 1020 / CR 5045)
- ✅ 3 NUnit tests passing
- ✅ Idempotency via UPGRADE-{appNo} key

**Frontend Deliverables:**
- ✅ LoanDetail upgrade button (green, conditional visibility)
- ✅ UpgradeDialog with reason textarea
- ✅ Service layer: getUpgradedLoans(), upgradeLoan()
- ✅ Reports Tab 6 "Loan Upgrades" (KPI cards + table)
- ✅ Cypress tests T-01 to T-04

### ✅ Fix Cypress E2E Tests (Completed 2026-05-10)
**Commit:** dcd5a8b
**Issue:** SAAR-LRP-003 tests failing due to insufficient auth in loginAsDemo()
**Resolution:**
- ✅ Enhanced cypress/support/e2e.ts loginAsDemo() to initialize Redux authSlice
- ✅ Added feature flags initialization
- ✅ Removed duplicate command from 17-loan-upgrades.cy.ts
- ✅ All regression tests now have consistent auth setup

---

## High Priority (This Sprint)

| Task | Type | Estimate | Owner | Status |
|------|------|----------|-------|--------|
| CI/CD Verification | DevOps | Medium | Team | 🟡 In Progress |
| Full Test Suite Run | QA | Small | Team | ⏳ Pending |
| Production Build Verification | DevOps | Small | Team | ⏳ Pending |

---

## Medium Priority (Next Sprint)

| Task | Type | Estimate | Owner | Status |
|------|------|----------|-------|--------|
| Hetzner VPS Staging Deployment | DevOps | Medium | Team | ⏳ Pending |
| Smoke Tests on Staging | QA | Small | Team | ⏳ Pending |
| Documentation Updates | Docs | Small | Team | ⏳ Pending |

---

## Low Priority / Backlog

| Task | Type | Owner | Status |
|------|------|-------|--------|
| Performance optimization | Backend | Team | 📋 Backlog |
| UI/UX refinements | Frontend | Team | 📋 Backlog |
| Additional test coverage | QA | Team | 📋 Backlog |
| Monitoring & alerting | DevOps | Team | 📋 Backlog |

---

## Definition of Done (Feature Complete)

For each feature to be considered complete, it must meet ALL of:

✅ **Backend**
- Data model defined and migrated
- API endpoints implemented and tested
- GL posting logic integrated (if financial)
- All NUnit tests passing (target: 3+ tests)
- Idempotency key pattern implemented (if applicable)

✅ **Frontend**
- UI components created and styled
- Service layer integration complete
- Redux state management (if needed)
- All Cypress regression tests passing (target: 4+ tests)
- CSV/PDF export (if applicable)

✅ **Documentation**
- Code comments for complex logic
- API endpoint documentation
- Test coverage documented
- Tracking documents updated

✅ **Deployment**
- All commits merged to main branch
- GitHub CI/CD passing
- Ready for production deployment

---

## Commits by Feature

### SAAR-NPA-003 (NPA Recovery Tracking)
- `e4cc48a` — Backend: Recovery endpoints + model fields + NUnit tests
- `35b4244` — Frontend: Tab 8 + LoanDetail recovery card + Cypress tests

### SAAR-RPT-002 (RBI Regulatory Reporting)
- `04a1763` — Backend: Regulatory Metrics API endpoint + NUnit tests
- `71772fc` — Frontend: Tab 7 + Service layer + Cypress tests

### SAAR-LRP-004 (Loan Upgrade)
- `ab07403` — Data model & migrations
- `d7de05a` — Upgrade endpoint + GL methods (WIP)
- `528561a` — Fix accessibility, all tests pass
- `793ec27` — Frontend: button, dialog, reports tab

### SAAR-LRP-003 (Loan Restructuring)
- `834e262` — Complete restructuring feature

### SAAR-NPA-002 (NPA Write-Off)
- `e43a22b` — Complete write-off workflow

### Session Fixes
- `dcd5a8b` — E2E: Fix loginAsDemo auth setup

---

## Test Coverage Targets

### Cypress Regression Tests
- **Current:** ~40 tests
- **Target:** 90+ tests
- **Required For:** Production deployment

### Backend NUnit Tests
- **Current:** 15+ tests
- **Target:** 25+ tests
- **Coverage:** All business logic paths

### Integration Tests
- **Current:** Limited
- **Target:** 10+ end-to-end tests
- **Coverage:** Full feature workflows

---

## Git Workflow

### Branch Strategy
- **main:** Production-ready code
- **feature/SAAR-???-###:** Feature branches (merged after testing)
- **hotfix/###:** Critical bug fixes (fast-tracked)

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

**Types:** feat, fix, chore, docs, style, refactor, perf, test

### Pre-commit Checklist
- [ ] Code follows project style
- [ ] All tests passing
- [ ] Tracking docs updated
- [ ] No breaking changes
- [ ] Feature flags considered

---

## Known Blockers

None currently.

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Features Complete | 4/6 | 4/6 | ✅ Achieved |
| Test Coverage | 90+ | ~50 | 🟡 In Progress |
| CI/CD Pass Rate | 100% | TBD | ⏳ Pending |
| Production Deployment | 1 | 0 | ⏳ Pending |
