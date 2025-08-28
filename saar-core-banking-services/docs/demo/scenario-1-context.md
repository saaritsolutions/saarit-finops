## Scenario 1 — Dynamic Credit Score Expression Impact (Demo context)

Purpose
-------
This document captures the demo context for Scenario 1: demonstrating real-time changes to the credit-score business rule and its immediate impact on loan pre-validation.

Status
------
- Story script: Ready (Playwright spec updated: `frontend-automation/tests/production-ready-e2e.spec.js`)
- Frontend code: Ready (UI updated to persist `usageType` as `category` for expressions)
- Expression engine: Ready (normalization + safe conversions added; ExpressionBuilder service rebuilt)
- E2E: Scenario 1 run completed (Playwright run passed locally during the demo)

Primary artifacts
-----------------
- Playwright spec: `frontend-automation/tests/production-ready-e2e.spec.js`
- Demo screenshot: `test-results/credit-score-impact-demo.png` (written by the spec run)
- Expression engine: `ExpressionBuilderService/Engine/RoslynExpressionEngine.cs` (normalization + Safe* helpers)
- Expression service logs and execution: `ExpressionBuilderService/Services/ExpressionService.cs`
- Loan pre-validate path: `LoanService` (calls ExpressionBuilder execute endpoint to evaluate active Validation expressions)

How to reproduce the demo (local)
--------------------------------
1. Start the backend services used by the demo (example):

```bash
# from repo root (macOS zsh)
cd /Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/ExpressionBuilderService
dotnet run --urls http://localhost:5004

cd /Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/LoanService
dotnet run --urls http://localhost:5130

cd /Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/frontend-react
npm run dev    # or the project's start command
```

2. Run the Scenario 1 Playwright test (single worker for deterministic output):

```bash
cd /Users/apple/GithubRepos/saarit-finops/saar-core-banking-services/frontend-automation
npx playwright test tests/production-ready-e2e.spec.js --workers=1 --reporter=list
```

Notes and next steps
--------------------
- The repository currently contains multiple active "Validation" expressions; if you want a single canonical rule for the demo, deactivate other active expressions in the ExpressionBuilder admin UI or via the API.
- Next: begin work on Scenario 2. I will create a short checklist for Scenario 2 once you confirm the goals.

Contact points
--------------
- Playwright spec: `frontend-automation/tests/production-ready-e2e.spec.js`
- ExpressionBuilder service: `ExpressionBuilderService`
- Loan service: `LoanService`

Last updated: 2025-08-28
