# PROJECT_STATE.md — SaaR Core Banking Services

**Last Updated:** 2026-04-06 (session 15 — E2E loan origination complete)
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

### Partially Implemented
- **LoanService** (~35%) — eligibility, interest rate, origination, workflow steps; disbursement missing
- **AccountService** (~30%) — full CRUD with nominees/passbooks/restrictions/lifecycle; statements missing
- **CustomerService** (~25%) — CRUD, KYC stub, PAN/Aadhaar validation; full KYC workflow missing
- **UserAccessManagementService** (~40%) — JWT login, seed users, role CRUD; password reset, MFA missing
- **WorkflowOrchestrationService** (~3%) — placeholder only

### Not Started (Confirmed Empty / Stub)
- EOD/BOD batch processing, InterestFeeService, ReportingMIS, full GL Chart of Accounts management
- InterestFeeService (accrual logic)
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
- **M4: Form builder MVP** — drag-and-drop form builder UI; persist schemas to DynamicFieldsSchemaService

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

1. **M2: Workflow Timeline polish** — add SLA chips, status colour coding, retry/notes to WorkflowTimeline component
2. **TransactionService: double-entry ledger** — posting engine with idempotency; highest-impact missing backend piece
3. **CustomerService: KYC stub** — `KycStatus` enum, PAN format endpoint, Aadhaar upload placeholder
4. **APIGateway: JWT auth + routing** — required for any real service-to-service flow
5. **Add `.gitattributes`** — `* text=auto` to eliminate CRLF warnings on Windows commits
6. **InterestFeeService: daily accrual engine** — needed for savings account demo
7. **WorkflowOrchestration: persisted state machine** — enables real loan approval workflow

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
