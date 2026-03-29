# ADR-002: Service Decomposition Strategy

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — Performance, Scalability |

---

## Context

Core Banking has 18 functional domains (per IDRBT) and must support EOD batch processing, real-time OLTP, and regulatory reporting simultaneously. The decomposition of these into services must balance:
- Team autonomy and independent deployability
- Transaction integrity (financial transactions span multiple domains)
- Operational simplicity (too many services = too complex to operate)
- Regulatory traceability (RBI audit can target specific domains)

---

## Decision Options Considered

### Option A: Big Monolith
```
All 18 domains in one application.
Pros: Simple deployment, easy transactions, easy debugging
Cons:
  - Entire system down for one module's deployment
  - Cannot scale EOD batch independently from OLTP
  - No team autonomy
  - Cannot deploy compliance fixes without redeploying everything
Rejected: Not viable at scale for CBS
```

### Option B: Full Microservices (one service per IDRBT section)
```
18+ services for 18 IDRBT sections.
Pros: Maximum autonomy
Cons:
  - Distributed transactions (saga patterns) for every financial operation
  - Operational overhead: 18 services × N environments
  - Network latency between services compounds
  - For a CBS startup: premature optimization
Rejected: Too complex too soon
```

### Option C: Modular Monolith (single deployable, internal module boundaries) ✓
```
Pros:
  - Refactoring to microservices is gradual and safe
  - No distributed transaction complexity initially
  - One deployment pipeline
  - Each module has clear bounded context
Cons:
  - Single scaling unit initially
```

### Option D: Strategic Microservices (modular monolith core + extract performance-critical services) ✓ CHOSEN
```
Start with a well-structured modular monolith for core banking.
Extract ONLY services where there is a genuine reason:
  - ExpressionBuilderService: CPU-intensive, scales independently
  - EOD/BOD Engine: runs in batches, must not affect OLTP
  - Reporting/MIS: heavy read queries, must not touch OLTP DB
  - Payment Gateway: external integrations (SFMS/NPCI), different SLA
  - Identity/Auth: shared across all services
```

---

## Decision: Strategic Microservices

### Service Inventory

```
CORE BANKING MODULE (single deployable — "CoreBankingApi")
├── Customer Domain         (CIF, KYC, AML)
├── Account Domain          (CASA, FD, RD, CC, OD)
├── Loan Domain             (Origination, Servicing, Collateral)
├── GL/Accounting Domain    (Journal entries, Trial Balance, P&L)
├── Regulatory Domain       (CRR, SLR, NPA, RBI reports)
└── Treasury Domain         (Investments, ALM)

INDEPENDENT SERVICES (extracted from day 1)
├── IdentityService         (Auth, RBAC, sessions)            :5001
├── ExpressionBuilderService (Rules, interest, eligibility)   :5004
├── WorkflowService          (Maker-Checker, EOD/BOD, SIs)    :5012
├── DynamicFieldsService     (Form schemas per bank)          :5013
├── PaymentService           (NEFT/RTGS/IMPS/DD/ECS)         :5014
├── NotificationService      (SMS/Email/In-app)               :5015
├── AuditService             (Immutable event store)          :5016
└── ReportingService         (Read-model, RBI reports, MIS)   :5017

FUTURE SERVICES (extracted when scale demands)
├── ChannelService           (Internet/Mobile banking)
├── HRMSService              (Payroll, Leave, Disciplinary)
└── TreasuryService          (Full ALM, Bond valuation)
```

### Why These Specific Boundaries?

```
ExpressionBuilderService SEPARATE because:
  - Runs on every account during EOD (10,000 accounts × 5 rules = 50,000 evaluations)
  - CPU-intensive Roslyn compilation
  - Must be scaled horizontally without scaling the core banking module

WorkflowService SEPARATE because:
  - EOD/BOD must run even when OLTP is paused
  - Saga orchestration needs durable state
  - Maker-Checker is a cross-cutting concern used by ALL domains

AuditService SEPARATE because:
  - Must be write-only from the application's perspective
  - Must persist even if CoreBankingApi is down
  - Never same availability zone as core banking
  - Append-only — fundamentally different write pattern

ReportingService SEPARATE because:
  - Read-heavy queries must NEVER touch OLTP PostgreSQL
  - RBI reports require historical aggregations (months of data)
  - Must run during business hours without impacting teller performance

PaymentService SEPARATE because:
  - Integrates with external systems (SFMS, NPCI, SWIFT)
  - Different SLA: payment failures have immediate regulatory consequences
  - NPCI mandates specific response time SLAs
```

### Anti-Corruption Layers Between Bounded Contexts

```
Loan Domain needs Customer data:
  ✗ WRONG: LoanService.DbContext.Customers.Find(customerId)
  ✓ RIGHT: await customerClient.GetCustomerAsync(customerId)
         or: consume CustomerUpdated domain event

This ensures bounded contexts remain autonomous.
```

### Domain Events (Cross-Context Communication)

```
CustomerVerified   → Account domain: allow account opening
AccountOpened      → GL domain: create GL posting
LoanDisbursed      → GL domain: Dr Loan Account, Cr Customer Account
                  → Payment domain: initiate disbursement transfer
InstallmentOverdue → Workflow domain: trigger recovery workflow
NpaClassified      → GL domain: reverse interest income, create provision
PaymentSettled     → Account domain: credit customer account
                  → GL domain: settlement entry
```

---

## Module Structure Within CoreBankingApi

```
CoreBankingApi/
├── Modules/
│   ├── Customer/
│   │   ├── Commands/
│   │   ├── Queries/
│   │   ├── Domain/
│   │   ├── Infrastructure/
│   │   └── CustomerModule.cs         (IModule registration)
│   ├── Account/
│   │   └── (same structure)
│   ├── Loan/
│   ├── GeneralLedger/
│   ├── Regulatory/
│   └── Treasury/
├── SharedKernel/
│   ├── Money.cs                      (value object: amount + currency)
│   ├── TenantContext.cs
│   ├── DomainEvent.cs
│   └── AuditableEntity.cs
└── Program.cs
```

Each module registers its own controllers, services, and EF entities. Modules communicate only via domain events or explicit interfaces — never via direct DbContext access to another module's tables.

---

## Consequences

### Positive
- Gradual extraction path: any module can be extracted to a standalone service
- EOD/BOD does not affect teller OLTP performance
- Reporting queries cannot degrade transaction processing
- Each service can be deployed, scaled, and rolled back independently

### Negative / Mitigations
- **Risk:** Domain events can fail (event not delivered)
  - **Mitigation:** Outbox pattern — events written to DB before being published
- **Risk:** Eventual consistency between domains
  - **Mitigation:** Critical financial state (balances, GL) remains strongly consistent within CoreBankingApi; eventual consistency only for notifications and reporting

---

## Related Decisions
- ADR-004: Event-Driven Architecture (event bus, outbox pattern)
- ADR-008: EOD/BOD Engine (batch processing isolation)
- ADR-009: Reporting Architecture (read model separation)
