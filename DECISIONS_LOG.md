# DECISIONS_LOG.md — SaaR Core Banking Services

**Last Updated:** 2026-04-07
**Purpose:** Record WHY the system is built the way it is. Prevents inconsistent future decisions.

---

### Decision Title: Microservices Architecture

**Date:** Pre-2025 (confirmed in codebase)

**Context:**
- Building a banking platform targeting multiple UCBs/NBFCs
- Need independent deployability and scalability per domain
- Future multi-tenancy and per-bank customization requirements

**Decision:**
Deploy 19+ independent ASP.NET Core Web API services, each owning its own database schema. Services communicate via HTTP/REST.

**Alternatives Considered:**
- Modular monolith — simpler to start, harder to scale/customize per bank
- Message-based (Kafka/RabbitMQ) — adds operational complexity before any customers exist

**Impact:**
- Each service is independently deployable with its own Dockerfile and DB context
- Added complexity: no inter-service auth yet, no service discovery
- Enables per-bank customization at the service level in future

**Status:** Active

---

### Decision Title: Roslyn-based Expression Engine as Core Differentiator

**Date:** Pre-2025 (confirmed in codebase)

**Context:**
- Banks frequently change eligibility rules, interest rate tiers, fee structures, and compliance thresholds
- Traditional hardcoded rules require developer intervention for every change
- Need a configurable rule engine that non-engineers can eventually use

**Decision:**
Use Microsoft.CodeAnalysis.CSharp (Roslyn) to compile and execute C# expressions at runtime. Rules are stored as strings in PostgreSQL and compiled on demand with an in-memory cache.

**Alternatives Considered:**
- Rule engines like NRules or Drools — XML/DSL based, steep learning curve for config
- Simple JSON condition trees — limited expressiveness for complex banking logic
- Python/scripting via subprocess — security risk, cross-platform complexity

**Impact:**
- ExpressionBuilderService is the most production-ready service in the codebase
- Security sandbox required: blocked namespaces (System.IO, System.Net, System.Reflection, System.Threading, System.Diagnostics)
- AI layer (OpenAI GPT) can generate valid C# expression strings, creating a natural-language-to-rule pipeline
- Compilation is cached per expression ID — cache must be invalidated on expression update

**Status:** Active

---

### Decision Title: OpenAI GPT for AI-assisted Rule and Form Generation

**Date:** ~2025 (confirmed in commit history: `b3d38b7`, `0b4fde2`)

**Context:**
- Expression Engine is powerful but requires C# knowledge to author rules
- Dynamic forms need schema definitions that are tedious to write manually
- AI can lower the barrier for bank admins to configure the system

**Decision:**
Integrate OpenAI GPT-4/4o via three dedicated controllers in ExpressionBuilderService: `AIExpressionController`, `AIFormController`, `AIWorkflowController`. Frontend sends natural language prompts; backend returns generated C# expressions or JSON schemas.

**Alternatives Considered:**
- Self-hosted LLM (Ollama, llama.cpp) — too slow, requires GPU infra, no managed API
- Google Gemini / Azure OpenAI — OpenAI chosen for quality and straightforward API; can be swapped via `ILlmSelectorService` abstraction

**Impact:**
- Requires `OpenAI:ApiKey` in service configuration (never commit to git)
- `ILlmSelectorService` abstraction allows future provider swap without controller changes
- AI-generated expressions must still pass the security validator before execution

**Status:** Active

---

### Decision Title: WorkflowOrchestrationService — EF Core 9 + Schema-Per-Tenant Persistence (Session 19)

**Date:** 2026-04-07

**Context:**
- WorkflowOrchestrationService was entirely in-memory (Load/Save stubs returned hardcoded values)
- LoanService and AccountService could not persist workflow state between requests
- AccountService was on EF Core 8 / Npgsql 8 while LoanService had already migrated to EF9

**Decision:**
- Migrated WorkflowOrchestrationService to EF Core 9 + Npgsql 9 + PostgreSQL with full schema-per-tenant multi-tenancy (identical pattern to LoanService: TenantResolutionMiddleware + TenantModelCacheKeyFactory + HasDefaultSchema + TenantSchemaProvisioner)
- WorkflowInstanceEntity stores Context as ContextJson (text column) — JSON serialization at the service layer — rather than using EF JSON columns, to avoid EF9 owned-entity schema gotchas
- Upgraded AccountService EF8→9 simultaneously; removed manual `__EFMigrationsHistory` pre-creation (EF9 handles this automatically unlike EF8)
- Chose fire-and-forget (Task.Run + catch+log) for all cross-service calls from AccountController so workflow/expression failures never block core banking operations

**Alternatives Considered:**
- Redis for workflow state — more operationally complex; PostgreSQL is already deployed
- EF JSON columns — simpler but hit EF9 owned-entity migration gotchas in practice; text column with explicit JsonSerializer is deterministic
- Await+throw for cross-service calls — would break account creation if workflow service down; banking-grade systems must degrade gracefully

