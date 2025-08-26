# LoanService – Loan Origination Features

Loan Origination endpoints with staged integrations: Dynamic Forms (with static fallback), Workflow Engine, and Expression Engine.

## Endpoints

- GET /api/LoanOrigination/form-schema/{productType}
  - When FeatureFlags:EnableDynamicForms=true: fetches schema from DynamicFieldsSchemaService.
  - On fetch error or when disabled: falls back to static JSON under `LoanService/Static/loan_form_{PRODUCT}.json`.
  - Returns 404 if no static schema exists for the product.

- POST /api/LoanOrigination/pre-validate
  - Body: { customerId, loanAmount, tenureMonths, creditScore, monthlyIncome, debtToIncomeRatio, productType }
  - When FeatureFlags:EnableDynamicForms=true: server-side schema validation runs first; violations return 400 with `{ errors: [..] }`.
  - When FeatureFlags:EnableExpressions=true: uses Expression Engine to evaluate eligibility and interest rate.
  - Otherwise falls back to hardcoded eligibility/interest logic.

- POST /api/LoanOrigination/submit
  - Body: same as pre-validate
  - Flow:
    0) If FeatureFlags:EnableDynamicForms=true: validate request against schema (dynamic or static fallback). Validation errors return 400.
    1) Evaluate eligibility (expressions when enabled, else fallback rules)
    2) Persist LoanApplication
    3) Calculate interest rate (expressions when enabled, else fallback formula)
    4) Start workflow (when FeatureFlags:EnableWorkflow=true). On failure, returns 503 with `{ status: "ERROR", ... }`.
    5) When workflow disabled: emulate a simple pseudo-workflow using ApplicationId.
  - Returns: { status, applicationId, workflowInstanceId, interestRate, message }

## Feature Flags

Configured via appsettings or environment variables:

- FeatureFlags:EnableDynamicForms (bool)
  - true: fetch schema from DynamicFieldsSchemaService and validate requests; on failure, static JSON fallback
  - false: skip schema fetch; GET endpoint serves static JSON when present
- FeatureFlags:EnableWorkflow (bool)
  - true: start workflow via WorkflowOrchestrationService and adopt engine status; return 503 if engine fails
  - false: emulate pseudo-workflow (WorkflowInstanceId equals ApplicationId)
- FeatureFlags:EnableExpressions (bool)
  - true: use Expression Engine for eligibility and interest rate
  - false: use hardcoded rules and formula

## Dependencies and Ports

- ExpressionBuilderService: http://localhost:5004 (Expressions execute API)
- WorkflowOrchestrationService: http://localhost:5012
- DynamicFieldsSchemaService: http://localhost:5013

Adjust ports as needed in `LoanService/Program.cs` HttpClient registrations or via reverse proxy (API Gateway).

## Expression IDs expected

- Eligibility: EXPR_1755237353842 (string result: APPROVED | MANUAL_REVIEW | REJECTED)
- Interest Rate: EXPR_INTEREST_RATE (decimal result)

You can create these in ExpressionBuilderService or update the IDs in `ExpressionEvaluationService`.

## Quick Start

1) Build solution:
   dotnet build ../SaaRCoreBankingMicroservices.sln -c Debug

2) Run services (in separate terminals):
   - ExpressionBuilderService (default: 5001)
   - WorkflowOrchestrationService (configure to 5012)
   - DynamicFieldsSchemaService (configure to 5013)
   - LoanService

3) Test pre-validate (example body):
   {
     "customerId": "CUST001",
     "loanAmount": 250000,
     "tenureMonths": 60,
     "creditScore": 720,
     "monthlyIncome": 80000,
     "debtToIncomeRatio": 0.35,
     "productType": "PERSONAL_LOAN"
   }

## Tests and Status

- Unit tests (LoanService.Tests) cover:
  - Phase 1 baseline: eligibility/rate, persistence, pseudo-workflow
  - Phase 2: workflow engine success and failure (503) paths
  - Phase 3: dynamic-forms schema validation (400 on violations), valid path success, and static fallback when dynamic service fails

All current tests pass locally. Some build warnings remain due to EF Core version conflicts; these are non-blocking and can be cleaned by aligning package versions across projects.

## Next Steps

- Externalize service URLs to appsettings/environment
- Align EF Core package versions to remove MSB3277 warnings
- Phase 4: enable Expression Engine in tests with stubbed IDs for interest/eligibility and add assertion coverage
