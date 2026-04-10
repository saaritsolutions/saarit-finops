# Project Context and Milestones

This file tracks goals, decisions, and incremental progress for the investor-ready demo of SaaR Core Banking Services.

## Goals
- Stable local dev with fixed ports, CORS, and Swagger enabled for all services.
- Seamless loan origination demo: dynamic forms, expressions-driven eligibility, workflow timeline.
- Admin UX for expressions, workflow configs, and schema.
- RBI-friendly surfaces: consent, KFS, disclosures, audit.

## Services and Ports
- ExpressionBuilderService: 5004
- TransactionService: 5005
- AccountService: 5217
- WorkflowOrchestrationService: 5012
- DynamicFieldsSchemaService: 5013
- LoanService: 5130

## Environment
- Development environment enforced by runner scripts for demos.
- FeatureFlags: EnableExpressions=true in Development; default may differ.

## Completed
- Fixed ports and CORS; Swagger enabled.
- Runner scripts kill conflicting ports and launch all services in watch mode.
- Expression compat route /api/Expressions/execute; integrated with LoanService.
- SimpleExpressionBuilder edit flow wired (GET/PUT) and working.
- DynamicFieldsSchemaService returns a complete demo schema (7 fields).
- WorkflowClient: camelCase payloads, cancellation tokens, and error logging.
- Git index restored (905 tracked files re-staged after index clear); cypress/screenshots added to .gitignore.
- PROJECT_STATE.md, TASK_QUEUE.md, DECISIONS_LOG.md created as living context documents.
- Milestone M1: Loan Wizard — EMI estimate in right-rail (P×r×(1+r)^n/((1+r)^n−1)), working file upload (PDF/JPG/PNG with list + remove), input masking for PAN / Aadhaar / mobile in SchemaForm (no extra library).
- Milestone M2: WorkflowTimeline polish — status colour-coded icons (completed/active/failed/pending), SLA due-date chips ("Due in Xh" / "Overdue Xh"), retry button on failed steps, expandable notes via Collapse. LoanOrigination now pushes rich WorkflowEvent objects with timestamp and SLA. `.gitattributes` added to normalise CRLF on Windows.
- Milestone M3: Expression Library — ExpressionSeedService seeds 10 banking rule expressions (incl. EXPR_1755237353842 + EXPR_INTEREST_RATE_001) on startup; 10 built-in templates in ExpressionTemplates.tsx; silent interest-rate fallback removed from LoanService (replaced with actionable error).
- TransactionService M4-part1: Double-entry ledger + posting engine — Journal/JournalEntry/ChartOfAccount/LedgerBalance models; PostingEngine (idempotency key, debit==credit validation, atomic LedgerBalance update, InMemory + Postgres support); LedgerService (balance DTOs per account); LedgerSeedService (18 Chart of Accounts entries: 1xxx–5xxx); JournalController + LedgerController; CORS + Swagger + TXN_USE_INMEMORY_DB flag; 16 unit tests. Commit bab9b9c.
- Hosting infrastructure (commit 70e08ec): docker-compose.yml (postgres + 6 services + frontend + nginx), Dockerfiles for all missing services, nginx reverse proxy for demobank.saaritsolutions.com (Hetzner VPS, HTTPS), CORS env-var injection in LoanService/WorkflowOrchestration/DynamicFields/AccountService, LoanService inter-service URLs made configurable, frontend port 5002→5004 bug fixed, CustomerService KYC stub complete (KycStatus enum, PanValidationService, PAN/Aadhaar validate endpoints, EF migration AddKycStatus).

## Completed (continued)
- Hetzner deployment LIVE (session 6, 2026-03-28): All 9 Docker containers running on 89.167.53.218.
  HTTP→HTTPS redirect working, API endpoints responding. Self-signed cert in place.
  Bug fixes along the way: NU1107 NuGet conflict, React OOM (fork-ts-checker disabled in prod build),
  host nginx port conflict, nginx Docker DNS (resolver 127.0.0.11 + set $var proxy_pass).
  Commits: f8cbe2c, 1445a56, a30d319, 6b8fcef, dd938b0.
- Dual-app hosting LIVE (session 7, 2026-03-28): Both https://demobank.saaritsolutions.com (banking demo)
  and https://saaritsolutions.com (AI Consultant) running simultaneously on same VPS.
  nginx joined to both Docker networks (saar-net + ai-consultant_default). Cloudflare DNS proxied
  for both domains. SSL via Cloudflare (Full mode). No certbot needed — Cloudflare issues public cert.
  All smoke tests passing: HTTP 301→HTTPS 200, API 200, AI Consultant 200.

