# ADR-006: Database Strategy

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — 15 min RPO, 1 hr RTO, Data Centre requirements |

---

## Context

A Core Banking database must handle:
- **OLTP:** 10–500 concurrent teller transactions per second during business hours
- **EOD Batch:** 10,000–100,000 account updates running sequentially overnight
- **Reporting:** Complex aggregate queries over months/years of transaction history
- **RBI Compliance:** 15-minute RPO (Recovery Point Objective), 1-hour RTO (Recovery Time Objective)
- **Scale:** Transaction table will grow to billions of rows over 10+ years

Running all three workloads on a single server instance will cause:
- EOD batch degrading teller response times
- Reporting queries locking OLTP tables
- Single point of failure with no HA

---

## Decision: PostgreSQL with Read Replica Separation + PgBouncer

### Topology

```
┌──────────────────────────────────────────────────────────────┐
│  APPLICATION TIER                                            │
│  CoreBankingApi × N    WorkflowService    ReportingService   │
└──────────┬───────────────────┬─────────────────┬────────────┘
           │ OLTP writes       │ OLTP reads       │ Heavy reads
           ▼                   ▼                  ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  PgBouncer      │   │  PgBouncer       │   │  PgBouncer       │
│  (write pool)   │   │  (read pool)     │   │  (report pool)   │
│  max 50 conns   │   │  max 100 conns   │   │  max 20 conns    │
└────────┬────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                     │                       │
         ▼                     │                       │
┌────────────────┐             │                       │
│  PRIMARY       │──streaming──►  REPLICA 1            │
│  PostgreSQL 16 │  replication│  (OLTP reads)         │
│  (all writes)  │             └───────────────────────┘
└────────┬───────┘──streaming──►  REPLICA 2
         │         replication │  (Reporting, EOD reads)
         │                     └───────────────────────
         │
         ▼
┌────────────────┐
│  STANDBY       │  (hot standby, DR site)
│  PostgreSQL 16 │  Streaming replication lag < 30 seconds
│  (failover)    │
└────────────────┘
```

### Read/Write Routing Rules
```csharp
// EF Core — separate DbContext for reads vs writes
services.AddDbContext<WriteDbContext>(o =>
    o.UseNpgsql(config["DB_WRITE_CONNECTION"]));  // → Primary

services.AddDbContext<ReadDbContext>(o =>
    o.UseNpgsql(config["DB_READ_CONNECTION"])     // → Replica
     .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// Rule: All Commands (CUD) → WriteDbContext
//       All Queries       → ReadDbContext
// ReportingService        → Replica 2 only (never touches Primary)
```

---

## Transaction Table Partitioning

The transaction ledger is the highest-growth table in any CBS — growing at 50,000–500,000 rows/day. Without partitioning, queries slow down as the table grows.

```sql
-- Master partition table
CREATE TABLE transactions (
    id              BIGSERIAL,
    txn_date        DATE NOT NULL,
    account_id      BIGINT NOT NULL,
    txn_type        TEXT NOT NULL,
    amount          NUMERIC(18,2) NOT NULL,
    balance_after   NUMERIC(18,2) NOT NULL,
    narration       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (txn_date);

-- Monthly partitions (created by pg_partman extension)
-- pg_partman auto-creates: transactions_2026_01, transactions_2026_02, etc.
SELECT partman.create_parent(
    'bank_kl001ucb.transactions',
    'txn_date',
    'range',
    'monthly'
);

-- Indexes created on each partition automatically
CREATE INDEX ON transactions (account_id, txn_date DESC);
CREATE INDEX ON transactions (txn_date, txn_type);

-- Old partitions (> 7 years) archived to cheaper storage
-- Retention policy: move to AWS Glacier / Azure Archive
```

### Partition Query Performance
```sql
-- This query only scans ONE partition (Jan 2026):
SELECT * FROM transactions
WHERE account_id = 123456
  AND txn_date BETWEEN '2026-01-01' AND '2026-01-31';

-- Without partitioning: full table scan (billions of rows)
-- With monthly partitioning: scans 1 of 120+ partitions → 100x faster
```

---

## PgBouncer Configuration

PgBouncer prevents connection exhaustion — 500 microservice instances × 10 EF Core connections = 5,000 PostgreSQL connections, which would crash PostgreSQL (max ~500).

