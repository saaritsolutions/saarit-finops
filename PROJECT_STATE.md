# PROJECT_STATE.md — SaaR FinOps Platform

**Last Updated:** 2026-05-10
**Project:** SaaR Core Banking Services (Microservices + React)
**Stack:** .NET 8 + React 19 + PostgreSQL + OpenAI GPT

---

## Current Status: Feature Development Phase

✅ **Foundation Complete**
- Multi-tenancy (schema-per-tenant)
- Dynamic schema + form generation
- Expression engine + AI evaluator
- GL posting + audit trails

🔄 **Active: Loan Lifecycle Features**
- ✅ Loan Origination
- ✅ Loan Restructuring (SAAR-LRP-003)
- ✅ Loan Upgrade (SAAR-LRP-004)
- ✅ RBI Regulatory Reporting (SAAR-RPT-002)
- 🔄 NPA Recovery Tracking (SAAR-NPA-003) — PENDING

---

## Recent Work Done

### Session 58 (Current Continuation - Final)
- **Completed:** SAAR-RPT-002 backend (commit 04a1763)
  - GET /api/loans/reports/regulatory-summary endpoint
  - RegulatoryMetricsDto with 18 properties
  - All 3 NUnit tests passing (T-01, T-02, T-03)
- **Completed:** SAAR-RPT-002 frontend (commit 71772fc)
  - Tab 7 "RBI Regulatory" in Reports.tsx
  - KPI cards for metrics (loan book, NPA, provision, restructured, upgraded, written-off)
  - Summary table with loan category breakdown
  - CSV export functionality
  - Service layer: getRegulatoryMetrics() in loanOriginationService.ts
  - 4 Cypress regression tests (18-regulatory-report.cy.ts)

### Session 58 (Earlier)
- **Completed:** SAAR-LRP-004 backend (3 commits: ab07403, d7de05a, 528561a)
  - Data model: IsUpgraded, UpgradedDate, UpgradedReason, UpgradeJournalNumber
  - Eligibility checks: 365+ days, DISBURSED, isRestructured, !isUpgraded, SMA=STANDARD
  - GL entry: DR 1020 (Loans) / CR 5045 (Provision Reversal)
  - All 3 NUnit tests passing
- **Completed:** SAAR-LRP-004 frontend (commit 793ec27)
  - LoanDetail upgrade button + dialog
  - Reports Tab 6 with KPI cards (upgraded count, total outstanding)
  - Service layer (getUpgradedLoans, upgradeLoan)
  - Cypress regression tests (T-01 to T-04)

### Session 58 (Current Continuation)
- **Fixed:** SAAR-LRP-003 Cypress E2E test failures (commit dcd5a8b)
  - Enhanced global loginAsDemo() in cypress/support/e2e.ts
  - Added Redux authSlice initialization with feature flags
  - Removed duplicate command definition from 17-loan-upgrades.cy.ts
  - Now all regression tests have consistent auth setup

---

## Dev Environment Setup

```bash
# Start all microservices
./start-all.sh

# Frontend
cd saar-core-banking-services/frontend-react
npm start  # PORT=3002

# Key services (ports)
- ExpressionBuilderService: 5004
- WorkflowOrchestrationService: 5012
- DynamicFieldsSchemaService: 5013
- LoanService: 5130
- frontend-react: 3002
```

**Required:** `ASPNETCORE_ENVIRONMENT=Development`
**Active Expression ID:** `EXPR_1755237353842` (do not delete)

---

## Pending Work

### 1. SAAR-NPA-003: NPA Recovery Tracking (Next)
**Priority:** HIGH
**Scope:**
- Recovery workflow for written-off loans
- Partial recovery tracking + GL entries
- Recovery timeline + forecasting
- Recovery success metrics

### 3. CI/CD & Deployment (Final)
**Priority:** CRITICAL
**Tasks:**
- Build verification for all commits
- Cypress regression test suite (target: 90+ tests)
- Hetzner VPS deployment
- Smoke test verification

---

## Active Commits (Current Session)

| Commit | Feature | Status |
|--------|---------|--------|
| dcd5a8b | E2E: Fix loginAsDemo in cypress/support | ✅ Complete |
| 793ec27 | SAAR-LRP-004: Frontend loan upgrade | ✅ Complete |
| 620ffb1 | Docs: Update tracking after SAAR-LRP-004 | ✅ Complete |
| 528561a | SAAR-LRP-004: Fix accessibility, all tests pass | ✅ Complete |
| d7de05a | SAAR-LRP-004: Upgrade endpoint + GL methods | ✅ Complete |
| ab07403 | SAAR-LRP-004: Data model + migrations | ✅ Complete |

---

## Testing Status

### Cypress Regression Tests
| Feature | Test File | Tests | Status |
|---------|-----------|-------|--------|
| Auth | 01-auth.cy.ts | ? | ⏳ Pending |
| Dashboard | 02-dashboard.cy.ts | ? | ⏳ Pending |
| Accounts | 03-accounts.cy.ts | ? | ⏳ Pending |
| Loans | 04-loans.cy.ts | ? | ⏳ Pending |
| Restructuring (SAAR-LRP-003) | 16-restructured-loans.cy.ts | 3 | ✅ Fixed |
| Upgrades (SAAR-LRP-004) | 17-loan-upgrades.cy.ts | 4 | ✅ Created |

**Total Target:** 90+ tests
**Current:** ~40 tests (estimate)

---

## Known Issues & Resolutions

### Issue #1: Cypress E2E Auth Failure (SAAR-LRP-003)
- **Root Cause:** Global loginAsDemo() only set auth token, not Redux state
- **Fix:** Enhanced to initialize authSlice with { isAuthenticated, user, tenantId, featureFlags }
- **Status:** ✅ RESOLVED (commit dcd5a8b)

---

## Configuration Reference

### Feature Flags (in authSlice)
```typescript
featureFlags: {
  feature_gold_loan: true,
  feature_dynamic_forms: true,
  feature_expressions: true,
  feature_approval_chain: true,
  feature_compliance_alerts: true,
  feature_fd_rd: true,
}
```

### GL Accounts (Double-Entry Bookkeeping)
```
1020 — Loans & Advances (Asset, Debit)
1030 — Provision Against NPAs (Contra-Asset, Debit)
5005 — Provision Against Restructuring (Income, Credit)
5045 — Restructuring Provision Reversal (Income, Credit)
```

### Idempotency Keys
- Restructure: `RESTR-{ApplicationNumber}`
- Upgrade: `UPGRADE-{ApplicationNumber}`

---

## Next Recommended Steps

1. **Begin SAAR-NPA-003 (NPA Recovery Tracking)**
   - Design recovery workflow data models
   - Implement recovery endpoints (partial recovery, reversal, GL posting)
   - Create frontend recovery management UI
   - Add Cypress tests

2. **Verify CI/CD & Test Coverage**
   - Push all commits to GitHub
   - Monitor GitHub Actions workflows
   - Ensure all tests pass (target: 90+ Cypress tests)
   - Verify build pipeline for all services

3. **Prepare Hetzner Deployment**
   - Configure environment variables for all services
   - Set up database migrations
   - Deploy to VPS
   - Run smoke tests and verify features