## Completed (continued)
- Architecture documentation (session 8, 2026-03-29): Full ARCHITECTURE/ folder committed (4dcfd14).
  12 ADRs covering all major design decisions (multi-tenancy, service decomposition, tech stack,
  event architecture, parametrization, DB strategy, security, EOD/BOD, reporting, AI pipeline,
  API gateway, deployment). 14 component docs for all services. Every ADR references IDRBT/RBI
  sections for regulatory traceability.

## Completed (continued)
- Architecture Jira backlog (session 9, 2026-03-30): RBI functional requirements — 13 epics + 61 stories
  (SCRUM-85 to SCRUM-159) created. Architecture gaps — 12 epics + 72 stories (SCRUM-1 to SCRUM-84).
  v0.1.0 tag created at d002f20 (base before architecture docs).
- Demo-focused architecture implementation (session 10, 2026-03-30): 5 phases committed:
  - Phase 1 (6e98e07): Real JWT auth — UserAccessManagementService login endpoint + seed users (SCRUM-2,3,4)
  - Phase 2 (774176b): Account Management CRUD UI wired to AccountService (SCRUM-80)
  - Phase 3 (eb02268): Ledger Balances + Journal Entries view wired to TransactionService (SCRUM-81)
  - Phase 4 (fbbaafd): User & Role Management screen (Admin=red, Maker=blue, Checker=amber) (SCRUM-82)
  - Phase 5 (c8954e1): Loan application list + LoanOrigination GET endpoint (SCRUM-83)

## Completed (continued)
- Session 11 deployment (2026-04-01): All 5 new screens deployed and smoke-tested LIVE.
  Bug fixes applied during deployment:
  - c70dbd7: AccountService schema rebuild on startup (EnsureDeleted+EnsureCreated when AccountProductTypes missing); 6 product types seeded; ReferenceHandler.IgnoreCycles in both AccountService and UAM
  - af2c648: LoanService DB migrations on startup (db.Database.Migrate() added to Program.cs); LoanServiceDb created in Postgres
  - nginx --force-recreate needed to pick up new location blocks (reload not sufficient for bind-mount)
  All endpoints verified: Login ✅ /api/users ✅ /api/account ✅ /api/LoanOrigination ✅ /api/ledger/balances ✅ Frontend ✅

## Completed (continued)
- Multi-Tenancy session 12 (2026-04-04): Schema-per-tenant isolation implemented across UAM + 4 core services.
  - UAM: Tenant table, 3 tenants seeded (public/ucb_demo/nbfc_demo), TenantId on User, JWT gains tenant_id claim
  - AccountService, CustomerService, LoanService, TransactionService: TenantResolutionMiddleware, IModelCacheKeyFactory, HasDefaultSchema per request, TenantSchemaProvisioner (CREATE SCHEMA + MigrateAsync on startup)
  - Frontend: resolveTenantName in authSlice, bankName in Header.tsx shows "UCB Cooperative Bank" / "SaaR NBFC" per login
  - Demo users: admin/maker@ucb-demo.com (ucb123), admin/maker@nbfc-demo.com (nbfc123)