```ini
[databases]
saar = host=postgres port=5432 dbname=saar

[pgbouncer]
pool_mode = transaction          ; best for microservices (stateless transactions)
max_client_conn = 2000           ; total connections PgBouncer accepts
default_pool_size = 50           ; connections per database per user to PostgreSQL
min_pool_size = 5
reserve_pool_size = 10
reserve_pool_timeout = 3
server_idle_timeout = 600
client_idle_timeout = 60
```

### Pool Size Limits Per Schema (Bank Isolation)
```ini
; Prevent one bank's EOD from consuming all connections
[databases]
bank_kl001ucb = host=postgres dbname=saar pool_size=20
bank_mh042ucb = host=postgres dbname=saar pool_size=20
bank_admin    = host=postgres dbname=saar pool_size=5
```

---

## Backup and Recovery Strategy

### Backup Schedule
```
Continuous WAL archiving → S3/Azure Blob (India region)
  - Every 5 minutes: WAL segment archived
  - This gives RPO of ~5 minutes (better than 15-min IDRBT requirement)

Daily: pg_basebackup (full base backup)
  - Stored for 90 days (regulatory retention)
  - Backup encrypted with AES-256 before upload

Weekly: Logical backup (pg_dump per tenant schema)
  - Enables single-bank restore without restoring entire cluster
  - Verified by automated restore test (separate server)
```

### Recovery Procedures
```bash
# Point-in-time recovery (PITR) — restore to specific timestamp
# IDRBT requires: 15-min RPO, 1-hr RTO

# Step 1: Restore base backup (15–30 min for 100GB)
pg_restore --target-time="2026-03-29 14:30:00"

# Step 2: Apply WAL archives up to target time
# PostgreSQL applies WALs automatically via recovery.conf

# Total RTO estimate: 30–45 min (within 1-hour IDRBT requirement)
```

---

## Index Strategy

### Critical Indexes (applied to all tenant schemas)
```sql
-- Account lookups (most frequent query in CBS)
CREATE INDEX idx_accounts_customer    ON accounts (customer_id);
CREATE INDEX idx_accounts_number      ON accounts (account_number);
CREATE INDEX idx_accounts_type_status ON accounts (account_type, status);

-- Transaction queries
CREATE INDEX idx_txn_account_date     ON transactions (account_id, txn_date DESC);
CREATE INDEX idx_txn_date_type        ON transactions (txn_date, txn_type);
CREATE INDEX idx_txn_reference        ON transactions (reference_number) WHERE reference_number IS NOT NULL;

-- Loan queries
CREATE INDEX idx_loans_customer       ON loans (customer_id);
CREATE INDEX idx_loans_status         ON loans (status, next_due_date);
CREATE INDEX idx_loans_overdue        ON loans (next_due_date, status) WHERE status = 'ACTIVE';

-- Customer search (CIF lookup)
CREATE INDEX idx_customers_pan        ON customers (pan_number) WHERE pan_number IS NOT NULL;
CREATE INDEX idx_customers_mobile     ON customers (mobile_number);
CREATE INDEX idx_customers_name_gin   ON customers USING gin (to_tsvector('simple', first_name || ' ' || last_name));
```

---

## Encryption at Rest

```sql
-- PII columns encrypted with pgcrypto
-- Application retrieves decrypted values; DB stores only ciphertext

-- Aadhaar (12-digit UID) — encrypted at application layer
-- PAN — encrypted at application layer
-- Mobile number — encrypted, only last 4 digits stored in plaintext for search

-- Transparent Data Encryption (TDE) at OS level via LUKS
-- PostgreSQL data directory: /var/lib/postgresql/data on LUKS-encrypted volume
```

---

## Consequences

### Positive
- OLTP workload never contends with reporting queries (separate replicas)
- EOD batch uses Replica 2 exclusively — zero impact on teller OLTP
- Partitioned transaction table remains performant over 10 years of data
- PgBouncer prevents connection exhaustion from 500+ service instances

### Negative / Mitigations
- **Risk:** Replication lag means reads from replica are slightly stale
  - **Mitigation:** Balance reads go to Primary (critical consistency); reporting uses Replica (eventual consistency acceptable)
- **Risk:** Partitioned table complicates cross-month queries
  - **Mitigation:** PostgreSQL query planner handles partition pruning transparently
- **Risk:** pg_partman auto-partitioning must be monitored
  - **Mitigation:** Grafana alert if next month's partition not pre-created by 25th of current month

---

## Related Decisions
- ADR-001: Multi-Tenancy (schema-per-tenant affects connection string construction)
- ADR-009: Reporting Architecture (reports use Replica 2 exclusively)
- ADR-012: Deployment (PostgreSQL on dedicated VM, not in Docker)
