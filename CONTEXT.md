# CONTEXT.md — SaaR Core Banking Services Project State

**Last Updated:** 2026-05-10
**Current Session:** Continuation of session 58

## Completed

### BUGFIX: Customer KYC Document Upload Workflow
- **Status:** ✅ Complete (current session)
- **Issue:** During smoke testing, user found no document upload UI in KYC workflow; status could change without uploading documents
- **Solution:**
  - **Frontend:** Created KycDocumentDialog component with document checklist by customer type
  - Updated CustomerManagement.tsx to integrate document upload dialog
  - Added "Back to In Progress" action to revert submitted documents
  - Integrated document upload into KYC workflow instead of just status change
  - **Backend:** Added two endpoints to CustomerController
    - POST /api/customer/{id}/documents/upload (with file validation: 5MB max, PDF/JPG/PNG only)
    - POST /api/customer/{id}/kyc/mark-incomplete (revert from DocumentsSubmitted to InProgress)
  - **TypeScript:** No compilation errors; Backend: Build successful
  - **Files Modified:**
    - frontend-react/src/features/customer/KycDocumentDialog.tsx (NEW)
    - frontend-react/src/features/customer/CustomerManagement.tsx
    - frontend-react/src/services/customerService.ts
    - saar-core-banking-services/CustomerService/Controllers/CustomerController.cs

### SAAR-NPA-003: NPA Recovery Tracking (COMPLETED)
- **Status:** ✅ Complete (commits e4cc48a, 35b4244)
- **Backend:** ✅ Complete
  - LoanApplication: RecoveredAmount, LastRecoveryDate, RecoveryNotes, RecoveryJournalNumber
  - ITransactionServiceClient: PostRecoveryJournalAsync (DR 1010 / CR 4050)
  - GET /api/loans/applications/written-off: List written-off loans with recovery status
  - POST /api/loans/{id}/recovery: Record recovery with GL posting and validation
  - RecoveryTests.cs: 3 NUnit tests (record, reject, list) all passing
- **Frontend:** ✅ Complete
  - loanOriginationService.ts: WrittenOffLoanItem, getWrittenOffLoans(), recordRecovery()
  - LoanDetail.tsx: WRITTEN_OFF status chip, write-off info card, RecoveryDialog
  - Reports.tsx: Tab 8 "Written-Off" with KPI cards, table, recovery status chips
  - 19-written-off-recovery.cy.ts: 4 E2E regression tests

### SAAR-RPT-002: RBI Regulatory Reporting (COMPLETED)
- **Status:** ✅ Complete (commits 04a1763, 71772fc)
- **Backend:** ✅ Complete
  - GET /api/loans/reports/regulatory-summary endpoint
  - RegulatoryMetricsDto with 18 metrics
  - All 3 NUnit tests passing
- **Frontend:** ✅ Complete
  - Tab 7 "RBI Regulatory" in Reports page
  - KPI cards for core metrics and loan categories
  - Summary table with loan classification breakdown
  - CSV export functionality
  - 4 Cypress regression tests created
- **Coverage:**
  - NPA Ratio and Provision Coverage
  - Restructured, Upgraded, Written-Off loan counts
  - SMA Watch list
  - Standard loan totals

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

### KYC Document Upload - E2E Testing
- **Status:** Pending
- **Tasks:**
  - Create Cypress tests for KYC document upload workflow
  - Test document validation (file size, type, required fields)
  - Test "Save for Later" vs "Upload & Submit" actions
  - Test "Back to In Progress" revert action
  - Verify frontend integrates with backend endpoints

### CI/CD & Deployment
- **Status:** Pending
- **Tasks:**
  - Verify all commits build successfully
  - Verify all Cypress E2E tests pass (target: 90+)
  - Deploy to Hetzner VPS
  - Verify smoke tests on production (including new KYC document workflow)

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
2. ✅ Implement SAAR-RPT-002 (RBI Regulatory Reporting) - DONE (commits 04a1763, 71772fc)
3. ✅ Implement SAAR-NPA-003 (NPA Recovery Tracking) - DONE (commits e4cc48a, 35b4244)
4. → Deploy all features to Hetzner and verify CI/CD
