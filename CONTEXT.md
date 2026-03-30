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

## In Progress
- Deploy updated containers to demobank.saaritsolutions.com (git pull + docker compose build + up)

## Pending Next
- Deploy to demobank: git pull → docker compose build useraccessmanagement accountservice frontend → up -d
- Update Jira stories SCRUM-2,3,4,80,81,82,83 to Done with commit hashes
- Verify all 5 screens at demobank.saaritsolutions.com post-deploy
- Next architecture batch: Maker-Checker workflow engine (SCRUM-9 to SCRUM-16), full parametrization (SCRUM-24 to SCRUM-31)

## Notes
- Eligibility expression ID currently in use: EXPR_1755237353842.
- Service startup uses ASPNETCORE_ENVIRONMENT=Development for predictable feature flag behavior.
