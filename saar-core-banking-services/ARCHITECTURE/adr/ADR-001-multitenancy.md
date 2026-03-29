# ADR-001: Multi-Tenancy Model

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | RBI Cloud Computing guidelines; IDRBT Annexure II - Data Isolation |

---

## Context

SaaR CBS must serve multiple banks (UCBs, NBFCs) from a single platform while maintaining strict data isolation between tenants. Each bank has its own regulatory identity, audit requirements, and data sovereignty obligations.

RBI guidelines explicitly require:
- Customer data of one bank must not be accessible to another bank
- Banks must have the right to request their complete data export
- Banks have the right to audit the data centre environment

---

## Decision Options Considered

### Option A: Shared Schema (single database, tenant_id column on every table)
```
Pros: Cheapest to operate, simplest infrastructure
Cons:
  - Single bug can expose Bank A's data to Bank B
  - Performance: one bank's heavy EOD impacts all others
  - Compliance: RBI audit cannot isolate a single bank's data
  - Row-level security complexity is massive across 200+ tables
  - Rejected for banking use
```

### Option B: Database-per-Tenant (completely separate PostgreSQL instance per bank)
```
Pros: Maximum isolation, trivial data export per bank
Cons:
  - 50 banks = 50 PostgreSQL instances to manage/patch/backup
  - Connection pooling becomes difficult
  - Schema migrations must run 50 times
  - Cost prohibitive at scale
  - Rejected: operational overhead too high
```

### Option C: Schema-per-Tenant (single PostgreSQL cluster, separate schema per bank) ✓ CHOSEN
```
Pros:
  - Strong isolation: SET search_path TO bank_kochi_ucb isolates all queries
  - Single PostgreSQL cluster to manage, patch, backup
  - Schema migration runs once (applied to all schemas via script)
  - Bank data export: pg_dump --schema=bank_kochi_ucb
  - Performance isolation: connection pool can be limited per schema
  - Standard pattern used by Finacle, Temenos for mid-tier deployments
Cons:
  - All schemas in one PostgreSQL cluster (mitigated with read replicas)
  - Schema count grows with banks (manageable up to ~500 schemas)
  - Requires strict schema naming convention
```

### Option D: Hybrid (schema-per-tenant for data, shared for reference data)
```
This is Option C + a shared `saar_reference` schema for:
  - IFSC codes
  - RBI holiday calendar
  - NPCI bank codes
  - State/district master

This is the actual implementation — Option C + shared reference schema.
```

---

## Decision: Schema-per-Tenant with Shared Reference Data

### Schema Naming Convention
```
Application schemas: bank_{registration_id}
  e.g., bank_KL001UCB (Kochi UCB registration)
       bank_MH042UCB (Nagpur UCB)

Reference schema:   saar_reference
System schema:      saar_system  (parametrization, bank registry)
```

### Tenant Resolution Flow
```
HTTP Request
    │
    ▼
API Gateway extracts: X-Bank-Id header OR subdomain
    │                 kochi.saarbanking.com → "KL001UCB"
    ▼
TenantResolver middleware
    │   → looks up bank_id in saar_system.banks
    │   → sets DbContext search_path = "bank_KL001UCB"
    ▼
All EF Core queries automatically scoped to correct schema
```

### Implementation in .NET (EF Core)
```csharp
// TenantDbContextFactory.cs
public class TenantDbContextFactory
{
    public BankingDbContext CreateForTenant(string bankId)
    {
        var schema = $"bank_{bankId.ToLower()}";
        var options = new DbContextOptionsBuilder<BankingDbContext>()
            .UseNpgsql(connectionString, o => o.SetPostgresVersion(16, 0))
            .Options;
        return new BankingDbContext(options, schema);
    }
}

// BankingDbContext.cs
protected override void OnModelCreating(ModelBuilder mb)
{
    mb.HasDefaultSchema(_tenantSchema);  // all tables go to tenant schema
    base.OnModelCreating(mb);
}
```

### Migration Strategy
```bash
# Apply schema migration to ALL tenant banks:
dotnet ef migrations add AddNpaClassificationField
./scripts/migrate-all-tenants.sh  # runs migration per schema
```

---

## Consequences

### Positive
- RBI compliance: full data isolation between banks
- Operational simplicity: one cluster to manage
- Scalability: can grow to 200+ banks on same cluster
- Backup: one pg_basebackup covers all banks

### Negative / Mitigations
- **Risk:** Cross-schema query possible if search_path misconfigured
  - **Mitigation:** Integration test suite validates tenant isolation on every CI run
- **Risk:** One large bank's queries can impact small banks
  - **Mitigation:** PgBouncer connection pooling with per-schema limits
- **Risk:** All schemas lose availability if PostgreSQL is down
  - **Mitigation:** Primary + hot standby + read replica (ADR-006)

---

## Related Decisions
- ADR-006: Database Strategy (connection pooling, read replicas)
- ADR-011: API Gateway (tenant resolution, routing)
