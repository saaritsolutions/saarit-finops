namespace ExpressionBuilderService.Models;

/// <summary>
/// Represents a compiled expression with metadata
/// </summary>
public class CompiledExpression
{
    public string ExpressionId { get; set; } = string.Empty;
    public string OriginalExpression { get; set; } = string.Empty;
    public string CompiledCode { get; set; } = string.Empty;
    public System.Reflection.Assembly? CompiledAssembly { get; set; }
    public System.Reflection.MethodInfo? ExecuteMethod { get; set; }
    public List<string> Dependencies { get; set; } = new();
    public Dictionary<string, Type> Variables { get; set; } = new();
    public TimeSpan CompilationTime { get; set; }
    public DateTime CompiledAt { get; set; }
}

/// <summary>
/// Result of expression compilation
/// </summary>
public class ExpressionCompilationResult
{
    public bool Success { get; set; }
    public CompiledExpression? CompiledExpression { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();

    public static ExpressionCompilationResult Succeeded(CompiledExpression compiledExpression)
    {
        return new ExpressionCompilationResult
        {
            Success = true,
            CompiledExpression = compiledExpression
        };
    }

    public static ExpressionCompilationResult Failed(IEnumerable<string> errors)
    {
        return new ExpressionCompilationResult
        {
            Success = false,
            Errors = errors.ToList()
        };
    }

    public static ExpressionCompilationResult Failed(string error)
    {
        return Failed(new[] { error });
    }
}

/// <summary>
/// Context for expression compilation and execution
/// </summary>
public class ExpressionContext
{
    public string ContextType { get; set; } = string.Empty; // "Customer", "Account", "Transaction", "Loan"
    public Type? ReturnType { get; set; }
    public List<ExpressionVariable> Variables { get; set; } = new();
    public bool RequiresBankingDomain { get; set; } = true;
    public Dictionary<string, object> Parameters { get; set; } = new();
}

/// <summary>
/// Variable available in expression context
/// </summary>
public class ExpressionVariable
{
    public string Name { get; set; } = string.Empty;
    public Type Type { get; set; } = typeof(object);
    public string Description { get; set; } = string.Empty;
    public object? DefaultValue { get; set; }
    public bool IsRequired { get; set; }
}

/// <summary>
/// Metadata about an expression
/// </summary>
public class ExpressionMetadata
{
    public List<string> UsedVariables { get; set; } = new();
    public List<string> UsedFunctions { get; set; } = new();
    public int ComplexityScore { get; set; }
    public bool HasConditions { get; set; }
    public bool HasLoops { get; set; }
    public List<string> Warnings { get; set; } = new();
    
    // Additional properties for compatibility
    public Dictionary<string, object> Variables { get; set; } = new();
    public List<string> Functions { get; set; } = new();
    public List<string> Dependencies { get; set; } = new();
    public List<string> BankingFunctions { get; set; } = new();
    public int VariableCount => UsedVariables.Count;
    public int MethodCallCount => UsedFunctions.Count;
    public int ConditionalCount => HasConditions ? 1 : 0;
    public string ComplexityLevel => ComplexityScore switch
    {
        < 3 => "Low",
        < 7 => "Medium",
        _ => "High"
    };
}

/// <summary>
/// Result of expression execution
/// </summary>
public class ExpressionExecutionResult
{
    public bool Success { get; set; }
    public object? Result { get; set; }
    public Type? ResultType { get; set; }
    public TimeSpan ExecutionTime { get; set; }
    public string? ErrorMessage { get; set; }
    public long MemoryUsed { get; set; }

    public static ExpressionExecutionResult Succeeded<T>(T result, TimeSpan executionTime)
    {
        return new ExpressionExecutionResult
        {
            Success = true,
            Result = result,
            ResultType = typeof(T),
            ExecutionTime = executionTime
        };
    }

    public static ExpressionExecutionResult Failed(string error, TimeSpan executionTime)
    {
        return new ExpressionExecutionResult
        {
            Success = false,
            ErrorMessage = error,
            ExecutionTime = executionTime
        };
    }
}

/// <summary>
/// Banking-specific expression context with domain entities
/// </summary>
public class BankingExpressionContext : ExpressionContext
{
    // Banking entities available in expressions
    public CustomerData? Customer { get; set; }
    public AccountData? Account { get; set; }
    public TransactionData? Transaction { get; set; }
    public LoanData? Loan { get; set; }
    public Dictionary<string, object> CustomFields { get; set; } = new();
    
    // System context
    public DateTime CurrentDate => DateTime.UtcNow.Date;
    public DateTime CurrentDateTime => DateTime.UtcNow;
    public string TenantId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;

    // Banking-specific calculated properties
    public int CustomerAge => Customer != null ? 
        (int)((CurrentDate - Customer.DateOfBirth).TotalDays / 365.25) : 0;
    
    public decimal CustomerMonthlyIncome => Customer?.MonthlyIncome ?? 0;
    public int CustomerCreditScore => Customer?.CreditScore ?? 0;
    public bool CustomerHasDefaultHistory => Customer?.HasDefaultHistory ?? false;
}

/// <summary>
/// Customer data for expressions
/// </summary>
public class CustomerData
{
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public decimal MonthlyIncome { get; set; }
    public int CreditScore { get; set; }
    public decimal DebtToIncomeRatio { get; set; }
    public bool HasDefaultHistory { get; set; }
    public bool AddressVerified { get; set; }
    public bool IncomeProofSubmitted { get; set; }
    public bool HasValidID { get; set; }
    public string CustomerType { get; set; } = string.Empty;
    public Dictionary<string, object> CustomAttributes { get; set; } = new();

    // Add camelCase properties for expressions (aliases)
    public decimal monthlyIncome => MonthlyIncome;
    public int creditScore => CreditScore;
    public decimal debtToIncomeRatio => DebtToIncomeRatio;
    public int age => DateTime.Now.Year - DateOfBirth.Year;
}

/// <summary>
/// Account data for expressions
/// </summary>
public class AccountData
{
    public string AccountId { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public decimal AvailableBalance { get; set; }
    public DateTime OpenedDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    public decimal MinimumBalance { get; set; }
}

/// <summary>
/// Transaction data for expressions
/// </summary>
public class TransactionData
{
    public string TransactionId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string FromAccountId { get; set; } = string.Empty;
    public string ToAccountId { get; set; } = string.Empty;
    public DateTime TransactionDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Currency { get; set; } = string.Empty;
    
    // Additional properties for risk assessment
    public bool IsInternational { get; set; }
    public int DailyTransactionCount { get; set; }
    public decimal DailyTransactionSum { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerRiskProfile { get; set; } = string.Empty;
    
    // Alias properties for case-insensitive access
    public decimal amount => Amount;
    public bool isInternational => IsInternational;
    public int dailyTransactionCount => DailyTransactionCount;
    public decimal dailyTransactionSum => DailyTransactionSum;
}

/// <summary>
/// Loan data for expressions
/// </summary>
public class LoanData
{
    public string LoanId { get; set; } = string.Empty;
    public decimal RequestedAmount { get; set; }
    public decimal ApprovedAmount { get; set; }
    public decimal InterestRate { get; set; }
    public int TenureMonths { get; set; }
    public string LoanType { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public decimal MonthlyEMI { get; set; }
    public decimal DebtToIncomeRatio { get; set; }
}