**Impact:**
- WorkflowInstances now persisted to Postgres; loan submit creates a row, disburse updates it
- AccountService CreateAccount creates WorkflowInstance row + fetches FD interest rate from expression engine — both non-blocking
- EF migrations must continue to be audited to strip schema: "public" qualifiers (EF generates them even in EF9 when HasDefaultSchema is active)

**Status:** Active

---

### Decision Title: React 19 as Primary Frontend (Angular as Secondary / Archived)

**Date:** ~2025 (confirmed: React at `frontend-react/`, Angular at `frontend-ui/`)

**Context:**
- Two frontend implementations exist: Angular 17.3.7 and React 19.1
- Both were started but React received the majority of recent development effort
- React was chosen for the investor demo and active milestone work

**Decision:**
React 19 + TypeScript + Material-UI v7 is the primary frontend. Angular exists but is not receiving active development.

**Alternatives Considered:**
- Angular — good for enterprise, but heavier toolchain; less community traction for demos
- Next.js — considered for SSR, but CRA (Create React App + craco) was already set up

**Impact:**
- All new UI work goes into `frontend-react/`; `frontend-ui/` should be treated as archived
- Pending: formally deprecate Angular frontend or remove to reduce confusion
- Redux Toolkit + Zustand are both present (different use cases: global auth state vs local UI state)

**Status:** Active (decision to formally deprecate Angular frontend is Needs Review)

---

### Decision Title: PostgreSQL with EF Core Code-First per Service

**Date:** Pre-2025 (confirmed in codebase)

**Context:**
- Each microservice needs its own data store (microservices principle)
- .NET team is familiar with Entity Framework Core
- Need to avoid shared database anti-pattern

**Decision:**
Each service has its own `DbContext` targeting PostgreSQL. Migrations are code-first. Dev can use in-memory EF Core as fallback.

**Alternatives Considered:**
- SQL Server — licensing cost, not preferred for cloud-native deployments
- MongoDB — document model doesn't fit relational banking data (accounts, transactions, journals)
- Shared PostgreSQL with separate schemas — rejected to maintain service independence

**Impact:**
- Most services have no real migrations yet — only ExpressionBuilderService has confirmed migration (`20250630095238_InitialCreate`)
- In-memory fallback is useful for demos but must not be used in production
- No cross-service joins — services must call each other's APIs for joined data

**Status:** Active

---

### Decision Title: JWT Bearer Authentication (Planned, Not Fully Implemented)

**Date:** Planned (JWT packages present in projects; not enforced end-to-end)

**Context:**
- Need auth for production; dev currently runs without enforcement
- All services have JWT Bearer package referenced

**Decision:**
JWT Bearer tokens issued by a central auth service (UserAccessManagementService). Services validate tokens via shared secret.

**Alternatives Considered:**
- Session-based auth — doesn't scale across stateless microservices
- OAuth2/OIDC (Keycloak) — more complete but operationally heavy for current stage; can adopt later

**Impact:**
- Currently: CORS allows all origins in Development; JWT not enforced on most services
- Shared secret must be consistent across all services in `appsettings.json`
- APIGateway should be the sole external entry point validating tokens before routing

**Status:** Needs Review (JWT is configured but not enforced; inter-service auth is missing)

---

### Decision Title: India-first UCB/NBFC Market with RBI Compliance Targets

**Date:** Pre-2025 (in EXECUTION_ROADMAP.md, Sep 20, 2025)

**Context:**
- Defining the initial target market for the banking platform
- UCBs are underserved by modern tech; RBI compliance is mandatory

**Decision:**
Target Urban Co-operative Banks (UCBs) and NBFCs in India as the first market. Compliance requirements are RBI-specific. First pilots: Maharashtra and Karnataka UCBs.

**Alternatives Considered:**
- Global banking market from day one — too broad, compliance complexity multiplies
- Private sector banks (PSBs) — higher bar for entry, long procurement cycles

**Impact:**
- All compliance work must align with RBI regulations (KYC, CDD, AML, CERSAI, RBI reporting)
- KFS (Key Facts Statement) disclosure is a mandatory milestone (M5)
- PAN and Aadhaar are the primary identity documents (not passport/SSN)
- Revenue model confirmed: ₹25–60L implementation + ₹2–5L/month SaaS per bank

**Status:** Active

---

### Decision Title: Fixed Development Ports and Runner Scripts

**Date:** Earlier 2025 (confirmed in CONTEXT.md)

**Context:**
- Multiple services starting simultaneously caused random port conflicts
- Demos were failing because services started on wrong ports

**Decision:**
Assign canonical ports to each service (ExpressionBuilderService: 5004, WorkflowOrchestration: 5012, DynamicFieldsSchema: 5013, LoanService: 5130, React frontend: 3002). Enforce via `Properties/launchSettings.json` and runner scripts that kill conflicting processes first.

**Alternatives Considered:**
- Dynamic port assignment — breaks hardcoded service URLs in appsettings and frontend
- Docker Compose only — adds Docker dependency to every dev session

**Impact:**
- `start-all.sh` and `scripts/start-all.sh` must be used to launch the full stack
- All `appsettings.Development.json` files reference these ports for inter-service calls
- `ASPNETCORE_ENVIRONMENT=Development` must be set for the feature flags and fixed ports to apply

**Status:** Active
