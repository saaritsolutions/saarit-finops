# SAAR-CFG-001 — Bank Configuration + Per-Tenant Feature Toggles

| Field       | Value |
|-------------|-------|
| Ticket ID   | SAAR-CFG-001 |
| Epic        | Platform Configuration |
| Status      | IN_PROGRESS |
| Priority    | MEDIUM |
| Service     | UserAccessManagementService (backend) + LoanService (enforcement) + frontend-react |
| Sprint      | Session 42 (2026-04-22) |
| Author      | saaritsolutions |

---

## Business Context

Each tenant (UCB Cooperative Bank, SaaR NBFC) operates as an independent virtual bank on the SaaR CBS platform. Currently:
- All tenants share the same appsettings.json feature flags (environment-wide, not per-tenant)
- Bank profile fields (address, phone, RBI license) are absent from the platform
- The sidebar and routes show all modules regardless of what a tenant has licensed

SAAR-CFG-001 solves this by giving each tenant admin a **Bank Configuration** screen to set their bank profile and enable/disable product modules (Gold Loan, Dynamic Forms, Expression Builder, etc.). Changes take effect at next login (flags embedded in the JWT).

---

## Functional Requirements

### FR-CFG-001: Bank Profile Storage
**As a** tenant Admin
**I want** to store my bank's name, logo URL, theme colour, address, phone, email, RBI licence number, and website
**So that** the platform correctly identifies and brands the bank

**Acceptance Criteria:**
- AC-01: `GET /api/tenant-config` returns all profile fields for the authenticated user's tenant
- AC-02: `PUT /api/tenant-config` saves profile fields and returns the updated record
- AC-03: Only Admin role may call PUT; Maker/Checker receives HTTP 403
- AC-04: Fields are nullable; partial updates preserve un-submitted fields
- AC-05: Existing `ThemeColor` and `LogoUrl` columns on `Tenant` are preserved and returned

### FR-CFG-002: Feature Toggle Storage
**As a** tenant Admin
**I want** to enable or disable individual product modules for my tenant
**So that** unlicensed modules are hidden from users and unavailable via API

**Acceptance Criteria:**
- AC-01: Six toggles are configurable: `featureGoldLoan`, `featureDynamicForms`, `featureExpressions`, `featureApprovalChain`, `featureComplianceAlerts`, `featureFdRd`
- AC-02: All toggles default to `true` except `featureComplianceAlerts` (default `false`)
- AC-03: Toggle values are persisted to `Tenant` table in `UserAccessDb`

### FR-CFG-003: JWT Feature Flag Claims
**As a** backend or frontend service
**I want** to read feature flag claims from the JWT without calling UAMService at runtime
**So that** there is zero per-request latency penalty for feature enforcement

**Acceptance Criteria:**
- AC-01: On successful login, `AuthController.GenerateJwt` includes claims: `feature_gold_loan`, `feature_dynamic_forms`, `feature_expressions`, `feature_approval_chain`, `feature_compliance_alerts`, `feature_fd_rd` (values `"true"` or `"false"`)
- AC-02: Claims `bank_theme_color` and `bank_logo_url` are also included when non-empty
- AC-03: Fail-open rule: if a claim is absent, the feature is treated as **enabled**
- AC-04: Flag changes require re-login to take effect (shown as info notice in the UI)

### FR-CFG-004: Backend Enforcement (LoanService — Gold Loan)
**As a** backend API
**I want** to return HTTP 403 when a feature is disabled for the requesting tenant
**So that** direct API calls are blocked even without the frontend gating

**Acceptance Criteria:**
- AC-01: `GoldLoanController` (all endpoints) checks `User.HasFeature("gold_loan")` — returns `{ error: "Gold Loan module is not enabled for this tenant." }` with status 403 when false
- AC-02: `GoldRateController` (all endpoints) has the same check
- AC-03: `HasFeature(name)` is a `ClaimsPrincipal` extension method in `LoanService/Extensions/ClaimsPrincipalExtensions.cs`
- AC-04: Fail-open: missing JWT claim → feature treated as enabled (returns 200)

### FR-CFG-005: Frontend Sidebar Conditional Rendering
**As a** user
**I want** to only see sidebar items for modules that are enabled for my tenant
**So that** the UI is clean and shows only licensed features

**Acceptance Criteria:**
- AC-01: **Gold Loans** section (list + new + Gold Rate admin) hidden when `featureFlags.goldLoan === false`
- AC-02: **Form Builder** sidebar entry hidden when `featureFlags.dynamicForms === false`
- AC-03: **Expression Builder** sidebar entry hidden when `featureFlags.expressions === false`
- AC-04: Feature flags decoded from JWT after login and stored in Redux `authSlice`
- AC-05: Default flags (all enabled) applied when JWT lacks feature claims (dev mock fallback)

