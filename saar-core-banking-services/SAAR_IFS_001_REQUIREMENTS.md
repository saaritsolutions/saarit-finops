# SAAR-IFS-001 — InterestFeeService: Daily Accrual + Monthly Posting

| Field | Value |
|---|---|
| **Ticket ID** | SAAR-IFS-001 |
| **Status** | In Progress |
| **Session** | 48 |
| **Date** | 2026-04-26 |
| **Service** | InterestFeeService |
| **Type** | Feature — Service Completion |
| **Priority** | High |
| **Assigned To** | Claude Code (saaritsolutions) |

---

## Background

`InterestFeeService` exists as a stub with basic CRUD scaffolding and a
`StubAccountServiceClient` that returns hardcoded `Balance = 1000`. It has
no Dockerfile, is not in `docker-compose.yml`, not in `nginx.conf`, and not
in `start-all.sh`. The `AccountService.Account` model already has the fields
needed: `AccruedInterest`, `AccruedTDS`, `IsTDSExempt`, `InterestRate`.

This ticket completes the service with real account data, daily accrual,
monthly GL posting, TDS computation, and frontend surfaces.

---

## Functional Requirements

### FR-1: Daily Interest Accrual
- The service SHALL calculate daily interest for all Active Savings, FD, RD,
  and Current accounts that have a non-null, non-zero `InterestRate`.
- Formula: `dailyInterest = Round(balance × rate / 100 / 365, 4)`
- For FD/RD: `balance` = principal (account.Balance).
- Accrual SHALL be idempotent: if a `DailyAccrual` record already exists for
  the same `(AccountId, TenantId, CalculationDate)`, the accrual SHALL be
  skipped (no duplicate row inserted).
- The job SHALL run once on service startup and every 24 hours thereafter via
  `System.Threading.Timer`.

**Acceptance criteria:**
- [ ] Starting the service produces a log: "DailyAccrualJob started. Running initial accrual..."
- [ ] `POST /api/interest-fees/run-daily-accrual` triggers accrual manually and returns `{ message, date }`.
- [ ] Running the endpoint twice on the same day produces exactly one record per account per tenant.

---

### FR-2: Monthly Interest Posting (GL Journal)
- A manual trigger endpoint SHALL sum all `DailyAccrual` records for a given
  calendar period (default: current month) and post a double-entry GL journal
  to TransactionService for each account.
- Journal entries: DR 5010 (Interest Expense) / CR 2010 (Customer Deposits).
- Idempotency key: `"MONTHLY-INTEREST-{accountNumber}-{period:yyyyMM}"`.
- The endpoint SHALL mark posted records (`CalculationType = "MonthlyPosted"`).
- The response SHALL include per-tenant summary: accounts posted, total interest.

**Acceptance criteria:**
- [ ] `POST /api/interest-fees/run-monthly-posting?period=202604` returns `{ tenantsProcessed, accountsPosted, totalInterest, totalTds }`.
- [ ] Re-running for the same period skips already-posted accounts (idempotent).
- [ ] If TransactionService is unreachable, the endpoint logs a warning and continues (fail-open).

---

### FR-3: TDS Computation
- During monthly posting, if total accrued interest for an account exceeds
  ₹5,000 AND `IsTDSExempt = false`, TDS SHALL be computed at 10% of interest.
- TDS deduction journal: DR 2010 (Customer Deposits) / CR 2040 (Other Liabilities — TDS Payable).
- Idempotency key: `"TDS-{accountNumber}-{period:yyyyMM}"`.
- `TdsAmount` SHALL be stored in the `InterestFee` record for the posting.

**Acceptance criteria:**
- [ ] Monthly interest ₹6,000 + IsTDSExempt=false → TDS = ₹600 (10%).
- [ ] Monthly interest ₹6,000 + IsTDSExempt=true → TDS = ₹0.
- [ ] Monthly interest ₹4,900 → TDS = ₹0 (below ₹5,000 threshold).

---

### FR-4: AccountService Integration
- InterestFeeService SHALL call AccountService via HTTP to fetch interest-eligible
  accounts and to update `AccruedInterest` on each account after accrual.
