# TASK_QUEUE.md — SaaR Core Banking Services

**Last Updated:** 2026-03-30 (session 10)
**Single source of truth for what to do next.**

---

## 1. Current Focus

> Max 3 items — work on these before anything else.

| # | Task | Why Now |
|---|---|---|
| 1 | **Deploy to demobank** — git push → git pull on server → docker compose build useraccessmanagement accountservice frontend → up -d | 5 new screens need to be live for investor demo |
| 2 | **[ARC-GAP-003] Multi-Tenancy** — schema-per-tenant, TenantResolutionMiddleware (SCRUM-17 to SCRUM-23) | Critical: cannot onboard second bank |
| 3 | **[RBI-02] Deposit Account Management** — SB/FD/RD lifecycle (SCRUM-93 to SCRUM-99) | Core banking function; needed to show real deposit products |

### Recently Completed (session 10 — 2026-03-30)
- [x] **Phase 1 — Real JWT Auth** (SCRUM-2, SCRUM-3, SCRUM-4): UserAccessManagementService /api/auth/login, BCrypt seed users (admin/maker/checker), JWT 8h expiry, [Authorize] on users/roles endpoints (`6e98e07`)
- [x] **Phase 2 — Account Management UI** (SCRUM-80): accountService.ts + AccountManagement.tsx — full CRUD + Approve/Close, product type select, maker-checker visual (`774176b`)
- [x] **Phase 3 — Ledger UI** (SCRUM-81): transactionService.ts + TransactionManagement.tsx — Ledger Balances tab, Journal Entries tab, Post Journal Entry dialog with debit=credit balance validation (`eb02268`)
- [x] **Phase 4 — User & Role Management UI** (SCRUM-82): userService.ts + UserManagement.tsx — Users/Roles tabs, Admin=red/Maker=blue/Checker=amber chips, New User/Role dialogs (`fbbaafd`)
- [x] **Phase 5 — Loan Management List** (SCRUM-83): LoanManagement.tsx shows application list; GET /api/LoanOrigination endpoint added to LoanService; status chips for all states (`c8954e1`)

### Recently Completed (session 9 — 2026-03-30)
- [x] **RBI functional requirements Jira backlog**: 13 epics + 61 stories (SCRUM-85 to SCRUM-159) covering all RBI/IDRBT functional requirements
- [x] SCRUM-79 (CustomerService UI) — validate endpoints fixed, marked Done in Jira (e1b629c)
- [x] Branch cleanup: production fast-forwarded to HEAD; stale branches deleted; v0.1.0 tag created

### Recently Completed (session 8)
- [x] Architecture documentation: 12 ADRs + 14 component docs committed (4dcfd14)
- [x] **Architecture gap Jira backlog: 12 epics + 72 stories (SCRUM-1 to SCRUM-84)** covering all architecture gaps

---

## 2. High Priority Tasks

> Core banking flow and demo-blocking items.

### Git & DevOps
- [x] Add `.gitattributes` (`* text=auto`) — eliminates CRLF warnings on Windows commits

### Frontend — Workflow Timeline (M2 — COMPLETE)
- [x] Add SLA due-date chip to each WorkflowTimeline step ("Due in Xh" / "Overdue Xh")
- [x] Add status colour coding (green=completed, blue=active, red=failed, grey=pending)
- [x] Add retry button on failed steps
- [x] Add expandable notes field on each step (Collapse)

### ExpressionBuilderService (M3 — COMPLETE)
- [x] Seed `EXPR_1755237353842` + 9 more banking rule expressions via `ExpressionSeedService` (runs on startup)
- [x] Add 10 built-in templates to `ExpressionTemplates.tsx`
- [x] Remove hardcoded interest-rate fallback from LoanService (replaced with actionable error)

### TransactionService — Double-entry Ledger (COMPLETE — commit bab9b9c)
- [x] Design journal/posting model: `Journal`, `JournalEntry` (debit/credit, account, amount, currency)
- [x] Implement posting engine with idempotency key
- [x] Add balance read API (LedgerController GET /api/ledger/balance/{code}, GET /api/ledger/balances)
- [x] 16 unit tests on posting correctness (balanced, imbalanced, idempotency, balance accumulation, 3-legged entries)

### CustomerService — KYC Stub (COMPLETE — commit 70e08ec)
- [x] Add `KycStatus` enum and field to Customer entity
- [x] Implement PAN format validation (regex) endpoint
- [x] Add Aadhaar format stub (offline XML upload placeholder — no real external call needed for demo)
- [x] Add maker-checker approval status field (via AccountService approve/close workflow)

