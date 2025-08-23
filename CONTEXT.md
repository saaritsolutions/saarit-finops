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

## In Progress
- Milestone M1: 5-step Loan Wizard (UX polish, right-rail summary, masked inputs, file upload).

## Pending Next
- M2: Workflow timeline polish (SLA chips, actions, retry/notes).
- M3: Expression Library harness and removal of fallback logic in demo mode.
- M4: Form builder MVP; M5: Compliance (KFS, consent, PAN validation); M6: Admin console; M7: Demo polish; M8: Perf/obs.

## Notes
- Eligibility expression ID currently in use: EXPR_1755237353842.
- Service startup uses ASPNETCORE_ENVIRONMENT=Development for predictable feature flag behavior.
