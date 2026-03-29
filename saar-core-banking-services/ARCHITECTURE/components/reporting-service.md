# ReportingService

## Purpose
Read-model reporting service for MIS dashboards, RBI regulatory returns, branch performance reports, and ad-hoc queries. Runs exclusively on a read replica to ensure zero impact on OLTP.

## Port
`:5017`

## Responsibilities
- RBI regulatory returns (DSB-01, DSB-06, OSS, CRILC, NPA report)
- CRR/SLR computation and compliance reports
- MIS dashboard data (deposits, advances, P&L, branch performance)
- Transaction volume and analytics reports
- Trial Balance and financial statements (read from GL replica)
- Ad-hoc report generation with parameterized queries
- Scheduled report generation and email delivery
- Export to Excel (ClosedXML) and PDF (iTextSharp/WeasyPrint)

## Port
`:5017`

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/trial-balance` | Trial balance as of date |
| GET | `/api/reports/profit-loss` | P&L for a period |
| GET | `/api/reports/balance-sheet` | Balance sheet |
| GET | `/api/reports/npa-summary` | NPA portfolio summary |
| GET | `/api/reports/crr-slr` | CRR/SLR compliance report |
| GET | `/api/reports/branch-performance` | Branch KPI dashboard |
| GET | `/api/reports/deposit-summary` | Product-wise deposit summary |
| GET | `/api/reports/loan-portfolio` | Loan portfolio analytics |
| GET | `/api/reports/transaction-volume` | Transaction volume analytics |
| GET | `/api/reports/rbi-dsb01` | RBI DSB-01 return (monthly) |
| GET | `/api/reports/rbi-oss` | RBI OSS quarterly return |
| GET | `/api/reports/crilc` | CRILC quarterly submission |
| POST | `/api/reports/adhoc` | Ad-hoc parameterized query |
| POST | `/api/reports/schedule` | Schedule recurring report delivery |

## RBI Returns Supported
| Return | Frequency | Regulator | Format |
|---|---|---|---|
| Form A — Basic Statistical Return | Annual | RBI/BSR | PDF + XML |
| DSB-01 — Deposits & Advances | Monthly | RBI DSB | Excel |
| DSB-06 — Interest Rates | Monthly | RBI DSB | Excel |
| OSS — Offsite Surveillance | Quarterly | RBI OSS | XML upload |
| CRILC — Central Repository | Quarterly | RBI CRILC | CSV |
| NPA Report | Quarterly | RBI | Excel |
| CRR/SLR Compliance | Fortnightly | RBI | Internal |
| ALM Statement | Monthly | RBI | Excel |

## Architecture: Read-Only Replica
```
ReportingService ONLY connects to:
  - PostgreSQL Replica 2 (heavy read queries)
  - Materialized views refreshed post-EOD

NEVER connects to:
  - PostgreSQL Primary (write path)
  - Any OLTP-facing service

This ensures: bank tellers experience zero slowdown
even when auditors run year-end reports
```

## Materialized Views Used
```sql
-- Refreshed at BOD Step 5 (every morning after EOD):
mv_daily_account_summary     -- Account counts and balances by type
mv_npa_summary               -- NPA portfolio by category
mv_txn_volume_daily          -- Daily transaction volume aggregates
mv_branch_performance        -- Branch KPIs
mv_deposit_product_summary   -- Product-wise deposit breakdown
mv_interest_accrual_summary  -- Accruals for P&L
```

## CRR/SLR Calculation
```
CRR (Cash Reserve Ratio) = 4% of NDTL
SLR (Statutory Liquidity Ratio) = 18% of NDTL

NDTL = Net Demand and Time Liabilities
     = (Demand Deposits + Time Deposits + Borrowings) − (Inter-bank assets)

Required CRR = NDTL × CRR Rate / 100
Actual CRR   = Cash balance with RBI + Cash in hand

If Actual < Required → CRR Shortfall → Penalty from RBI
```

## IDRBT Requirements Met
- Section 18: Management Information System (MIS)
- Section 16: Regulatory compliance reporting
- RBI DSB: Monthly data submission to RBI data warehouse
- RBI CRILC: Quarterly large credit exposure reporting
- IDRBT Annexure II: Reports must not impact OLTP performance