- Two new `[AllowAnonymous]` endpoints in AccountController:
  - `GET /api/account/interest-eligible` — returns Active SB/FD/RD/Current accounts with InterestRate > 0.
  - `PATCH /api/account/{id}/accrued-interest` — increments `AccruedInterest` by the supplied delta.
- InterestFeeService SHALL send `X-Tenant-ID` header to AccountService
  (leveraging `TenantResolutionMiddleware`'s header fallback).

**Acceptance criteria:**
- [ ] `GET /api/account/interest-eligible` with `X-Tenant-ID: public` header returns Active accounts with `InterestRate > 0`.
- [ ] `PATCH /api/account/{id}/accrued-interest` with body `9.5890` increments `AccruedInterest` by that amount.

---

### FR-5: Accrual Summary Query
- `GET /api/interest-fees/accrual-summary` SHALL return per-day aggregated
  accrual totals for use in the Reports frontend.
- Query params: `tenantId` (optional), `from` (optional, default: 30 days ago), `to` (optional, default: today).
- Response: array of `{ date, totalInterest, accountCount, tenantId }`.

**Acceptance criteria:**
- [ ] Returns empty array when no records exist.
- [ ] Returns grouped per-day totals when records exist.

---

### FR-6: Multi-Tenant Support
- The `DailyAccrualJob` SHALL loop over tenants `["public", "ucb_demo", "nbfc_demo"]`
  and send the appropriate `X-Tenant-ID` header to AccountService for each.
- The `InterestFees` table SHALL use a `TenantId` column (single-schema design)
  since background jobs have no request context.
- If a tenant fails (e.g., AccountService unreachable), the job SHALL log a
  warning and continue to the next tenant (fail-open).

**Acceptance criteria:**
- [ ] Accrual summary can be filtered by `tenantId`.
- [ ] A failure for `ucb_demo` does not prevent `nbfc_demo` from being processed.

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Daily accrual is idempotent — re-running for the same date produces no duplicates. |
| NFR-2 | Fail-open on downstream errors — log warning, skip tenant/account, never throw to host. |
| NFR-3 | At least 5 NUnit tests covering: SB daily calc, FD daily calc, idempotency, TDS applied, TDS exempt. |
| NFR-4 | Service MUST build with 0 errors (`dotnet build InterestFeeService.csproj`). |
| NFR-5 | Service MUST auto-migrate its DB on startup (`db.Database.Migrate()`). |

---

## Out of Scope

- Schema-per-tenant for InterestFeeService (single-schema with TenantId column is sufficient)
- Real cron/Quartz scheduling (System.Threading.Timer is sufficient for demo)
- Interest calculation for Current Accounts (excluded from expression engine rates)
- SWIFT/NACH disbursement of interest (GL journal credit is sufficient)
- Backdated accrual (only forward from service startup date)
- Interest rate changes mid-period (use current rate on record)

---

## Test Plan

| # | Test | Type | Tool |
|---|---|---|---|
| T-1 | SB account daily interest = Round(100000 × 3.5/100/365, 4) = 9.5890 | Unit | NUnit |
| T-2 | FD account daily interest = Round(500000 × 8/100/365, 4) = 109.5890 | Unit | NUnit |
| T-3 | Running accrual twice on same date produces 1 record (idempotency) | Unit | NUnit |
| T-4 | Monthly interest > ₹5000 + IsTDSExempt=false → TDS = 10% of interest | Unit | NUnit |
| T-5 | Monthly interest > ₹5000 + IsTDSExempt=true → TDS = ₹0 | Unit | NUnit |
| T-6 | Reports page Deposit Interest tab exists and is clickable | E2E | Cypress |
| T-7 | Accrual summary chart renders with stub data | E2E | Cypress |
| T-8 | "Run Daily Accrual" button is visible | E2E | Cypress |
| T-9 | Account Management shows AccruedInterest badge for Active SB account | E2E | Cypress |
| T-10 | `/api/interest-fees/accrual-summary` stub returns correct data shape | E2E | Cypress |
