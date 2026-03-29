# ParametrizationService (within CoreBankingApi)

## Purpose
3-tier parameter store for all bank-configurable values: interest rates, charges, operational thresholds, product configurations, and regulatory limits.

## Module
Part of `CoreBankingApi`. Module path: `CoreBankingApi/Modules/Parametrization/`

## Responsibilities
- Store and serve parameters at 3 tiers: System / Bank / Product
- Effective date management (rate changes take effect on a specific date)
- Parameter change approval workflow (maker-checker via WorkflowService)
- Parameter cache management (Redis-backed, 1-hour TTL)
- Parameter change audit trail
- Seed default parameters for new bank onboarding

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/params` | List all bank parameters |
| GET | `/api/params/{key}` | Get specific parameter (effective today) |
| GET | `/api/params/{key}?asOfDate=2026-04-01` | Get parameter for a future/past date |
| POST | `/api/params` | Create parameter change request |
| PUT | `/api/params/{key}` | Update parameter (creates pending change) |
| GET | `/api/params/pending` | Pending parameter changes for approval |
| POST | `/api/params/{id}/approve` | Approve parameter change (BANK_ADMIN) |
| GET | `/api/params/history/{key}` | Full history of a parameter value |
| POST | `/api/params/refresh-cache` | Force cache refresh (BOD trigger) |

## Standard Parameter Set (Seeded on Bank Onboarding)
| Category | Parameter | Default |
|---|---|---|
| Interest | `sb.interest_rate` | 3.50 |
| Interest | `sb.senior_citizen_bonus` | 0.50 |
| Interest | `npa.term_loan.overdue_days` | 90 |
| Interest | `npa.agricultural.overdue_days` | 180 |
| Charges | `charge.min_balance.savings.urban` | 1000 |
| Charges | `charge.chequebook.10leaves` | 50.00 |
| Charges | `charge.rtgs.outward.2to5lakh` | 25.00 |
| Operations | `workflow.maker_checker_threshold` | 100000 |
| Operations | `eod.start_time` | 22:00 |
| Operations | `session.inactivity_timeout_minutes` | 3 |
| Regulatory | `rbi.crr_rate` | 4.00 |
| Regulatory | `rbi.slr_rate` | 18.00 |

## Parameter Resolution Priority
```
1. Product-level parameter (most specific)
   → e.g., FD_REGULAR: interest_rate = 7.25%
2. Bank-level parameter
   → e.g., bank default FD rate = 7.00%
3. System-level parameter (SaaR default)
   → e.g., global default = 6.50%
4. ParameterNotFoundException (never silently default to zero)
```

## Cache Strategy
```
Redis key: params:{bankId}:{paramKey}:{effectiveDate}
TTL: 1 hour
Invalidated: on parameter approval
Refreshed: at BOD Step 1 (for new day's parameters)

EOD protection: Parameter values are snapshot at EOD start
→ Parameter changes approved during EOD do not affect current EOD run
→ Takes effect from next BOD
```

## IDRBT Requirements Met
- Section 1: Product parametrization (interest rates, charges)
- Section 3: Interest rate management with effective dates
- IDRBT P1 Principle: Bank variations as parameters, not code changes
- RBI: Rate change audit trail for regulatory inspection
