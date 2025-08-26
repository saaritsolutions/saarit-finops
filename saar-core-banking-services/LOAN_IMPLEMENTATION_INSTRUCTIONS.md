# Loan Features – Implementation Instructions

Strict rule: Do not keep any half-baked solutions. Complete each feature fully (functional, documented, and tested) before moving to the next.

## Phases overview
- Phase 0: Contracts, flags, scaffolding
- Phase 1: Backend with static forms + hardcoded workflow
- Phase 2: Integrate workflow engine
- Phase 3: Integrate dynamic forms
- Phase 4: Introduce expressions
- Phase 5: Complete API testing
- Phase 6: Frontend (frontend-react) implementation

Each phase must meet its Definition of Done (below) before proceeding.

---
## Phase 0 – Contracts, flags, scaffolding
Objectives
- Define API contracts (requests/responses) and enable Swagger.
- Externalize service URLs in appsettings.
- Add feature flags: EnableWorkflow, EnableDynamicForms, EnableExpressions.
- Seed placeholders (sample schema JSON, expression IDs, workflow step names).
Deliverables
- Swagger docs visible for Loan endpoints.
- appsettings.* with service URLs and feature flags.
- Minimal health checks and smoke tests.
Definition of Done
- Build green; APIs compile; flags resolved via configuration; basic tests pass.

## Phase 1 – Backend with static forms + hardcoded workflow
Objectives
- Persist LoanApplication (with JSON FormData) + link to LoanAccount optionally.
- Endpoints:
  - GET /api/LoanOrigination/form-schema/{productType} (static JSON)
  - POST /api/LoanOrigination/pre-validate (pure backend logic)
  - POST /api/LoanOrigination/submit (create application, emulate step transitions)
Deliverables
- EF migrations applied; repository and controller logic implemented.
- Unit/integration tests for happy/reject/validation paths.
Definition of Done
- Endpoints function end-to-end with DB; tests cover success and error flows; docs updated.

### Phase 1 status (as of 2025-08-17)
- Build: PASS (Debug) for solution.
- Tests: PASS — `LoanService.Tests` 5/5
  - Covered: APPROVED, MANUAL_REVIEW, REJECTED in pre-validate; submit persists and returns pseudo workflow ID when workflow disabled; rejected submit does not persist.
- Database: Migration applied; `LoanApplications` table created.
- Static forms: `LoanService/Static/loan_form_PERSONAL_LOAN.json` served when `EnableDynamicForms=false` (copied to output at build).
- Feature flags: Defaults are false in `LoanService/appsettings.json` (EnableWorkflow, EnableDynamicForms, EnableExpressions).

## Phase 2 – Swap to workflow engine
Objectives
- When EnableWorkflow=true, call WorkflowOrchestrationService to start/process.
- Keep Phase 1 fallback when engine disabled/unavailable (return meaningful 503 on hard failures).
Deliverables
- Workflow client with retry/correlation IDs; integration tests with mocked engine responses.
Definition of Done
- Engine path and fallback path both pass tests; metrics/logs emit workflow IDs.

## Phase 3 – Swap to dynamic forms
Objectives
- When EnableDynamicForms=true, fetch schema from DynamicFieldsSchemaService.
- Server-side validation adheres to schema rules (required, min/max, patterns).
- Fallback to Phase 1 static schema when dynamic service fails.
Deliverables
- Dynamic forms client; validation layer; tests for schema fetch, validation, and fallback.
Definition of Done
- Schema-driven validation enforced; graceful fallback; tests green.

## Phase 4 – Introduce expressions
Objectives
- When EnableExpressions=true, drive decisions via ExpressionBuilderService:
  - Eligibility: EXPR_LOAN_ELIGIBILITY_{PRODUCT}
  - Interest rate: EXPR_LOAN_INTEREST_RATE_{PRODUCT}
  - Workflow rules (routing/approvals/step completion) used by engine
- Safe defaults only where permitted (rate), not for eligibility.
Deliverables
- Expression client; robust error handling; context mapping with dot-keys.
- Tests for success, failure, and context correctness.
Definition of Done
- Expression-driven flow stable; deterministic fallback rules documented; tests pass.

