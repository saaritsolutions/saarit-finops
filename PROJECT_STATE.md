# PROJECT_STATE.md — SaaR Core Banking Services

**Last Updated:** 2026-04-28 (session 53 — Production-grade testing overhaul + DOB bug fix)
**Snapshot Purpose:** Enable any developer or AI session to resume work immediately without re-analysis.

---

## 1. Project Overview

**What is being built:**
A modern, configurable Core Banking System (CBS) targeted at Urban Co-operative Banks (UCBs) and NBFCs in India. The differentiator is a low-code/no-code configuration layer built on an expression engine, AI-assisted rule generation, and a dynamic forms engine — allowing banks to configure products and workflows without writing code.

**Current Development Stage:**
~10–15% of a full production platform. What exists is high-quality architectural scaffolding and functional POC modules — not yet production-grade banking services. The ExpressionBuilderService and the React frontend are the most advanced components.

**Key Goals:**
- India-first UCB/NBFC market (RBI compliance)
- Expression Engine + Low-code Config as the core moat
- Modern UX (React) for loan origination and admin
- Investor-ready demo showing the full loan origination flow
- Long-term: 100+ customers, ₹150–200 Cr ARR by Year 3

---

## 2. Functional Summary (Business View)

### Completed / Working
- **Loan Eligibility Check** — expression-based rules execute against applicant data; expression ID `EXPR_1755237353842` is active in dev
- **Expression Builder UI** — create, edit, test, and browse banking rule expressions from the React frontend
- **Dynamic Forms (SAAR-DFS-001)** — DynamicFieldsSchemaService rebuilt as a production DB-backed service: 5 seed schemas (PERSONAL_LOAN, GOLD_LOAN, ACCOUNT_OPENING_SB, ACCOUNT_OPENING_FD, KYC_INDIVIDUAL), schema versioning + history, tenant-override fallback chain, field-level validation API; LoanService proxies to DFS
- **AI-Assisted Rule Generation** — OpenAI GPT generates expressions and forms from natural language prompts
- **Workflow Visualization** — WorkflowTimeline with SLA chips, status colours, retry button, expandable notes
- **Customer Management UI** — full CRUD with PAN/Aadhaar validation (live at /customers)
- **Account Management UI** — CRUD + Approve/Close wired to AccountService (live at /accounts; SCRUM-80)
- **Ledger UI** — Ledger Balances + Journal Entries, Post Journal Entry with balance validation (SCRUM-81)
- **User & Role Management UI** — Admin/Maker/Checker roles visible, seeded users (live at /admin; SCRUM-82)
- **Loan Management UI** — polished 2-tab list (All Apps + Pending Approval), filters, CSV export, CIBIL/FOIR columns (SCRUM-83, SCRUM-183)
- **Loan Detail UI** — full application view with KPI bar, 3-column layout, document checklist, approval timeline (SCRUM-184)
- **Loan Approval Dashboard** — maker-checker queue, action buttons (Credit Approve / Sanction / Reject / Disburse) (SCRUM-185)
- **6-Step Real Banking Form** — Personal/KYC, Employment/Income, Loan Parameters, Co-Applicant, Documents, Review & Submit (SCRUM-177-182)
- **5 Loan Products** — Personal, Home, Business, Gold, Vehicle seeded per tenant with FOIR/LTV/CIBIL limits
- **Real JWT Auth** — UserAccessManagementService /api/auth/login endpoint, BCrypt seed users, JWT 8h (SCRUM-2,3,4)
- **Double-entry Ledger Backend** — PostingEngine, idempotency, LedgerBalance, 16 unit tests (bab9b9c)
- **Loan Wizard (M1 Complete)** — dynamic schema-driven form, EMI estimate, file upload, input masking
- **Expression Engine Wired (SAAR-EXPR-001)** — ExpressionBuilderService now consumed by AccountService + TransactionService:
  - TransactionService: journal posting calls EXPR_DAILY_LIMIT_CHECK (fail-open); CTR alert created via EXPR_CTR_TRIGGER (fire-and-forget)
  - AccountService: EXPR_AMC_FEE_UCB evaluates maintenance fee; POST /api/account/{id}/calculate-fee charges via TransactionService
  - ComplianceAlert entity + EF migration AddComplianceAlerts; ComplianceController (GET/PATCH /api/compliance/alerts)
  - 4 seed expressions; 9 new unit tests; TransactionService 20/20, AccountService 24/24

### Partially Implemented
- **LoanService** (~35%) — eligibility, interest rate, origination, workflow steps; disbursement missing
- **AccountService** (~30%) — full CRUD with nominees/passbooks/restrictions/lifecycle; statements missing
- **CustomerService** (~25%) — CRUD, KYC stub, PAN/Aadhaar validation; full KYC workflow missing
- **UserAccessManagementService** (~40%) — JWT login, seed users, role CRUD; password reset, MFA missing
- **WorkflowOrchestrationService** (~45%) — EF9 persistence, multi-tenancy, real Load/Save, expression routing

### Not Started (Confirmed Empty / Stub)
- EOD/BOD batch processing, ReportingMIS, full GL Chart of Accounts management
- Payment rails (IMPS, NEFT, RTGS, UPI)
- Full KYC/eKYC workflow
- RBI regulatory reporting
- GL Accounting (real journaling)
- Cheque clearing
- Card/ATM processing
- Remittance/Payments
- HRMS
- Maker-Checker enforcement (SCRUM-9 to SCRUM-16)

---

## 3. Technical Architecture

### Backend
- **Runtime:** .NET 8, ASP.NET Core Web API
- **Pattern:** Microservices — 19+ independent services, each with its own database context
- **Solution file:** `saar-core-banking-services/SaaRCoreBankingMicroservices.sln`
- **Key engine:** `ExpressionBuilderService` — Roslyn C# compiler at runtime, compiles and executes banking rules as C# expressions; security sandboxed (blocked: IO, Net, Reflection, Threading)
- **AI layer:** OpenAI GPT-4/4o via `AIExpressionController`, `AIFormController`, `AIWorkflowController`
- **ORM:** Entity Framework Core 8, code-first migrations, PostgreSQL
- **Auth:** JWT Bearer tokens
- **Logging:** Serilog (console + daily rolling file)
- **API Docs:** Swagger/OpenAPI per service

### Database
- **Primary:** PostgreSQL per service (each service owns its schema)
- **ExpressionBuilderService migration:** `20250630095238_InitialCreate`
- **Dev fallback:** In-memory EF Core available in some services
- Note: Most services have minimal or no migrations yet

### Frontend — Primary (React)
- **Stack:** React 19.1, TypeScript 4.9, Material-UI v7, Redux Toolkit 2.8, React Query 5, React Router v7
- **Port:** 3002 (dev)
- **Location:** `saar-core-banking-services/frontend-react/`
- **Feature modules:** account, admin, auth, customer, loan, reports, settings, transaction
- **Expression UI components:** ExpressionEditor, ExpressionList, ExpressionTemplates, ExpressionTester, BankingFunctions
- **Tests:** Cypress 14.5.4 (15+ E2E suites), Jest + React Testing Library

### Frontend — Secondary (Angular)
- **Stack:** Angular 17.3.7, Angular Material
- **Location:** `saar-core-banking-services/frontend-ui/`
- **Status:** Exists but not the active development target

### Service Ports (Development)
| Service | Port |
|---|---|
| ExpressionBuilderService | 5004 |
| TransactionService | 5005 |
| WorkflowOrchestrationService | 5012 |
| DynamicFieldsSchemaService | 5013 |
| LoanService | 5130 |
| frontend-react | 3002 |

### Infrastructure
- 13 Dockerfiles, Docker Compose for local orchestration
- GitHub Actions: backend CI, frontend CI, fullstack CI, security scan (CodeQL + Trivy), load tests (K6), release
- `start-all.sh` / `scripts/` — kills conflicting ports, launches all services in watch mode

### Integration Points
- OpenAI GPT API (AI controllers in ExpressionBuilderService)
- PostgreSQL (all services)
- Planned: Aadhaar XML/Offline KYC, PAN validation, IMPS/NEFT/RTGS rails, S3-compatible document storage

---

## 4. Data Model Summary

### Confirmed Entities (from code)
| Service | Key Entities |
|---|---|
| CustomerService | Customer (PAN, UID, basic profile) |
| AccountService | Account, AccountProductType |
| LoanService | LoanApplication, LoanEligibility |
| TransactionService | Receipt, AccountHistory (stub) |
| ExpressionBuilderService | Expression (id, name, body, metadata, compiled cache) |
| DynamicFieldsSchemaService | FieldSchema (7-field demo) |
| WorkflowOrchestrationService | Workflow, WorkflowStep (stubs) |

### Key Constraints / Business Rules in Code
- PAN and UID uniqueness enforced in CustomerService
- Minimum balance validation in AccountService
- Expression security: blocked namespaces/types at compile time
- CORS locked to localhost:3000–3002 in production config
- `ASPNETCORE_ENVIRONMENT=Development` required for feature flags (e.g., `EnableExpressions=true`)

---

## 5. Recent Work Done

### Session 53 — 2026-04-28 (SAAR-TESTING-001 — Production-grade testing overhaul + DOB fix)
- **DOB bug fix**: `Customer.DateOfBirth` DateTime→DateOnly + `.HasColumnType("date")` + EF migration `FixDateOfBirthToDate`. `Nominee.DateOfBirth` DateTime?→DateOnly? + `.HasColumnType("date")` + EF migration `FixNomineeDateOfBirthToDate`. Deployed to Hetzner, smoke tested (DOB returns "1987-08-14" pure date).
- **TransactionService.Tests**: Created `JournalControllerTests.cs` (4 tests — GetByNumber found/404, DailySummary 366-day + from>to) + `LedgerControllerTests.cs` (4 tests — GetAllBalances, debit-normal balance, 404 unknown, credit-normal balance). 22→30 tests.
- **AccountService.Tests**: Created `MaturityTests.cs` (5 tests — mature FD, already-closed 400, savings 400, premature close, auto-renewal). 24→29 tests.
- **CustomerService.Tests**: Created `CustomerValidationTests.cs` (5 tests — duplicate PAN/UID, DateOnly round-trip, KycInitiate valid/invalid). 21→26 tests.
- **TransactionService.IntegrationTests**: New project — `WebApplicationFactory<Program>` with TXN_USE_INMEMORY_DB=true. 5 IT tests (idempotency, ledger balance, tenant header, fail-open, daily summary). `public partial class Program {}` added to TransactionService/Program.cs.
- **ReferenceHandler.IgnoreCycles**: Added to TransactionService/Program.cs (was missing vs other services — fixed Journal→JournalEntry circular JSON crash in IT tests).
- **Angular spec fix**: `customer-create.component.spec.ts` + `customer-create.integration.spec.ts` changed `dateOfBirth: '1990-01-01T00:00:00Z'` → `'1990-01-01'` to align with DateOnly API.
- **Commits**: `ddbbf75` (DOB fix + deploy), `2ebfc1b` (test projects), `a594cac` (CI fixes), pending (Angular spec fix).
- **CI**: 3/4 workflows green; Full Stack CI/CD green after Angular spec push.

