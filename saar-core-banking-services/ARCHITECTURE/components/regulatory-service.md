# RegulatoryService (within CoreBankingApi)

## Purpose
Handles all RBI-mandated regulatory computations: CRR/SLR compliance, NPA IRAC norms, priority sector lending, and government-directed schemes.

## Module
Part of `CoreBankingApi`. Module path: `CoreBankingApi/Modules/Regulatory/`

## Responsibilities
- CRR (Cash Reserve Ratio) computation and compliance monitoring
- SLR (Statutory Liquidity Ratio) computation (approved securities tracking)
- Priority Sector Lending (PSL) target tracking
- Agricultural loan sub-targets (18% of ANBC)
- Weaker sections and micro-enterprise sub-targets
- NPA IRAC (Income Recognition and Asset Classification) norms application
- Provision for doubtful and loss assets
- RBI inspection data preparation
- Government scheme administration (PM Mudra, PMJJBY, PMSBY, Atal Pension)

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/regulatory/crr-slr/current` | Today's CRR/SLR position |
| GET | `/api/regulatory/crr-slr/history` | Historical CRR/SLR compliance |
| GET | `/api/regulatory/psl/position` | Priority sector lending position |
| GET | `/api/regulatory/psl/targets` | PSL targets vs achievement |
| GET | `/api/regulatory/npa/classification` | NPA classification summary |
| GET | `/api/regulatory/npa/provisions` | Provision adequacy report |
| GET | `/api/regulatory/schemes` | Enrolled government schemes |
| POST | `/api/regulatory/schemes/{schemeCode}/enroll` | Enroll customer in scheme |
| GET | `/api/regulatory/investments` | SLR-eligible investments |
| POST | `/api/regulatory/investments` | Record investment |

## CRR/SLR Monitoring
```
CRR Compliance Check (fortnightly average basis):
  - Computed every EOD
  - 14-day rolling average maintained
  - Alert if daily average falls below required CRR
  - Penalty: 3% above bank rate on shortfall amount (RBI Act 1934)

SLR Compliance Check:
  - Approved securities: G-Secs, State Dev Loans, RBI bonds
  - Valued at market price (marked-to-market for G-Secs)
  - Alert if SLR position < required 18%
```

## Priority Sector Lending (PSL)
```
RBI PSL targets for UCBs:
  Overall PSL:          40% of ANBC (Adjusted Net Bank Credit)
  Agricultural:         18% of ANBC
    - Small/Marginal:   8% of ANBC
  Micro Enterprises:    7.5% of ANBC
  Weaker Sections:      12% of ANBC
  Housing (affordable): ₹35 lakh limit in metros, ₹25 lakh others

ANBC = Domestic Bank Credit + RIDF deposits - Food Credit
```

## NPA IRAC Norms (RBI 2015)
```
Asset Classification:
  STANDARD:     No overdue / overdue < NPA threshold
  SUB-STANDARD: Overdue 90–365 days (or 180 days for agriculture)
  DOUBTFUL:     Sub-standard for > 12 months
    DOUBTFUL-1: Up to 1 year in doubtful category → 25% provision
    DOUBTFUL-2: 1–3 years in doubtful → 40% provision
    DOUBTFUL-3: > 3 years in doubtful → 100% provision
  LOSS:         Identified as loss but not fully written off → 100% provision

Provision Rates:
  Standard:     0.25–1% (based on loan type)
  Sub-Standard: 15%
  Doubtful-1:   25% (secured) / 100% (unsecured)
  Doubtful-2:   40%
  Doubtful-3:   100%
  Loss:         100%
```

## Government Schemes Administered
| Scheme | Ministry | Purpose |
|---|---|---|
| PM Mudra Yojana (PMMY) | Finance | Small business loans (Shishu/Kishore/Tarun) |
| PMJJBY | Finance | Life insurance ₹2 lakh @ ₹436/year |
| PMSBY | Finance | Accident insurance ₹2 lakh @ ₹20/year |
| Atal Pension Yojana (APY) | PFRDA | Pension scheme for unorganised sector |
| PMJDY | Finance | Jan Dhan zero-balance accounts |
| SHG Bank Linkage | NABARD | Self-Help Group credit linkage |
| KCC | Agriculture | Kisan Credit Card for farmers |

## IDRBT Requirements Met
- Section 16: Regulatory compliance
- Section 16.1: CRR/SLR computation
- Section 16.2: Priority sector lending tracking
- Section 16.3: NPA provisioning per IRAC norms
- RBI Master Circular on IRAC Norms (updated annually)
- NABARD guidelines for agricultural credit
