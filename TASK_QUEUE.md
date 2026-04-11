# TASK_QUEUE.md — SaaR Core Banking Services

**Last Updated:** 2026-04-11 (session 28 — Hetzner deploy + ledger migration fix)
**Single source of truth for what to do next.**

---

## 1. Current Focus

> Max 3 items — work on these before anything else.

| # | Task | Why Now |
|---|---|---|
| 1 | **Run smoke + regression suites** — `scripts\run-smoke.bat` then `scripts\run-regression.bat` from cmd.exe | Validate all session 22–28 changes |
| 2 | **E2E smoke**: log in → disburse a loan → click GL Journal # chip → verify JournalDetailDialog | Confirm full journal drill-down works end-to-end on live site |

### Recently Completed (session 28 — 2026-04-11)
- [x] **Hetzner deploy** — transactionservice + frontend rebuilt. All 11 containers healthy.
- [x] **TransactionService ledger migration fix** — `AddLedgerTables` (20260411175347) creates Journals, JournalEntries, ChartOfAccounts, LedgerBalances tables that were in DbContext since bab9b9c but had NO migration. On restart: 3 schemas provisioned + 19 CoA entries seeded. Journal by-number endpoint returns 404 (tables exist). Commit `474f7ee`.
- [x] **CI confirmed green** — Backend CI/CD #47, CI #91, Full Stack CI/CD #74 all pass for `6c5ee9c`.

### Recently Completed (session 27 — 2026-04-11)
- [x] **CI/CD "Backend Tests" job fully green — 78/78 passing, 0 failing** (was 74 pass, 4 fail)
  - NU1605: bumped `Microsoft.EntityFrameworkCore.InMemory` 8.0.0→9.0.6 in `AccountService.Tests.csproj`
  - CS7036 constructor drift: updated `GetController()` factories in 3 AccountService.Tests files; added `NoOpTransactionService`+`NoOpWorkflowClient` stubs in `EligibilityAndWorkflowTests.cs`
  - EMI rounding: `StandardEmi` `.Within(20m)`, `TotalPayment_EqualsEmiTimesMonths` `.Within(5m)` tolerances
  - Income threshold: `PreValidate_returns_MANUAL_REVIEW_and_null_rate_when_borderline` → `MonthlyIncome 12000→15000`
  - StubHttpMessageHandler: added `updatedAt`+`returnType` to GET response; added `/api/expression-engine/execute` URL match; added interest-rate expression path (returns decimal 10.5)

### Recently Completed (session 26 — 2026-04-11)
- [x] **Ledger UI — journal drill-down** — `GET /api/journal/by-number/{number}` in TransactionService. `getJournalByNumber()` in transactionService.ts. `JournalDetailDialog` shared component at `components/dialogs/`. `disbursalJournalNumber` chip in LoanDetail.tsx clickable. `maturityJournalNumber` PaymentsIcon in AccountManagement.tsx clickable.

### Recently Completed (session 25 — 2026-04-11)
- [x] **Hetzner deploy** — rebuilt expressionbuilder, loanservice, accountservice, workfloworchestration, frontend. docker-compose.yml: Services__TransactionBaseUrl wired + depends_on for both. All 11 containers healthy. Commit b134f74.
- [x] **Cypress smoke suite** (`cypress/e2e/smoke.cy.ts`) — ~30 tests covering 8 UI modules + API health checks. All APIs cy.intercepted. Run: `scripts\run-smoke.bat`
- [x] **Cypress regression suite** (`cypress/e2e/regression/`) — 8 spec files (~60 tests): auth, dashboard, accounts (freeze/unfreeze/maturity/premature), loans (disbursal journal), transactions (post-entry), customers, users, expression builder.
- [x] **support/e2e.ts** — cy.loginViaApi() (real JWT from UAM) + cy.stubApis() commands.
- [x] **run-smoke.bat + run-regression.bat** — headless cmd.exe runners for both suites.

