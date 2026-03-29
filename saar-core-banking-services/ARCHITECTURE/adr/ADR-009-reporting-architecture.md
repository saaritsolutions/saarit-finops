# ADR-009: Reporting Architecture

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Section 18 (MIS/Reports), RBI DSB returns, CRILC reporting |

---

## Context

A Core Banking System must produce three classes of reports:
1. **Operational Reports** — daily/intraday: transaction summaries, branch cash position, teller reports
2. **MIS Reports** — weekly/monthly: business performance, product-wise deposits/advances, P&L
3. **Regulatory Reports** — monthly/quarterly/annual: RBI DSB returns, CRILC, NPA reports, CRR/SLR computation

Challenges:
- Regulatory reports require complex aggregations over months/years of transaction history
- Running such queries on the OLTP PostgreSQL server would degrade teller performance
- RBI has specific formats for DSB (Data Submission Bureau) returns and requires submission within a deadline
- Reports must support custom date ranges, branch filters, and product filters
- Bank staff need ad-hoc report generation, not just fixed formats

IDRBT Annexure II explicitly requires the reporting system to run without impacting OLTP performance.

---

## Decision: CQRS Read Model on Dedicated Replica

### Architecture

```
OLTP (Primary DB)
        │
        │ streaming replication (< 5s lag)
        ▼
Reporting Replica (PostgreSQL read-only)
        │
        │ ReportingService queries here ONLY
        ▼
ReportingService (:5017)
  ├── Pre-built Views (materialized, refreshed post-EOD)
  ├── On-demand Report API
  ├── RBI Return Generator (scheduled)
  └── Report Scheduler (Hangfire)
        │
        ▼
Report Output:
  ├── In-browser (React AG Grid)
  ├── PDF export (via WeasyPrint/iTextSharp)
  └── Excel export (via ClosedXML)
```

### Key Rules
```
1. ReportingService NEVER touches the Primary PostgreSQL — read replica only
2. No write operations from ReportingService
3. Materialized views refreshed at BOD Step 5 (after EOD completes)
4. Real-time operational reports query live replica (< 5s lag acceptable)
5. Historical regulatory reports query materialized views (pre-aggregated)
```

---

## Materialized Views (Pre-Aggregated for Performance)

### Daily Account Summary
```sql
CREATE MATERIALIZED VIEW mv_daily_account_summary AS
SELECT
    a.account_type,
    a.product_code,
    COUNT(*)                                    AS account_count,
    SUM(a.current_balance)                      AS total_balance,
    SUM(CASE WHEN a.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN a.current_balance < 0 THEN 1 ELSE 0 END) AS od_count,
    DATE(NOW())                                 AS snapshot_date
FROM accounts a
GROUP BY a.account_type, a.product_code;

-- Refreshed at BOD Step 5
CREATE UNIQUE INDEX ON mv_daily_account_summary (account_type, product_code, snapshot_date);
```

### NPA Summary (for RBI reporting)
```sql
CREATE MATERIALIZED VIEW mv_npa_summary AS
SELECT
    loan_type,
    npa_category,
    COUNT(*)                    AS loan_count,
    SUM(outstanding_principal)  AS outstanding_amount,
    SUM(provision_amount)       AS provision_amount,
    DATE(NOW())                 AS snapshot_date
FROM loans
WHERE npa_category != 'STANDARD'
GROUP BY loan_type, npa_category;
```

### Transaction Volume Aggregates
```sql
CREATE MATERIALIZED VIEW mv_txn_volume_daily AS
SELECT
    txn_date,
    txn_type,
    COUNT(*)        AS txn_count,
    SUM(amount)     AS txn_amount,
    AVG(amount)     AS avg_amount
FROM transactions
GROUP BY txn_date, txn_type;

-- Covers multiple years — query performance O(1) regardless of transaction history
```

---

## RBI Regulatory Returns

### Return Formats Supported

| Return | Frequency | IDRBT Reference |
|---|---|---|
| Form A (Basic Statistical Return) | Annual | RBI/BSR |
| Form B (Investments) | Annual | RBI/BSR |
| DSB-01 (Deposits and Advances) | Monthly | RBI DSB |
| DSB-06 (Interest Rates) | Monthly | RBI DSB |
| OSS (Offsite Surveillance) | Quarterly | RBI OSS |
| CRILC (Central Repository) | Quarterly | RBI CRILC |
| NPA/NPI Report | Quarterly | RBI IRAC |
| CRR/SLR Compliance | Fortnightly | RBI Act 1934 |
| ALM (Asset Liability Management) | Monthly | RBI ALM |

