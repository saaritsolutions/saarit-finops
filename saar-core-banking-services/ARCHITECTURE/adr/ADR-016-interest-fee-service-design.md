# ADR-016: InterestFeeService Design — Standalone + Single-Schema

| Field | Value |
|---|---|
| **ID** | ADR-016 |
| **Date** | 2026-04-26 |
| **Status** | Accepted |
| **Session** | 48 |
| **Deciders** | saaritsolutions |
| **Ticket** | SAAR-IFS-001 |

---

## Context

`InterestFeeService` is responsible for computing daily interest accruals and
posting monthly interest GL journals across all tenant accounts. Two design
decisions were needed:

1. Should the service be merged into `AccountService`, or kept standalone?
2. Should it use schema-per-tenant (like AccountService), or a single-schema
   DB with a `TenantId` column?

---

## Decision 1: Keep InterestFeeService as Standalone (not merged into AccountService)

**Rationale:**
- AccountService is request-scoped (handles account CRUD, freeze/unfreeze,
  maturity, etc.) with an HttpContext-aware tenant resolver.
- InterestFeeService is fundamentally a scheduled, batch-oriented service.
  Merging them would pollute AccountService's simple request model with
  background job concerns (IHostedService, IServiceScopeFactory, timers).
- Separation of concerns: interest accrual is an independent domain function
  that only reads account data; it does not own accounts.
- Deployment independence: InterestFeeService can be restarted, upgraded, or
  scaled separately from AccountService without affecting account operations.

**Rejected alternative:** Merge accrual logic into AccountService as a hosted
service. Rejected because it violates single-responsibility and makes
AccountService harder to test and reason about.

---

## Decision 2: Single-Schema DB with TenantId Column (not schema-per-tenant)

**Rationale:**
- AccountService uses schema-per-tenant with `TenantResolutionMiddleware`
  (JWT → X-Tenant-ID header → "public"). This works because every request
  carries a tenant context.
- InterestFeeService's `DailyAccrualJob` loops over ALL tenants in a single
  goroutine-equivalent. There is no HTTP request context to drive
  `TenantResolutionMiddleware` for its own DB writes.
- Implementing schema-per-tenant for a background store (audit log of accrual
  events) adds significant complexity (schema provisioner, per-tenant
  DbContext scoping inside the job loop) for minimal benefit — the accrual
  data is already segregated by the `TenantId` column.
- The `InterestFees` table is an append-only audit log. Cross-tenant
  queries (e.g., accrual-summary without a tenantId filter) are legitimate
  and useful. Schema-per-tenant would make cross-tenant aggregation impossible
  without dynamic SQL.

**Consequences:**
- `InterestFees` table has an additional `TenantId` column (string, default "public").
- All queries are filtered by `TenantId` where appropriate.
- The service does NOT implement `TenantResolutionMiddleware` or `TenantSchemaProvisioner`.
- EF migrations run normally without schema qualifiers (no `HasDefaultSchema` issue).

**Rejected alternative:** Schema-per-tenant matching AccountService pattern.
Rejected because background jobs have no request context, and cross-tenant
reporting would require dynamic SQL.

---

## Consequences

- `InterestFeeService` remains a standalone microservice on port 5218.
- `AccountService` gains two internal `[AllowAnonymous]` endpoints that
  InterestFeeService calls via HTTP with `X-Tenant-ID` header.
- The `DailyAccrualJob` loops `["public", "ucb_demo", "nbfc_demo"]` and
  sends `X-Tenant-ID` per iteration.
- `docker-compose.yml`: add `interestfeeservice` block on port 5218.
- `nginx.conf`: add `/api/interest-fees` route.
- `start-all.sh`: add InterestFeeService on port 5218.
