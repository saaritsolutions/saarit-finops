# ADR-015 — Feature Flags via JWT Claims

| Field      | Value |
|------------|-------|
| Status     | ACCEPTED |
| Date       | 2026-04-22 |
| Ticket     | SAAR-CFG-001 |
| Deciders   | saaritsolutions |

---

## Context

SAAR-CFG-001 requires per-tenant feature flags (enable/disable Gold Loan, Dynamic Forms, Expressions, etc.). These flags must be:
1. Stored per-tenant in the database (in `UserAccessManagementService`)
2. Accessible by multiple backend services for enforcement
3. Accessible by the React frontend to show/hide sidebar items
4. Added with zero latency overhead to existing request paths

Three options were considered for delivering flags from UAMService to other services at request time.

---

## Options Considered

### Option A — JWT Claims at Login (CHOSEN)
Embed feature flags as JWT claims when the user logs in. Flags are read by services from `User.FindFirst("feature_gold_loan")`.

**Pros:**
- Zero per-request overhead — claims already in every validated JWT
- No inter-service HTTP dependency at runtime
- Stateless — each service independently validates claims without calling UAMService
- Consistent with how `tenant_id` and `roles` are already distributed

**Cons:**
- Requires re-login to pick up flag changes (8-hour JWT expiry window)
- Slight JWT payload increase (~200 bytes for 6 boolean claims)

### Option B — Per-Request UAMService Call
Each service calls `GET UAMService/api/tenant-config` when processing requests that need feature enforcement.

**Pros:**
- Real-time flag changes without re-login

**Cons:**
- Every guarded request adds a synchronous HTTP call to UAMService
- Tight coupling — all services depend on UAMService availability
- Need circuit breaker / fallback to avoid cascading failures
- Significantly more complex to implement and test

### Option C — Shared Cache (Redis)
UAMService writes flags to a shared Redis cache; services read from cache.

**Pros:**
- Near-real-time updates, low latency reads

**Cons:**
- Requires Redis infrastructure (not currently in the platform)
- Additional operational complexity
- Over-engineered for 3-tenant demo scope

---

## Decision

**Option A — JWT Claims at Login**

For a demo platform with 8-hour JWT sessions and 3 tenants, requiring re-login after a flag change is acceptable and is clearly communicated in the UI ("Changes take effect at next login"). The zero-runtime-overhead design is preferable at this stage.

---

## Implementation Notes

- **UAMService (`AuthController`)**: `GenerateJwt` loads the `Tenant` row and adds 6 boolean claims (`feature_*`) plus `bank_theme_color` / `bank_logo_url` when non-empty.
- **Fail-open rule**: Any service reading a `feature_*` claim MUST treat a missing claim as `true` (enabled). This ensures existing sessions and mock tokens continue to work.
- **Frontend (`authSlice`)**: `decodeFlags(token)` decodes the JWT payload; falls back to `DEFAULT_FLAGS` (all enabled) on any parse error.
- **Backend enforcement**: `ClaimsPrincipalExtensions.HasFeature(name)` — returns `true` when claim is absent. Wired into GoldLoanController + GoldRateController.
- **Scope**: Only Gold Loan module is backend-enforced in SAAR-CFG-001. Other modules can be added in subsequent tickets without architectural change.

---

## Consequences

- All existing tokens (mock tokens, 8-hour real JWTs from before this change) will lack `feature_*` claims → fail-open → no disruption for current users.
- When UAMService is deployed with the new migration, existing `Tenant` rows will have all feature flags defaulting to `true` (via EF column defaults) — no manual DB patching needed.
- Future services that want per-tenant enforcement can simply call `User.HasFeature(name)` with no architecture change.