## Completed (continued)
- Hetzner multi-tenancy deployment (session 13, 2026-04-04): All 11 containers LIVE with schema-per-tenant.
  - EF Core 8 fix: AccountService TenantSchemaProvisioner now manually creates __EFMigrationsHistory before MigrateAsync (EF8 NpgsqlMigrator doesn't call CreateIfNotExistsAsync first unlike EF9)
  - All 4 core services provisioned 3 schemas each (public, ucb_demo, nbfc_demo) on startup
  - SearchPath=tenantId in connection strings routes unqualified migration DDL to correct tenant schema
  - Commits: 6ead6b8 (SearchPath + ConfigureWarnings + AddAccountServiceSchema migration), 767c5d4 (__EFMigrationsHistory pre-create fix)

## Completed (continued)
- World-class UI redesign (session 14, 2026-04-05): Stripe/Linear aesthetic applied across all screens for investor demo.
  - Theme: Inter font, #2563EB blue, slate neutrals, custom shadow system, dark mode tokens
  - Sidebar: permanent on desktop (260px/68px), section labels, active left-border accent, collapse toggle
  - Header: white AppBar, center search bar, tenant chip with color coding, notification panel, user dropdown
  - Dashboard: KPI StatCards with trend badges, Recharts AreaChart + BarChart, activity timeline, quick actions
  - Account Management: filter bar, status chips, skeleton loaders, EmptyState component
  - Loan Origination: custom step indicator, section headers, styled EMI panel, document upload
  - Common components: StatCard, PageHeader, EmptyState created
  - recharts@2.15.3 added to package.json
  - Commit: 444db60
- UI redesign deployed to Hetzner (session 14 cont., 2026-04-05): World-class UI live at demobank.saaritsolutions.com.
  - Fix: Dockerfile switched from `npm ci` to `npm install --legacy-peer-deps` (npm 11 lock file incompatible with Docker node:20-alpine npm 10)
  - Build time: ~108s webpack compilation; all 11 containers healthy
  - Commit: b257255

## Completed (continued)
- E2E Loan Origination session 15 (2026-04-06): Enterprise-grade loan flow implemented end-to-end.
  - **Jira backlog**: 4 epics (SCRUM-160–163) + 26 stories (SCRUM-164–189) created
  - **Backend models**: LoanApplication extended to 50+ fields, LoanProduct (5 seeded), LoanDocument, LoanApprovalAction
  - **EF migration**: EnhancedLoanOrigination — all new tables + enhanced columns
  - **APIs**: LoanProductController (products + checklist), LoanEligibilityController (FOIR/LTV/EMI/eligibility),
    LoanApplicationsController (paginated list, detail, approval actions, pending-approval queue)
  - **State machine**: DRAFT→SUBMITTED→IN_REVIEW→CREDIT_APPROVED→APPROVED→DISBURSED / REJECTED
  - **Frontend**: 6-step real banking form (Personal/KYC, Employment/Income, Loan Parameters,
    Co-Applicant, Documents, Review & Submit), LoanManagement (2-tab polished list with filters/export),
    LoanDetail (full detail + MUI Lab Timeline + action buttons)
  - Commits: a4def55 (models/APIs/6-step form), a192e92 (list/detail/approval dashboard)

## Completed (continued)
- Loan detail JSON bug fixed + demo seeder fully live (session 17, 2026-04-06):
  - LoanService missing ReferenceHandler.IgnoreCycles → 200 OK with truncated JSON → frontend "Failed to load" error.
    Fixed in Program.cs (commit d6bb3e1). Loan detail now returns complete 53KB response.
  - Demo data seeder: 5 apps × 3 tenants = 15 apps LIVE. Fixed 3 bugs: DateTimeKind.Utc, EF FK ordering,
    cross-schema FK constraints in Postgres (ucb_demo/nbfc_demo). Commits 8c90ee1, 7dd80a7.
  - Fixed DateTimeKind.Utc on all DateOfBirth fields (Npgsql rejects Unspecified for timestamptz)
  - Fixed EF Core insert ordering: save LoanApplication first, then docs/actions (FK satisfaction)
  - Fixed cross-schema FK bug in Postgres: ucb_demo/nbfc_demo LoanApprovalActions + LoanDocuments FKs
    were referencing public.LoanApplications instead of their own schema — corrected via ALTER TABLE
  - Commits: 8c90ee1 (DateTimeKind fix), 7dd80a7 (FK ordering fix)

## Completed (continued)
- Repayment Schedule in LoanDetail (session 17 cont., 2026-04-06):
  - Pure frontend amortization table added to LoanDetail.tsx
  - EMI formula: P × r × (1+r)^n / ((1+r)^n − 1); monthly breakdown: opening balance, EMI, principal, interest, closing balance
  - Summary KPIs: Monthly EMI, Total Interest, Total Payable, Tenure — always visible
  - "Show Month-by-Month" toggle reveals sticky-header scrollable table (maxHeight 420px)
  - Uses sanctionedAmount if set, else requestedAmount; hidden when loan params missing
  - No backend changes needed — all data already in loan detail API response

## Completed (continued)
- Test quality initiative — SCRUM-188 + testing (session 18, 2026-04-06):
  - `docs/TEST_CASES_LOAN_ORIGINATION.md`: 70+ BDD test cases across 12 categories (TC-01 to TC-12) for pasting into Jira
  - `LoanService.Tests/EligibilityAndWorkflowTests.cs`: 40 NUnit tests — EMI, FOIR, LTV, CheckEligibility, list/filter, state machine, audit trail; 0 build errors
  - `frontend-react/cypress/e2e/loan-management.cy.ts`: 25+ Cypress E2E tests — list page, detail page, approval actions, new form, API smoke tests
  - `LoanDemoDataSeeder`: 3 new apps — DRAFT (Kavita Sharma ₹3L PL), APPROVED (Suresh Patel ₹7.5L BL with sanction), INFO_REQUESTED (Anita Desai ₹25L HL with co-applicant); total 8 apps per tenant covering all workflow states
  - Commit: `1a138e1`; pushed to GitHub; Hetzner SSH unreachable at time of deploy (pending `docker compose up --build -d loanservice` on Hetzner)

## Completed (continued)
- Workflow engine real persistence + AccountService wiring (session 19, 2026-04-07):
  - **WorkflowOrchestrationService**: replaced in-memory stub with EF Core 9 + PostgreSQL. Full multi-tenancy (TenantResolutionMiddleware, TenantModelCacheKeyFactory, HasDefaultSchema, TenantSchemaProvisioner). WorkflowInstanceEntity with ContextJson/ApprovalRequirementsJson. EF migration InitialCreate (audited — no schema: "public" qualifiers). String-result fallback in EvaluateRoutingRulesAsync (Roslyn returns plain strings, not objects).
  - **ExpressionBuilderService**: 4 new seeds — EXPR_ROUTING_LOAN_ORIGINATION, EXPR_APPROVAL_LOAN_ORIGINATION, EXPR_ROUTING_ACCOUNT_OPENING, EXPR_APPROVAL_ACCOUNT_OPENING. Total: 14 seeded expressions.
  - **LoanService**: flipped UseLocalWorkflowOrchestrator→false; wired fire-and-forget ProcessStep(DISBURSE) in LoanApplicationsController. WorkflowInstanceId was already on LoanApplication — no new migration.
  - **AccountService**: upgraded EF8→9.0.6, Npgsql8→9.0.4. Simplified TenantSchemaProvisioner (removed manual __EFMigrationsHistory block — EF9 handles it). Created 3 new service clients: IExpressionEvaluationService (CalculateDepositInterestRateAsync via EXPR_FD_RATE_001), IWorkflowClient (StartAccountOpeningAsync + ProcessStepAsync), IDynamicFormsClient (GetAccountFormSchemaAsync). Registered in Program.cs. Extended Account model with 7 deposit fields (TermMonths, MaturityDate, InterestRate, AutoRenewal, InstallmentAmount, PrematureClosurePenalty, WorkflowInstanceId). EF migration AddDepositFields (audited). Wired CreateAccount (FD/RD validation + expression rate + workflow start) and ApproveAccount (workflow APPROVE step). Added GET /api/account/{id}/eligible-rate endpoint.
  - **Jira**: 5 new epics + 31 stories (SCRUM-190–SCRUM-225): WorkflowEngine-1 (DB persistence), WorkflowEngine-2 (LoanService wiring), WorkflowEngine-3 (expression seeds), AccountWiring-1 (AccountService), Deposits-1 (FD/RD lifecycle).

## Completed (continued)
- SCRUM-187: LoanService → TransactionService disbursal wiring (session 22, 2026-04-10):
  - **EXPR_GL_MAPPING_LOAN_DISBURSAL** seeded in ExpressionBuilderService — returns "debitCode|creditCode" (1020|1010) per product type; tenant can reconfigure from Expression Builder UI.
  - **ITransactionServiceClient / TransactionServiceClient** added to LoanService — HTTP POST to `/api/journal` with idempotency key `DISBURSAL-{applicationNumber}`, DR 1020 (Loans and Advances) / CR 1010 (Cash and Bank).
  - **LoanApplicationsController DISBURSE** — now: (1) evaluates GL mapping expression, (2) posts double-entry journal to TransactionService, (3) then fire-and-forgets WorkflowService step. Non-fatal: if TransactionService is unreachable, disbursal succeeds with warning log.
  - **TransactionService** added to start-all.sh on port 5005; TransactionServiceDb created locally; appsettings.Development.json updated with explicit connection string.
  - **LoanService appsettings.Development.json** now has TransactionBaseUrl: http://localhost:5005.
  - Services: 5 → 6 (all ports: 5004, 5005, 5012, 5013, 5130, 3002).

## Completed (continued)
- SCRUM-223/224/225: FD/RD deposit lifecycle endpoints (session 22 cont., 2026-04-10):
  - **EXPR_MATURITY_INTEREST_CALC** (seed #15) — principal × annualRate/100 × termMonths/12; tenant-configurable.
  - **EXPR_PREMATURE_CLOSURE_PENALTY_CALC** (seed #16) — same with penalty subtracted from rate.
  - **GET /api/account/upcoming-maturities?days=30** — lists FD/RD maturing in the next N days with projected interest.
  - **POST /api/account/{id}/mature** — evaluates expression, posts DR 2010+DR 5010 / CR 1010 journal, handles AutoRenewal.
  - **POST /api/account/{id}/premature-close** — evaluates penalty expression, posts journal, closes account.
  - **ITransactionServiceClient / TransactionServiceClient** added to AccountService (mirrors LoanService pattern).
  - AccountService added to start-all.sh on port 5217; appsettings.Development.json updated with TransactionBaseUrl.

## In Progress
- (none)

## Pending Next
- Deploy to Hetzner (rebuild loanservice, expressionbuilder, accountservice, transactionservice containers)
- Wire Ledger UI view to show disbursal and maturity journal entries from loan/account detail pages

## Notes
- Eligibility expression ID currently in use: EXPR_1755237353842.
- Service startup uses ASPNETCORE_ENVIRONMENT=Development for predictable feature flag behavior.
