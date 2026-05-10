# DECISIONS_LOG.md — Architectural & Design Decisions

**Last Updated:** 2026-05-10

---

## Decision #1: Global Cypress Auth Command (Session 58, Commit dcd5a8b)

**Date:** 2026-05-10
**Context:** SAAR-LRP-003 E2E tests were failing due to insufficient authentication state
**Decision:** Enhance global `loginAsDemo()` in cypress/support/e2e.ts to properly initialize Redux authSlice
**Options Considered:**
1. ✅ Update global command to initialize both auth token AND authSlice (CHOSEN)
   - Pro: Consistent auth across all tests
   - Pro: Prevents command redefinition conflicts
   - Pro: Simplifies test code

2. Let each test file define its own loginAsDemo
   - Pro: Tests can customize auth as needed
   - Con: Duplicate code, command conflicts
   - Con: Harder to maintain

**Rationale:** All tests need the same auth setup (basic demo user with feature flags). A global command avoids duplication and command conflicts. Individual tests can further customize by calling cy.localStorage('setItem') if needed.

**Implementation:**
- Enhanced loginAsDemo() to set both `auth-token` and `authSlice` in localStorage
- `auth-token`: Base64-encoded mock JWT with demo credentials
- `authSlice`: Stringified Redux state with user data and all feature flags enabled
- Removed duplicate definition from 17-loan-upgrades.cy.ts

**Impact:** All Cypress regression tests now have consistent, complete auth initialization. SAAR-LRP-003 tests now pass.

---

## Decision #2: Loan Upgrade Eligibility Checks (Session 57, Commit ab07403)

**Date:** Prior session (approx 2026-05-09)
**Context:** Designing SAAR-LRP-004 loan upgrade feature
**Decision:** Implement strict eligibility guards in backend (EligibilityCheck class)
**Eligibility Criteria:**
- Loan status: DISBURSED
- Loan must be restructured: isRestructured = true
- Loan not already upgraded: isUpgraded = false
- Minimum 365 days since restructure: restructuredDate ≤ today - 365 days
- SMA status: STANDARD (no arrears)

**Rationale:**
- **DISBURSED:** Only disbursed loans can have active restructuring
- **isRestructured:** Upgrade applies only to already-restructured loans
- **!isUpgraded:** Prevent double upgrades
- **365+ days:** Ensure 1-year satisfactory repayment period (RBI requirement)
- **SMA=STANDARD:** No payment issues (standard asset status)

**GL Entry Decision:**
- DR 1020 (Loans & Advances) — Reverse provision reversal
- CR 5045 (Restructuring Provision Reversal) — Recognize previously reversed provision
- Idempotency: UPGRADE-{ApplicationNumber}

**Impact:** Ensures only eligible loans can be upgraded, maintaining regulatory compliance. Banks can confidently upgrade loans that meet all criteria.

---

## Decision #3: Loan Restructuring GL Entry (Session 56, Feature SAAR-LRP-003)

**Date:** Prior session
**Context:** Implementing SAAR-LRP-003 restructuring feature
**Decision:** Use specific GL accounts for restructuring provisions
**GL Entry:**
- DR 1030 (Provision Against NPAs) or equivalent
- CR 5005 (Provision Against Restructuring)
- Idempotency: RESTR-{ApplicationNumber}

**Rationale:**
- **DR 1030:** Increase provision liability (reserve funds for restructured loans)
- **CR 5005:** Reduce income (provision is a cost)
- Restructuring is a risk mitigation activity (hence provision)
- Idempotency prevents accidental double-posting

**Impact:** Proper financial tracking of restructured loans. Auditors can trace all restructuring decisions via GL entries.

---

## Decision #4: Multi-Tenancy via Schema-per-Tenant (Prior decision)

**Date:** Foundation phase
**Context:** SaaR platform must support multiple banks (tenants) with complete data isolation
**Decision:** Implement schema-per-tenant architecture in PostgreSQL
**Pattern:**
- Each tenant gets its own PostgreSQL schema (e.g., `tenant_public`, `tenant_bank_001`)
- Connection string includes schema qualifier
- EF Core migrations apply to all schemas automatically
- TenantId flows through request context

**Implementation Details:**
- No explicit schema qualifiers in C# code (handled at connection level)
- Transparent to business logic
- Each tenant's data is completely isolated
- Supports unlimited tenant scaling

**Rationale:**
- Data isolation for regulatory compliance (banks can't see each other's data)
- Scalability (new tenants = new schema, no code changes)
- Performance (smaller schema per tenant = faster queries)
- Simplicity in code (business logic doesn't need to know about tenancy)

**Impact:** SaaR can safely serve multiple bank customers with complete data isolation.

---

## Decision #5: Feature Flags in Redux authSlice (Prior decision)

**Date:** Foundation phase
**Context:** Different features needed to be enabled/disabled per tenant or role
**Decision:** Store feature flags in Redux authSlice alongside auth state
**Pattern:**
```typescript
authSlice: {
  isAuthenticated: boolean,
  user: { userId, bankName },
  tenantId: string,
  featureFlags: {
    feature_gold_loan: boolean,
    feature_dynamic_forms: boolean,
    feature_expressions: boolean,
    feature_approval_chain: boolean,
    feature_compliance_alerts: boolean,
    feature_fd_rd: boolean,
  }
}
```

**Rationale:**
- Feature flags loaded with auth state (single auth check)
- Redux allows reactive UI updates when flags change
- Frontend can conditionally render components based on flags
- Easy to enable/disable per tenant without code changes

**Impact:** Flexible feature deployment per tenant/role. UI automatically reflects enabled features.

---

## Decision #6: Idempotency Keys for Financial Transactions (Prior decision)

**Date:** Foundation phase
**Context:** Prevent duplicate GL postings if requests are retried
**Decision:** Implement idempotency keys in format: `{OperationType}-{ApplicationNumber}`
**Examples:**
- Restructure: `RESTR-APP-2024-001`
- Upgrade: `UPGRADE-APP-2024-001`
- NPA Write-off: `WRITEOFF-APP-2024-001`

**Implementation:**
- Store idempotency key with GL entry
- Check for duplicate before posting
- Return existing entry if key already processed
- Audit trail includes idempotency key

**Rationale:**
- Prevents accidental double-posting (financial integrity)
- Network retries don't create duplicate transactions
- Audit trail shows if duplicate was attempted
- Matches banking industry best practices

**Impact:** Reliable financial transactions even in unreliable networks.

---

## Summary of Active Decisions

| Decision | Type | Status | Impact |
|----------|------|--------|--------|
| Global Cypress auth command | Testing | ✅ Active | Consistent test auth |
| Loan upgrade eligibility checks | Business Logic | ✅ Active | RBI compliance |
| Loan restructuring GL entries | Financial | ✅ Active | Proper accounting |
| Schema-per-tenant multi-tenancy | Architecture | ✅ Active | Data isolation |
| Feature flags in Redux | Frontend | ✅ Active | Flexible deployment |
| Idempotency keys | Financial | ✅ Active | Transaction safety |

---

## Decisions Pending Review

None currently.

---

## Reversed Decisions

None to date.
