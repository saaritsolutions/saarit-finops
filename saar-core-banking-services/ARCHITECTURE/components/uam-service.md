# UserAccessManagementService — Component Documentation

| Field | Value |
|-------|-------|
| Port (local) | 5033 |
| Port (docker) | 5033 |
| Database | `UserAccessDb` (PostgreSQL, shared schema — NOT schema-per-tenant) |
| Solution | `SaaRCoreBankingMicroservices.sln` |

---

## Responsibilities

- JWT-based authentication (login endpoint)
- User CRUD (create, list, activate/deactivate)
- Role management (Admin / Maker / Checker)
- Tenant registry (known tenants: public, ucb_demo, nbfc_demo)
- **Bank profile + feature toggles per tenant** (SAAR-CFG-001)

---

## Entities

### `Tenant`
| Column | Type | Notes |
|--------|------|-------|
| `Id` | string(50) PK | Slug, e.g. `ucb_demo` |
| `Name` | string | Display name, e.g. `UCB Cooperative Bank` |
| `ThemeColor` | string? | Hex colour, e.g. `#1565C0` |
| `LogoUrl` | string? | URL to bank logo |
| `CreatedAt` | DateTime | UTC |
| `BankAddress` | string? | Postal address |
| `BankPhone` | string? | Contact phone |
| `BankEmail` | string? | Contact email |
| `RbiLicenseNumber` | string? | RBI licence / registration number |
| `WebsiteUrl` | string? | Bank website |
| `FeatureGoldLoan` | bool | Default: `true` |
| `FeatureDynamicForms` | bool | Default: `true` |
| `FeatureExpressions` | bool | Default: `true` |
| `FeatureApprovalChain` | bool | Default: `true` |
| `FeatureComplianceAlerts` | bool | Default: `false` |
| `FeatureFdRd` | bool | Default: `true` |
| `ConfigUpdatedAt` | DateTime? | When config was last saved |
| `ConfigUpdatedBy` | string? | Email of admin who saved |

### `User`
| Column | Type | Notes |
|--------|------|-------|
| `Id` | int PK | |
| `Username` | string | Same as Email for demo users |
| `Email` | string | Login identifier |
| `PasswordHash` | string | BCrypt |
| `IsActive` | bool | |
| `TenantId` | string FK | → `Tenant.Id` |

### `Role`
`Id`, `Name` (Admin / Maker / Checker)

### `UserRole`
Composite PK `(UserId, RoleId)` — many-to-many join table

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | Anonymous | Returns JWT (8h) with `tenant_id`, roles, and feature flag claims |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/users` | `[Authorize]` | List users (filtered by caller's tenant) |
| `POST` | `/api/users` | `[Authorize(Roles="Admin")]` | Create user |
| `PUT` | `/api/users/{id}` | `[Authorize(Roles="Admin")]` | Update user |
| `DELETE` | `/api/users/{id}` | `[Authorize(Roles="Admin")]` | Deactivate user |

### Roles
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/roles` | `[Authorize]` | List roles |
| `POST` | `/api/roles` | `[Authorize(Roles="Admin")]` | Create role |

### Tenant Config (SAAR-CFG-001)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tenant-config` | `[Authorize]` | Returns bank profile + feature toggles for caller's tenant |
| `PUT` | `/api/tenant-config` | `[Authorize(Roles="Admin")]` | Updates config; sets `ConfigUpdatedAt`/`ConfigUpdatedBy` |

---

## JWT Claims

The login endpoint generates a JWT with the following claims:

| Claim | Source | Example |
|-------|--------|---------|
| `sub` | `User.Id` | `"3"` |
| `email` | `User.Email` | `"admin@ucb-demo.com"` |
| `name` | `User.Username` | `"admin@ucb-demo.com"` |
| `jti` | `Guid.NewGuid()` | UUID |
| `tenant_id` | `User.TenantId` | `"ucb_demo"` |
| `role` | Each role name | `"Admin"` |
| `feature_gold_loan` | `Tenant.FeatureGoldLoan` | `"true"` |
| `feature_dynamic_forms` | `Tenant.FeatureDynamicForms` | `"true"` |
| `feature_expressions` | `Tenant.FeatureExpressions` | `"true"` |
| `feature_approval_chain` | `Tenant.FeatureApprovalChain` | `"true"` |
| `feature_compliance_alerts` | `Tenant.FeatureComplianceAlerts` | `"false"` |
| `feature_fd_rd` | `Tenant.FeatureFdRd` | `"true"` |
| `bank_theme_color` | `Tenant.ThemeColor` (if set) | `"#1565C0"` |
| `bank_logo_url` | `Tenant.LogoUrl` (if set) | `"https://..."` |

**Fail-open:** Services must treat a missing `feature_*` claim as `true` (enabled).

---

## EF Migrations

| Migration | Description |
|-----------|-------------|
| `InitialCreate` | Tenants, Users, Roles, UserRoles tables |
| `AddTenantConfig` | Bank profile + feature toggle columns on Tenants (SAAR-CFG-001) |

---

## Known Tenants

| Id | Name | Admin Email | Password |
|----|------|-------------|----------|
| `public` | System Default | `admin@saarbanking.com` | `admin123` |
| `ucb_demo` | UCB Cooperative Bank | `admin@ucb-demo.com` | `ucb123` |
| `nbfc_demo` | SaaR NBFC | `admin@nbfc-demo.com` | `nbfc123` |

---

## Multi-Tenancy Note

UAMService uses a **shared** (single-schema) database — it IS the tenant registry, so it does not apply schema-per-tenant isolation to itself. The Tenant table holds all tenants in a single `UserAccessDb`.