### FR-CFG-006: Bank Configuration Admin Page
**As a** tenant Admin
**I want** a dedicated admin page at `/admin/bank-config`
**So that** I can manage bank profile and feature toggles from a single screen

**Acceptance Criteria:**
- AC-01: Page has 2 tabs: "Bank Profile" and "Feature Toggles"
- AC-02: Bank Profile tab has fields: Bank Name, Theme Color, Logo URL, Address, Phone, Email, RBI Licence Number, Website URL
- AC-03: Feature Toggles tab has 6 MUI `Switch` components with label + description
- AC-04: Info alert: "Feature toggle changes take effect at next login."
- AC-05: Save button calls `PUT /api/tenant-config`; success/error shown via Alert
- AC-06: Page protected by `BANKING_PERMISSIONS.SYSTEM_CONFIG`
- AC-07: "Bank Configuration" entry visible in the Sidebar under Administration for Admin role

### FR-CFG-007: Fail-Open Behaviour
**As a** platform engineer
**I want** all feature checks to fail open (feature = enabled) when configuration is unavailable
**So that** a missing or malformed JWT claim never breaks existing functionality

**Acceptance Criteria:**
- AC-01: `HasFeature()` returns `true` when the named claim is absent from the JWT
- AC-02: `decodeFlags()` in `authSlice` returns `DEFAULT_FLAGS` (all enabled) on any JWT parse error
- AC-03: Backend enforcement only gates new modules (Gold Loan); existing functionality is unaffected

### FR-CFG-008: UAMService Local Dev
**As a** developer
**I want** UAMService included in `start-all.sh`
**So that** the full auth + config flow works locally without manual service startup

**Acceptance Criteria:**
- AC-01: `scripts/start-all.sh` starts UAMService on port **5033** via `run-fixed-port.sh`
- AC-02: `UserAccessManagementService/appsettings.Development.json` has correct local postgres password
- AC-03: `nginx/nginx.conf` proxies `/api/tenant-config` to `useraccessmanagement:5033`

---

## Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| NFR-01 Security | Only JWT-authenticated users may call GET /api/tenant-config; only Admin may call PUT |
| NFR-02 Performance | Zero per-request latency — flags read from JWT, no UAMService call at runtime |
| NFR-03 Backward Compat | All existing services continue working unchanged; new claims are additive |
| NFR-04 Default State | All feature toggles default to enabled so existing tenants see no change without action |
| NFR-05 Re-login | Flag changes require re-login; this is documented in the UI (info alert) |

---

## Out of Scope

- Real-time feature flag updates without re-login (would require WebSocket or JWT refresh)
- Feature flag enforcement in WorkflowOrchestrationService, TransactionService, AccountService (Phase 2)
- Per-user feature overrides (only per-tenant in this ticket)
- Admin UI for managing tenant onboarding or creating new tenants
- Logo image file upload (URL-based only in this phase)

---

## Data Model

### Extended `Tenant` entity (UserAccessManagementService)

```csharp
// Bank Profile (new columns on existing Tenant table)
public string? BankAddress        { get; set; }
public string? BankPhone          { get; set; }
public string? BankEmail          { get; set; }
public string? RbiLicenseNumber   { get; set; }
public string? WebsiteUrl         { get; set; }

// Feature Toggles
public bool FeatureGoldLoan         { get; set; } = true;
public bool FeatureDynamicForms     { get; set; } = true;
public bool FeatureExpressions      { get; set; } = true;
public bool FeatureApprovalChain    { get; set; } = true;
public bool FeatureComplianceAlerts { get; set; } = false;
public bool FeatureFdRd             { get; set; } = true;

// Audit
public DateTime? ConfigUpdatedAt { get; set; }
public string?  ConfigUpdatedBy  { get; set; }
```

---

## API Surface

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tenant-config` | `[Authorize]` | Returns config for caller's tenant (from JWT `tenant_id`) |
| `PUT` | `/api/tenant-config` | `[Authorize(Roles="Admin")]` | Updates config for caller's tenant |

---

## Test Plan

### Backend Unit Tests (UAMService.Tests — TenantConfigTests.cs)
| Test | Scenario | Expected |
|------|----------|----------|
| T-01 | Login with seeded tenant flags | JWT contains `feature_gold_loan=true` claim |
| T-02 | GET /api/tenant-config for tenant | Returns correct config DTO |
| T-03 | PUT /api/tenant-config then GET | Updated flags returned |
| T-04 | PUT as Checker role | HTTP 403 |

### Cypress Regression (12-bank-config.cy.ts — 15 tests)
- Bank Profile tab: load, populate, edit name, save success, save error
- Feature Toggles tab: 6 toggles loaded, toggle off Gold Loan, save, info alert
- Sidebar gating: Gold Loans hidden when flag false, shown when true; Form Builder hidden when dynamicForms false