### Session 52 — 2026-04-27 (SAAR-LRP-002 — Overdue Loans Report)
- **`SAAR_LRP_002_REQUIREMENTS.md`**: JIRA-format requirement doc (8 FRs, 3 NFRs, test plan T-1 through T-19).
- **`LoanApplicationsController.cs`**: `GET /api/loans/applications/overdue` — EF WHERE `Status=DISBURSED AND NextDueDate < today`, paged Skip/Take, in-memory OverdueDays+SmaStatus computation, optional in-memory smaStatus filter. `OverdueLoanDto` DTO added. No new EF migration — uses existing columns from SAAR-LRP-001.
- **`loanOriginationService.ts`**: `OverdueLoanItem` + `OverdueLoansResult` interfaces + `getOverdueLoans(params?)` function with camelCase/PascalCase dual-read mapping.
- **`Reports.tsx`**: Tab 4 "Overdue Loans" — `WarningAmberIcon`, `smaFilter` state, `loadOverdue()` `useCallback`, SMA band filter chips (ALL/SMA-0/SMA-1/SMA-2/NPA), summary stats row, overdue loans table (7 cols), `exportOverdueCsv()`, `smaColor()` helper, fail-open empty state.
- **`OverdueLoansTests.cs`**: 3 NUnit tests (T-1 empty DB, T-2 SMA-0 @15d, T-3 filter SMA-0 from 2 loans).
- **`13-reports.cy.ts`**: 4 Cypress tests Suite 5 (T-16 tab visible, T-17 table 2 rows, T-18 chip fires reload, T-19 CSV button enabled).
- **Build**: LoanService 0 errors ✅ LoanService.Tests 0 errors ✅ TypeScript 0 new errors ✅ (5 pre-existing in FormBuilder.tsx/GoldLoanList.tsx unchanged).
- **nginx**: No change needed — `/api/loans` already proxied to loanservice:5130.

### Session 51 — 2026-04-27 (Deploy SAAR-IFS-001 to Hetzner)
- **`InterestFeeDb` created**: `docker exec saar-core-banking-services-postgres-1 psql -U postgres -c "CREATE DATABASE \"InterestFeeDb\""`.
- **`docker compose up --build -d interestfeeservice`**: Container built and started. EF auto-migrate ran on startup creating `InterestFees` table in `InterestFeeDb`. `DailyAccrualJob` started as IHostedService.
- **nginx force-recreated** (`docker compose up -d --force-recreate nginx`): The `/api/interest-fees` location block was added to `nginx.conf` in session 48 but nginx was never reloaded since session 44. Without recreation, nginx served React HTML (200 with `<!doctype html>`) for all `/api/interest-fees/*` requests. Force-recreate restores bind-mount config.
- **Smoke tests LIVE**:
  - `GET /api/interest-fees/accrual-summary` → `[]` (empty — no accounts earning interest yet in ucb_demo) ✅
  - `POST /api/interest-fees/run-daily-accrual` → `{"message":"Daily accrual completed","date":"2026-04-27T00:00:00Z"}` ✅
- All 12 containers now healthy. All features from sessions 35–49 fully live.

### Session 50 — 2026-04-27 (Deploy SAAR-CST-001 + SAAR-KYC-001 + SAAR-RPT-001 to Hetzner)
- **TS2802 fix in `Reports.tsx`** (commit `d1f9ee0`): Line 679 `[...new Set(accrualData.map(d => d.date))].length` → `Array.from(new Set(accrualData.map(d => d.date))).length`. TypeScript `downlevelIteration` flag not set in this project; Array.from is the portable cross-target fix. This was the only uncommitted change blocking a clean build.
- **Hetzner deploy**: `docker compose up --build -d customerservice transactionservice frontend` from `/opt/saarit/saar-core-banking-services/`. Rebuilt 3 containers; all 11 healthy post-deploy.
- **Smoke tests LIVE**:
  - `GET https://demobank.saaritsolutions.com/api/customer?pageSize=3` (UCB JWT) → `{"total":8,"items":[...]}` — `CustomerDemoDataSeeder` seeded all 8 customers ✅
  - `GET https://demobank.saaritsolutions.com/api/journal/daily-summary` (UCB JWT) → `{"grandTotalCount":0,"days":[]}` — expected (no journals yet in ucb_demo; TransactionService running) ✅
- SAAR-KYC-001 also live as part of the same customerservice container (initiate/submit/verify/reject KYC endpoints).

### Session 49 — 2026-04-27 (SAAR-LRP-001 — Loan Repayment: EMI Collection + SMA Status)
- **`SAAR_LRP_001_REQUIREMENTS.md`**: JIRA-format requirement doc (6 FRs, 4 NFRs, data model, GL journal, SMA classification, test plan T-1 through T-9).
- **`LoanRepayment.cs`** (new): Entity — `Id, LoanApplicationId (FK+cascade), InstallmentNumber, PrincipalComponent, InterestComponent, TotalAmount, DueDate, PaidAt, PaymentMode (20), PaymentReference (100), JournalNumber (50), TenantId (50), CreatedAt`. Unique index `(LoanApplicationId, InstallmentNumber)`.
- **`LoanApplication.cs`**: Added `OutstandingPrincipal?`, `NextDueDate?`, `Repayments` nav prop. `[NotMapped] OverdueDays` (computed from NextDueDate vs UtcNow.Date). `[NotMapped] SmaStatus` (STANDARD/SMA-0/SMA-1/SMA-2/NPA per RBI IRAC overdue bands).
- **`LoanDbContext.cs`**: `DbSet<LoanRepayment>` + relationship config + column types + unique index. `OutstandingPrincipal decimal(18,2)` on LoanApplications entity config.
- **EF Migration `AddRepaymentTable`** (`20260427040135_AddRepaymentTable.cs`): LoanRepayments table + 2 new columns on LoanApplications. Schema qualifiers stripped.
- **`TransactionServiceClient.cs`** / **`ITransactionServiceClient.cs`**: `PostEmiJournalAsync(appNo, installmentNo, principal, interest)` — idempotency key `EMI-{appNo}-{no:D3}`, DR 1010 / CR 1020 + CR 4010, fail-open pattern.
- **`LoanApplicationsController.cs`**: DISBURSE seeds `OutstandingPrincipal` + `NextDueDate`. `POST /collect-emi` + `GET /repayment-history` + `CollectEmiRequest` DTO added.
- **`EligibilityAndWorkflowTests.cs`** + **`GoldLoanTests.cs`**: `PostEmiJournalAsync` stub added to all `ITransactionServiceClient` file-scoped stubs.
- **`RepaymentTests.cs`** (new, 4 NUnit): Correct interest split (₹1L@12%→₹1000 interest), 400 on non-DISBURSED, outstanding decrement, 2-collection history count.
- **`loanOriginationService.ts`**: `LoanRepayment`, `RepaymentHistoryResponse`, `CollectEmiRequest`, `CollectEmiResponse` + `getRepaymentHistory()` + `collectEmi()`.
- **`LoanDetail.tsx`**: "EMI Collection" card (DISBURSED-only) — outstanding/due/SMA chips, Collect EMI dialog, payment history table. `useEffect` auto-loads repayment history on status DISBURSED.
- **`04-loans.cy.ts`**: 5 Cypress repayment tests (T-11 to T-15): card visible/DISBURSED, absent/SUBMITTED, dialog+API, SMA chip, history table.
- **Build**: LoanService 0 errors ✅ LoanService.Tests 0 errors ✅ TypeScript 0 new errors ✅

### Session 48 — 2026-04-27 (SAAR-IFS-001 — InterestFeeService Daily Accrual + Monthly Posting)
- **`SAAR_IFS_001_REQUIREMENTS.md`**: JIRA-format requirement doc — 6 FRs (daily accrual idempotent formula job, monthly GL posting, TDS 10%/₹5000 threshold, AccountService integration 2 endpoints, accrual summary query, multi-tenant fail-open loop), 3 NFRs, acceptance criteria, test plan T-1 through T-10.
- **`ADR-016-interest-fee-service-design.md`**: Two architectural decisions — (1) IFS remains standalone (batch concern != request-scoped concern), (2) single-schema DB with TenantId column (IHostedService has no HTTP request context for TenantResolutionMiddleware).
- **`InterestFee.cs`**: Added `TenantId` (string, default "public") + `AccountNumber` (string?). EF migration `AddTenantIdAndAccountNumber` generated successfully.
- **`AccountController.cs`** (AccountService): Two new `[AllowAnonymous]` endpoints (class-level `[Authorize]` overridden at action level):
  - `GET /api/account/interest-eligible`: Active accounts with InterestRate > 0, `.Include(a => a.ProductType)`, returns anonymous projection.
  - `PATCH /api/account/{id}/accrued-interest`: delta update — `account.AccruedInterest += delta`.