### Recently Completed (session 24 — 2026-04-10)
- [x] **SCRUM-228: Disbursal journal number** — `LoanApplication.DisbursalJournalNumber` field + EF migration; saved in DISBURSE action; green GL Journal # chip in LoanDetail.tsx
- [x] **SCRUM-230: Maturity journal number** — `Account.MaturityJournalNumber` field + EF migration; saved in `/mature` (both paths) + `/premature-close`; PaymentsIcon tooltip in AccountManagement
- [x] **SCRUM-229: Account freeze/unfreeze** — `POST /api/account/{id}/freeze` + `/unfreeze` endpoints; AcUnitIcon + LockOpenIcon buttons in AccountManagement.tsx; Close Account hidden for Frozen
- 0 TypeScript errors; AccountService 0 C# errors

### Recently Completed (session 23 — 2026-04-10)
- [x] **FD/RD lifecycle UI** — accountService.ts, AccountManagement.tsx, Dashboard.tsx
  - `accountService.ts`: `mature(id)`, `prematureClose(id)`, `upcomingMaturities(days)` + 3 new interfaces
  - `AccountManagement.tsx`: "Process Maturity" + "Premature Closure" buttons on Active FD/RD rows; `Mature` status chip + filter tab; success alert with journal/payout details
  - `Dashboard.tsx`: "Upcoming Maturities" full-width widget — live API, skeleton loader, days-left urgency chips
  - 0 TypeScript errors