### CRR/SLR Calculation Engine
```csharp
public class CrrSlrCalculationService
{
    public async Task<CrrSlrReport> CalculateAsync(DateOnly forDate)
    {
        var ndtl = await GetNetDemandTimeliabilitiesAsync(forDate);  // NDTL
        var requiredCrr = ndtl * await _params.GetDecimalAsync("rbi.crr_rate", forDate) / 100;
        var requiredSlr = ndtl * await _params.GetDecimalAsync("rbi.slr_rate", forDate) / 100;

        var actualCrr = await GetCashBalanceWithRbiAsync(forDate);
        var actualSlr = await GetApprovedSecuritiesValueAsync(forDate);

        return new CrrSlrReport
        {
            Ndtl = ndtl,
            RequiredCrr = requiredCrr,
            ActualCrr = actualCrr,
            CrrCompliant = actualCrr >= requiredCrr,
            CrrShortfall = Math.Max(0, requiredCrr - actualCrr),
            RequiredSlr = requiredSlr,
            ActualSlr = actualSlr,
            SlrCompliant = actualSlr >= requiredSlr,
            SlrShortfall = Math.Max(0, requiredSlr - actualSlr),
        };
    }
}
```

---

## MIS Dashboard Reports

### Branch Performance Dashboard
```json
{
  "report": "BRANCH_PERFORMANCE",
  "period": "2026-03",
  "data": {
    "total_deposits": 450000000,
    "total_advances": 320000000,
    "cd_ratio": 71.1,
    "new_accounts_opened": 142,
    "accounts_closed": 12,
    "loan_applications": 34,
    "loans_sanctioned": 28,
    "loan_sanction_rate": 82.4,
    "npa_percentage": 3.2,
    "transaction_count": 8420,
    "top_products": [
      { "product": "SB_BASIC", "balance": 120000000 },
      { "product": "FD_REGULAR", "balance": 180000000 }
    ]
  }
}
```

### Report API Design
```
GET /api/reports/trial-balance?date=2026-03-29
GET /api/reports/npa-summary?asOfDate=2026-03-31
GET /api/reports/crr-slr?forDate=2026-03-28
GET /api/reports/branch-performance?branchId=BR001&month=2026-03
GET /api/reports/transaction-summary?fromDate=2026-03-01&toDate=2026-03-31&txnType=RTGS
GET /api/reports/rbi-dsb01?month=2026-03       → generates RBI DSB-01 return (PDF + XML)
POST /api/reports/adhoc                         → ad-hoc query builder (REPORT_USER role only)
```

---

## Ad-Hoc Report Builder (REPORT_USER role)

For ad-hoc reporting without coding:
```
Pre-defined report templates:
  - Account-wise transaction summary
  - Customer-wise loan portfolio
  - Branch-wise deposit summary
  - Dormant account list
  - Overdue loan list with contact details

User can:
  - Select template
  - Apply date range filter
  - Apply branch/product filter
  - Export as Excel/PDF/CSV
  - Schedule recurring delivery (email)

Technical implementation:
  - Parameterized queries (no dynamic SQL — prevents injection)
  - Row limit: 10,000 for browser; unlimited for scheduled exports
  - CPU timeout: 60 seconds per query
  - Heavy reports run as Hangfire background jobs; email on completion
```

---

## Consequences

### Positive
- OLTP teller performance completely isolated from reporting workload
- Pre-aggregated materialized views make regulatory report generation near-instant
- Report API is separate service — can be scaled independently if RBI reporting load increases
- Scheduled reports automatically generated before business hours

### Negative / Mitigations
- **Risk:** Replica lag means operational reports may be up to 5 seconds stale
  - **Mitigation:** Acceptable for all reports; balance inquiries still go to Primary
- **Risk:** Materialized view refresh fails if EOD data is incorrect
  - **Mitigation:** Refresh wrapped in transaction; rollback if validation fails
- **Risk:** Ad-hoc queries by users cause unexpected load on replica
  - **Mitigation:** Query cost limit (pg_stat_statements); role-based query complexity limit

---

## Related Decisions
- ADR-006: Database Strategy (Replica 2 dedicated to reporting)
- ADR-008: EOD/BOD Engine (materialized views refreshed at BOD Step 5)
- ADR-002: Service Decomposition (ReportingService is an independent service)
