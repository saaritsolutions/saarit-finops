# SaaR Core Banking - Current Asset Inventory (Brutally Real)

Date: 20 Sep 2025

## 🧱 Foundation (What Exists Today)

- Codebase: 19+ microservices, consistent .NET 8 WebAPI scaffolds
- Controllers/Endpoints: 80-120 endpoints across services; majority are CRUD or placeholders
- Frontend: React/Angular shells with module scaffolds
- DevOps: CI/CD, Dockerfiles, linting, tests wired for some services
- Docs: Extensive architecture and roadmap documentation

## ✅ Real, Working Assets (Substantive)

- `ExpressionBuilderService` (Strong):
  - Robust service with create/update/validate/execute flows
  - Roslyn-based compile + analyze + execute pipeline
  - Templates, logging, pagination, status, categories, tags
  - Multiple controllers and test coverage
  - Value driver for loan eligibility, dynamic rules

- `LoanService` (Partial, but meaningful):
  - Eligibility via expression engine
  - Admin config & origination controller with schema endpoints
  - Room to grow into full origination & servicing

## ⚠️ Mostly Scaffolding / Placeholders

- `CustomerService`: CRUD + basic duplicate checks; no KYC, risk, docs, lifecycle
- `AccountService`: CRUD + min balance; TODOs for core integrations
- `TransactionService`: Receipt/history CRUD; no double-entry, ledger, reconciliation
- `BusinessRulesEngineService`: Placeholder returns
- `APIGateway`: Ping + thin pass-throughs
- Many supporting services (Audit, Docs, Workflow, ProductParam, InterestFee, etc.): controller shells and sample data responses

## 📊 Objective Signals

- Placeholder markers found across services: numerous "Placeholder" and hardcoded `return Ok(new[] { ... })`
- TODOs in core models and controllers (Account refs, nominees, joint customers)
- Tests: present for some services; many are smoke-level or minimal

## 🧠 Innovation & IP (Real Value)

- Expression Engine (primary asset):
  - Compile-time codegen, metadata analysis
  - Execution with tenant scoping, variables, categories
  - Extensible patterns suitable for broader rule/risk engines

- AI Integration (supporting): controllers and service hooks present; not core to value yet

- Dynamic Forms / Workflow (POC-level): useful direction, not yet monetizable

## 📉 What’s Not There (Yet)

- Double-entry GL and real-time balance engine
- End-to-end loan origination → disbursement → servicing → NPA
- Customer KYC/AML/CKYC, document mgmt, lifecycle
- Transaction networks (NEFT/RTGS/IMPS/UPI), clearing & settlement
- Reporting, regulatory packs, audit trails at banking-grade
- Multitenancy enforcement, authz, rate limiting, observability at scale

## 💰 Brutally Real Asset Value (India Context)

- Expression Engine + Loan hooks: ₹6–10 Cr
- Microservice scaffolding + infra + docs: ₹4–7 Cr
- Frontend shells + test harnesses: ₹1–2 Cr
- Team/process maturity embedded in code: ₹1–2 Cr
- Risk haircut for placeholders/high completion delta: −₹3–6 Cr

Net Present Asset Value (today): ₹9–15 Cr

Range for negotiation (if emphasizing roadmap + demos): ₹12–20 Cr

## 🎯 Near-Term Value Uplifts (3–6 months)

- Ship production-grade `CustomerService` with KYC + docs + lifecycle (+₹3–5 Cr)
- Build minimal viable `TransactionService` with ledger + postings (+₹4–6 Cr)
- Convert 2 placeholder services to working components (e.g., Interest accrual, Workflow persistence) (+₹2–3 Cr)
- Land 1–2 paid pilots (+₹5–8 Cr signal value)

Potential 6–9 month valuation band post-delivery: ₹25–40 Cr

## 🧭 Bottom Line

- Today’s assets: strong architecture + one real differentiator (expressions)
- Most services are scaffolds; core banking logic largely missing
- Honest current value: ₹9–15 Cr, with a credible path to ₹25–40 Cr by turning 3 core areas production-grade and securing pilots.
