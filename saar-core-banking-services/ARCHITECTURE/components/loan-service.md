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