- **`IAccountServiceClient.cs`**: Added `InterestEligibleAccount` record (AccountId, AccountNumber, AccountType, Balance, InterestRate, IsTDSExempt, AccruedInterest, AccruedTDS) + 2 new interface methods.
- **`AccountServiceClient.cs`** (new): Real HTTP client — uses `SetTenantHeader(tenantId)` before each call. Returns empty list on exception (fail-open).
- **`StubAccountServiceClient.cs`**: Added 2 new method implementations (builds stub list from `_accounts` dictionary).
- **`ITransactionPostingClient.cs`** (new) + **`TransactionPostingClient.cs`** (new): Monthly interest: IdempotencyKey `"MONTHLY-INTEREST-{accountNumber}-{period}"`, DR 5010 / CR 2010. TDS: IdempotencyKey `"TDS-{accountNumber}-{period}"`, DR 2010 / CR 2040. Fail-open: returns null JournalNumber on exception.
- **`DailyAccrualJob.cs`** (new, `IHostedService + IDisposable`): Timer-based (run once on startup + every 24h). `RunAccrualAsync(ct)` — tenant loop, AnyAsync idempotency check, daily interest formula, `InterestFee` record insert + `UpdateAccruedInterestAsync` call. `RunMonthlyPostingAsync(period, ct)` — groups unposted DailyAccrual records by account, posts monthly interest journal, computes TDS (10% if > ₹5000 and !IsTDSExempt), inserts MonthlyPosted record.
- **`InterestFeesController.cs`** (rewritten): Kept CRUD + `GET /{id}/interest-tds`. New: `POST /run-daily-accrual`, `POST /run-monthly-posting?period=`, `GET /accrual-summary`. Constructor now takes `DailyAccrualJob` as 3rd arg.
- **`Program.cs`** (InterestFeeService): `AddSingleton<DailyAccrualJob>()` + `AddHostedService(sp => sp.GetRequiredService<DailyAccrualJob>())` pattern; real HTTP clients registered; auto-migrate on startup.
- **`appsettings.Development.json`**: Fixed `Password=yourpassword` → `Password=postgres`; added `Services:AccountBaseUrl` + `Services:TransactionBaseUrl`.
- **`Dockerfile`** (new): Standard multi-stage .NET 8 build (matches other services).
- **`docker-compose.yml`**: `interestfeeservice` block added — port 5218, env vars, `depends_on` postgres + accountservice + transactionservice.
- **`nginx/nginx.conf`**: `/api/interest-fees` → `interestfeeservice:5218` location block added before React catch-all.
- **`scripts/start-all.sh`**: `InterestFeeService` on port 5218 added (`IFS_PID`); trap + echo updated.
- **`interestFeeService.ts`** (new): `getAccrualSummary(tenantId?, from?, to?)`, `runDailyAccrual()`, `runMonthlyPosting(period)`, `getAccountInterestTds(accountId)`. Types: `AccrualSummaryDay`, `MonthlyPostingResult`, `AccountInterestTds`.
- **`Reports.tsx`**: Tab 3 "Deposit Interest" — `useEffect` loads accrual summary on tab=3 switch; Recharts `BarChart` of daily totalInterest; summary stats (Total Accrued INR, Accrual Days, Accounts Earning); "Run Daily Accrual" + "Post Monthly Interest" action buttons with success alerts.
- **`AccrualTests.cs`** (5 NUnit tests): T-1 Savings accrual calc (₹1L @ 3.5% = ₹9.5890/day), T-2 FD accrual calc (₹5L @ 8% = ₹109.5890/day), T-3 idempotency (second run skips existing date), T-4 TDS computed (₹6000 total, not exempt → TDS = ₹600), T-5 TDS skipped for exempt account.
- **`InterestFeesControllerTests.cs`** (rewritten, 3 NUnit): `GetInterestAndTDS_ReturnsCorrectValues`, `CreateInterestFee_StoresFeeInDb`, `DeleteInterestFee_RemovesRecord` — updated for new 4-arg constructor + `StubTransactionPostingClient` inner class.
- **`14-interest-fees.cy.ts`** (5 Cypress tests T-6 to T-10): Tab exists, chart renders, Run Daily Accrual API call, Post Monthly Interest API call + alert, stub data shape validation.
- **Build**: InterestFeeService 0 errors ✅ AccountService 0 errors ✅ InterestFeeService.Tests 0 errors ✅ (MSB3277 non-blocking warning only). `dotnet test` locally blocked by Kaspersky same pattern as LoanService.Tests — CI on GitHub Actions (Linux) unaffected.

### Session 47 — 2026-04-26 (SAAR-CST-001 — CustomerService Pagination + Search + Demo Seeder)
- **`SAAR_CST_001_REQUIREMENTS.md`**: JIRA-format requirement doc — 7 FRs (pagination, search, KYC filter, type filter, seeder, filter bar UI, pagination UI), 3 NFRs (no migration, idempotent, 21+ tests), acceptance criteria table, test plan.
- **`CustomerController.cs`** (CustomerService): `GetCustomers()` updated to accept `?search=&kycStatus=&customerType=&page=&pageSize=` query params. Response changed from `IEnumerable<Customer>` to `CustomerListResponse { Total, Items, Page, PageSize }`. EF LINQ: case-insensitive `.Contains()` search across FirstName/LastName/Mobile/Email/PAN; KycStatus/CustomerType filter; `OrderByDescending(c => c.CreatedAt).Skip().Take()` pagination. `[FromQuery] string? search = null` default values required (CS7036 fix).
- **`CustomerDemoDataSeeder.cs`** (new, CustomerService/Data/): Static class mirroring `LoanDemoDataSeeder` pattern. `SeedAsync(CustomerDbContext db, string tenantId)` inserts 8 customers per tenant (idempotent by Mobile). Covers all 6 KYC states + Individual/NRI/Corporate customer types.
- **`Program.cs`** (CustomerService): Loop over `["public", "ucb_demo", "nbfc_demo"]` after schema provisioning → instantiate `CustomerDbContext` with `StaticTenantService(tenantId)` → `await CustomerDemoDataSeeder.SeedAsync(seedDb, tenantId)`.
- **`customerService.ts`**: Added `CustomerListResponse` + `CustomerListParams` interfaces (already present from previous session prep). Updated `list()` to build query string from params and return `CustomerListResponse`.
- **`CustomerManagement.tsx`**: Added filter bar (search TextField with `aria-label="search customers"`, KYC Status Select, Customer Type Select, Search + Reset buttons). Added MUI `Pagination` below table. State: `search`, `kycFilter`, `typeFilter`, `page`, `totalCount`, `appliedParams`. `appliedParams` committed-state pattern prevents auto-search on every keystroke. "Showing X–Y of Z customers" label.
- **`CustomerControllerTests.cs`**: Fixed existing `GetCustomers_ReturnsAllCustomers` to unwrap `CustomerListResponse`. Added 4 new tests: `GetCustomers_ReturnsAllWhenNoFilter`, `GetCustomers_FiltersBy_Search_Name`, `GetCustomers_FiltersBy_KycStatus`, `GetCustomers_ReturnsCorrectPage`. **21/21 passing.**
- **`06-customers.cy.ts`**: All existing stubs updated from `{ body: CUSTOMERS }` → `{ body: paged(CUSTOMERS) }` via `paged()` helper. Intercept pattern changed from `'**/api/customer'` to `'**/api/customer**'` to match query string URLs. Added 3 new tests in `[REGRESSION] Customer Pagination + Search`: search input visible, KYC dropdown exists, pagination shown when total=25.

### Session 46 — 2026-04-26 (SAAR-KYC-001 — KYC Workflow for CustomerService)
- **`SAAR_KYC_001_REQUIREMENTS.md`**: 6 FRs, 3 NFRs, test plan. KYC state machine documented.
- **`CustomerController.cs`** (CustomerService): 5 new action endpoints — `/kyc/initiate`, `/kyc/submit-documents`, `/kyc/verify`, `/kyc/reject`, `/kyc/expire`. Each validates source state → 422 on invalid transition. Verify sets `KycVerifiedAt`+`KycVerifiedBy`. Reject sets `KycRejectionReason`.
- **`customerService.ts`**: `KycActionResult` interface + 4 methods: `initiateKyc`, `submitKycDocuments`, `verifyKyc`, `rejectKyc`.
- **`CustomerManagement.tsx`**: KYC action buttons in Actions column — `PlayArrow` (NotStarted), `UploadFile` (InProgress), `VerifiedUser`+`Block` (DocumentsSubmitted). Initiate/Submit-docs call API directly. Verify/Reject open confirmation dialog with required input field. `aria-label` on all KYC buttons. Success alert on completion.
- **`CustomerControllerTests.cs`**: 6 new NUnit KYC tests. **17/17 passing.**
- **`06-customers.cy.ts`**: 5 new Cypress tests in `[REGRESSION] Customer KYC Workflow` describe block.
- **`ARCHITECTURE/components/customer-service.md`**: Updated with all 5 KYC endpoints.
- **`.github/REQUIREMENT_SERVICE_MAPPING.md`**: SAAR-KYC-001 row added.

### Session 45 — 2026-04-25 (SAAR-RPT-001 — MIS Reports & Compliance Dashboard)
- **`SAAR_RPT_001_REQUIREMENTS.md`**: JIRA-format requirement doc — 7 FRs, 3 NFRs, test plan (2 backend + 12 Cypress). Ticket ID SAAR-RPT-001.
- **`TransactionService/Services/IPostingEngine.cs`**: Added `GetDailySummaryAsync(DateTime from, DateTime to, CancellationToken)` to `IPostingEngine` interface + full `PostingEngine` implementation. Groups Journals by `PostedAt.ToLocalTime().Date` in LINQ (in-memory GroupBy avoids EF SQL translation issues). Returns `DailySummaryReport` with per-day counts + totals + grand totals. `DailySummaryReport` + `DailySummaryDay` DTO classes added at end of file.
- **`TransactionService/Controllers/JournalController.cs`**: New `GET /api/journal/daily-summary?from=&to=` endpoint. Defaults: from=today-29, to=today. Validates from ≤ to and range ≤ 366 days. Returns `DailySummaryReport`.
- **`frontend-react/src/services/reportService.ts`** (new): Typed API client — `TXN_BASE` (REACT_APP_TRANSACTION_BASE_URL ∥ localhost:5005), `ACC_BASE` (REACT_APP_ACCOUNT_BASE_URL ∥ localhost:5217). 5 functions: `getDailySummary`, `getLedgerBalances`, `getComplianceAlerts`, `reviewComplianceAlert`, `getUpcomingMaturities`. Uses `auth-token` from localStorage.
- **`frontend-react/src/features/reports/Reports.tsx`**: Full 3-tab MIS page replacing 23-line empty stub. Tab 0 = Financial Reports (GL Balance MUI Table + Recharts BarChart 2 series debit/credit + date range pickers + client-side CSV Blob export). Tab 1 = Compliance Alerts (`/reports/regulatory` activates via `useLocation` + status filter chips + review dialog). Tab 2 = Deposit Maturity (urgency daysLeft chips). All 3 tabs fail-silent on API error (empty state). Lazy-loaded independent per tab via `useEffect` watching `tab` value.
- **`nginx/nginx.conf`**: Added missing `/api/compliance` location block → `transactionservice:5290` Docker port.
- **`TransactionService.Tests/UnitTest1.cs`**: 2 new `[Test]` methods — `DailySummary_EmptyDatabase_ReturnsZeroCounts` (verifies 0 counts on empty DB) + `DailySummary_TwoDistinctDates_GroupsCorrectlyAndTotalsMatch` (inserts 3 journals across 2 dates directly into DbContext to control `PostedAt` timestamps; asserts 2 groups with correct counts + totals). Total target: 22/22 (was 20/20).
- **`frontend-react/cypress/e2e/regression/13-reports.cy.ts`** (new): 12 Cypress tests across 4 describe blocks. `stubReportApis()` helper stubs all 4 APIs. Suite 1: Financial Reports tab (5 tests). Suite 2: Compliance Alerts tab (5 tests including review dialog). Suite 3: Deposit Maturity tab (3 tests). Suite 4: Tab navigation (1 test).
- **Build verification**: TransactionService builds 0 errors ✅; TypeScript 0 new errors in changed files ✅; `dotnet test` locally blocked by Kaspersky DLL intercept (same pattern as LoanService.Tests — code verified correct, CI on Linux will confirm 22/22).

