# ADR-003: Technology Stack

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — Cross-browser, Thin Client, Standard RDBMS |

---

## Context

Technology choices for a CBS platform must balance:
- Performance (10 TPS minimum per IDRBT, hundreds TPS for multi-branch)
- Security (PII encryption, OWASP compliance)
- Local support (RBI requires RDBMS with local support)
- Browser agnostic (IDRBT: must not be restricted to one OS/browser)
- Long-term maintainability (CBS contracts run 10–15 years)

---

## Stack Decisions

### Backend: .NET 8 (C#)

**Chosen:** .NET 8 LTS

**Rationale:**
```
✓ LTS (Long Term Support) — 3 years Microsoft support guarantee
✓ Best-in-class performance: .NET 8 benchmarks show 800K+ req/sec
✓ Strong type system: financial calculations benefit from compile-time safety
✓ Roslyn — used for our Expression/Rule Engine (dynamic compilation)
✓ Entity Framework Core 8: mature ORM with PostgreSQL support
✓ Microsoft SQL Server fallback available if client insists
✓ Large talent pool in India (C# + .NET widely available)
✓ FIPS-compliant cryptography (AES-256 for PII)
✗ Consideration: Java (Spring Boot) is also valid; chosen .NET for Roslyn rule engine advantage
```

**Key .NET Libraries:**
| Library | Purpose |
|---------|---------|
| EF Core 8 + Npgsql | ORM + PostgreSQL driver |
| MediatR | In-process event bus + CQRS |
| FluentValidation | Input validation |
| Hangfire | Background jobs (EOD/BOD tasks) |
| Polly | Resilience (retry, circuit breaker for payment APIs) |
| Serilog | Structured logging (JSON → ELK or Seq) |
| OpenTelemetry | Distributed tracing (required for performance monitoring) |
| HotChocolate | GraphQL (for reporting queries — optional) |
| Swashbuckle | OpenAPI/Swagger documentation |

### Frontend: React 19 + TypeScript + Material UI

**Chosen:** React 19 + TypeScript + MUI v6

**Rationale:**
```
✓ TypeScript: type safety for financial data (amounts, dates, IDs)
✓ React 19: React Server Components for complex reporting pages
✓ Material UI: WCAG 2.1 accessibility compliance (banking requirement)
✓ Browser agnostic (satisfies IDRBT thin-client requirement)
✓ PWA capability: works offline for tellers (important for connectivity)
✗ Angular: considered but React ecosystem is larger for fintech
```

**Key Frontend Libraries:**
| Library | Purpose |
|---------|---------|
| React Query (TanStack) | Server state management, caching |
| Redux Toolkit | Auth state + global app state |
| React Hook Form + Zod | Form validation (maker-checker forms) |
| Recharts | Charts for MIS dashboards |
| AG Grid | High-performance table (1000+ rows: transaction lists) |
| date-fns | Date manipulation (Indian financial year logic) |

### Database: PostgreSQL 16

**Chosen:** PostgreSQL 16

**Rationale:**
```
✓ IDRBT requires "Standard RDBMS with local support" — PostgreSQL qualifies
✓ Schema-per-tenant supported natively
✓ Row-level security (RLS) for additional isolation
✓ ACID compliant — financial transactions require this
✓ Partitioning: transaction table will have billions of rows; partition by date
✓ JSON support: flexible for dynamic bank-specific fields
✓ Logical replication: for read replica setup
✓ Open source: no per-core Oracle/SQL Server licensing
✓ EDB (EnterpriseDB) provides Indian support contracts if RBI asks
✗ SQL Server: considered (common in Indian banks) but licensing costs prohibitive
✗ MySQL: lacks full ACID support for complex transactions
```

**PostgreSQL Feature Usage:**
```sql
-- Partitioning (transactions table)
CREATE TABLE transactions (
    id          BIGSERIAL,
    txn_date    DATE NOT NULL,
    ...
) PARTITION BY RANGE (txn_date);
-- Auto-partition by month via pg_partman

-- Row-level security (audit table)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_log
    USING (bank_id = current_setting('app.bank_id'));

-- Encrypted columns (PII)
-- Use pgcrypto or application-level AES-256
SELECT pgp_sym_encrypt(aadhaar_number, current_setting('app.enc_key'))
```

### Cache: Redis 7

**Chosen:** Redis 7

**Rationale:**
```
✓ Session storage (auth tokens, teller sessions)
✓ Parameter cache (bank/product parameters — read thousands of times per second during EOD)
✓ Rate limiting (prevent API abuse)
✓ Pub/Sub (real-time notifications to tellers)
✓ Distributed lock (EOD: prevent double execution across application instances)
✗ Memcached: considered but lacks pub/sub and persistence
```

