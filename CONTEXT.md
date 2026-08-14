# CONTEXT.md — SaaR Core Banking Services Project State

**Last Updated:** 2026-08-13
**Current Session:** Autonomous Daily Build-Out — Tier 1 test coverage

## Completed

### Autonomous Daily Build-Out: RegulatoryComplianceService.Tests (2026-08-13)
- **Status:** ✅ Complete, on branch `auto/regulatorycompliance-tests-2026-08-13` (not merged to main)
- Replaced scaffold `Assert.Pass()` with 11 real NUnit tests covering ComplianceReportsController
  and RegulatoryFilingsController (create/stamp-date, getAll, get-404, get-found, delete, delete-404,
  update-mismatched-id-badrequest)
- Added `Microsoft.EntityFrameworkCore.InMemory` to the test csproj, matching the pattern used for
  GLAccountingService.Tests the previous run
- ⚠️ UNVERIFIED — sandbox has no .NET SDK; run `dotnet build`/`dotnet test` locally before merging

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

## In Progress

### PHASE 1: Loan Eligibility Checking (Enterprise-Grade Loan Module)
- **Status:** 90% Complete — Backend Implementation (commit a33c796)
- **Backend Completed:** ✅
  - LoanEligibilityCheck model with CIBIL scoring, FOIR, LTV fields
  - EligibilityCheckService: Real-time credit scoring with mock CIBIL fallback
  - 3 core API endpoints: eligibility-check, eligibility-status, pre-approve
  - DI registration and EF Core migration
  - Build verified successful
- **Frontend Pending:** React components (EligibilityCheck.tsx, KycVerification.tsx)
- **Testing Pending:** 11 NUnit tests, 9 Cypress E2E tests (target 85% coverage)

## Completed

### KYC Document Upload - E2E Testing
- **Status:** ✅ Complete (commit b8ecc44)
- **Tests Created:** 20-kyc-document-upload.cy.ts with 11 comprehensive tests
  - T-01: Customer Management page loads with KYC buttons
  - T-02: Initiate KYC transitions to InProgress
  - T-03: Upload Documents dialog opens with checklist
  - T-04: Document validation (file type and size)
  - T-05: Save Documents (without submitting)
  - T-06: Upload & Submit (transitions to DocumentsSubmitted)
  - T-07: Back to In Progress revert action
  - T-08: Verify/Reject buttons appear for submitted status
  - T-09: Verify KYC transitions to Verified
  - T-10: Reject KYC transitions to Rejected
  - T-11: Document checklist varies by customer type
- **Coverage:**
  - KYC status transitions (0→1→2→3 / 4 / 5)
  - Document upload UI and validation
  - API mocking with cy.intercept()
  - Individual and Corporate customer types

### CI/CD & Deployment
- **Status:** In Progress
- **Completed:**
  - ✅ Backend build: SaaRCoreBankingMicroservices.sln builds successfully (dotnet build)
  - ✅ Frontend TypeScript: No new errors introduced by KYC changes
  - ✅ Cypress tests: 20-kyc-document-upload.cy.ts created with 11 comprehensive tests
  - ✅ Test file syntax: Follows existing test patterns (matches 18-regulatory-report.cy.ts)
- **Pending:**
  - Run full Cypress test suite (target: 90+ tests)
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
4. ✅ Fix KYC Document Upload workflow - DONE (commits bba6086, b8ecc44)
5. → **PHASE 1: Complete Loan Eligibility Module** (90% backend, in progress)
   - Implement frontend React components (EligibilityCheck.tsx, KycVerification.tsx)
   - Write 11 NUnit backend tests + 9 Cypress E2E tests
   - Target 85%+ test coverage
   - Commit when complete: `feat(phase1): Complete loan eligibility checking module`
6. → Run full Cypress test suite (target 90+ tests passing)
7. → Deploy all features to Hetzner and verify CI/CD and smoke tests
