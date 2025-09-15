## Expression Context Architecture

### Context Types:

#### 1. **Customer Context**
```csharp
// Object access (backend)
customer.creditScore
customer.monthlyIncome
customer.dateOfBirth

// Flattened access (expressions)
creditScore
monthlyIncome
age (calculated from dateOfBirth)
```

#### 2. **Loan Context** 
```csharp
// Backend provides BOTH customer AND loan data as flattened variables
// Customer properties:
creditScore, monthlyIncome, age, hasDefaultHistory

// Loan properties:
requestedAmount, approvedAmount, tenureMonths, interestRate, loanType
```

#### 3. **Account Context**
```csharp
// Object access
account.balance
account.accountType
account.minimumBalance

// Flattened access
balance
accountType
minimumBalance
```

#### 4. **Transaction Context**
```csharp
// Object access
transaction.amount
transaction.isInternational
customer.riskRating (related entity)

// Flattened access
amount
isInternational
customerRiskRating
```

### Multi-Entity Scenarios:

When expressions need data from multiple entities (like Loan + Customer), the system:

1. **Flattens all relevant properties** into a single variable space
2. **Merges related entity data** into the context
3. **Provides both approaches** for backward compatibility

Example Loan Context execution:
```json
{
  "contextData": {
    // Customer data (flattened)
    "creditScore": 750,
    "monthlyIncome": 120000,
    "age": 35,
    
    // Loan data (flattened)  
    "requestedAmount": 500000,
    "tenureMonths": 36,
    "interestRate": 8.5,
    
    // Calculated/derived
    "debtToIncomeRatio": 0.25
  }
}
```

This is why our auto-correction works:
- `customer.creditScore` → `creditScore` 
- `loan.requestedAmount` → `requestedAmount`

The backend merges all relevant entity data into a flat namespace for expression execution.