**Cache Key Strategy:**
```
params:{bankId}:{paramKey}       → 1-hour TTL (parametrization)
session:{userId}:{sessionId}     → 3-min TTL (IDRBT requirement)
ratelimit:{bankId}:{endpoint}    → 1-min TTL (API protection)
eod:lock:{bankId}:{date}         → 4-hour TTL (EOD mutex)
```

### Message Broker: In-process (MediatR) → Kafka/Azure Service Bus

**Phase 1:** MediatR in-process events (simple, no infrastructure)
**Phase 2:** Kafka or Azure Service Bus when cross-service events needed

**Rationale for Kafka (when needed):**
```
✓ Event replay: can rebuild read model from event history
✓ High throughput: handles EOD event storms (10K accounts × 10 events)
✓ Persistent: events survive service restarts
✓ Azure Event Hubs: Kafka-compatible, Azure India region available
✓ Message ordering: financial events must be ordered per account
```

**Phase transition trigger:** When PaymentService needs to publish events to CoreBankingApi asynchronously (cross-service boundary).

### Rule Engine: .NET Roslyn (existing ExpressionBuilderService)

**Chosen:** Custom Roslyn-based engine (already built)

**Rationale:**
```
✓ Already built and working in SaaR
✓ Roslyn: compile-time safety for financial expressions
✓ Supports complex rules: NPA classification, interest calculation
✓ AI-friendly: AI agents can generate Roslyn expressions from specs
✓ Performance: compiled to IL, executes at native speed
✗ Alternative: Drools (Java) — not compatible with .NET ecosystem
✗ Alternative: NRules — less flexible for financial expressions
```

### Authentication: JWT + RBAC (custom IdentityService)

**Chosen:** Custom JWT-based auth + RBAC

**Rationale:**
```
✓ IDRBT: "Availability of menu restricted on basis of user access (RBAC) level"
✓ Custom roles: Teller, Officer, Manager, Auditor, Admin — not standard OAuth roles
✓ Financial Power Limits: authorization includes transaction amount limits
✓ Maker-Checker: requires tracking who made vs who checked
✓ Session management: 3-minute inactivity timeout, single active session
✓ Branch-scoped access: a Teller can only access their branch's accounts
✗ Keycloak: considered but overkill for initial deployment; can add later
✗ Azure AD: creates vendor dependency; Indian UCBs may not use Azure
```

### Deployment: Docker + Docker Compose → Kubernetes

**Phase 1:** Docker Compose (current — working at demobank.saaritsolutions.com)
**Phase 2:** Kubernetes (when multi-bank, multi-region deployment needed)

### Monitoring: OpenTelemetry + Prometheus + Grafana

```
Distributed traces: OpenTelemetry → Jaeger (trace per EOD job)
Metrics: Prometheus + Grafana (TPS, latency, EOD progress)
Logs: Serilog → Elasticsearch + Kibana
Alerts: Grafana Alertmanager → PagerDuty/SMS
```

---

## Summary Table

| Component | Technology | Version | Rationale |
|-----------|-----------|---------|-----------|
| API Backend | .NET | 8 LTS | Performance, Roslyn, FIPS crypto |
| Frontend | React + TypeScript | 19 | Browser-agnostic, type safety |
| UI Components | Material UI | v6 | WCAG accessibility |
| ORM | Entity Framework Core | 8 | PostgreSQL native |
| RDBMS | PostgreSQL | 16 | ACID, partitioning, local support |
| Cache | Redis | 7 | Sessions, params, distributed lock |
| Event Bus (Phase 1) | MediatR | 12 | In-process, simple |
| Event Bus (Phase 2) | Kafka / Azure Event Hubs | - | Cross-service events |
| Rule Engine | Roslyn (custom) | - | Already built, IL performance |
| Background Jobs | Hangfire | 1.8 | EOD/BOD, retry, dashboards |
| API Docs | Swagger / OpenAPI | 3 | Standard, required by banks |
| Logging | Serilog + ELK | - | Structured, searchable |
| Metrics | OpenTelemetry + Prometheus | - | Distributed tracing |
| Containers | Docker | 24 | Consistent environments |
| Orchestration | Docker Compose → K8s | - | Phase 1 → Phase 2 |
| Reverse Proxy | nginx | - | SSL, routing, static files |
| CI/CD | GitHub Actions | - | Automated build/test/deploy |
