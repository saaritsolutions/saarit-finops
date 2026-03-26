# TASK_QUEUE.md — SaaR Core Banking Services

**Last Updated:** 2026-03-26
**Single source of truth for what to do next.**

---

## 1. Current Focus

> Max 3 items — work on these before anything else.

| # | Task | Why Now |
|---|---|---|
| 1 | **Commit the restored git state** | Git index was cleared; 171 files are staged but uncommitted. All work since Sep 2025 is at risk. |
| 2 | **Complete M1: Loan Wizard — file upload + right-rail summary** | Active milestone. Directly unblocks investor demo. |
| 3 | **Add `cypress/screenshots/` to root `.gitignore`** | Test artifacts were previously committed; needs a one-line fix before next commit. |

---

## 2. High Priority Tasks

> Core banking flow and demo-blocking items.

### Git & DevOps
- [ ] Add `.gitattributes` to normalize LF/CRLF across platforms (eliminates CRLF warnings on Windows)
- [ ] Verify `.gitignore` covers `cypress/screenshots/` and `cypress/videos/`

### Frontend — Loan Wizard (M1)
- [ ] Implement file upload component in Loan Wizard step (document attach)
- [ ] Add right-rail summary panel (loan amount, rate, EMI estimate) visible across all 5 steps
- [ ] Apply input masking to PAN, Aadhaar, phone number fields
- [ ] Wire step 5 (review + submit) to call LoanService eligibility API

### ExpressionBuilderService
- [ ] Confirm active expression `EXPR_1755237353842` exists in the dev PostgreSQL instance (add seed script if not)
- [ ] Add expression seed/migration script so demos work from a clean DB without manual setup

### TransactionService — Double-entry Ledger (highest-impact missing piece)
- [ ] Design journal/posting model: `Journal`, `JournalEntry` (debit/credit, account, amount, currency)
- [ ] Implement posting engine with idempotency key
- [ ] Add balance read API (current + available)
- [ ] Write 50+ unit tests on posting correctness

### CustomerService — KYC Stub
- [ ] Add `KycStatus` enum and field to Customer entity
- [ ] Implement PAN format validation (regex) endpoint
- [ ] Add Aadhaar format stub (offline XML upload placeholder — no real external call needed for demo)
- [ ] Add maker-checker approval status field

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

| Task | Completed |
|---|---|
| OpenAI integration in ExpressionBuilderService (AI controllers) | ~Sep 2025 |
| Expression AI frontend integration (React UI wired to AI endpoints) | ~Sep 2025 |
| Dynamic form field improvements | ~Sep 2025 |
| Cypress E2E test suite for loan eligibility + expression builder | ~Sep 2025 |
| Fixed ports, CORS, Swagger enabled for all services | Earlier 2025 |
| Expression compat route `/api/Expressions/execute` integrated with LoanService | Earlier 2025 |
| DynamicFieldsSchemaService 7-field demo schema | Earlier 2025 |
| WorkflowClient: camelCase payloads, cancellation tokens, error logging | Earlier 2025 |
| Strategic analysis docs added (EXECUTION_ROADMAP, VALUATION, etc.) | Sep 27, 2025 |
| Git index restored (all 905 files re-staged after index clear) | 2026-03-26 |