### Recently Completed (session 22 — 2026-04-10)
- [x] **SCRUM-223/224/225: FD/RD deposit lifecycle endpoints**
  - `GET /api/account/upcoming-maturities?days=30` — deposits maturing in window, projected interest
  - `POST /api/account/{id}/mature` — EXPR_MATURITY_INTEREST_CALC + DR 2010+5010 / CR 1010 + AutoRenewal
  - `POST /api/account/{id}/premature-close` — EXPR_PREMATURE_CLOSURE_PENALTY_CALC + journal + close
  - 2 expression seeds: EXPR_MATURITY_INTEREST_CALC (#15), EXPR_PREMATURE_CLOSURE_PENALTY_CALC (#16)
  - AccountService added to start-all.sh on port 5217; TransactionBaseUrl wired
- [x] **SCRUM-187: LoanService → TransactionService disbursal wiring**
  - `EXPR_GL_MAPPING_LOAN_DISBURSAL` seeded (15th expression — GL codes per product type, tenant-configurable)
  - `ITransactionServiceClient` / `TransactionServiceClient` created in LoanService/Services/
  - `LoanApplicationsController` DISBURSE: evaluates expression → posts DR 1020 / CR 1010 journal → fires WF step
  - `TransactionService` added to start-all.sh on port 5005; `TransactionServiceDb` created; appsettings updated
  - Zero C# compilation errors across all modified services

### Recently Completed (session 20 — 2026-04-08)
- [x] **Cypress config fix** — deleted stale `cypress.config.js` (baseUrl=localhost:3001, supportFile=false) that was overriding `cypress.config.ts`; all Cypress tests now connect to the correct port 3002 with `cy.loginAsDemo()` available. Commit 8a6fa65.
- [x] **Workflow configuration via UI** — explained and confirmed that `EXPR_ROUTING_LOAN_ORIGINATION` controls loan workflow steps via SimpleExpressionBuilder at `/expressions/simple`.
- [x] **UI-driven Cypress tests created** — `smoke-check.cy.ts` (3 connectivity checks) + `loan-workflow-ui.cy.ts` (2 tests: reduce to 2-step, restore 3-step) using `cy.on('window:alert')` pattern.
- [x] **Node.js fallback tests** — `scripts/test-workflow-config.mjs` runs 12/12 API-level assertions (no browser needed).

### Recently Completed (session 19 — 2026-04-07)
- [x] **WorkflowOrchestrationService real persistence** — EF Core 9 + PostgreSQL. WorkflowInstanceEntity, multi-tenancy, Load/Save wired, EF migration InitialCreate (audited). Program.cs: JWT + DbContext + tenant provisioner.
- [x] **ExpressionBuilderService routing seeds** — 4 new expressions: EXPR_ROUTING_LOAN_ORIGINATION, EXPR_APPROVAL_LOAN_ORIGINATION, EXPR_ROUTING_ACCOUNT_OPENING, EXPR_APPROVAL_ACCOUNT_OPENING. Total 14 seeded.
- [x] **LoanService wired to real workflow** — UseLocalWorkflowOrchestrator→false; DISBURSE fires ProcessStepAsync.
- [x] **AccountService full wiring** — EF8→9.0.6, Npgsql8→9.0.4; TenantSchemaProvisioner simplified; 3 service clients; 7 deposit fields; EF migration AddDepositFields; CreateAccount FD/RD + workflow; ApproveAccount workflow; eligible-rate endpoint.
- [x] **Jira tickets** — jira-create-workflow-tickets.js created + run: 5 epics + 31 stories (SCRUM-190–225). All 4 services build 0 errors.

### Recently Completed (session 18 — 2026-04-06)
- [x] **Test quality initiative — SCRUM-188 + testing** (commit `1a138e1`)
  - `docs/TEST_CASES_LOAN_ORIGINATION.md`: 70+ BDD test cases across 12 categories for Jira
  - `LoanService.Tests/EligibilityAndWorkflowTests.cs`: 40 NUnit tests (EMI, FOIR, LTV, eligibility, list, state machine); 0 build errors
  - `frontend-react/cypress/e2e/loan-management.cy.ts`: 25+ Cypress tests across 5 suites
  - `LoanDemoDataSeeder`: 3 new apps (DRAFT/APPROVED/INFO_REQUESTED) — 8 apps per tenant total
  - Pushed to GitHub; Hetzner SSH unreachable — pending redeploy of loanservice container

### Recently Completed (session 17 cont. — 2026-04-06)
- [x] **Repayment Schedule in LoanDetail** — amortization table added to loan detail page
  - `computeAmortization()` helper: EMI formula P×r×(1+r)^n/((1+r)^n−1), month-by-month breakdown
  - Summary KPIs always shown: Monthly EMI, Total Interest, Total Payable, Tenure
  - "Show Month-by-Month" toggle reveals sticky-header scrollable MUI Table
  - Pure frontend — no backend API changes; uses existing loan detail response fields

### Recently Completed (session 17 — 2026-04-06)
- [x] **Loan detail page bug fixed** — "Failed to load application" error resolved (commit d6bb3e1)
  - Root cause: `AddControllers()` had no JSON options → System.Text.Json hit circular reference mid-stream
    → 200 OK with 14KB truncated JSON (53KB expected); axios threw → frontend showed error
  - Fix: `.AddJsonOptions(o => o.JsonSerializerOptions.ReferenceHandler = IgnoreCycles)` in LoanService Program.cs
  - Loan detail now returns complete 53KB JSON; all 5 loan apps clickable on demobank.saaritsolutions.com
- [x] **Demo data seeder deployed to Hetzner** (SCRUM-188) — all 3 tenants fully seeded (5 apps × 3 = 15 total)
  - Bug 1: DateTimeKind.Utc missing on DateOfBirth fields → Npgsql rejected Unspecified timestamptz (commit 8c90ee1)
  - Bug 2: EF Core batched parent+children in one SaveChangesAsync → FK violation; split into two saves (commit 7dd80a7)
  - Bug 3: EF Core migration created cross-schema FKs (ucb_demo/nbfc_demo LoanApprovalActions → public.LoanApplications);
    fixed in Postgres via ALTER TABLE DROP/ADD CONSTRAINT with schema-qualified REFERENCES
  - Final state: 5 apps + 19 actions + 32 docs per tenant, all 3 schemas confirmed via pg_stat_user_tables

### Recently Completed (session 15 — 2026-04-06)
- [x] **E2E Loan Origination** (SCRUM-164 to SCRUM-185):
  - LoanApplication extended (50+ fields), LoanProduct (5), LoanDocument, LoanApprovalAction entities + EF migration
  - LoanProductController, LoanEligibilityController (FOIR/LTV/EMI), LoanApplicationsController (approval state machine)
  - 6-step real banking form (Personal/KYC, Employment/Income, Loan Parameters, Co-Applicant, Documents, Review)
  - LoanManagement: 2-tab polished list (All + Pending Approval), filters, CSV export, CIBIL/FOIR columns
  - LoanDetail: full detail page with Timeline, action buttons, document checklist
  - Commits: `a4def55`, `a192e92`; deployed to Hetzner

### Recently Completed (session 14 cont. — 2026-04-05)
- [x] **UI redesign deployed to Hetzner** — all 11 containers healthy, demobank.saaritsolutions.com LIVE with new design
  - Fix: Dockerfile `npm ci` → `npm install --legacy-peer-deps` (npm 11 lock file vs Docker npm 10 mismatch)
  - Commits: `444db60` (redesign), `b257255` (Dockerfile fix)

### Recently Completed (session 14 — 2026-04-05)
- [x] **World-class UI redesign** — Stripe/Linear aesthetic across all screens
  - Theme: Inter font, #2563EB blue, slate neutrals, shadow system, dark mode (theme.ts full rewrite)
  - Sidebar: permanent 260/68px, section labels, left-border active state, collapse toggle (Sidebar.tsx rewrite)
  - Header: white AppBar, search bar, tenant chip, notification panel, avatar+chevron (Header.tsx rewrite)
  - Layout: permanent sidebar on desktop with smooth content shift (Layout.tsx updated)
  - Dashboard: KPI StatCards, Recharts AreaChart + BarChart, timeline, quick actions (Dashboard.tsx rewrite)
  - Account Management: filter bar, status chips (StatusChip), skeleton loaders, EmptyState (AccountManagement.tsx polish)
  - Loan Origination: custom step indicator, section headers, EMI panel, document upload (LoanOrigination.tsx polish)
  - Common: StatCard, PageHeader, EmptyState new components
  - Cross-cutting: Inter body font, thin scrollbar, page fade-in, recharts styles (index.css)
  - recharts@2.15.3 added, installed, TS errors fixed

### Recently Completed (session 13 — 2026-04-04)
- [x] **Multi-tenancy deployed to Hetzner** — All 11 containers LIVE, 3 schemas per service
  - Root cause fixed: EF Core 8 NpgsqlMigrator doesn't call CreateIfNotExistsAsync before GetAppliedMigrationsAsync (unlike EF9); fix: pre-create __EFMigrationsHistory with search_path=tenantId
  - Commits: `6ead6b8`, `767c5d4`

### Recently Completed (session 12 — 2026-04-04)
- [x] **Multi-Tenancy (SCRUM-17 to SCRUM-23)** — schema-per-tenant across UAM + 4 services
  - UAM: Tenant table + EF migration, 3 tenants seeded (public/ucb_demo/nbfc_demo), TenantId on User, JWT `tenant_id` claim
  - 4 services: ITenantService, TenantResolutionMiddleware, TenantModelCacheKeyFactory, schema-aware DbContext (HasDefaultSchema), TenantSchemaProvisioner (CREATE SCHEMA + MigrateAsync on startup)
  - Frontend: `resolveTenantName()` in authSlice, `bankName` in Header.tsx
  - Demo users: admin/maker@ucb-demo.com (ucb123), admin/maker@nbfc-demo.com (nbfc123)
  - All 5 services build with 0 errors

### Recently Completed (session 11 — 2026-04-01)
- [x] **Deployed all 5 new screens to demobank.saaritsolutions.com** — all endpoints smoke-tested green
- [x] **c70dbd7** — AccountService schema rebuild (EnsureDeleted+EnsureCreated on stale schema); 6 product types seeded; `ReferenceHandler.IgnoreCycles` in AccountService + UAM
- [x] **af2c648** — LoanService `db.Database.Migrate()` on startup; LoanServiceDb created in Postgres
- [x] nginx `--force-recreate` required (bind-mount nginx.conf needs full container restart, not just `nginx -s reload`)

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
| Test quality initiative — TEST_CASES_LOAN_ORIGINATION.md, NUnit tests, Cypress E2E, seeder 8 apps (SCRUM-188+) | `1a138e1` | 2026-04-06 |
| E2E Loan Origination — models, APIs, 6-step form, approval dashboard (SCRUM-164–185) | `a4def55` `a192e92` | 2026-04-06 |
| Multi-tenancy deployed LIVE — 11 containers, 3 schemas each; EF Core 8 __EFMigrationsHistory fix | `6ead6b8` `767c5d4` | 2026-04-04 |
| Deployed all 5 screens LIVE; 3 bug fixes (JSON cycle, schema rebuild, LoanService migrate) | `c70dbd7` `af2c648` | 2026-04-01 |
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
