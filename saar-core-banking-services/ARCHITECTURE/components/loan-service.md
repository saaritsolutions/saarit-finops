# LoanService

## Purpose
End-to-end loan lifecycle management: origination, sanction, disbursement, repayment, NPA management, and closure.

## Port
`:5130`

## Responsibilities
- Loan application intake and processing
- Credit appraisal (income assessment, DSR calculation via ExpressionBuilderService)
- Collateral/security management
- Loan sanction workflow (maker-checker)
- Disbursement processing
- EMI schedule generation
- Repayment posting (cash, ECS, PDC)
- NPA status tracking (with EOD engine)
- Loan restructuring / moratorium
- Foreclosure calculation

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/loan/applications` | Submit loan application |
| GET | `/api/loan/applications/{id}` | Get application status |
| POST | `/api/loan/applications/{id}/appraise` | Run credit appraisal |
| POST | `/api/loan/applications/{id}/sanction` | Sanction loan (checker) |
| POST | `/api/loan/applications/{id}/disburse` | Disburse sanctioned loan |
| GET | `/api/loan/{id}` | Get loan account details |
| GET | `/api/loan/{id}/schedule` | Repayment schedule |
| POST | `/api/loan/{id}/repay` | Post repayment |
| POST | `/api/loan/{id}/foreclose` | Calculate and process foreclosure |
| GET | `/api/loan/npa-accounts` | List NPA loan accounts |
| GET | `/api/LoanOrigination/form-schema/{productCode}` | Dynamic form schema |

## Loan Product Types
| Type | Tenure | Collateral |
|---|---|---|
| Personal Loan | 12–60 months | Unsecured |
| Home Loan | Up to 240 months | Property mortgage |
| Vehicle Loan | 12–84 months | Hypothecation |
| Agricultural Loan | 12–36 months | Land/crop insurance |
| Gold Loan | 3–12 months | Gold jewelry pledge |
| Business Loan | 12–60 months | Assets/guarantors |
| Education Loan | 5–15 years | Moratorium during study |

## Credit Appraisal Integration
```
LoanService → ExpressionBuilderService
  POST /api/expressions/{EXPR_LOAN_ELIGIBILITY}/evaluate
  Input: { monthlyIncome, existingEmi, loanAmount, tenure, creditScore }
  Output: { eligible, maxLoanAmount, maxEmi, dsr, riskCategory }
```

## Data Model
```
LoanApplication
├── ApplicationId (GUID)
├── CustomerId
├── ProductCode
├── LoanAmount (requested)
├── Tenure (months)
├── Purpose
├── Status: DRAFT | SUBMITTED | UNDER_REVIEW | SANCTIONED | DISBURSED | REJECTED
├── AppraisalResult (JSON — AI expression output)
├── CollateralDetails (JSON array)
├── SanctionedAmount, SanctionedRate, SanctionedTenure
├── DisbursedDate
└── AuditFields

LoanAccount (post-disbursement)
├── LoanId (GUID)
├── LoanNumber
├── OutstandingPrincipal
├── AccruedInterest
├── NpaCategory: STANDARD | SUB_STANDARD | DOUBTFUL | LOSS
├── DaysPastDue
├── NextDueDate
├── ProvisionAmount
└── RepaymentSchedule: [ { dueDate, principal, interest, status } ]
```

## Domain Events Published
- `LoanApplicationSubmitted`
- `LoanSanctioned`
- `LoanDisbursed` → GL: Dr Loan A/c, Cr Customer CASA
- `InstallmentOverdue` → NPA days counter starts
- `NpaClassified` → GL: reverse interest, create provision
- `LoanClosed` → GL: close loan GL head

## IDRBT Requirements Met
- Section 7: Loan origination and appraisal
- Section 7.3: Collateral management
- Section 7.5: Disbursement with GL posting
- Section 11: NPA classification (RBI IRAC norms)
- Section 11.1: Sub-Standard, Doubtful, Loss categories
- Section 11.2: Provision creation per RBI norms

---

## Gold Loan Sub-Module (SAAR-GL-001 — Session 33+)

**Architectural Pattern:** Sub-module within LoanService (ADR-013)
**Folder:** `Models/Gold/`, `Controllers/Gold/`, `Services/Gold/`

### Additional Entities
| Entity | Relationship | Purpose |
|---|---|---|
| GoldLoanDetails | 1:1 with LoanApplication | Scheme, tenure, appraiser, vault location, pledge totals |
| GoldPledgeItem | 1:N with GoldLoanDetails | Individual ornament: weight, purity, valued amount |
| GoldRateMaster | Standalone (per tenant) | Daily IBJA 22K rate log |
| MarginCall | 1:N with GoldLoanDetails | LTV breach events (Phase 3) |
| AuctionNotice | 1:N with GoldLoanDetails | RBI-mandated 14-day auction notices (Phase 4) |

### Gold Loan API Endpoints
| Method | Path | Description |
|---|---|---|
| POST | `/api/gold-loan/applications` | Create gold loan (LoanApplication + GoldLoanDetails) |
| GET | `/api/gold-loan/applications` | List gold loans with pledge totals and LTV |
| GET | `/api/gold-loan/applications/{id}` | Full detail: pledge items + margin calls + auction |
| POST | `/api/gold-loan/applications/{id}/pledge-items` | Add pledge item (ornament/bar) |
| DELETE | `/api/gold-loan/applications/{id}/pledge-items/{itemId}` | Remove pledge item (DRAFT only) |
| POST | `/api/gold-loan/applications/{id}/sanction` | Sanction: verify LTV ≤ 75%, issue pledge receipt |
| POST | `/api/gold-loan/applications/{id}/disburse` | Disburse: GL DR 1025 / CR 1010 |
| POST | `/api/gold-loan/applications/{id}/repay` | Record repayment |
| POST | `/api/gold-loan/applications/{id}/close` | Close: GL DR 1010 / CR 1025 + CR 4015, release gold |
| POST | `/api/gold-loan/applications/{id}/margin-calls` | Create margin call (LTV breach) |
| PATCH | `/api/gold-loan/margin-calls/{id}/respond` | Record customer margin call response |
| POST | `/api/gold-loan/applications/{id}/auction-notices` | Issue 14-day auction notice |
| POST | `/api/gold-loan/auction-notices/{id}/conduct` | Record auction outcome + GL |
| GET | `/api/gold-loan/ltv-report` | LTV status of all active gold loans |
| GET | `/api/gold-rate/today` | Get today's IBJA rate |
| GET | `/api/gold-rate` | Rate history |
| POST | `/api/gold-rate` | Admin: enter today's rate |

### Gold Loan GL Accounts (New — added to TransactionService)
| Code | Name | Type | Normal |
|---|---|---|---|
| 1025 | Gold Loans Outstanding | Asset | Debit |
| 2050 | Gold in Custody | Liability | Credit |
| 4015 | Gold Loan Interest Income | Income | Credit |
| 5050 | Auction Expenses | Expense | Debit |

### Gold Loan Lifecycle
```
DRAFT → SUBMITTED → APPRAISED → SANCTIONED → DISBURSED
  → CLOSED (bullet repayment)
  → MARGIN_CALL_OPEN → AUCTION_NOTICE_ISSUED → AUCTION_SETTLED
```

### RBI Regulatory Compliance
- LTV cap 75% enforced at sanction (hard stop)
- 14-day minimum auction notice period enforced in AuctionNotice entity
- Auction proceeds surplus must be returned to borrower (tracked via SurplusReturnedAt)
- Daily gold rate management for LTV monitoring
