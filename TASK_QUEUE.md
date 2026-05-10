# TASK_QUEUE.md — Development Backlog

**Last Updated:** 2026-05-10
**Current Focus:** SAAR-RPT-002 (RBI Regulatory Reporting)

---

## Current Focus

### SAAR-RPT-002: RBI Regulatory Reporting
**Status:** PLANNING
**Priority:** HIGH
**Start Date:** 2026-05-10

#### Backend Tasks
- [ ] Design regulatory report data models
- [ ] Create API endpoints for NPA, Restructured, Upgraded summaries
- [ ] Implement GL aggregation queries
- [ ] Add regulatory metrics calculations
- [ ] Write NUnit tests for all endpoints
- [ ] Document API contracts

#### Frontend Tasks
- [ ] Create Reports tabs for RBI data
- [ ] Implement KPI cards for compliance metrics
- [ ] Build data tables with sorting/filtering
- [ ] Add CSV/PDF export functionality
- [ ] Create Cypress regression tests
- [ ] Integrate with existing Reports page

---

## Recently Completed

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
| SAAR-RPT-002 Backend Design | Design | - | Team | 🟡 Planning |
| SAAR-RPT-002 API Implementation | Backend | Medium | Team | ⏳ Pending |
| SAAR-RPT-002 Frontend | Frontend | Medium | Team | ⏳ Pending |
| SAAR-RPT-002 E2E Tests | QA | Small | Team | ⏳ Pending |
| CI/CD Verification | DevOps | Small | Team | ⏳ Pending |

---

## Medium Priority (Next Sprint)

| Task | Type | Estimate | Owner | Status |
|------|------|----------|-------|--------|
| SAAR-NPA-003 Backend | Backend | Large | Team | ⏳ Pending |
| SAAR-NPA-003 Frontend | Frontend | Medium | Team | ⏳ Pending |
| SAAR-NPA-003 E2E Tests | QA | Medium | Team | ⏳ Pending |
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
| Features Complete | 4/6 | 3/6 | 🟡 On Track |
| Test Coverage | 90+ | ~40 | 🟡 In Progress |
| CI/CD Pass Rate | 100% | TBD | ⏳ Pending |
| Production Deployment | 1 | 0 | ⏳ Pending |