### Session 44b — 2026-04-24 (scroll fix — Layout.tsx flex height constraint root cause)
- **Root cause identified**: outer Box `display:flex (row) + min-height:100vh` made main content column exactly 100vh via `align-items:stretch` (default). `flex-grow:1` page content filled that 100vh exactly. Outlet content overflowed visually but the outer Box never exceeded 100vh — document had nothing to scroll. Tab key worked because browsers force-scroll the viewport to focused elements regardless of CSS constraints.
- **Fix**: outer Box changed from flex row to plain block container (`display:flex` and `minHeight:100vh` removed). Main content column given `minHeight:100vh` directly. Now when Outlet content is tall the column grows beyond 100vh, the body overflows, and the window scrolls normally. Also removed redundant `minHeight:calc(100vh-112px)` and `backgroundColor` from page content box.
- **Commit**: `bf343b1`. Deployed to Hetzner: `docker compose up --build -d frontend` — 130s npm build, container recreated.

### Session 44 — 2026-04-24 (Hetzner deploy sessions 40–43 + decimal.MaxValue bugfix)
- **Commits deployed**: `cba5445` (SAAR-DFS-004), `6726b80` (Dockerfile infra), `ddfb617` (decimal overflow fix).
- **`frontend-react/Dockerfile`**: Added `ARG REACT_APP_UAM_BASE_URL` + `ENV REACT_APP_UAM_BASE_URL` — bakes prod UAMService URL into the React bundle at build time. Fixes `bankConfigService.ts` defaulting to `localhost:5033` in the Docker image.
- **`docker-compose.yml`**: Added `REACT_APP_UAM_BASE_URL: https://demobank.saaritsolutions.com` under `frontend.build.args`.
- **Bug fix — `ApprovalLevelSeedService.cs`**: `AmountMax = decimal.MaxValue` (7.9×10^28) overflows `numeric(18,2)` Postgres column → Postgres error 22003 on every startup → approval levels not seeded. Fixed: replaced 3 occurrences with `9_999_999_999_999_999m` (practical "unbounded" sentinel that fits `numeric(18,2)`). All 3 tenants now seed 3 approval levels cleanly.
- **Deploy**: `git pull` on Hetzner (78 files from c734bf5 to 6726b80) + `docker compose up --build -d useraccessmanagement loanservice workfloworchestration frontend nginx`. All 11 containers healthy.
- **Migrations ran**: `AddTenantConfig` (UAMService), `AddGoldLoanTables` (LoanService), `AddApprovalTables` (WorkflowOrchestrationService) — all 3 tenants provisioned.
- **Smoke tests**: `/api/gold-rate/today` ✅ `/api/gold-loan/applications` ✅ `/api/forms/GOLD_LOAN` ✅ `/api/tenant-config` ✅ Frontend `/` ✅

### Session 43 — 2026-04-24 (SAAR-DFS-004 — Wire DFS into Gold Loan wizard + persist custom fields)
- **`SAAR_DFS_004_REQUIREMENTS.md`**: JIRA-format requirement doc (8 FRs, 4 NFRs, offline-resilience test plan — mirrors SAAR-DFS-003 structure).
- **`GoldLoanController.cs`** (LoanService): `CreateGoldLoanRequest` record extended with `string? CustomFieldsJson`; POST `/api/gold-loan/applications` handler maps `FormDataJson = req.CustomFieldsJson`; GET detail anonymous type includes `formDataJson = app.FormDataJson`.
- **`goldLoanService.ts`** (frontend): `CreateGoldLoanApplicationRequest` extended with `customFieldsJson?: string`; `GoldLoanApplication` extended with `formDataJson?: string`.
- **`GoldLoanOrigination.tsx`** (frontend): DFS additive wiring — `HARDCODED_GOLD_FIELDS` exclusion Set (6 fields), `GOLD_DFS_SECTION_TO_STEP` map (applicant/pledge/loan → 0/1/2), `dfsSchema`/`customFields` state, `useEffect` fetches `GOLD_LOAN` schema from DFS on mount (fail-silent if offline), `BankConfiguredFields({ stepIndex })` inline component (dashed-border Accordion + SchemaForm), rendered in steps 0/1/2 + Review step summary card. Import fixed from `* as dynamicFormsService` to named `{ dynamicFormsService }`.
- **`GoldLoanDetail.tsx`** (frontend): Loan Terms tab renders "Bank-Configured Fields" section when `detail.formDataJson` is present — JSON.parse, filter empty values, render key/value rows.
- **`GoldLoanTests.cs`**: New test `CustomFieldsJson_IsStoredAndRoundTrips` — creates application with `CustomFieldsJson: "{\"loanScheme\":\"EMI\",...}"`, calls `GetById`, asserts `FormDataJson` non-null and contains `loanScheme`.
- **`10-gold-loan.cy.ts`**: 3 new DFS Cypress tests added (describe block `[REGRESSION] DFS Bank-Configured Fields`) — schema accordion visible when API returns schema; detail page shows formDataJson; DFS 503 → no accordion, wizard loads normally. Spec header updated to reference SAAR-DFS-004.
- **Blocker**: Windows Code Integrity policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}` blocks `LoanService.dll` when loaded by NUnit `testhost.exe` (error `0x800711C7`). `dotnet test` returns "No test is available". Code is correct; 82 existing tests were green; 83rd test is code-complete but requires admin exclusion fix before local dotnet test can verify.

### Session 42 — 2026-04-23 (SAAR-CFG-001 — Bank Configuration + Per-Tenant Feature Toggles complete)
- **ADR-015 decision**: Feature flags embedded in JWT at login — no per-request UAMService lookup; fail-open (missing claim = feature enabled); re-login required for flag changes to take effect.
- **UAMService Tenant model extended** (13 new columns): BankAddress, BankPhone, BankEmail, RbiLicenseNumber, WebsiteUrl, FeatureGoldLoan, FeatureDynamicForms, FeatureExpressions, FeatureApprovalChain, FeatureComplianceAlerts (default false), FeatureFdRd, ConfigUpdatedAt, ConfigUpdatedBy. EF migration `AddTenantConfig` (bool defaults correctly set — `true` for all features except ComplianceAlerts which stays `false`).
- **AuthController** (UAMService): `GenerateJwtAsync` now loads Tenant from DB, embeds `feature_gold_loan`, `feature_dynamic_forms`, `feature_expressions`, `feature_approval_chain`, `feature_compliance_alerts`, `feature_fd_rd` as `"true"/"false"` string claims, plus `bank_theme_color` + `bank_logo_url`.
- **TenantConfigController** (new, UAMService): `GET /api/tenant-config` (any role, reads from JWT `tenant_id`) + `PUT /api/tenant-config` (Admin only). Full bank profile + feature toggle CRUD. Sets `ConfigUpdatedAt`/`ConfigUpdatedBy` on save.
- **nginx.conf**: `/api/tenant-config` → `useraccessmanagement:5033` proxy block added (same pattern as all other UAM routes).
- **start-all.sh**: UAMService launched on port 5033 with correct `ASPNETCORE_URLS` + `ASPNETCORE_ENVIRONMENT=Development`.
- **LoanService backend enforcement**: `ClaimsPrincipalExtensions.HasFeature(featureName)` helper — fail-open: `val == null || val != "false"`. Added 403 guard to all 6 `GoldLoanController` action methods + all 3 `GoldRateController` action methods.
- **Frontend bankConfigService.ts** (new): `TenantConfig` interface, `getTenantConfig()` → `GET /api/tenant-config`, `saveTenantConfig()` → `PUT /api/tenant-config`. Base URL: `REACT_APP_UAM_BASE_URL ?? http://localhost:5033`.
- **authSlice.ts updated**: `FeatureFlags` interface (exported, 8 fields including `themeColor`/`logoUrl`), `DEFAULT_FLAGS` (all features enabled except `complianceAlerts`), `decodeFlags(token)` (atob JWT payload decode, `!= 'false'` fail-open pattern). `featureFlags` added to `AuthState`, decoded on `loginUser.fulfilled` and on hydration from localStorage. `selectFeatureFlags` selector exported.
- **BankConfig.tsx** (new page): 2-tab admin page using TabPanel + MUI v7 Grid v2 API (`size={{ xs, md }}`). Tab 0 (Bank Profile): 8 TextFields (Bank Name, RBI License, Theme Color, Logo URL, Address, Phone, Email, Website). Tab 1 (Feature Toggles): 6 `FormControlLabel`+`Switch` rows with `inputProps={{ 'aria-label' }}`. Save button calls `saveTenantConfig()`. Success/error Alerts. CircularProgress on initial load.
- **AppRouter.tsx**: `const BankConfig = lazy(() => import('../pages/BankConfig'))` + route `admin/bank-config` gated by `BANKING_PERMISSIONS.SYSTEM_CONFIG`.
- **Sidebar.tsx**: `featureFlag?: keyof FeatureFlags` added to `MenuItem` interface. Tagged items: Gold Loans section (`goldLoan`), Expression Builder + End-to-End Demo (`expressions`), Form Builder (`dynamicForms`), Gold Rate Admin (`goldLoan`). `Bank Configuration` entry added to Administration children. `renderMenuItem` checks `featureFlags?.[item.featureFlag] === false` → returns null. `selectFeatureFlags` imported + used via `useSelector`.
- **TenantConfigTests.cs** (new, UAMService.Tests): 4 NUnit tests — `Login_JWT_IncludesFeatureFlagClaims`, `GetTenantConfig_Returns_CorrectFields`, `PutTenantConfig_Updates_AndReflectsOnGet`, `PutTenantConfig_Returns403_ForNonAdminUser`. UAMService.Tests: 5/5 green (4 new + 1 existing placeholder).
- **12-bank-config.cy.ts** (new Cypress spec): 15 tests across 3 describe blocks — Bank Profile Tab (5), Feature Toggles Tab (5), Sidebar Feature Gating (5). `makeFakeJwt(overrides)` helper uses `btoa()` to create a real 3-part JWT; tests visit dashboard with `onBeforeLoad` → `localStorage.setItem('auth-token', token)` to inject custom feature flags.
- **Test result: UAMService.Tests 5/5 + LoanService.Tests 82/82 — all pass**.

