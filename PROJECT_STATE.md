# PROJECT_STATE.md — SaaR Core Banking Services

**Last Updated:** 2026-03-26
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
- **Dynamic Forms** — DynamicFieldsSchemaService returns a 7-field demo schema; frontend renders forms from schema
- **AI-Assisted Rule Generation** — OpenAI GPT generates expressions and forms from natural language prompts
- **Workflow Visualization** — basic workflow timeline UI in React
- **Basic CRUD** — CustomerService, AccountService, LoanService, AccountService each expose basic create/read/update/delete APIs
- **Loan Wizard (In Progress M1)** — 5-step loan application flow in React; UX polish ongoing

### Partially Implemented
- **LoanService** (~25%) — eligibility checking and interest rate framework work; origination-to-disbursement lifecycle missing
- **AccountService** (~20%) — basic account creation and product types; balance management, statements, lifecycle missing
- **CustomerService** (~15%) — basic CRUD with PAN/UID uniqueness; KYC, risk profiling, CDD/AML missing
- **TransactionService** (~5%) — entity models exist; no real transaction processing engine
- **WorkflowOrchestrationService** (~3%) — placeholder only

### Not Started (Confirmed Empty / Stub)
- Double-entry ledger / posting engine
- InterestFeeService (accrual logic)
- Payment rails (IMPS, NEFT, RTGS, UPI)
- Full KYC/eKYC workflow
- RBI regulatory reporting
- GL Accounting (real journaling)
- Cheque clearing
- Card/ATM processing
- Remittance/Payments
- HRMS
- Multi-tenancy

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

### Last Commit: `cc10d2e` — Sep 27, 2025
- Added strategic analysis documents: `EXECUTION_ROADMAP.md`, `HONEST_IMPLEMENTATION_REALITY_CHECK.md`, `ACTUAL_IMPLEMENTATION_DEPTH_ANALYSIS.md`, `VALUATION_METHODOLOGY_BREAKDOWN.md`, `CURRENT_ASSET_INVENTORY.md`

### Prior Commits (most recent first)
- `894e039` / `2bd606e` — E2E test changes and fixes (Cypress)
- `0b4fde2` — Expression AI frontend integration (new AI controllers wired to React UI)
- `d67c7a4` — OpenAI sample integrations
- `f0fd8ba` / `286bc68` — Config updates and instruction docs
- `b3d38b7` — OpenAI integration (ExpressionBuilderService AI controllers)
- `13f0d0b` — All updates for demo
- `e9e814d` — Dynamic form field improvements

### Git State as of 2026-03-26
- **All files were untracked** (git index was cleared, likely by `git rm --cached`). Re-staged via `git add .` in this session.
- 171 files re-staged as modified (CRLF normalization only)
- 12 old Cypress screenshot PNGs staged for deletion (correct)
- Recommend: commit this restored state

---

## 6. Pending Work

### In Progress
- **M1: 5-Step Loan Wizard** — UX polish, right-rail summary, masked inputs, file upload (per CONTEXT.md)

### Milestone Backlog (from CONTEXT.md)
| Milestone | Description |
|---|---|
| M2 | Workflow timeline polish — SLA chips, retry/notes |
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
- `cypress/screenshots/` test artifacts were previously committed (should be gitignored)
- Missing `.gitattributes` for cross-platform LF/CRLF consistency

---

## 7. Next Recommended Steps (Ordered by Impact)

1. **Commit the restored git state** — run `git commit` with the currently staged changes
2. **Add `cypress/screenshots/` to `.gitignore`** — prevent test artifacts from being re-committed
3. **Complete M1 Loan Wizard UX** — file upload, right-rail summary, input masking
4. **TransactionService: double-entry ledger** — posting engine with idempotency; this is the highest-impact missing piece
5. **CustomerService: KYC stub** — even a basic Aadhaar/PAN hook unlocks the demo story
6. **APIGateway: JWT auth + routing** — required for any real service-to-service flow
7. **InterestFeeService: daily accrual engine** — needed for savings account demo
8. **WorkflowOrchestration: persisted state machine** — enables loan approval workflow demo

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
