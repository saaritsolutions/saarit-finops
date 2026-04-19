# ADR-013: Gold Loan Module Architecture

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Engineering Lead, Product Owner
**Ticket:** SAAR-GL-001

---

## Context

Gold loans are a high-priority product for the UCB/NBFC market. The system already has a `GOLD_LOAN` product type seeded in LoanService but lacks:
- Granular pledge register (individual ornament tracking by weight, purity, value)
- Daily gold rate management
- Gold-specific lifecycle states (APPRAISED, MARGIN_CALL_OPEN, AUCTION_NOTICE_ISSUED)
- LTV monitoring tied to a live commodity price
- Auction workflow (14-day statutory notice — RBI mandatory)

Three architectural options were evaluated for implementing this functionality.

---

## Decision Drivers

1. **Time to market** — UCB demos need gold loan capability soon
2. **Infrastructure complexity** — avoid new ports/docker-compose/nginx/CI complexity
3. **Domain isolation** — gold loan has genuinely different domain logic; should be organized clearly
4. **Extractability** — should be possible to split into a standalone service later with minimal refactoring
5. **Boilerplate cost** — ~300–400 lines of multi-tenancy boilerplate exists; avoid duplicating it

---

## Options Considered

### Option A: Extend LoanService (flat — no folder structure)
Add gold entities and controllers directly alongside existing loan models/controllers.

- **Pros:** Zero infrastructure change; fast
- **Cons:** LoanService becomes a "god service"; gold logic mixed with personal/home loan logic; poor maintainability

### Option B: New GoldLoanService Microservice (port 5140)
Standalone service with own DB, port, docker-compose entry, nginx routing, CI step.

- **Pros:** Perfect domain isolation; independent deployability; clear team ownership
- **Cons:** 3–5× more setup work; duplicates 400 lines of multi-tenancy boilerplate; frontend needs second API base URL; new CI pipeline step

### Option C (Selected): Sub-Module within LoanService (Gold/ folder structure)
Organize gold loan entities, controllers, and services in explicit `Gold/` subfolders within LoanService.

```
LoanService/
├── Models/Gold/         ← GoldLoanDetails, GoldPledgeItem, GoldRateMaster, MarginCall, AuctionNotice
├── Controllers/Gold/    ← GoldLoanController, GoldRateController
└── Services/Gold/       ← IGoldRateService, ILtvMonitorService
```

- **Pros:**
  - Zero new infrastructure (same port 5130, same DB, same docker-compose entry)
  - Reuses all existing boilerplate: multi-tenancy, JWT, CORS, TransactionServiceClient
  - Folder boundary = logical domain boundary without physical service split
  - Future extraction to GoldLoanService requires only moving files, not rewriting boilerplate
  - Frontend stays on single API base URL
- **Cons:**
  - LoanService source tree grows (10 models, 9 controllers) — manageable

---

## Decision

**Option C is selected.**

The `Gold/` folder structure provides meaningful domain isolation without the overhead of a new microservice. The codebase is at MVP stage; speed to market matters. When gold loan volume or team size warrants it, the `Gold/` folder can be extracted into a dedicated `GoldLoanService` microservice with minimal refactoring.

---

## Consequences

### Positive
- Gold loan Phase 1 can be delivered in one session without new infrastructure setup
- All existing CI/CD workflows continue to pass without modification
- TransactionService GL posting, WorkflowOrchestration, and ExpressionBuilder are immediately available to gold loan logic

### Negative
- LoanService.csproj grows in scope — must maintain clear folder discipline
- If two teams work on LoanService simultaneously, git conflicts are more likely than with a separate service

### Neutral
- One new EF migration (`AddGoldLoanTables`) adds 5 new tables
- LoanDbContext gains 5 new DbSets — schema-isolated per tenant as before

---

## Future Extraction Path (when warranted)

1. Create `GoldLoanService/` project
2. Move all `Models/Gold/`, `Controllers/Gold/`, `Services/Gold/` files to new project
3. Create `GoldLoanDbContext` (copy pattern from `LoanDbContext`)
4. Copy multi-tenancy boilerplate (TenantSchemaProvisioner, TenantModelCacheKeyFactory, TenantResolutionMiddleware)
5. Add new docker-compose service, nginx location, CI step
6. Update frontend API base URL for gold loan endpoints
7. Estimated effort: 1–2 sessions

---

## Related Decisions

- ADR-001: Multi-tenancy strategy (schema-per-tenant) — applies unchanged
- ADR-002: Service decomposition — gold loan is an extension of Loan Service boundary
- ADR-006: Database strategy (PostgreSQL + EF Core) — unchanged