## Phase 5 – Complete API testing
Objectives
- Contract tests (request/response), integration tests (DB + service stubs), and basic end-to-end API flows.
- Negative cases: engine down, expression errors, schema missing, invalid payload.
Deliverables
- Automated test suite; CI job executing tests; minimal performance sanity checks.
Definition of Done
- All tests green in CI; coverage on critical paths; Swagger examples validated.

## Phase 6 – Frontend (frontend-react)
Objectives
- Routes: /loans, /loans/new (wizard), /loans/:id (detail + workflow timeline).
- API layer (React Query) for origination; DynamicFormRenderer (RHF+Zod).
- Pre-validate UX; submit; detail with workflow actions.
Deliverables
- Pages: LoanListPage, LoanOriginationPage (wizard steps), LoanApplicationDetailPage.
- RTL tests for wizard/form and pre-validate; 1–2 Cypress happy paths.
Definition of Done
- Usable end-to-end flow; tests pass; feature toggles respected; basic accessibility checked.

---
## Quality bar and principles
- No half-baked features: each phase closed with complete functionality, tests, and docs.
- Feature flags: safe rollouts; fallback code paths tested.
- Error handling: clear messages, correlation IDs; no silent failures.
- Observability: log expression/workflow calls with latency; basic counters.
- Security: respect Protected routes; avoid logging PII from FormData; prepare for tenancy headers.

Run commands policy
- Always pass the explicit project/path when running apps to avoid wrong working directories:
  - dotnet: `dotnet run --project saarit-finops/saar-core-banking-services/LoanService/LoanService.csproj`
  - npm: `npm start --prefix saarit-finops/saar-core-banking-services/frontend-react`
  - Build solution: `dotnet build saarit-finops/saar-core-banking-services/SaaRCoreBankingMicroservices.sln -c Debug`
  - Tests (LoanService only): `dotnet test "saarit-finops/saar-core-banking-services/SaaRCoreBankingMicroservices.sln" -c Debug --filter FullyQualifiedName~LoanService.Tests`

## Configuration keys (suggested)
- Services: ExpressionBaseUrl, WorkflowBaseUrl, DynamicFormsBaseUrl
- Flags: EnableWorkflow, EnableDynamicForms, EnableExpressions
- Expressions: per-product IDs for eligibility, interest rate, workflow

## Open items to confirm
- Final workflow steps and ownership
- Expression IDs per product and seeding plan
- Dynamic forms schema ownership and versioning
- Disbursement timing (post-approval vs combined)

---
## Next steps (Phases 2–4)

### Phase 2 – Enable workflow engine path
- Behavior when `EnableWorkflow=true`:
  - Use `IWorkflowClient.StartLoanOriginationAsync` to create an instance and persist `WorkflowInstanceId`.
  - Return engine-driven status in submit response; retain Phase 1 fallback when disabled or on hard failures (503 with message).
- Tests:
  - Engine-enabled happy path (mock client), error path (client throws → fallback/503), and disabled fallback remains green.

### Phase 3 – Enable dynamic forms path
- Behavior when `EnableDynamicForms=true`:
  - Fetch schema via `IDynamicFormsClient.GetLoanFormSchemaAsync` and return `{ productType, fields }`.
  - Add server-side validation against schema (required/min/max/patterns); fallback to static JSON if service fails.
- Tests:
  - Schema fetch success, validation errors surfaced, and service failure falls back to static schema.

### Phase 4 – Enable expressions path
- Behavior when `EnableExpressions=true`:
  - Pre-validate: evaluate eligibility via expression; only compute rate when approved; map context keys (`customer.*`, `loan.*`, `product.*`).
  - Submit: use expression for eligibility and rate; persist results consistently; document deterministic fallback for rate only.
- Tests:
  - Expression success (APPROVED with rate), MANUAL_REVIEW (null rate), REJECTED (no persist), and error handling (clear messages; no silent defaults for eligibility).

### Notes / Troubleshooting
- EF Core version warnings observed during build; consider aligning Microsoft.EntityFrameworkCore packages across services to a single version to reduce noise.

## Sign-off
Once approved, implement Phase 0→1 first, then progress strictly in order. Each phase requires PR review with passing tests and updated docs before merging.
