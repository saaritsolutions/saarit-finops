# SaaR Core Banking Services — Architecture Documentation

## Overview

SaaR CBS is a **multi-tenant, cloud-native Core Banking Platform** targeting Urban Cooperative Banks (UCBs) and Non-Banking Financial Companies (NBFCs) in India. The platform is designed to meet all functional and technical requirements mandated by IDRBT/RBI (CBS Requirements for UCBs, July 2017).

---

## Architecture Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Parametrization over Customization** | Every bank-specific variation is a parameter, not a code branch |
| P2 | **Compliance by Design** | Every feature traces back to a regulatory requirement |
| P3 | **Event-Driven by Default** | Financial actions produce domain events; downstream effects are async |
| P4 | **Schema-per-Tenant Isolation** | Regulatory requirement: bank data must be isolated |
| P5 | **Maker-Checker Everywhere** | All financial transactions require dual authorization |
| P6 | **Immutable Audit Trail** | Every state change is recorded; nothing is ever deleted |
| P7 | **AI-Assisted Development** | Structured specs drive code generation, test generation, review |
| P8 | **Thin Client / Browser Agnostic** | IDRBT requirement: no OS/browser vendor lock-in |
| P9 | **EOD Resumability** | Batch jobs must be restartable from point of failure |
| P10 | **India-First** | Indian calendar, rupee, RBI regulations, NPCI payment rails |

---

## Architecture Layers

```
┌────────────────────────────────────────────────────────────────┐
│  LAYER 5 — CHANNELS                                            │
│  Web Banking  │  Mobile  │  ATM/POS  │  Internet  │  Open API │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  LAYER 4 — DOMAIN SERVICES (Bounded Contexts)                  │
│  Customer │ Account │ Loan  │ Payment │ GL/Acctg │ Regulatory │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  LAYER 3 — CORE FRAMEWORK ENGINE                               │
│  Rules/Expr │ Workflow │ Parametrization │ EOD/BOD │ Reporting │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  LAYER 2 — PLATFORM INFRASTRUCTURE                             │
│  Multi-Tenant │ Security/RBAC │ Event Bus │ AI Pipeline        │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  LAYER 1 — DATA LAYER                                          │
│  PostgreSQL (per-tenant schema) │ Redis │ Event Store          │
└────────────────────────────────────────────────────────────────┘
```

---

## Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](adr/ADR-001-multitenancy.md) | Multi-Tenancy Model | Accepted |
| [ADR-002](adr/ADR-002-service-decomposition.md) | Service Decomposition Strategy | Accepted |
| [ADR-003](adr/ADR-003-technology-stack.md) | Technology Stack | Accepted |
| [ADR-004](adr/ADR-004-event-architecture.md) | Event-Driven Architecture | Accepted |
| [ADR-005](adr/ADR-005-parametrization.md) | Parametrization Engine Design | Accepted |
| [ADR-006](adr/ADR-006-database-strategy.md) | Database Strategy | Accepted |
| [ADR-007](adr/ADR-007-security-framework.md) | Security Framework | Accepted |
| [ADR-008](adr/ADR-008-eod-bod-engine.md) | EOD/BOD Batch Engine | Accepted |
| [ADR-009](adr/ADR-009-reporting-architecture.md) | Reporting Architecture | Accepted |
| [ADR-010](adr/ADR-010-ai-development-pipeline.md) | AI-Assisted Development Pipeline | Accepted |
| [ADR-011](adr/ADR-011-api-gateway.md) | API Gateway Strategy | Accepted |
| [ADR-012](adr/ADR-012-deployment.md) | Deployment & Infrastructure | Accepted |

---

## Component Inventory

| Component | Purpose | Docs |
|-----------|---------|------|
| CustomerService | CIF, KYC, AML watchlist | [→](components/customer-service.md) |
| AccountService | CASA, FD, RD, CC, OD | [→](components/account-service.md) |
| LoanService | Origination, Servicing, NPA | [→](components/loan-service.md) |
| PaymentService | NEFT, RTGS, IMPS, DD, ECS | [→](components/payment-service.md) |
| GlAccountingService | Double-entry GL, Trial Balance, P&L | [→](components/gl-accounting-service.md) |
| RegulatoryService | RBI reports, CRR, SLR, OSS | [→](components/regulatory-service.md) |
| ExpressionBuilderService | Rule engine, interest calc, eligibility | [→](components/expression-builder.md) |
| WorkflowOrchestrationService | Maker-checker, approvals, EOD/BOD | [→](components/workflow-service.md) |
| DynamicFieldsSchemaService | Bank-specific form fields | [→](components/dynamic-fields.md) |
| ParametrizationService | Bank/product parameter management | [→](components/parametrization-service.md) |
| AuditService | Immutable audit trail | [→](components/audit-service.md) |
| NotificationService | SMS, email, in-app alerts | [→](components/notification-service.md) |
| ReportingService | MIS, RBI reports, ad-hoc | [→](components/reporting-service.md) |
| IdentityService | Auth, RBAC, session management | [→](components/identity-service.md) |

---

## Regulatory Compliance Matrix

Every architectural decision references one or more compliance requirements:

| Requirement | Source | Architectural Response |
|-------------|--------|----------------------|
| Data isolation between banks | RBI/IDRBT | Schema-per-tenant |
| Maker-Checker for all transactions | IDRBT Sec 15 | Workflow engine (mandatory) |
| PII encrypted at rest | IDRBT Annexure II | Column-level AES-256 |
| EOD within 3 hours | IDRBT Annexure II | Async batch pipeline |
| 10 TPS minimum (unit bank) | IDRBT Annexure II | Horizontal scaling |
| Audit trail for all changes | IDRBT Annexure II | Append-only event store |
| NPA auto-classification | RBI IRAC norms | Rule engine + EOD job |
| CRR/SLR computation | RBI Act 1934 | Regulatory service |
| VAPT by CERT-IN agency | IDRBT Annexure II | CI/CD security scan |
| Data must stay within India | RBI Cloud circular | India-region deployment only |
| 15-min RPO, 1-hr RTO | IDRBT Annexure II | DR site + backup strategy |

---

## Document Control

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Date | 2026-03-29 |
| Authors | SaaR Architecture Team |
| Review Cycle | Quarterly |
| Based On | IDRBT CBS Requirements for UCBs, July 2017 |
