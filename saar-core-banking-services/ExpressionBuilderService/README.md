# Expression Builder Service

A powerful microservice for building, compiling, and executing banking business rules using C# expressions with Microsoft Roslyn. This service enables real-time compilation and execution of custom business logic for core banking operations.

## 🚀 Features

- **Runtime C# Compilation**: Uses Microsoft Roslyn for real-time C# expression compilation
- **Banking Function Library**: 50+ pre-built banking functions for common operations
- **Security Validation**: Comprehensive security checks to prevent malicious code execution
- **Multi-Tenant Support**: Tenant-aware expression management and execution
- **Expression Templates**: Pre-built templates for common banking scenarios
- **Performance Monitoring**: Execution time tracking and performance metrics
- **Audit Logging**: Complete audit trail of expression executions
- **RESTful API**: Well-documented REST API for integration

## 🏗️ Architecture

### Core Components

1. **Expression Engine** (`RoslynExpressionEngine`)
   - Compiles C# expressions using Roslyn
   - Validates expression security and syntax
   - Manages expression compilation cache
   - Executes compiled expressions safely

2. **Banking Function Library** (`BankingFunctionLibrary`)
   - Interest calculations (Simple, Compound, EMI, NPV, IRR)
   - Account operations and validations
   - Customer management functions
   - Transaction validations and limits
   - Risk assessment and scoring
   - Loan eligibility and calculations
   - Regulatory compliance checks
   - Date/time utilities
   - Currency conversion
   - Mathematical and statistical functions

3. **Security Validator** (`ExpressionSecurityValidator`)
   - Syntax tree analysis for security threats
   - Namespace and type filtering
   - Method call validation
   - Injection pattern detection
   - Resource usage monitoring

4. **Expression Service** (`ExpressionService`)
   - CRUD operations for expressions
   - Expression validation and compilation
   - Execution with logging
   - Template management

### Database Schema

- **ExpressionDefinitions**: Core expression metadata and compiled code
- **ExpressionExecutionLogs**: Audit trail of all expression executions
- **ExpressionTemplates**: Pre-built expression templates for common scenarios

## 🛠️ Technology Stack

- **.NET 8**: Modern C# runtime and framework
- **Microsoft Roslyn**: C# compiler as a service
- **Entity Framework Core**: Database ORM with PostgreSQL
- **ASP.NET Core**: Web API framework
- **JWT Authentication**: Secure API access
- **Swagger/OpenAPI**: API documentation
- **Serilog**: Structured logging
- **PostgreSQL**: Primary database

## 📦 Installation

### Prerequisites

- .NET 8 SDK
- PostgreSQL 12+
- Visual Studio 2022 or VS Code

### Setup Steps

1. **Clone the repository**
   ```bash
   cd ExpressionBuilderService
   ```

2. **Configure Database**
   ```bash
   # Update connection string in appsettings.json
   # Create database using the provided schema
   psql -U postgres -f Data/database_schema.sql
   ```

3. **Install Dependencies**
   ```bash
   dotnet restore
   ```

4. **Run the Service**
   ```bash
   dotnet run
   ```

5. **Access Swagger UI**
   ```
   https://localhost:7001/swagger
   ```

## 🔧 Configuration

### Database Configuration

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=saar_banking_expressions;Username=postgres;Password=postgres"
  }
}
```

### JWT Configuration

```json
{
  "Jwt": {
    "Key": "your-super-secret-key-here-must-be-at-least-256-bits",
    "Issuer": "https://your-domain.com",
    "Audience": "expression-builder-api",
    "ExpiryInHours": 24
  }
}
```

## 🚀 API Usage

### Create an Expression

```http
POST /api/expressions
Content-Type: application/json
Authorization: Bearer {token}

{
  "expressionId": "loan-approval-v1",
  "name": "Loan Approval Rule",
  "description": "Basic loan approval criteria",
  "category": "Loan Management",
  "expressionText": "customer.Age >= 21 && banking.IsEligibleForLoan(customer.CustomerId, 50000m, \"PERSONAL\")",
  "returnType": "boolean",
  "contextType": "Customer",
  "usageType": "Validation",
  "variables": {},
  "tags": ["loan", "approval", "validation"]
}
```

### Execute an Expression

```http
POST /api/expression-engine/execute
Content-Type: application/json
Authorization: Bearer {token}

{
  "expressionId": "loan-approval-v1",
  "variables": {
    "customerId": "CUST123456",
    "loanAmount": 50000,
    "loanType": "PERSONAL"
  },
  "executionContext": "Loan Application"
}
```

### Validate an Expression

```http
POST /api/expression-engine/validate
Content-Type: application/json
Authorization: Bearer {token}