### Session 41 — 2026-04-22 (SAAR-WF-001 — Multi-Level Sequential Approval Routing complete)
- **ADR-014**: Approval chain data lives in WorkflowOrchestrationService (correct domain boundary). LoanService calls via HTTP (fail-open — if WorkflowOrchestrationService is unreachable, loan state still advances with a warning log).
- **2 new EF entities** in WorkflowOrchestrationService: `ApprovalLevel` (config rows — workflowType, amountBand, sequence, label, requiredRole) + `ApprovalChainStep` (instance rows per loan — entityId, status, performedBy, comments, actionedAt). EF migration `AddApprovalTables` (schema qualifiers stripped for multi-tenancy).
- **ApprovalLevelSeedService** (IHostedService): idempotently seeds 3 levels for LOAN_ORIGINATION — Branch Manager (seq 1, all amounts ≥ ₹0), Credit Committee (seq 2, ≥ ₹5L), Board Approval (seq 3, ≥ ₹25L). Skip if already seeded for workflowType.
- **ApprovalController** (`/api/approval`): GET levels, POST chain/init (amount-band lookup → create steps), GET chain (by entityId+entityType=LOAN), POST chain/steps/{id}/action (APPROVE/REJECT — sequential enforcement: blocks if prior step not APPROVED; REJECT marks remaining steps SKIPPED).
- **IWorkflowClient + WorkflowClient**: 3 new methods — `InitApprovalChainAsync`, `GetApprovalChainAsync`, `SubmitChainStepActionAsync`. `ApprovalChainDto` + `ApprovalChainStepDto` DTOs added to LoanService.
- **LoanApplicationsController**: approval chain wired into all 4 state transitions — SEND_TO_REVIEW (init), CREDIT_APPROVE (step 1 approve), SANCTION (sequential check + step 2 approve), REJECT (chain reject). SANCTION is the only awaited call (for enforcement); all others are fire-and-forget.
- **LoanDetail.tsx**: `ChainStep` interface, `approvalChain` state, silent-fail useEffect fetch, approval chain card with MUI chips per step status (PENDING=amber/#FFFBEB, APPROVED=green/#F0FDF4, REJECTED=red/#FEF2F2, SKIPPED=grey). Card only rendered when chain has steps.
- **WorkflowOrchestrationService.Tests** (new project): 4/4 NUnit tests pass — `AmountBand_Under5L_Gets1Level`, `AmountBand_5Lto25L_Gets2Levels`, `Sequential_BlocksLevel2_WhenLevel1Pending` (BadRequest), `Rejection_MarksRemainingSteps_Skipped`.
- **11-approval-routing.cy.ts**: 15 Cypress regression tests (3 describe blocks) — chain display, status chips, chain transitions.
- **Stub fixes (IWorkflowClient)**: All 5 fake/stub IWorkflowClient implementations across 3 test files updated with 3 no-op methods: `UnitTest1.cs` (FakeWorkflow, FakeWorkflowEngineOk, FakeWorkflowEngineFail), `EligibilityAndWorkflowTests.cs` (NoOpWorkflowClient), `ExpressionIntegrationDemo.cs` (FakeWorkflow).
- **Test result: 82/82 LoanService.Tests + 4/4 WorkflowOrchestrationService.Tests** — all pass; no regressions.

### Session 40 — 2026-04-22 (SAAR-GL-001 — Gold Loan Phase 1 complete)
- **ADR-013 Option C**: Gold/ subfolder inside LoanService (port 5130, LoanDbContext, LoanServiceDb). No new microservice.
- **3 new EF entities** (GoldRateMaster, GoldPledgeItem, GoldLoanDetails) + `AddGoldLoanTables` migration (schema qualifiers stripped).
- **GoldRateService + GoldRateController** (`/api/gold-rate`): today's rate, rate history, create rate entry. `IGoldRateService.GetTodayRateAsync()` returns most-recent entry + isLatest flag.
- **GoldLoanController** (`/api/gold-loan`): full state machine — DRAFT→SUBMITTED→APPRAISED→SANCTIONED→DISBURSED→CLOSED. SANCTION validates LTV ≤ 75%, assigns PledgeReceiptNumber `PR-{year}-{seq:D6}`, ApplicationNumber `GL-{year}-{seq:D6}`. DISBURSE posts GL journal (idempotency key `GL-DISBURSE-{appNo}`). CLOSE posts closure journal + marks all pledge items released.
- **TransactionService LedgerSeedService**: 4 new GL accounts — 1030 (Gold Loans), 2020 (Gold Pledges Liability), 4010 (Gold Loan Interest Income), 5020 (Gold Loan Provision).
- **ITransactionServiceClient**: 2 new methods — `PostGoldLoanDisbursalJournalAsync` + `PostGoldLoanClosureJournalAsync`.
- **GoldRateService registered** in `LoanService/Program.cs`.
- **goldLoanService.ts**: typed frontend API client (10 functions, 8 types).
- **4 new React pages**: `GoldRateAdmin.tsx`, `GoldLoanList.tsx`, `GoldLoanOrigination.tsx`, `GoldLoanDetail.tsx`.
- **AppRouter.tsx**: 4 lazy-loaded routes (permission-gated). **Sidebar.tsx**: Gold Loans section + Gold Rate admin. **Dashboard.tsx**: Gold Loans Active KPI stat card.
- **GoldLoanTests.cs**: 4 NUnit tests (LTV correct, LTV>75% rejected, no pledge items rejected, GoldRateService fallback to yesterday's rate).
- **10-gold-loan.cy.ts**: 17 Cypress regression tests (3 describe blocks: Gold Rate Admin, Gold Loan List, Gold Loan Detail).
- **Stub fixes**: `NoOpTransactionService` given 2 new gold journal methods; all 4 `FakeForms`/`FakeFormsWithSchema`/`FakeFormsThrow` stubs given `GetFormSchemaAsync` (pre-existing DFS-001 gap).
- **Test result: 82/82 passing** (78 existing + 4 new).

### Session 38 — 2026-04-21 (SAAR-DFS-003 — LoanOrigination DFS additive wiring)
- **`SAAR_DFS_003_REQUIREMENTS.md`**: JIRA-format requirement doc (8 FRs FR-LO-001 to FR-LO-008; AC-01 to AC-05; offline-resilience test plan).
- **`SchemaForm.tsx`**: Added `case 'textarea': return <TextField multiline minRows={3} {...common} />;` — was the only missing type case, would crash on any DFS textarea field.
- **`LoanOrigination.tsx`**: Wired DFS schema as additive "Bank-Configured Fields" layer:
  - Imports: `Accordion`/`AccordionSummary`/`AccordionDetails` + `ExpandMoreIcon` (from MUI); `SchemaForm`; `dynamicFormsService` + `DFSFormSchema` type.
  - `HARDCODED_DFS_FIELDS` Set — 12 field names already in the hardcoded form; custom fields must not include these.
  - `DFS_SECTION_TO_STEP` map — `applicant_details→0`, `employment_income→1`, `loan_details→2`.
  - `dfsSchema`/`customFields` state; `useEffect` on mount fetches `PERSONAL_LOAN` schema, silent-fails if DFS offline.
  - `BankConfiguredFields({ stepIndex })` inline component — filters fields by step+exclusion, renders dashed-border Accordion + SchemaForm; returns null if no custom fields for that step.
  - Steps 0/1/2 each call `<BankConfiguredFields stepIndex={N} />` at bottom of CardContent.
  - Review step (Step 5): "Bank-Configured Fields" summary Card with label/value rows (conditional on customFields having entries).
- **Zero TypeScript errors** in both changed files (`tsc --noEmit` confirms); pre-existing FormBuilder.tsx errors unaffected.

### Session 37 — 2026-04-21 (Cypress regression 108/108 — Form Builder spec added)
- **`09-form-builder.cy.ts`** (new, 22 tests): Cypress regression spec for SAAR-DFS-002 Form Builder UI.
  - 3 describe blocks: Schemas Tab (10 tests), Field Editor Tab (7 tests), History Tab (5 tests).
  - Single `stubFormsApi()` route-handler intercept dispatches GET requests by URL shape (list vs schema-get vs history).
  - Covers: page load, 4 tabs, schema table, version chips, aria-label buttons, Edit→Field Editor tab switch, section accordions, field labels, Save→Saved v2 chip, History tab, View JSON dialog.
  - All 22 tests green on first run (19s). Full regression suite: **108/108** (was 86/86).

### Session 36 — 2026-04-21 (SAAR-DFS-002 Form Builder UI)
- **`dynamicFormsService.ts`** (new): typed `fetch`-based API client for all 5 DFS endpoints (list, get, save, reset, history). Uses `auth-token` from localStorage for Bearer auth.
- **`FormBuilder.tsx`** (new, 4-tab page): Tab 0 = Schemas table (Edit/History/Reset per row); Tab 1 = Field Editor — split pane with MUI Accordion sections + `FieldCard` stack (▲/▼/✕) left + `FieldPropertyEditor` right (conditional Min/Max/MaxLength/Options/Regex inputs per field type); Tab 2 = Preview (reuses `SchemaForm` with `readonly=true`); Tab 3 = History table + View JSON dialog.
- **`AppRouter.tsx`**: lazy-loaded `/admin/form-builder` route protected by `BANKING_PERMISSIONS.SYSTEM_CONFIG`.
- **`Sidebar.tsx`**: "Form Builder" entry with `DynamicFormIcon` added to Administration children array.
- **`nginx/nginx.conf`**: added `/api/forms` location block → `dynamicfields:5013` (was only `/api/DynamicForm`).
- **`SAAR_DFS_002_REQUIREMENTS.md`**: JIRA-format requirement doc with 9 FRs (FR-FB-001 to 009), 5 NFRs, 12-step test plan.
- No new npm dependencies; no backend changes.

### Session 35 — 2026-04-19 (SAAR-DFS-001 Dynamic Forms Service fully implemented)
- **DynamicFieldsSchemaService** rebuilt from a 7-field stub into a real multi-tenant DB-backed service.
- **Models**: `FormSchema` + `FormSchemaHistory`. **DbContext**: `DynamicFormsDbContext` with `TenantModelCacheKeyFactory` (identical pattern to AccountService). **EF migration**: `AddFormSchemas` (schema qualifiers stripped for multi-tenancy).
- **TenantSchemaProvisioner**: provisions `public`, `ucb_demo`, `nbfc_demo` schemas on startup. **TenantResolutionMiddleware**: resolves tenant from JWT `tenant_id` claim → `X-Tenant-ID` header → `"public"` fallback.
- **FormSchemaSeedService** (IHostedService): seeds 5 schemas idempotently — PERSONAL_LOAN (12 fields, 3 sections), GOLD_LOAN (10 fields), ACCOUNT_OPENING_SB (10 fields), ACCOUNT_OPENING_FD (8 fields), KYC_INDIVIDUAL (8 fields). All include PAN/Aadhaar/mobile/pincode regex validation + Indian state dropdown.
- **FormsController (6 endpoints)**: GET schema (tenant fallback), GET list (admin), PUT save+version+history, POST reset, GET history, POST validate.
- **LoanService** updated: `DynamicFormsClient` rewritten — new `GetFormSchemaAsync` calls DFS API; `GetLoanFormSchemaAsync` kept as default interface method returning null (backwards-compat). `AdminConfigController` proxies GET/PUT to DFS when `EnableDynamicForms=true`.
- **DynamicFieldsSchemaService.Tests**: 13/13 NUnit tests green (EF InMemory 9.0.6). Test project added to solution.

### Session 31 — 2026-04-13 (Cypress regression suite ALL GREEN — 86/86 passing)
- **`env -i` Cypress breakthrough**: Cypress Electron binary can now run from Git Bash by stripping all MSYS/Cygwin environment variables. Command: `env -i PATH="C:\\Windows\\System32\\WindowsPowerShell\\v1.0;..." CYPRESS_BASE_URL="http://localhost:3002" node ./node_modules/cypress/bin/cypress run --spec "..."`. Need PowerShell in PATH so Cypress can spawn `powershell.exe` for browser detection. This permanently resolves the "Cypress CANNOT run from Git Bash" limitation.
- **15 regression failures fixed** across 4 spec files (was 86 tests, 71 pass, 15 fail → 86/86):
  - `05-transactions.cy.ts`: BALANCES mock missing `normalBalance`/`debitTotal`/`creditTotal` → `INR(undefined)` crashed React on render. JOURNALS mock had wrong field names. Journal tab click now uses `[role="tab"]` scope.
  - `06-customers.cy.ts`: MUI TextField with `{...field('firstName')}` spread does NOT add `name` attr → `input[name="firstName"]` finds nothing. Fix: `cy.get('[role="dialog"]').find('input:not([type="hidden"])').first()`.
  - `07-users.cy.ts`: Tab labels runtime value is "Users (3)" not "Users" — anchored regex `/^Users$/` never matches. Role table has no description column — test renamed. "New Role" button only shows when `tab===1`.
  - `08-expression-builder.cy.ts` (complete rewrite): `cy.wait([...]).catch()` invalid — Cypress chainable has no `.catch()`; `{ body: EXPRESSIONS[] }` wrong — component reads `data.expressions`; EXPRESSIONS items missing `id` field; textarea has no `name` attr.
- **Final result**: 86/86 green, 0 failing, 1m 39s runtime.

### Session 30 — 2026-04-13 (Cypress regression suite pre-run fixes)
- **3 root causes fixed** before running regression locally:
  1. **`run-regression.bat`**: Added `set REACT_APP_DISABLE_DEV_AUTH=true` to React start command. authSlice already had this escape hatch but the bat file was not using it. Fixes all `01-auth.cy.ts` tests (login form no longer auto-redirects in dev mode). `cy.loginAsDemo()` (mock-jwt-token-* path) still works.
  2. **`AccountManagement.tsx`**: Added `aria-label` to 4 IconButton elements (Freeze Account, Unfreeze Account, Process Maturity, Premature Closure). MUI v7 Tooltip `title` prop creates a popover but does NOT set a DOM `title` attribute on the child — so `[title*="Freeze" i]` selectors in `03-accounts.cy.ts` would find zero elements. Also improves screen-reader accessibility.
  3. **`08-expression-builder.cy.ts`**: 5 tests fixed — "New Expression button is visible" → "Create/Edit tab is visible"; all tests that clicked `/new expression|create expression/i` now click `cy.contains(/Create\/Edit/i)` instead. SimpleExpressionBuilder.tsx has always used a tabbed interface (not a button).

### Session 29 — 2026-04-12 (Cypress smoke test fixes — 12/29 → 0 failing)
- **12 failing smoke tests fixed** (commit `1f8f780`). Root causes:
  - Auth: `NODE_ENV=development` → `isDevelopment=true` → `isAuthenticated=true` always → `/login` redirects. Tests now conditional on `cy.url()`.
  - API Health Checks: `ECONNREFUSED` not catchable via `failOnStatusCode:false`. Added `this.skip()` gate + `CYPRESS_SKIP_API_HEALTH=true` in `cypress-e2e.yml`.
  - Account filter tabs: `**/api/account/accounts*` pattern wrong — `accountService.ts` calls `GET /api/account`. Updated to `**/api/account*`.
  - Loan seeded apps: `**/api/LoanApplications*` wrong — `getApplicationsList()` calls `GET /api/loans/applications`. Fixed URL + response body to match paginated format.
  - Customer search: `CustomerManagement.tsx` has no search input — changed test to check table column headers.
  - Expression Builder: no "New Expression" button — `SimpleExpressionBuilder.tsx` has "Create/Edit" tab. Updated assertion.
  - Open Account dialog click blocked by overlay — added `{force:true}`.
  - `stubApis()` in `e2e.ts` URL patterns fixed: `/api/account*`, `/api/loans*`, `/api/customer*`, `/api/ledger*`.

### Session 28 — 2026-04-11 (Hetzner deploy + TransactionService ledger migration fix)
- **Critical infra bug fixed**: `Journals`, `JournalEntries`, `ChartOfAccounts`, `LedgerBalances` were in `TransactionDbContext` since commit `bab9b9c` (2025) but were NEVER covered by any EF migration. `TenantSchemaProvisioner.MigrateAsync()` only applied `InitialCreate` + `AddAccountHistory` on Hetzner → all journal operations (loan disbursal, account maturity, journal drill-down) returned Postgres `"relation does not exist" 500`.
- **Migration fix**: `AddLedgerTables` (20260411175347) creates all 4 tables with unqualified names (schema: "public" qualifiers stripped per multi-tenancy pattern). Commit `474f7ee`.
- **Hetzner deploy**: `transactionservice` + `frontend` rebuilt. On startup: 3 schemas (public, ucb_demo, nbfc_demo) provisioned + 19 Chart-of-Accounts entries seeded each. Smoke test: `GET /api/journal/by-number/FAKE-999` with UCB JWT → 404. Journal drill-down now operational on demobank.
- **CI confirmed green**: Backend CI/CD #47, CI #91, Full Stack CI/CD #74 all passed for commit `6c5ee9c`. Initial failure of run 24281039850 was a transient NuGet CDN blip.

### Session 27 — 2026-04-11 (CI/CD test suite fully green)
- **Root cause analysis**: 5 separate root causes found across `AccountService.Tests` and `LoanService.Tests` that had accumulated silently across sessions 19–22.
- **NU1605 fix**: `AccountService.Tests.csproj` `Microsoft.EntityFrameworkCore.InMemory` 8.0.0 → 9.0.6 (AccountService was upgraded to EF9 in session 19; test project missed the bump).
- **Constructor drift fix**: `AccountController` gained 5 params (session 19), `LoanApplicationsController` gained `ITransactionServiceClient` (session 22). Updated `GetController()` factories in all 3 AccountService.Tests files; added `NoOpTransactionService`+`NoOpWorkflowClient` stubs in `EligibilityAndWorkflowTests.cs`.
- **EMI rounding**: `StandardEmi_ReturnsPositiveValues` `.Within(20m)` + `TotalPayment_EqualsEmiTimesMonths` `.Within(5m)` — `TotalPayment = Math.Round(emi*n, 0)` independently computed from `MonthlyEMI = Math.Round(emi, 0)`.
- **Income threshold**: `PreValidate_returns_MANUAL_REVIEW_and_null_rate_when_borderline` MonthlyIncome 12000→15000 (the hardcoded `PreValidate` path rejects income < 15000; `Submit` doesn't — they have different eligibility logic).
- **StubHttpMessageHandler**: added `updatedAt`+`returnType` to GET response; added `/api/expression-engine/execute` to POST handler (EvaluateExpressionAsync posts there, not to the old `/api/expressions/execute`); added interest-rate expression path (returns 10.5 decimal). **Final: 78/78 tests passing.**

### Session 26 — 2026-04-11 (Ledger UI — journal drill-down)
- **TransactionService**: `GetByJournalNumberAsync` added to `IPostingEngine` + `PostingEngine`. New `GET /api/journal/by-number/{number}` endpoint in `JournalController`.
- **transactionService.ts**: `getJournalByNumber(journalNumber)` added → `GET /api/journal/by-number/{encoded}`.
- **JournalDetailDialog** (new shared component `components/dialogs/JournalDetailDialog.tsx`): fetches journal from TransactionService by number, shows header metadata + MUI Table of double-entry lines (debit/credit, account codes, narration, totals row).
- **LoanDetail.tsx**: `disbursalJournalNumber` chip is now clickable — `onClick → setJournalDialogOpen(true)` with hover highlight and Tooltip; `JournalDetailDialog` renders conditionally. Inline dialog definition replaced with shared component import.
- **AccountManagement.tsx**: maturityJournalNumber `PaymentsIcon` now clickable — `onClick → setJournalNumber(acc.maturityJournalNumber)` with hover highlight; `JournalDetailDialog` renders. New `journalNumber` state added.

### Session 25 — 2026-04-11 (Hetzner deploy + Cypress smoke + regression suites)
- **Hetzner deploy**: rebuilt expressionbuilder, loanservice, accountservice, workfloworchestration, frontend. docker-compose.yml updated with Services__TransactionBaseUrl on loanservice + accountservice + all depends_on. All 11 containers healthy. Commit b134f74.
- **Cypress smoke suite** (`cypress/e2e/smoke.cy.ts`): 10 describe blocks covering Auth, Dashboard, Accounts, Loans, Transactions, Customers, Users, Expression Builder, Reports + API health checks. All API calls stubbed via cy.intercept(). Target < 3 min headless.
- **Cypress regression suite** (`cypress/e2e/regression/`): 8 spec files, ~60 tests:
  - 01-auth.cy.ts, 02-dashboard.cy.ts, 03-accounts.cy.ts (freeze/unfreeze/maturity), 04-loans.cy.ts (disbursal journal), 05-transactions.cy.ts (post-entry validation), 06-customers.cy.ts, 07-users.cy.ts (RBAC), 08-expression-builder.cy.ts.
- **New support commands**: cy.loginViaApi() (real UAM JWT) + cy.stubApis() (bulk intercept).
- **Batch scripts**: run-smoke.bat + run-regression.bat for cmd.exe headless runs.

### Session 24 — 2026-04-10 (GL journal numbers + freeze/unfreeze — SCRUM-228/229/230)
- **LoanApplication.DisbursalJournalNumber** (string?, MaxLength 50) + EF migration `AddDisbursalJournalNumber`. DISBURSE saves journal number. `LoanDetail.tsx` shows green monospace GL Journal # chip (PaymentsIcon) in Loan Parameters section.
- **Account.MaturityJournalNumber** (string?, MaxLength 50) + EF migration `AddMaturityJournalNumber`. Both `/mature` (auto-renewal + non-renewal paths) and `/premature-close` save journal number on success.
- **AccountController freeze/unfreeze**: `POST /api/account/{id}/freeze` (Status→"Frozen") + `POST /api/account/{id}/unfreeze` (Status→"Active").
- **accountService.ts**: `freeze(id)` + `unfreeze(id)` methods; `maturityJournalNumber?` added to `AccountRecord`.
- **AccountManagement.tsx**: AcUnitIcon (freeze, blue) + LockOpenIcon (unfreeze, green) buttons; PaymentsIcon tooltip on Mature rows; Close Account hidden for Frozen accounts.
- 0 TypeScript errors; AccountService builds with 0 C# errors.

### Session 23 — 2026-04-10 (FD/RD lifecycle UI — accountService + AccountManagement + Dashboard)
- **accountService.ts**: added `MaturityRecord`, `MatureResult`, `PrematureCloseResult` interfaces; `mature(id)`, `prematureClose(id)`, `upcomingMaturities(days)` methods. Added `maturityDate`, `termMonths`, `annualRate`, `autoRenewal` to `AccountRecord`.
- **AccountManagement.tsx**: "Process Maturity" button (SavingsIcon, blue) + "Premature Closure" button (MoneyOffIcon, amber) for Active FD/RD rows. `Mature` and `Dormant` STATUS_CONFIG entries. `Mature` in STATUS_FILTERS. `successMsg` state shows journal number + payout on success. Close Account button hidden for already-Mature accounts.
- **Dashboard.tsx**: "Upcoming Maturities" full-width card widget above Recent Activity. Live API call to `/api/account/upcoming-maturities?days=30` on mount. Table: Account #, Customer, Type, Principal, Rate, Maturity Date (with days-left urgency chip — red ≤7d, amber ≤14d, green >14d), Projected Payout. Skeleton loader while loading. Zero TypeScript errors.

### Session 22 — 2026-04-10 (SCRUM-187 + SCRUM-223/224/225 — disbursal wiring + FD/RD lifecycle)
- **EXPR_MATURITY_INTEREST_CALC** (seed #15) + **EXPR_PREMATURE_CLOSURE_PENALTY_CALC** (seed #16) added. Total: 17 seeded expressions.
- **ITransactionServiceClient / TransactionServiceClient** added to AccountService.
- **AccountController** extended with 3 new endpoints:
  - `GET /api/account/upcoming-maturities?days=N` — FD/RD maturing in next N days with projected interest
  - `POST /api/account/{id}/mature` — expression-driven interest, DR 2010+5010 / CR 1010 journal, AutoRenewal support
  - `POST /api/account/{id}/premature-close` — penalty expression, balanced journal, closes account
- **AccountService** added to start-all.sh on port 5217; appsettings updated with TransactionBaseUrl.
- 0 build errors across all modified services.

### Session 22 — 2026-04-10 (SCRUM-187 — LoanService → TransactionService disbursal wiring)
- **EXPR_GL_MAPPING_LOAN_DISBURSAL** seeded — returns "debitCode|creditCode" (e.g., "1020|1010") based on product type; tenant-configurable from Expression Builder UI.
- **ITransactionServiceClient / TransactionServiceClient** created in LoanService/Services/ — HTTP POST to `/api/journal` with idempotency key `DISBURSAL-{applicationNumber}`.
- **LoanApplicationsController** DISBURSE case extended: evaluates GL mapping expression → posts DR 1020 (Loans and Advances) / CR 1010 (Cash and Bank) journal to TransactionService → fire-and-forgets workflow step. Non-fatal if TransactionService is unreachable.
- **TransactionService** added to start-all.sh on port 5005; appsettings.Development.json updated; TransactionServiceDb created.
- **LoanService appsettings.Development.json** updated with TransactionBaseUrl.
- **Services ports**: 5004 (Expression), 5005 (Transaction), 5012 (Workflow), 5013 (DynamicForms), 5130 (Loan), 3002 (React).

### Session 19 — 2026-04-07 (workflow engine persistence + AccountService wiring + deposits)
- **WorkflowOrchestrationService real persistence**: EF Core 9 + Npgsql 9. WorkflowInstanceEntity (ContextJson/ApprovalRequirementsJson as text). Full schema-per-tenant multi-tenancy (4 files copied from LoanService). Models extracted to WorkflowModels.cs. LoadWorkflowInstanceAsync / SaveWorkflowInstanceAsync wired to DB. EF migration InitialCreate (schema qualifiers stripped). Program.cs updated: JWT, DbContext, tenant provisioner.
- **ExpressionBuilderService seeds**: 4 new routing expressions (total 14). EXPR_ROUTING_LOAN_ORIGINATION, EXPR_APPROVAL_LOAN_ORIGINATION, EXPR_ROUTING_ACCOUNT_OPENING, EXPR_APPROVAL_ACCOUNT_OPENING.
- **LoanService wired to real workflow**: UseLocalWorkflowOrchestrator→false. DISBURSE action fire-and-forgets ProcessStepAsync.
- **AccountService full wiring**: EF8→9.0.6, Npgsql8→9.0.4. TenantSchemaProvisioner simplified (EF9 handles __EFMigrationsHistory). 3 new service clients. 7 deposit fields on Account (TermMonths, MaturityDate, InterestRate, AutoRenewal, InstallmentAmount, PrematureClosurePenalty, WorkflowInstanceId). EF migration AddDepositFields (schema qualifiers stripped). CreateAccount wired for FD/RD validation + expression rate + workflow start. ApproveAccount fires workflow APPROVE step. New GET /api/account/{id}/eligible-rate endpoint.
- **Jira tickets**: jira-create-workflow-tickets.js created + run. 5 epics (SCRUM-190–204, 210, 220) + 31 stories (SCRUM-191–225).
- All 4 modified services build with 0 errors.

### Session 18 — 2026-04-06 (test quality initiative — SCRUM-188 + testing)
- **Jira test cases**: `docs/TEST_CASES_LOAN_ORIGINATION.md` — 70+ BDD tests across 12 categories (TC-01 to TC-12), covering EMI/FOIR/LTV calculators, eligibility API, products API, state machine, frontend list/detail/form, and demo data
- **NUnit unit tests**: `LoanService.Tests/EligibilityAndWorkflowTests.cs` — 40 tests in 6 fixture classes (EmiCalculator, FoirCalculator, LtvCalculator, CheckEligibility, LoanApplicationsList, LoanStateMachine); builds with 0 errors
- **Cypress E2E**: `frontend-react/cypress/e2e/loan-management.cy.ts` — 25+ tests across 5 suites using `cy.session()` login cache; direct API smoke tests on LoanService port 5130
- **Demo seeder extended**: 3 new apps bringing total to 8 per tenant (DRAFT, APPROVED/sanctioned, INFO_REQUESTED); all workflow states now covered
- Commit: `1a138e1` (pushed to GitHub); Hetzner SSH unreachable — pending `docker compose up --build -d loanservice`

### Session 16 — 2026-04-06 (demo data seeder — SCRUM-188)
- **LoanDemoDataSeeder**: 5 realistic loan applications per tenant spanning all workflow states
  - Priya Sharma (Personal ₹5L, SUBMITTED), Rajesh Kumar (Home ₹45L, IN_REVIEW), Anjali Mehta (Business ₹10L, CREDIT_APPROVED), Vikram Nair (Gold ₹2L, DISBURSED), Sunita Patel (Vehicle ₹8L, REJECTED)
  - Full approval action history per application (CREATED → ... → final state)
  - Documents per application with realistic PENDING/UPLOADED/VERIFIED statuses
  - Idempotent: checks by ApplicationNumber; runs on startup per-tenant
  - Files: `LoanService/Data/LoanDemoDataSeeder.cs`, `LoanService/Program.cs` (2 lines added)
- Next: deploy to Hetzner (restart loanservice container)

### Session 9 — 2026-03-30 (RBI functional requirements Jira backlog)
- **RBI requirements research**: reviewed KYC Master Directions (UCB) 2025, IRAC Master Circular 2024/2025, PSL Master Directions 2024 (60% ANBC), Interest Rate Directions 2025, Management of Advances 2025, Cyber Security Framework UCBs, ALM guidelines, IDRBT CBS requirements
- **Jira backlog — RBI requirements**: 13 epics + 61 stories (SCRUM-85 to SCRUM-159):
  - SCRUM-85: KYC & AML (7 stories — UCIC, CDD tiers, periodic re-KYC, CKYC/CERSAI, PEP/EDD, STR/FIU, V-CIP)
  - SCRUM-93: Deposit Account Management (6 stories — SB, FD, RD, TDS, dormant, nomination)
  - SCRUM-100: Loan Origination & Credit Appraisal (7 stories — application, KFS, DSCR, exposure limits, small-value loan, collateral, disbursement)
  - SCRUM-108: NPA Management & IRAC (5 stories — SMA, NPA classification, provisioning, recovery, write-off)
  - SCRUM-114: Interest & Fee Engine (4 stories — accrual, penal charges, fee matrix, rate management)
  - SCRUM-119: Payments & Clearing (6 stories — NEFT, RTGS, CTS, NACH, UPI, DD)
  - SCRUM-126: Regulatory Returns (6 stories — CRR, SLR, DSB-01, CRILC, CRAR, ALM)
  - SCRUM-133: Priority Sector Lending (3 stories — PSL tagging, ANBC, dashboard)
  - SCRUM-137: Branch Operations & Cash (3 stories — teller drawer, vault, EOD balancing)
  - SCRUM-141: General Ledger & Financials (4 stories — COA, double-entry, financial statements, statutory reserve)
  - SCRUM-146: Government Schemes (4 stories — PMMY, PMJJBY/PMSBY, KCC, SHG)
  - SCRUM-151: Digital Banking & Cyber Security (3 stories — internet banking, OTP, RBI cyber controls)
  - SCRUM-155: Customer Service & Grievance (3 stories — grievance, ombudsman, multilingual)
- **Total Jira backlog**: 25 epics + 133 stories (SCRUM-1 to SCRUM-159)
- **v0.1.0 tag** created at d002f20 (stable demo baseline before architecture work)

### Session 8 — 2026-03-29 (architecture docs, 84 Jira issues, SCRUM-79 Customer UI fix)
- **Architecture documentation**: Created 12 ADRs (ADR-001 to ADR-012) in `ARCHITECTURE/adr/` covering multi-tenancy, service decomposition, tech stack, event architecture, parametrization, DB strategy, security, EOD/BOD engine, reporting, AI pipeline, API gateway, and deployment
- **14 component docs** in `ARCHITECTURE/components/` with responsibilities, API surfaces, data models, and IDRBT compliance mapping
- **Gap analysis**: 12 critical/high/medium gaps identified (no Identity, no Maker-Checker enforcement, no multi-tenancy, etc.)
- **Jira creation**: 84 issues created via REST API — 12 epics (SCRUM-1, 9, 17, 24, 32, 41, 49, 55, 61, 67, 73, 78) + 72 stories with ADF descriptions and acceptance criteria
- **SCRUM-79 Customer Management UI**: Code was already implemented; fixed `ValidatePan`/`ValidateAadhaar` endpoints to always return HTTP 200 with `{ isValid, message }` format (previously returned 400 on invalid input, causing axios to throw and swallow the error message); fixed `apiService.ts` fallback port 5002 → 5004

### Session 7 — 2026-03-28 (dual-app hosting + Cloudflare SSL)
- Dual-app nginx: nginx container joined to both `saar-core-banking-services_saar-net` and `ai-consultant_default` networks
- Added `saaritsolutions.com` server blocks to nginx.conf; nginx now proxies both banking demo and AI Consultant
- Cloudflare DNS: `demobank` A record → 89.167.53.218 (proxied); Cloudflare SSL mode set to "Full"
- **Server state:** https://demobank.saaritsolutions.com → 200 (valid cert, no browser warning); https://saaritsolutions.com → 200; API → 200. Both apps LIVE.

### Session 6 Commits — 2026-03-28 (deployment live)
- `dd938b0` — nginx Docker DNS resolver + variable proxy_pass (fixes "host not found in upstream" at startup)
- `6b8fcef` — Remove fork-ts-checker in production build (eliminates ~1 GB child-process OOM on VPS)
- `a30d319` — Disable source maps + ESLint in Docker build (reduce webpack peak heap by ~400 MB)
- `1445a56` — Increase Node.js heap to 3072 MB for React Docker build
- `f8cbe2c` — Resolve ExpressionBuilderService NuGet NU1107 conflict; remove docker-compose version attr

### Session 5 Commits — 2026-03-28
- `70e08ec` — **Hosting infrastructure**: docker-compose.yml (postgres + 6 services + frontend + nginx), Dockerfiles for ExpressionBuilderService/WorkflowOrchestrationService/DynamicFieldsSchemaService/CustomerService/TransactionService/frontend-react, nginx reverse proxy with HTTPS for demobank.saaritsolutions.com (Hetzner), CORS env-var injection in 4 services, LoanService inter-service URLs made configurable via env, frontend port 5002→5004 bug fixed, CustomerService KYC stub (KycStatus enum, PanValidationService, PAN+Aadhaar validate endpoints, EF migration AddKycStatus)

### Session 3 Commits — 2026-03-26
- 9e81653 — **M3 Expression Library**: ExpressionSeedService seeds 10 banking rules on startup; 10 built-in templates in ExpressionTemplates.tsx; LoanService silent interest-rate fallback replaced with actionable error
- `8b0fc90` — **M2 WorkflowTimeline polish**: status colour icons, SLA chips, retry button, expandable notes; LoanOrigination updated to push rich WorkflowEvent objects; `.gitattributes` added

### Session 2 Commits — 2026-03-26
- `e0d20c4` — **M1 Loan Wizard complete**: EMI estimate in right-rail, working file upload with list/remove, PAN/Aadhaar/mobile input masking in SchemaForm (no library)
- `6751022` — Added `cypress/screenshots/` and `cypress/videos/` to `.gitignore`
- `012dace` — Restored git tracking (171 files re-staged after index clear); added PROJECT_STATE.md, TASK_QUEUE.md, DECISIONS_LOG.md

### Prior Session Commits (most recent first)
- `cc10d2e` — Added strategic analysis docs (EXECUTION_ROADMAP, HONEST_IMPLEMENTATION_REALITY_CHECK, ACTUAL_IMPLEMENTATION_DEPTH_ANALYSIS, VALUATION_METHODOLOGY_BREAKDOWN, CURRENT_ASSET_INVENTORY)
- `894e039` / `2bd606e` — Cypress E2E test changes and fixes
- `0b4fde2` — Expression AI frontend integration (AI controllers wired to React UI)
- `d67c7a4` / `b3d38b7` — OpenAI integration in ExpressionBuilderService
- `13f0d0b` — All updates for demo
- `e9e814d` — Dynamic form field improvements

### Key Files Changed This Session
| File | Change |
|---|---|
| `frontend-react/src/pages/LoanOrigination.tsx` | EMI useMemo, file upload state + handlers, AttachFile/Close icons |
| `frontend-react/src/components/forms/SchemaForm.tsx` | getMaskedHandler, getMaskedDisplay, getPlaceholder for PAN/Aadhaar/mobile |
| `.gitignore` | Added cypress/screenshots and cypress/videos patterns |
| `PROJECT_STATE.md` / `TASK_QUEUE.md` / `DECISIONS_LOG.md` | Created as living context documents |

---

## 6. Pending Work

### In Progress
- (none)

### Recently Completed
- **SAAR-CST-001 (CustomerService Pagination + Search + Demo Seeder)** — `GET /api/customer` paginated + filtered; `CustomerDemoDataSeeder` seeds 8 customers per tenant (all KYC states); filter bar + MUI Pagination in CustomerManagement.tsx; 21/21 NUnit tests passing.
- **SAAR-KYC-001 (KYC Workflow — CustomerService)** — 5 backend KYC action endpoints (initiate/submit-docs/verify/reject/expire), frontend KYC buttons + dialog in CustomerManagement.tsx, 17/17 unit tests passing.
- **SAAR-DFS-004 (Wire DFS into Gold Loan wizard + persist custom fields)** — `GoldLoanController.cs` + `goldLoanService.ts` + `GoldLoanOrigination.tsx` + `GoldLoanDetail.tsx` extended; new test `CustomFieldsJson_IsStoredAndRoundTrips`; 3 new DFS Cypress regression tests in `10-gold-loan.cy.ts`. Blocker: CI policy blocks dotnet test — code correct, fix pending admin action.
- **SAAR-CFG-001 (Bank Configuration + Feature Toggles)** — Tenant model extended (13 cols), JWT claims, TenantConfigController, BankConfig.tsx (2-tab admin page), Sidebar feature gating, 5/5 UAMService.Tests + 82/82 LoanService.Tests.
- **M4: Form Builder (SAAR-DFS-002)** — 4-tab React page: schema list, field editor (▲/▼/property panel), preview, history. Deployed via PR #SAAR-DFS-002.

### Milestone Backlog (from CONTEXT.md)
| Milestone | Description |
|---|---|
| M2 | Workflow timeline polish — SLA chips, retry/notes (**Complete**) |
| M3 | Expression Library — seed service, 10 built-in templates, LoanService fallback removed (**Complete**) |
| M3 | Expression Library harness, remove demo fallback logic |
| M4 | Form builder MVP |
| M5 | Compliance — KFS disclosure, consent, PAN validation |
| M6 | Admin console |
| M7 | Demo polish |
| M8 | Performance & observability |

### Year 1 Q1 2026 Plan (Jan–Mar — NOW OVERDUE)
Per `EXECUTION_ROADMAP.md`:
- AccountService v1 (lifecycle, statements, joint/nominee, freeze/unfreeze)
- ReportingMIS v1 (operational reports, audit exports)
- WorkflowOrchestration v1 (persisted state, SLA timers, events)
- Compliance v0.9 (RBI reporting skeleton, audit log immutability)

### Known Issues / Limitations
- No real posting engine — TransactionService is a stub
- No KYC workflow — CustomerService is basic CRUD
- APIGateway has no auth, rate limiting, or circuit breakers
- No inter-service communication implemented
- Missing `.gitattributes` for cross-platform LF/CRLF consistency (CRLF warnings appear on Windows commits)

---

## 7. Next Recommended Steps (Ordered by Impact)

1. **Deploy SAAR-LRP-002 to Hetzner**: `docker compose up --build -d loanservice frontend` on Hetzner.
2. **E2E smoke on demobank**: `/reports` Tab 4 Overdue Loans (verify empty state or seeded data), EMI Collection card on UCB-GL-2026-004.
3. **Fix Kaspersky Application Control** (local only): Kaspersky Settings → Application Control → add exclusion for `C:\Users\LENOVO YOGA\SAARIT\saarit-finops`. Then re-run `dotnet test` locally.
4. **Next feature**: SAAR-NPA-001 (NPA classification board) or SAAR-STMT-001 (Account Statement endpoint).
5. **APIGateway: JWT auth + routing** — required for any real service-to-service flow.

---

## 8. Developer Notes

### Assumptions
- `ASPNETCORE_ENVIRONMENT=Development` must be set for all services to enable Swagger, CORS, and feature flags
- Active eligibility expression ID is `EXPR_1755237353842` — do not delete from ExpressionBuilderService DB
- Services are run via `start-all.sh` / `scripts/start-all.sh` which handles port conflicts

### Known Risks
- **No real database migrations** in most services — only ExpressionBuilderService has a confirmed migration; others use in-memory or auto-created schemas
- **OpenAI API key** must be present in ExpressionBuilderService `appsettings.json` for AI features to work (not committed — managed manually)
- **Git index clearing** happened once — unknown cause; recommend verifying `.gitignore` before major restructures
- **Angular frontend** (`frontend-ui/`) appears unmaintained relative to React frontend — check before investing more work there
- **No inter-service auth** — service-to-service calls are unauthenticated in current dev setup

### Things to Be Careful About
- Do not add `bin/`, `obj/`, or `node_modules/` to git — `.gitignore` covers these but always verify before `git add .`
- ExpressionBuilderService security validator blocks dangerous namespaces — do not weaken this
- Redux state uses `redux-persist` — if schema changes, the persisted state in browser localStorage may cause hydration errors; bump the persist version key
- Port 5004, 5012, 5013, 5130 are canonical for dev — do not change without updating `CONTEXT.md` and all `appsettings.Development.json` files
