# CONTEXT.md — SaaR Core Banking Services Project State

**Last Updated:** 2026-05-10
**Current Session:** Continuation of session 58

## In Progress

### SAAR-RPT-002: RBI Regulatory Reporting (WIP)
- **Status:** Planning Phase
- **Backend:** Not yet started
- **Frontend:** Not yet started
- **Estimated Coverage:**
  - NPA Status & History Reports
  - Restructured Loans Reports
  - Upgraded Loans Reports
  - Regulatory Compliance Metrics

### Cypress E2E Tests (SAAR-LRP-003)
- **Status:** FIXED (commit dcd5a8b)
- **Issue:** Global loginAsDemo() in cypress/support/e2e.ts was too minimal
- **Solution:** Enhanced to properly initialize Redux authSlice with feature flags
- **Tests Affected:** 16-restructured-loans.cy.ts now passes with proper auth

## Completed

### SAAR-LRP-004: Loan Upgrade (Restructured → Original Terms)
- **Backend:** ✅ Complete (commits ab07403, d7de05a, 528561a)
  - Data model with IsUpgraded, UpgradedDate, UpgradedReason, UpgradeJournalNumber
  - EligibilityCheck guards: DISBURSED + isRestructured + !isUpgraded + 365+ days + SMA=STANDARD
  - GL journal posting: DR 1020 / CR 5045 (restructuring provision reversal)
  - Idempotency via UPGRADE-{appNo} key
  - All 3 NUnit tests passing
- **Frontend:** ✅ Complete (commit 793ec27)
  - Upgrade button on LoanDetail (green, visible when eligible)
  - UpgradeDialog with reason textarea
  - Service layer: getUpgradedLoans(), upgradeLoan()
  - Reports Tab 6 "Loan Upgrades" with KPI cards and table
  - Cypress tests T-01 through T-04 (17-loan-upgrades.cy.ts)

### SAAR-LRP-003: Loan Restructuring Tracking
- **Backend:** ✅ Complete (commit 834e262)
  - Restructure endpoint with eligibility guards
  - GL journal posting: DR 1030 / CR 5005
  - Idempotency via RESTR-{appNo} key
- **Frontend:** ✅ Complete
  - Restructure button on LoanDetail
  - RestructureDialog with 4 fields (EMI, Tenure, Rate, Reason)
  - Reports "Restructured Loans" tab with provisioning calculations
  - Cypress tests T-04 through T-06 (16-restructured-loans.cy.ts)

### SAAR-NPA-002: NPA Loan Write-Off Workflow
- **Status:** ✅ Deployed (commit e43a22b)
- **Coverage:** NPA-to-write-off transitions with GL entries

## Pending

### SAAR-NPA-003: NPA Recovery Tracking
- **Status:** Not started
- **Expected Features:**
  - Recovery journeys for written-off loans
  - Partial recovery tracking
  - Recovery amounts and dates

### CI/CD & Deployment
- **Status:** Pending
- **Tasks:**
  - Verify all commits build successfully
  - Verify all Cypress E2E tests pass (target: 90+)
  - Deploy to Hetzner VPS
  - Verify smoke tests on production

## Key Architectural Patterns

### Multi-Tenancy (Schema-per-Tenant)
- No schema qualifiers in migrations (handled transparently)
- TenantId flows through all requests
- Public tenant for demo/testing

### Financial Transactions (GL Posting)
- Double-entry bookkeeping: DR/CR pairs
- Idempotency keys: `{OperationType}-{ApplicationNumber}`
- JournalNumbers generated for audit trail

### Frontend Auth
- Mock JWT in localStorage: `auth-token`
- Redux authSlice: `{ isAuthenticated, user, tenantId, featureFlags }`
- Feature flags enable/disable UI elements per tenant

### Cypress Testing
- Global loginAsDemo() for consistent auth across tests
- API stubbing with cy.intercept()
- Regression test files in cypress/e2e/regression/

## Feature Flag Reference
- `feature_gold_loan` — Loan Origination
- `feature_dynamic_forms` — AI-powered form designer
- `feature_expressions` — Expression builder
- `feature_approval_chain` — Approval workflow
- `feature_compliance_alerts` — Compliance monitoring
- `feature_fd_rd` — Fixed Deposits & Recurring Deposits

## Next Steps (Priority Order)
1. ✅ Fix SAAR-LRP-003 E2E tests (DONE - commit dcd5a8b)
2. → Implement SAAR-RPT-002 (RBI Regulatory Reporting)
3. → Implement SAAR-NPA-003 (NPA Recovery Tracking)
4. → Deploy all features to Hetzner and verify CI/CD