{
  "expressionText": "banking.CalculateSimpleInterest(10000m, 5.5m, 30)",
  "contextType": "Account",
  "returnType": "decimal",
  "variables": {}
}
```

## 💡 Expression Examples

### Simple Interest Calculation
```csharp
banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)
```

### Loan Eligibility Check
```csharp
customer.Age >= 21 && customer.Age <= 65 && 
banking.IsEligibleForLoan(customer.CustomerId, 100000m, "HOME") && 
!banking.IsLoanDefaulter(customer.CustomerId)
```

### Transaction Validation
```csharp
!banking.IsTransactionLimitExceeded(transaction.Amount, "TRANSFER", account.AccountNumber) && 
banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) < 75m &&
banking.IsTransactionTimeValid(DateTime.UtcNow)
```

### Fee Calculation
```csharp
transaction.Amount > 10000m ? 
    banking.Percentage(transaction.Amount, 0.5m) : 
    5m
```

### Risk Assessment
```csharp
banking.IsSuspiciousTransaction(transaction.Amount, customer.CustomerId, "TRANSFER") || 
banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) > 80m
```

## 🛡️ Security Features

### Expression Security Validation

- **Namespace Filtering**: Only allows safe namespaces (System, System.Linq, etc.)
- **Type Blocking**: Prevents access to dangerous types (File, Process, etc.)
- **Method Validation**: Whitelist of allowed method calls
- **Syntax Analysis**: Comprehensive syntax tree analysis
- **Injection Protection**: Detects SQL injection and script injection patterns
- **Resource Limits**: Prevents memory and CPU intensive operations

### Safe Banking Functions

All banking functions are designed to be:
- **Side-effect free**: No database modifications
- **Input validated**: Proper parameter validation
- **Exception handled**: Graceful error handling
- **Performance optimized**: Cached where appropriate

## 📊 Monitoring and Performance

### Execution Metrics

- Execution time tracking
- Memory usage monitoring
- Success/failure rates
- Performance trending

### Audit Trail

- Complete execution history
- Input parameter logging
- Result tracking
- Error logging with stack traces

## 🔗 Integration

### Core Banking Integration

The Expression Builder Service integrates with your core banking platform through:

1. **Shared Models**: Common data models for Customer, Account, Transaction, Loan
2. **Event-Driven**: Responds to banking events for rule execution
3. **API Integration**: RESTful APIs for real-time rule evaluation
4. **Database Integration**: Shared database access for banking data

### Multi-Tenant Architecture

- Tenant-aware expression management
- Isolated expression execution
- Tenant-specific templates and configurations
- Secure tenant data separation

## 🧪 Testing

### Sample Test Scenarios

```bash
# Run unit tests
dotnet test

# Test expression compilation
curl -X POST "https://localhost:7001/api/expression-engine/validate" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "expressionText": "banking.CalculateSimpleInterest(1000m, 5m, 30)",
    "contextType": "Account",
    "returnType": "decimal"
  }'

# Test expression execution
curl -X POST "https://localhost:7001/api/expression-engine/execute" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "expressionId": "sample-interest-calc",
    "variables": {
      "principal": 1000,
      "rate": 5.5,
      "days": 30
    }
  }'
```

## 📚 Documentation

### Banking Function Reference

| Category | Functions | Description |
|----------|-----------|-------------|
| Interest | CalculateSimpleInterest, CalculateCompoundInterest, CalculateEMI | Interest calculations |
| Account | IsAccountActive, GetAccountBalance, GetAccountType | Account operations |
| Customer | IsCustomerValid, GetCustomerAge, GetCustomerRiskCategory | Customer management |
| Transaction | IsTransactionLimitExceeded, CalculateRiskScore | Transaction validation |
| Loan | IsEligibleForLoan, CalculateLoanEligibility | Loan operations |
| Compliance | IsCTRRequired, IsSARRequired, IsAMLCompliant | Regulatory compliance |
| Utilities | CalculateBusinessDays, ConvertCurrency, GenerateReferenceNumber | Utility functions |

### API Documentation

Full API documentation is available via Swagger UI at `/swagger` when running the service.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Update documentation
5. Submit a pull request

## 📄 License

This project is part of the SaaR Core Banking Platform and is proprietary software.

## 🆘 Support

For support and questions:
- Email: support@saarsolutions.com
- Documentation: [Core Banking Documentation](../README.md)
- Issues: Create an issue in the repository

## 🔮 Roadmap

- [ ] Visual Expression Builder UI
- [ ] Expression Templates Marketplace
- [ ] Advanced Performance Analytics
- [ ] Machine Learning-based Risk Scoring
- [ ] GraphQL API Support
- [ ] Real-time Expression Testing
- [ ] Expression Version Control
- [ ] Advanced Debugging Tools

---

**Expression Builder Service** - Empowering dynamic business rule management in core banking systems.