### APIGateway
- [ ] Add JWT validation middleware (validate token against shared secret)
- [ ] Add basic route table: forward `/api/customers/*` → CustomerService, `/api/accounts/*` → AccountService, etc.
- [ ] Add request logging (correlation ID header)

---

## 3. Medium Priority Tasks

> Enhancements needed for milestone M2–M6 and Year 1 Q1/Q2 roadmap.

### Workflow Orchestration (M2 / Q1 2026 — overdue)
- [ ] Define workflow state machine model: `WorkflowInstance`, `WorkflowStep`, `WorkflowTransition`
- [ ] Implement persisted state (EF Core + PostgreSQL)
- [ ] Add SLA timer fields (due date, escalation threshold)
- [ ] Expose REST API to advance workflow state
- [ ] Wire frontend workflow timeline to real API (replace mock data)

### Expression Library (M3)
- [ ] Build expression template library with 5–10 pre-built banking rules (interest rate selector, eligibility tiers, fee schedule)
- [ ] Remove hardcoded fallback expression logic from LoanService demo mode
- [ ] Add expression versioning (version field + deprecation flag)

### Form Builder (M4)
- [ ] Build drag-and-drop form builder UI in React (fields, labels, validation rules)
- [ ] Persist form schemas to DynamicFieldsSchemaService via API
- [ ] Add form preview mode

### AccountService v1 (Q1 2026 — overdue)
- [ ] Add account lifecycle states: PENDING → ACTIVE → FROZEN → CLOSED
- [ ] Implement freeze/unfreeze endpoint
- [ ] Add basic account statement (list transactions by date range)
- [ ] Add joint account support (multiple customer IDs)
- [ ] Add nominee field to account model

### InterestFeeService — Daily Accrual (Q1 2026 — overdue)
- [ ] Implement daily accrual calculation (balance × rate × 1/365)
- [ ] Add monthly posting trigger (apply accrued interest to account)
- [ ] Add TDS computation hook (placeholder)
- [ ] Write deterministic test vectors (backdated runs, idempotent reruns)

### ReportingMIS v1 (Q1 2026 — overdue)
- [ ] Implement daily transaction summary report endpoint
- [ ] Implement audit export (date-range CSV/JSON)
- [ ] Wire React reports feature module to real API

### Compliance (M5)
- [ ] Add KFS (Key Facts Statement) generation endpoint in LoanService
- [ ] Add consent capture model to LoanApplication
- [ ] Add PAN validation API (format + checksum)
- [ ] Add RBI reporting skeleton (account counts, outstanding loan amounts)

---

## 4. Low Priority Tasks

> Nice-to-have, non-blocking improvements.

### Frontend Polish (M7)
- [ ] Add dark mode toggle to React UI theme
- [ ] Add skeleton loaders for all data-heavy pages (accounts list, transaction history)
- [ ] Add toast notification system for success/error feedback
- [ ] Audit and fix all TODO comments in React source

### Performance & Observability (M8)
- [ ] Add OpenTelemetry tracing to ExpressionBuilderService and LoanService
- [ ] Add Prometheus metrics endpoint (`/metrics`) to each service
- [ ] Run K6 load test baseline: target <200ms p95 reads, <500ms p95 postings
- [ ] Add Redis cache layer to ExpressionBuilderService (compiled expression cache)

### Angular Frontend (frontend-ui)
- [ ] Audit Angular frontend vs React — decide if it's being maintained or deprecated
- [ ] If deprecated: add note to README and move to `archived/` branch

### Documentation
- [ ] Add `README.md` to each microservice directory (what it does, endpoints, how to run)
- [ ] Add `PORTS.md` update to canonical port list
- [ ] Add `CONTRIBUTING.md` with branch naming and PR conventions

---

## 5. Blockers / Dependencies

| Blocker | What It Blocks | Resolution Needed |
|---|---|---|
| OpenAI API key not in repo | AI expression/form generation in ExpressionBuilderService | Set `OpenAI:ApiKey` in `appsettings.Development.json` locally; use secrets manager for prod |
| PostgreSQL instance required | ExpressionBuilderService, LoanService (for real data persistence) | Run via Docker (`docker-compose up postgres`) or use in-memory fallback for demo |
| No inter-service auth | APIGateway routing to downstream services | JWT secret must be shared across services; needs config decision |
| Expression seed data | Loan eligibility demo (`EXPR_1755237353842` must exist) | Add database seeder or migration-time seed |
| No `LoanService → TransactionService` link | End-to-end loan disbursement flow | TransactionService posting engine must be built first |
| `.gitignore` CRLF issue | Clean commits on Windows | Add `.gitattributes` with `* text=auto` |

