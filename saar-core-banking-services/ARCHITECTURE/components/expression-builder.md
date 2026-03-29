# ExpressionBuilderService

## Purpose
Roslyn-based rule engine for financial expressions — interest calculations, loan eligibility, NPA classification rules, and any bank-defined formulas.

## Port
`:5004`

## Responsibilities
- Store and version financial expressions (rules)
- Compile C# expressions using Roslyn at runtime
- Evaluate expressions with input parameters
- Provide AI-assisted expression generation
- Seed standard expression templates (interest, eligibility, charges)

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/expressions` | List all expressions |
| GET | `/api/expressions/{id}` | Get expression by ID |
| POST | `/api/expressions` | Create new expression |
| PUT | `/api/expressions/{id}` | Update expression |
| POST | `/api/expressions/{id}/evaluate` | Evaluate expression with inputs |
| POST | `/api/AIExpression/generate` | AI-generate expression from spec |
| GET | `/api/ExpressionTemplates` | Get seeded expression templates |
| POST | `/api/expressions/{id}/test` | Test expression against test cases |

## Expression Format
```csharp
// Example: SB Interest Calculation
{
  "id": "EXPR_SB_INTEREST",
  "name": "Savings Bank Interest Calculation",
  "inputParameters": [
    { "name": "dailyMinBalance", "type": "decimal" },
    { "name": "annualRate", "type": "decimal" },
    { "name": "isSeniorCitizen", "type": "bool" },
    { "name": "seniorBonus", "type": "decimal" }
  ],
  "formula": "var effectiveRate = isSeniorCitizen ? annualRate + seniorBonus : annualRate; return dailyMinBalance * effectiveRate / 100 / 365;"
}
```

## How It Works
1. Expression stored as text formula in PostgreSQL
2. At evaluation: Roslyn compiles formula to IL (in-memory, cached)
3. IL assembly invoked with input parameters
4. Result returned as JSON

## Performance
- Compiled IL cached per expression ID (not recompiled on every call)
- Cache invalidated on expression update
- 10,000 EOD calls: ~2ms per evaluation (IL speed)

## Active Expression IDs (do not delete)
- `EXPR_1755237353842` — currently active, used by LoanService

## IDRBT Requirements Met
- Section 3: Interest calculation parametrization
- Section 7: Loan eligibility assessment
- Section 11: NPA classification rules (overdue days, provision rates)
