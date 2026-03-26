# Project Context and Milestones

This file tracks goals, decisions, and incremental progress for the investor-ready demo of SaaR Core Banking Services.

## Goals
- Stable local dev with fixed ports, CORS, and Swagger enabled for all services.
- Seamless loan origination demo: dynamic forms, expressions-driven eligibility, workflow timeline.
- Admin UX for expressions, workflow configs, and schema.
- RBI-friendly surfaces: consent, KFS, disclosures, audit.

## Services and Ports
- ExpressionBuilderService: 5004
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

## In Progress
- M4: Form builder MVP (frontend drag-and-drop form builder; backend schema persistence).

## Pending Next
- M4: Form builder MVP; M5: Compliance (KFS, consent, PAN validation); M6: Admin console; M7: Demo polish; M8: Perf/obs.
- CustomerService: KycStatus enum, PAN format endpoint, Aadhaar upload placeholder.
- APIGateway: JWT validation middleware + basic route table.

## Notes
- Eligibility expression ID currently in use: EXPR_1755237353842.
- Service startup uses ASPNETCORE_ENVIRONMENT=Development for predictable feature flag behavior.