---

## 6. Recently Completed

| Task | Commit | Date |
|---|---|---|
| Phase 1: Real JWT auth — UserAccessManagementService /api/auth/login, BCrypt seed users, JWT 8h (SCRUM-2,3,4) | `6e98e07` | 2026-03-30 |
| Phase 2: Account Management UI — accountService.ts + AccountManagement.tsx CRUD + Approve/Close (SCRUM-80) | `774176b` | 2026-03-30 |
| Phase 3: Ledger UI — transactionService.ts + TransactionManagement.tsx balances + journal entries (SCRUM-81) | `eb02268` | 2026-03-30 |
| Phase 4: User & Role Management UI — userService.ts + UserManagement.tsx Admin/Maker/Checker (SCRUM-82) | `fbbaafd` | 2026-03-30 |
| Phase 5: Loan Management list — LoanManagement.tsx + GET /api/LoanOrigination endpoint (SCRUM-83) | `c8954e1` | 2026-03-30 |
| docker-compose.yml + nginx reverse proxy for demobank.saaritsolutions.com (HTTPS, Hetzner) | `70e08ec` | 2026-03-28 |
| Dockerfiles: ExpressionBuilderService, WorkflowOrchestration, DynamicFields, CustomerService, TransactionService, frontend-react | `70e08ec` | 2026-03-28 |
| CORS env-var injection in LoanService, WorkflowOrchestration, DynamicFields, AccountService | `70e08ec` | 2026-03-28 |
| LoanService WorkflowBaseUrl + DynamicFormsBaseUrl made configurable (Docker DNS) | `70e08ec` | 2026-03-28 |
| Frontend REACT_APP_API_BASE_URL port 5002→5004 bug fixed | `70e08ec` | 2026-03-28 |
| CustomerService KYC stub: KycStatus enum, PanValidationService, validate/pan + validate/aadhaar endpoints, EF migration | `70e08ec` | 2026-03-28 |
| M3: ExpressionSeedService — 10 banking rules seeded on startup (incl. EXPR_1755237353842) | `9e81653` | 2026-03-26 |
| M3: ExpressionTemplates.tsx expanded to 10 built-in templates | `9e81653` | 2026-03-26 |
| M4-part1: TransactionService double-entry ledger, posting engine, 16 unit tests | `bab9b9c` | 2026-03-26 |
| M3: LoanService silent interest-rate fallback replaced with actionable error | `9e81653` | 2026-03-26 |
| M2: WorkflowTimeline — status icons, SLA chips, retry button, expandable notes | `8b0fc90` | 2026-03-26 |
| M2: LoanOrigination updated to push rich WorkflowEvent objects with timestamps + SLA | `8b0fc90` | 2026-03-26 |
| Add `.gitattributes` (`* text=auto`) | `8b0fc90` | 2026-03-26 |
| M1: EMI estimate in right-rail (formula: P×r×(1+r)^n / ((1+r)^n−1)) | `e0d20c4` | 2026-03-26 |
| M1: Working file upload in Documents card (PDF/JPG/PNG, list + remove) | `e0d20c4` | 2026-03-26 |
| M1: Input masking for PAN / Aadhaar / mobile in SchemaForm (no library) | `e0d20c4` | 2026-03-26 |
| Add cypress/screenshots and cypress/videos to .gitignore | `6751022` | 2026-03-26 |
| Git index restored; PROJECT_STATE / TASK_QUEUE / DECISIONS_LOG created | `012dace` | 2026-03-26 |
| OpenAI integration in ExpressionBuilderService (AI controllers) | — | ~Sep 2025 |
| Expression AI frontend integration (React UI wired to AI endpoints) | — | ~Sep 2025 |
| Dynamic form field improvements | — | ~Sep 2025 |
| Cypress E2E test suite for loan eligibility + expression builder | — | ~Sep 2025 |
| Fixed ports, CORS, Swagger enabled for all services | — | Earlier 2025 |
| Expression compat route `/api/Expressions/execute` integrated with LoanService | — | Earlier 2025 |
| DynamicFieldsSchemaService 7-field demo schema | — | Earlier 2025 |
| WorkflowClient: camelCase payloads, cancellation tokens, error logging | — | Earlier 2025 |
