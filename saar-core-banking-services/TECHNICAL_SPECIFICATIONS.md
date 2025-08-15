# Technical Framework Specifications

## 📋 **Document Overview**

**Purpose**: Detailed technical specifications for each framework component  
**Audience**: Development team, technical architects, system integrators  
**Version**: 1.1  
**Date**: August 13, 2025  
**Update**: Added Expression Builder Engine specifications

---

## 🧮 **1. Expression Builder Engine Specification** ⭐️ **NEW CRITICAL COMPONENT**

### **1.1 Roslyn-Based Expression Architecture**

The Expression Builder Engine allows users to create custom business logic using C# expressions that are compiled and executed at runtime using Microsoft.CodeAnalysis (Roslyn).

#### **Core Expression Engine Implementation**
```csharp
// IExpressionEngine.cs
public interface IExpressionEngine
{
    Task<ExpressionCompilationResult> CompileExpressionAsync(
        string expression, 
        ExpressionContext context, 
        CancellationToken cancellationToken = default);
    
    Task<T> ExecuteExpressionAsync<T>(
        CompiledExpression compiledExpression, 
        Dictionary<string, object> variables,
        CancellationToken cancellationToken = default);
    
    Task<bool> ValidateExpressionSyntaxAsync(
        string expression, 
        ExpressionContext context);
    
    Task<ExpressionMetadata> AnalyzeExpressionAsync(string expression);
    
    Task<IEnumerable<string>> GetAvailableFunctionsAsync(string category = null);
    Task<IEnumerable<ExpressionVariable>> GetAvailableVariablesAsync(string contextType);
}

// ExpressionEngine.cs - Core Implementation
public class ExpressionEngine : IExpressionEngine
{
    private readonly ILogger<ExpressionEngine> _logger;
    private readonly ITenantContext _tenantContext;
    private readonly IExpressionSecurityValidator _securityValidator;
    private readonly IMemoryCache _compilationCache;
    
    // Allowed namespaces for security
    private readonly HashSet<string> _allowedNamespaces = new()
    {
        "System",
        "System.Math",
        "System.DateTime",
        "System.TimeSpan",
        "System.String",
        "System.Linq",
        "Banking.Domain.Models",
        "Banking.Domain.Functions"
    };

    // Blocked types for security
    private readonly HashSet<string> _blockedTypes = new()
    {
        "System.IO",
        "System.Net",
        "System.Reflection",
        "System.Threading",
        "System.Diagnostics",
        "System.Runtime"
    };

    public async Task<ExpressionCompilationResult> CompileExpressionAsync(
        string expression, 
        ExpressionContext context, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Security validation
            var securityResult = await _securityValidator.ValidateExpressionAsync(expression, context);
            if (!securityResult.IsValid)
            {
                return ExpressionCompilationResult.Failed(securityResult.Errors);
            }

            // Check compilation cache
            var cacheKey = $"{_tenantContext.TenantId}:{expression.GetHashCode()}";
            if (_compilationCache.TryGetValue(cacheKey, out CompiledExpression cachedExpression))
            {
                return ExpressionCompilationResult.Success(cachedExpression);
            }

            // Create compilation
            var compilationResult = await CompileToAssemblyAsync(expression, context, cancellationToken);
            
            if (compilationResult.Success)
            {
                // Cache successful compilation
                _compilationCache.Set(cacheKey, compilationResult.CompiledExpression, TimeSpan.FromHours(1));
            }

            return compilationResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Expression compilation failed: {Expression}", expression);
            return ExpressionCompilationResult.Failed(new[] { ex.Message });
        }
    }

    private async Task<ExpressionCompilationResult> CompileToAssemblyAsync(
        string expression, 
        ExpressionContext context,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        
        // Generate wrapper class for expression
        var sourceCode = GenerateWrapperClass(expression, context);
        
        // Create syntax tree
        var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode);
        
        // Get required references
        var references = GetRequiredReferences(context);
        
        // Create compilation
        var compilation = CSharpCompilation.Create(
            assemblyName: $"Expression_{Guid.NewGuid():N}",
            syntaxTrees: new[] { syntaxTree },
            references: references,
            options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary)
                .WithOptimizationLevel(OptimizationLevel.Release)
                .WithPlatform(Platform.AnyCpu));

        // Compile to memory stream
        using var memoryStream = new MemoryStream();
        var emitResult = compilation.Emit(memoryStream);

        if (!emitResult.Success)
        {
            var errors = emitResult.Diagnostics
                .Where(d => d.IsWarningAsError || d.Severity == DiagnosticSeverity.Error)
                .Select(d => d.GetMessage())
                .ToArray();
            
            return ExpressionCompilationResult.Failed(errors);
        }

        // Load compiled assembly
        memoryStream.Seek(0, SeekOrigin.Begin);
        var assembly = Assembly.Load(memoryStream.ToArray());
        var type = assembly.GetType("DynamicExpression.ExpressionWrapper");
        var method = type?.GetMethod("Execute");

        if (method == null)
        {
            return ExpressionCompilationResult.Failed(new[] { "Failed to find execute method in compiled expression" });
        }

        var compiledExpression = new CompiledExpression
        {
            ExpressionId = Guid.NewGuid().ToString(),
            OriginalExpression = expression,
            CompiledCode = sourceCode,
            CompiledAssembly = assembly,
            ExecuteMethod = method,
            Dependencies = ExtractDependencies(syntaxTree),
            Variables = context.Variables.ToDictionary(v => v.Name, v => v.Type),
            CompilationTime = stopwatch.Elapsed,
            CompiledAt = DateTime.UtcNow
        };

        return ExpressionCompilationResult.Success(compiledExpression);
    }

    private string GenerateWrapperClass(string expression, ExpressionContext context)
    {
        var usings = string.Join("\n", _allowedNamespaces.Select(ns => $"using {ns};"));
        
        var parameters = string.Join(", ", context.Variables.Select(v => 
            $"{GetCSharpTypeName(v.Type)} {v.Name}"));

        var returnType = context.ReturnType != null ? GetCSharpTypeName(context.ReturnType) : "object";

        return $@"
{usings}

namespace DynamicExpression
{{
    public static class ExpressionWrapper
    {{
        public static {returnType} Execute({parameters})
        {{
            return {expression};
        }}
    }}
}}";
    }

    private PortableExecutableReference[] GetRequiredReferences(ExpressionContext context)
    {
        var references = new List<PortableExecutableReference>
        {
            MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Math).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(DateTime).Assembly.Location),
            MetadataReference.CreateFromFile(typeof(Enumerable).Assembly.Location),
        };

        // Add banking domain references
        if (context.RequiresBankingDomain)
        {
            references.Add(MetadataReference.CreateFromFile(typeof(BankingExpressionContext).Assembly.Location));
        }

        return references.ToArray();
    }
}
```

#### **Banking Expression Context**
```csharp
// BankingExpressionContext.cs
public class BankingExpressionContext : ExpressionContext
{
    // Banking entities available in expressions
    public CustomerData Customer { get; set; }
    public AccountData Account { get; set; }
    public TransactionData Transaction { get; set; }
    public LoanData Loan { get; set; }
    public Dictionary<string, object> CustomFields { get; set; } = new();
    
    // System context
    public DateTime CurrentDate => DateTime.UtcNow.Date;
    public DateTime CurrentDateTime => DateTime.UtcNow;
    public string TenantId { get; set; }
    public string UserId { get; set; }

    // Banking-specific calculated properties
    public int CustomerAge => Customer != null ? 
        (int)((CurrentDate - Customer.DateOfBirth).TotalDays / 365.25) : 0;
    
    public decimal CustomerMonthlyIncome => Customer?.MonthlyIncome ?? 0;
    public int CustomerCreditScore => Customer?.CreditScore ?? 0;
    public bool CustomerHasDefaultHistory => Customer?.HasDefaultHistory ?? false;
}

// Banking domain data models for expressions
public class CustomerData
{
    public string CustomerId { get; set; }
    public string CustomerNumber { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public DateTime DateOfBirth { get; set; }
    public decimal MonthlyIncome { get; set; }
    public int CreditScore { get; set; }
    public bool HasDefaultHistory { get; set; }
    public bool AddressVerified { get; set; }
    public bool IncomeProofSubmitted { get; set; }
    public bool HasValidID { get; set; }
    public string CustomerType { get; set; }
    public Dictionary<string, object> CustomAttributes { get; set; } = new();
}

public class AccountData
{
    public string AccountId { get; set; }
    public string AccountNumber { get; set; }
    public string AccountType { get; set; }
    public decimal Balance { get; set; }
    public decimal AvailableBalance { get; set; }
    public DateTime OpenedDate { get; set; }
    public string Status { get; set; }
    public string Currency { get; set; }
    public decimal MinimumBalance { get; set; }
}

public class TransactionData
{
    public string TransactionId { get; set; }
    public decimal Amount { get; set; }
    public string TransactionType { get; set; }
    public string FromAccountId { get; set; }
    public string ToAccountId { get; set; }
    public DateTime TransactionDate { get; set; }
    public string Status { get; set; }
    public string Description { get; set; }
    public string Currency { get; set; }
}

public class LoanData
{
    public string LoanId { get; set; }
    public decimal RequestedAmount { get; set; }
    public decimal ApprovedAmount { get; set; }
    public decimal InterestRate { get; set; }
    public int TenureMonths { get; set; }
    public string LoanType { get; set; }
    public string Purpose { get; set; }
    public decimal MonthlyEMI { get; set; }
    public decimal DebtToIncomeRatio { get; set; }
}
```

#### **Banking Expression Functions Library**
```csharp
// BankingExpressionFunctions.cs - Static functions available in expressions
public static class BankingExpressionFunctions
{
    // Date and time functions
    public static bool IsWorkingDay(DateTime date)
    {
        return date.DayOfWeek != DayOfWeek.Saturday && 
               date.DayOfWeek != DayOfWeek.Sunday;
    }

    public static int WorkingDaysBetween(DateTime startDate, DateTime endDate)
    {
        var workingDays = 0;
        var currentDate = startDate.Date;
        
        while (currentDate <= endDate.Date)
        {
            if (IsWorkingDay(currentDate))
                workingDays++;
            currentDate = currentDate.AddDays(1);
        }
        
        return workingDays;
    }

    public static int MonthsBetween(DateTime startDate, DateTime endDate)
    {
        return ((endDate.Year - startDate.Year) * 12) + endDate.Month - startDate.Month;
    }

    // Financial calculation functions
    public static decimal CalculateSimpleInterest(decimal principal, decimal rate, int days)
    {
        return (principal * rate * days) / (100 * 365);
    }

    public static decimal CalculateCompoundInterest(decimal principal, decimal rate, int compoundsPerYear, int years)
    {
        return principal * (decimal)Math.Pow((double)(1 + rate / (100 * compoundsPerYear)), compoundsPerYear * years) - principal;
    }

    public static decimal CalculateEMI(decimal principal, decimal ratePerMonth, int months)
    {
        if (ratePerMonth == 0) return principal / months;
        
        var r = ratePerMonth / 100;
        return principal * r * (decimal)Math.Pow((double)(1 + r), months) / 
               ((decimal)Math.Pow((double)(1 + r), months) - 1);
    }

    public static decimal CalculatePMT(decimal rate, int periods, decimal presentValue, decimal futureValue = 0)
    {
        if (rate == 0) return -(presentValue + futureValue) / periods;
        
        var pvif = (decimal)Math.Pow((double)(1 + rate), periods);
        return -(presentValue * pvif + futureValue) * rate / (pvif - 1);
    }

    // Validation functions
    public static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsValidPhoneNumber(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return false;
        
        // Remove all non-digit characters
        var digitsOnly = System.Text.RegularExpressions.Regex.Replace(phone, @"[^\d]", "");
        
        // Check if it's a valid length (10-15 digits)
        return digitsOnly.Length >= 10 && digitsOnly.Length <= 15;
    }

    public static bool IsValidAccountNumber(string accountNumber)
    {
        if (string.IsNullOrWhiteSpace(accountNumber)) return false;
        
        // Basic account number validation (customize based on bank's format)
        return accountNumber.Length >= 8 && accountNumber.Length <= 20 && 
               accountNumber.All(char.IsDigit);
    }

    // Banking business logic functions
    public static string DetermineCreditRating(int creditScore)
    {
        return creditScore switch
        {
            >= 800 => "Excellent",
            >= 740 => "Very Good",
            >= 670 => "Good",
            >= 580 => "Fair",
            _ => "Poor"
        };
    }

    public static bool IsEligibleForLoan(int creditScore, decimal debtToIncomeRatio, decimal monthlyIncome)
    {
        return creditScore >= 650 && 
               debtToIncomeRatio <= 0.4m && 
               monthlyIncome >= 30000;
    }

    public static decimal CalculateRiskPremium(int creditScore, string loanType, decimal amount)
    {
        var basePremium = creditScore switch
        {
            >= 750 => 0.0m,
            >= 700 => 0.5m,
            >= 650 => 1.0m,
            >= 600 => 1.5m,
            _ => 2.5m
        };

        // Adjust for loan type
        var typeMultiplier = loanType.ToLower() switch
        {
            "home" => 1.0m,
            "auto" => 1.2m,
            "personal" => 1.5m,
            "business" => 1.8m,
            _ => 2.0m
        };

        // Adjust for amount
        var amountMultiplier = amount > 1000000 ? 1.2m : 1.0m;

        return basePremium * typeMultiplier * amountMultiplier;
    }

    // Currency and formatting functions
    public static decimal ConvertCurrency(decimal amount, string fromCurrency, string toCurrency)
    {
        // In a real implementation, this would call an exchange rate service
        // For now, return the amount (assuming same currency or 1:1 rate)
        if (fromCurrency == toCurrency) return amount;
        
        // Placeholder exchange rates
        var exchangeRates = new Dictionary<string, decimal>
        {
            { "USD_INR", 83.0m },
            { "EUR_INR", 91.0m },
            { "GBP_INR", 105.0m },
            { "INR_USD", 0.012m },
            { "INR_EUR", 0.011m },
            { "INR_GBP", 0.0095m }
        };

        var rateKey = $"{fromCurrency}_{toCurrency}";
        if (exchangeRates.TryGetValue(rateKey, out var rate))
        {
            return amount * rate;
        }

        return amount; // Default: no conversion
    }

    public static string FormatCurrency(decimal amount, string currencyCode = "INR")
    {
        var culture = currencyCode switch
        {
            "USD" => new System.Globalization.CultureInfo("en-US"),
            "EUR" => new System.Globalization.CultureInfo("de-DE"),
            "GBP" => new System.Globalization.CultureInfo("en-GB"),
            _ => new System.Globalization.CultureInfo("en-IN")
        };

        return amount.ToString("C", culture);
    }
}
```

### **1.2 Database Schema for Expression Management**

```sql
-- Expression definitions and metadata
CREATE TABLE ExpressionDefinitions (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    ExpressionId VARCHAR(200) NOT NULL,
    Name VARCHAR(500) NOT NULL,
    Description TEXT,
    
    -- Categorization
    Category VARCHAR(100) NOT NULL, -- 'Validation', 'Calculation', 'Eligibility', 'Fee', 'Risk'
    SubCategory VARCHAR(100),
    Tags JSONB DEFAULT '[]',
    
    -- Expression content
    ExpressionText TEXT NOT NULL,
    ReturnType VARCHAR(100) NOT NULL, -- 'Boolean', 'Decimal', 'String', 'Integer'
    ContextType VARCHAR(100) NOT NULL, -- 'Customer', 'Account', 'Transaction', 'Loan', 'General'
    
    -- Compiled information
    CompiledCode TEXT,
    Dependencies JSONB DEFAULT '[]',
    Variables JSONB DEFAULT '{}',
    Functions JSONB DEFAULT '[]',
    
    -- Usage and integration
    UsageType VARCHAR(100) NOT NULL, -- 'FormValidation', 'WorkflowRule', 'CalculationRule', 'EligibilityCheck'
    IntegrationPoints JSONB DEFAULT '[]',
    
    -- Status and versioning
    Version VARCHAR(50) NOT NULL DEFAULT '1.0',
    Status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Testing', 'Active', 'Deprecated'
    IsGlobal BOOLEAN NOT NULL DEFAULT false,
    IsTemplate BOOLEAN NOT NULL DEFAULT false,
    
    -- Performance and monitoring
    AverageExecutionTimeMs INTEGER DEFAULT 0,
    TotalExecutions BIGINT DEFAULT 0,
    SuccessfulExecutions BIGINT DEFAULT 0,
    LastExecutionAt TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    CreatedBy UUID NOT NULL,
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UpdatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    LastCompiledAt TIMESTAMP WITH TIME ZONE,
    ApprovedBy UUID,
    ApprovedAt TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT FK_ExpressionDefinitions_TenantId FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT UQ_ExpressionDefinitions_TenantExpression UNIQUE (TenantId, ExpressionId, Version)
);

-- Expression execution logs for monitoring and debugging
CREATE TABLE ExpressionExecutionLogs (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ExpressionDefinitionId UUID NOT NULL,
    TenantId UUID NOT NULL,
    UserId UUID,
    
    -- Execution context
    ExecutionContext VARCHAR(500) NOT NULL, -- Where was it executed (FormValidation, WorkflowStep, etc.)
    ContextEntityId UUID, -- ID of the entity being processed (CustomerId, AccountId, etc.)
    
    -- Input and output
    InputVariables JSONB NOT NULL,
    ExecutionResult JSONB NOT NULL,
    ResultType VARCHAR(100) NOT NULL,
    
    -- Performance metrics
    ExecutionStartTime TIMESTAMP WITH TIME ZONE NOT NULL,
    ExecutionEndTime TIMESTAMP WITH TIME ZONE NOT NULL,
    ExecutionTimeMs INTEGER NOT NULL,
    MemoryUsedKB INTEGER DEFAULT 0,
    
    -- Execution status
    Success BOOLEAN NOT NULL,
    ErrorMessage TEXT,
    StackTrace TEXT,
    
    -- Metadata
    ExecutedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UserAgent VARCHAR(500),
    IPAddress INET,
    
    CONSTRAINT FK_ExpressionExecutionLogs_ExpressionDefinition 
        FOREIGN KEY (ExpressionDefinitionId) REFERENCES ExpressionDefinitions(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ExpressionExecutionLogs_TenantId 
        FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

-- Expression templates for common banking scenarios
CREATE TABLE ExpressionTemplates (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    TemplateId VARCHAR(200) NOT NULL UNIQUE,
    Name VARCHAR(500) NOT NULL,
    Description TEXT NOT NULL,
    Category VARCHAR(100) NOT NULL,
    
    -- Template content
    ExpressionTemplate TEXT NOT NULL, -- Template with placeholders like {MinAge}, {MaxAmount}
    TemplateVariables JSONB NOT NULL, -- Definition of template variables
    SampleExpression TEXT NOT NULL, -- Example with filled placeholders
    
    -- Usage information
    ContextType VARCHAR(100) NOT NULL,
    ReturnType VARCHAR(100) NOT NULL,
    UsageInstructions TEXT,
    
    -- Template metadata
    IsBuiltIn BOOLEAN NOT NULL DEFAULT true,
    SortOrder INTEGER DEFAULT 0,
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UpdatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample expression templates data
INSERT INTO ExpressionTemplates (TemplateId, Name, Description, Category, ExpressionTemplate, TemplateVariables, SampleExpression, ContextType, ReturnType) VALUES
('customer-age-validation', 'Customer Age Validation', 'Validate customer age against minimum and maximum limits', 'Validation', 'CustomerAge >= {MinAge} && CustomerAge <= {MaxAge}', '{"MinAge": {"type": "int", "default": 18}, "MaxAge": {"type": "int", "default": 70}}', 'CustomerAge >= 18 && CustomerAge <= 70', 'Customer', 'Boolean'),

('loan-eligibility-basic', 'Basic Loan Eligibility', 'Check basic loan eligibility criteria', 'Eligibility', 'CustomerCreditScore >= {MinCreditScore} && CustomerMonthlyIncome >= {MinIncome} && !CustomerHasDefaultHistory', '{"MinCreditScore": {"type": "int", "default": 650}, "MinIncome": {"type": "decimal", "default": 30000}}', 'CustomerCreditScore >= 650 && CustomerMonthlyIncome >= 30000 && !CustomerHasDefaultHistory', 'Customer', 'Boolean'),

('transaction-fee-calculation', 'Transaction Fee Calculation', 'Calculate transaction fees based on amount tiers', 'Calculation', 'Transaction.Amount <= {Tier1Limit} ? 0 : (Transaction.Amount <= {Tier2Limit} ? {Tier2Fee} : Transaction.Amount * {HighTierRate})', '{"Tier1Limit": {"type": "decimal", "default": 1000}, "Tier2Limit": {"type": "decimal", "default": 10000}, "Tier2Fee": {"type": "decimal", "default": 5}, "HighTierRate": {"type": "decimal", "default": 0.001}}', 'Transaction.Amount <= 1000 ? 0 : (Transaction.Amount <= 10000 ? 5 : Transaction.Amount * 0.001m)', 'Transaction', 'Decimal'),

('interest-rate-calculation', 'Dynamic Interest Rate', 'Calculate interest rate based on credit score and loan type', 'Calculation', '{BaseRate} + CalculateRiskPremium(CustomerCreditScore, Loan.LoanType, Loan.RequestedAmount)', '{"BaseRate": {"type": "decimal", "default": 8.5}}', '8.5m + CalculateRiskPremium(CustomerCreditScore, Loan.LoanType, Loan.RequestedAmount)', 'Loan', 'Decimal');

-- Indexes for performance
CREATE INDEX IX_ExpressionDefinitions_TenantId_Category ON ExpressionDefinitions(TenantId, Category);
CREATE INDEX IX_ExpressionDefinitions_Status_UsageType ON ExpressionDefinitions(Status, UsageType);
CREATE INDEX IX_ExpressionExecutionLogs_TenantId_ExecutedAt ON ExpressionExecutionLogs(TenantId, ExecutedAt DESC);
CREATE INDEX IX_ExpressionExecutionLogs_ExpressionDefinitionId_ExecutedAt ON ExpressionExecutionLogs(ExpressionDefinitionId, ExecutedAt DESC);
```

---

## 🏗️ **2. Multi-Tenancy Framework Specification**

### **1.1 Database Schema Design**

#### **Core Tenant Tables**
```sql
-- Master tenant registry
CREATE TABLE Tenants (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    TenantName VARCHAR(200) NOT NULL UNIQUE,
    Subdomain VARCHAR(100) NOT NULL UNIQUE,
    DatabaseSchema VARCHAR(100) NOT NULL,
    Status VARCHAR(50) NOT NULL DEFAULT 'Active',
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UpdatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Business Information
    ContactEmail VARCHAR(255) NOT NULL,
    ContactPhone VARCHAR(50),
    Address JSONB,
    
    -- Technical Configuration
    Configuration JSONB NOT NULL DEFAULT '{}',
    FeatureFlags JSONB NOT NULL DEFAULT '{}',
    ResourceQuotas JSONB NOT NULL DEFAULT '{}'
);

-- Tenant-aware base for all business tables
CREATE TABLE Customers (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    CustomerNumber VARCHAR(50) NOT NULL,
    FirstName VARCHAR(100) NOT NULL,
    LastName VARCHAR(100) NOT NULL,
    Email VARCHAR(255),
    Phone VARCHAR(50),
    Address JSONB,
    KYCStatus VARCHAR(50) NOT NULL DEFAULT 'Pending',
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UpdatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT FK_Customers_TenantId FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT UQ_Customers_TenantCustomer UNIQUE (TenantId, CustomerNumber)
);

-- Row Level Security Policies
ALTER TABLE Customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON Customers
    USING (TenantId = current_setting('app.current_tenant_id')::UUID);
```

#### **Tenant Configuration Schema**
```sql
-- Tenant-specific configurations
CREATE TABLE TenantConfigurations (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    ConfigurationKey VARCHAR(200) NOT NULL,
    ConfigurationValue JSONB NOT NULL,
    ConfigurationType VARCHAR(100) NOT NULL, -- 'Feature', 'Branding', 'Business', 'Integration'
    IsActive BOOLEAN NOT NULL DEFAULT true,
    ValidFrom TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ValidTo TIMESTAMP WITH TIME ZONE,
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT FK_TenantConfigurations_TenantId FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT UQ_TenantConfigurations_Key UNIQUE (TenantId, ConfigurationKey)
);

-- Sample Configuration Data Structure
INSERT INTO TenantConfigurations (TenantId, ConfigurationKey, ConfigurationValue, ConfigurationType) VALUES 
('tenant-uuid', 'branding.primaryColor', '"#1976d2"', 'Branding'),
('tenant-uuid', 'branding.logo', '"https://cdn.tenant.com/logo.png"', 'Branding'),
('tenant-uuid', 'features.aiAssistant', 'true', 'Feature'),
('tenant-uuid', 'business.maxLoanAmount', '1000000', 'Business'),
('tenant-uuid', 'integration.paymentGateway', '{"provider": "stripe", "apiKey": "encrypted"}', 'Integration');
```

### **1.2 .NET Core Implementation**

#### **Tenant Context Service**
```csharp
// ITenantContext.cs
public interface ITenantContext
{
    Guid? TenantId { get; }
    string TenantName { get; }
    string Subdomain { get; }
    TenantConfiguration Configuration { get; }
    bool IsMultiTenant { get; }
}

public class TenantConfiguration
{
    public Dictionary<string, object> Features { get; set; } = new();
    public Dictionary<string, object> Branding { get; set; } = new();
    public Dictionary<string, object> Business { get; set; } = new();
    public Dictionary<string, object> Integration { get; set; } = new();
}

// TenantContext.cs
public class TenantContext : ITenantContext
{
    public Guid? TenantId { get; private set; }
    public string TenantName { get; private set; } = string.Empty;
    public string Subdomain { get; private set; } = string.Empty;
    public TenantConfiguration Configuration { get; private set; } = new();
    public bool IsMultiTenant => TenantId.HasValue;

    public void SetTenant(Guid tenantId, string tenantName, string subdomain, TenantConfiguration configuration)
    {
        TenantId = tenantId;
        TenantName = tenantName;
        Subdomain = subdomain;
        Configuration = configuration;
    }
}
```

#### **Tenant Resolution Middleware**
```csharp
// TenantResolutionMiddleware.cs
public class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ITenantService _tenantService;

    public TenantResolutionMiddleware(RequestDelegate next, ITenantService tenantService)
    {
        _next = next;
        _tenantService = tenantService;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var tenantIdentifier = ExtractTenantIdentifier(context.Request);
        
        if (!string.IsNullOrEmpty(tenantIdentifier))
        {
            var tenant = await _tenantService.GetTenantAsync(tenantIdentifier);
            if (tenant != null)
            {
                var tenantContext = context.RequestServices.GetRequiredService<ITenantContext>();
                ((TenantContext)tenantContext).SetTenant(
                    tenant.Id, 
                    tenant.TenantName, 
                    tenant.Subdomain, 
                    tenant.Configuration
                );

                // Set database context for Row Level Security
                context.Items["TenantId"] = tenant.Id.ToString();
            }
        }

        await _next(context);
    }

    private string ExtractTenantIdentifier(HttpRequest request)
    {
        // Priority order: Header > Subdomain > Query Parameter
        
        // 1. Check custom header
        if (request.Headers.ContainsKey("X-Tenant-Id"))
        {
            return request.Headers["X-Tenant-Id"];
        }
        
        // 2. Extract from subdomain
        var host = request.Host.Host;
        if (host.Contains('.') && !host.StartsWith("www"))
        {
            return host.Split('.')[0]; // Extract subdomain
        }
        
        // 3. Check query parameter
        if (request.Query.ContainsKey("tenant"))
        {
            return request.Query["tenant"];
        }
        
        return string.Empty;
    }
}
```

#### **Tenant-Aware Repository Pattern**
```csharp
// ITenantRepository.cs
public interface ITenantRepository<T> where T : class, ITenantEntity
{
    Task<IEnumerable<T>> GetAllAsync();
    Task<T?> GetByIdAsync(Guid id);
    Task<T> CreateAsync(T entity);
    Task<T> UpdateAsync(T entity);
    Task DeleteAsync(Guid id);
    Task<int> CountAsync();
}

// Base entity interface
public interface ITenantEntity
{
    Guid Id { get; set; }
    Guid TenantId { get; set; }
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}

// TenantRepository.cs
public class TenantRepository<T> : ITenantRepository<T> where T : class, ITenantEntity
{
    private readonly BankingDbContext _context;
    private readonly ITenantContext _tenantContext;
    private readonly DbSet<T> _dbSet;

    public TenantRepository(BankingDbContext context, ITenantContext tenantContext)
    {
        _context = context;
        _tenantContext = tenantContext;
        _dbSet = context.Set<T>();
    }

    public async Task<IEnumerable<T>> GetAllAsync()
    {
        EnsureTenantContext();
        return await _dbSet
            .Where(e => e.TenantId == _tenantContext.TenantId)
            .ToListAsync();
    }

    public async Task<T?> GetByIdAsync(Guid id)
    {
        EnsureTenantContext();
        return await _dbSet
            .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == _tenantContext.TenantId);
    }

    public async Task<T> CreateAsync(T entity)
    {
        EnsureTenantContext();
        entity.TenantId = _tenantContext.TenantId!.Value;
        entity.CreatedAt = DateTime.UtcNow;
        entity.UpdatedAt = DateTime.UtcNow;
        
        _dbSet.Add(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    private void EnsureTenantContext()
    {
        if (!_tenantContext.IsMultiTenant)
            throw new InvalidOperationException("Tenant context is not available");
    }
}
```

### **1.3 React Frontend Implementation**

#### **Tenant Context Provider**
```typescript
// contexts/TenantContext.tsx
interface TenantConfiguration {
  features: Record<string, any>;
  branding: Record<string, any>;
  business: Record<string, any>;
  integration: Record<string, any>;
}

interface TenantContextType {
  tenantId: string | null;
  tenantName: string;
  subdomain: string;
  configuration: TenantConfiguration;
  isMultiTenant: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshConfiguration: () => Promise<void>;
}

const TenantContext = React.createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantContextType>({
    tenantId: null,
    tenantName: '',
    subdomain: '',
    configuration: {
      features: {},
      branding: {},
      business: {},
      integration: {}
    },
    isMultiTenant: false,
    switchTenant: async () => {},
    refreshConfiguration: async () => {}
  });

  useEffect(() => {
    initializeTenant();
  }, []);

  const initializeTenant = async () => {
    try {
      // Extract tenant from URL, localStorage, or API
      const tenantIdentifier = extractTenantFromUrl() || localStorage.getItem('currentTenant');
      
      if (tenantIdentifier) {
        const response = await apiService.get(`/api/tenants/${tenantIdentifier}`);
        setTenant(prev => ({
          ...prev,
          tenantId: response.data.id,
          tenantName: response.data.tenantName,
          subdomain: response.data.subdomain,
          configuration: response.data.configuration,
          isMultiTenant: true
        }));
      }
    } catch (error) {
      console.error('Failed to initialize tenant:', error);
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      const response = await apiService.get(`/api/tenants/${tenantId}`);
      setTenant(prev => ({
        ...prev,
        tenantId: response.data.id,
        tenantName: response.data.tenantName,
        subdomain: response.data.subdomain,
        configuration: response.data.configuration
      }));
      
      localStorage.setItem('currentTenant', tenantId);
      
      // Update API service headers
      apiService.defaults.headers.common['X-Tenant-Id'] = tenantId;
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      throw error;
    }
  };

  return (
    <TenantContext.Provider value={{ ...tenant, switchTenant, refreshConfiguration: initializeTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
```

#### **Tenant-Aware Theme Provider**
```typescript
// theme/TenantThemeProvider.tsx
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useTenant } from '../contexts/TenantContext';

export const TenantThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { configuration, isMultiTenant } = useTenant();

  const theme = useMemo(() => {
    const baseTheme = {
      palette: {
        primary: {
          main: '#1976d2',
        },
        secondary: {
          main: '#dc004e',
        },
      },
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      },
    };

    if (isMultiTenant && configuration.branding) {
      // Apply tenant-specific branding
      return createTheme({
        ...baseTheme,
        palette: {
          ...baseTheme.palette,
          primary: {
            main: configuration.branding.primaryColor || baseTheme.palette.primary.main,
          },
          secondary: {
            main: configuration.branding.secondaryColor || baseTheme.palette.secondary.main,
          },
        },
        typography: {
          ...baseTheme.typography,
          fontFamily: configuration.branding.fontFamily || baseTheme.typography.fontFamily,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: configuration.branding.borderRadius || 4,
              },
            },
          },
        },
      });
    }

    return createTheme(baseTheme);
  }, [configuration, isMultiTenant]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
```

---

## 📝 **2. Dynamic Forms Framework Specification**

### **2.1 Form Schema Structure**

#### **JSON Schema Definition**
```typescript
// types/FormSchema.ts
interface FormSchema {
  formId: string;
  tenantId: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated';
  
  metadata: {
    category: 'customer' | 'account' | 'loan' | 'transaction' | 'compliance';
    tags: string[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  
  sections: FormSection[];
  validation: FormValidation;
  workflow: FormWorkflow;
  styling: FormStyling;
}

interface FormSection {
  sectionId: string;
  title: string;
  description?: string;
  order: number;
  collapsible: boolean;
  
  fields: FormField[];
  conditions: ConditionalLogic[];
  layout: SectionLayout;
}

interface FormField {
  fieldId: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  readonly: boolean;
  order: number;
  
  // Field-specific configuration
  config: FieldConfiguration;
  validation: FieldValidation;
  dependencies: FieldDependency[];
}

type FormFieldType = 
  | 'text' | 'email' | 'phone' | 'number' | 'currency'
  | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'textarea' | 'richtext'
  | 'file' | 'image' | 'signature'
  | 'account-selector' | 'customer-selector' | 'branch-selector'
  | 'kyc-document' | 'address' | 'bank-details';
```

#### **Banking-Specific Field Configurations**
```typescript
// Banking field configurations
interface BankingFieldConfigs {
  'account-selector': {
    accountTypes: AccountType[];
    showBalance: boolean;
    multiSelect: boolean;
  };
  
  'customer-selector': {
    searchBy: ('name' | 'id' | 'phone' | 'email')[];
    showKYCStatus: boolean;
    customerTypes: CustomerType[];
  };
  
  'kyc-document': {
    documentTypes: KYCDocumentType[];
    maxFileSize: number;
    acceptedFormats: string[];
    ocrEnabled: boolean;
  };
  
  'currency': {
    currencyCode: string;
    minValue?: number;
    maxValue?: number;
    decimalPlaces: number;
  };
  
  'address': {
    includeCountry: boolean;
    requiredFields: ('line1' | 'line2' | 'city' | 'state' | 'postalCode')[];
    validatePostalCode: boolean;
  };
}
```

### **2.2 React Dynamic Form Implementation**

#### **Dynamic Form Renderer**
```typescript
// components/forms/DynamicFormRenderer.tsx
interface DynamicFormRendererProps {
  schema: FormSchema;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  onFieldChange?: (fieldName: string, value: any) => void;
  mode: 'create' | 'edit' | 'view';
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  schema,
  initialData = {},
  onSubmit,
  onFieldChange,
  mode = 'create'
}) => {
  const { configuration } = useTenant();
  
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: initialData,
    resolver: yupResolver(generateValidationSchema(schema))
  });

  const watchedValues = watch();

  // Handle conditional field visibility
  const isFieldVisible = useCallback((field: FormField) => {
    return evaluateConditionalLogic(field.dependencies, watchedValues);
  }, [watchedValues]);

  const renderField = (field: FormField) => {
    if (!isFieldVisible(field)) return null;

    const FieldComponent = getFieldComponent(field.type);
    
    return (
      <Controller
        key={field.fieldId}
        name={field.name}
        control={control}
        render={({ field: formField, fieldState }) => (
          <FieldComponent
            {...formField}
            field={field}
            error={fieldState.error}
            disabled={mode === 'view' || field.readonly}
            tenantConfig={configuration}
            onChange={(value) => {
              formField.onChange(value);
              onFieldChange?.(field.name, value);
            }}
          />
        )}
      />
    );
  };

  const renderSection = (section: FormSection) => (
    <Card key={section.sectionId} sx={{ mb: 2 }}>
      <CardHeader 
        title={section.title} 
        subtitle={section.description}
        collapsible={section.collapsible}
      />
      <CardContent>
        <Grid container spacing={2}>
          {section.fields
            .sort((a, b) => a.order - b.order)
            .map(field => (
              <Grid item xs={field.config.gridSize || 12} key={field.fieldId}>
                {renderField(field)}
              </Grid>
            ))}
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      {schema.sections
        .sort((a, b) => a.order - b.order)
        .map(renderSection)}
      
      {mode !== 'view' && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button type="button" variant="outlined">
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      )}
    </Box>
  );
};
```

#### **Banking-Specific Field Components**
```typescript
// components/forms/fields/BankingFields.tsx

// Account Selector Field
export const AccountSelectorField: React.FC<BankingFieldProps> = ({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  tenantConfig 
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await apiService.get('/api/accounts', {
        params: { 
          types: field.config.accountTypes,
          includeBalance: field.config.showBalance 
        }
      });
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel>{field.label}</InputLabel>
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        multiple={field.config.multiSelect}
        loading={loading}
      >
        {accounts.map((account) => (
          <MenuItem key={account.id} value={account.id}>
            <Box>
              <Typography variant="body1">
                {account.accountNumber} - {account.customerName}
              </Typography>
              {field.config.showBalance && (
                <Typography variant="caption" color="textSecondary">
                  Balance: {formatCurrency(account.balance, account.currency)}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error.message}</FormHelperText>}
    </FormControl>
  );
};

// KYC Document Upload Field
export const KYCDocumentField: React.FC<BankingFieldProps> = ({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled 
}) => {
  const [uploading, setUploading] = useState(false);
  const [ocrResults, setOcrResults] = useState<any>(null);

  const handleFileUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', field.config.documentType);
        formData.append('enableOCR', field.config.ocrEnabled.toString());

        const response = await apiService.post('/api/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        return {
          fileId: response.data.fileId,
          fileName: file.name,
          documentType: field.config.documentType,
          ocrData: response.data.ocrData
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      const newValue = field.config.multiple ? [...(value || []), ...uploadedFiles] : uploadedFiles[0];
      
      onChange(newValue);
      
      if (field.config.ocrEnabled && uploadedFiles[0]?.ocrData) {
        setOcrResults(uploadedFiles[0].ocrData);
      }
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <FormLabel component="legend">{field.label}</FormLabel>
      <FileUpload
        accept={field.config.acceptedFormats.join(',')}
        maxFileSize={field.config.maxFileSize}
        multiple={field.config.multiple}
        onUpload={handleFileUpload}
        disabled={disabled || uploading}
        loading={uploading}
      />
      
      {/* Display uploaded files */}
      {value && (
        <Box sx={{ mt: 2 }}>
          {(Array.isArray(value) ? value : [value]).map((file, index) => (
            <Chip
              key={index}
              label={file.fileName}
              onDelete={disabled ? undefined : () => {
                const newValue = Array.isArray(value) 
                  ? value.filter((_, i) => i !== index)
                  : null;
                onChange(newValue);
              }}
              sx={{ mr: 1, mb: 1 }}
            />
          ))}
        </Box>
      )}

      {/* Display OCR results */}
      {ocrResults && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom>
            Extracted Information:
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(ocrResults).map(([key, value]) => (
              <Grid item xs={6} key={key}>
                <Typography variant="caption" color="textSecondary">
                  {key}:
                </Typography>
                <Typography variant="body2">
                  {value as string}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {error && (
        <FormHelperText error>{error.message}</FormHelperText>
      )}
    </Box>
  );
};

// Currency Field with Banking Formatting
export const CurrencyField: React.FC<BankingFieldProps> = ({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled,
  tenantConfig 
}) => {
  const currencyCode = field.config.currencyCode || tenantConfig.business.defaultCurrency || 'USD';
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/[^\d.]/g, '');
    const numericValue = parseFloat(rawValue);
    
    if (!isNaN(numericValue)) {
      // Validate against min/max values
      if (field.config.minValue && numericValue < field.config.minValue) {
        return;
      }
      if (field.config.maxValue && numericValue > field.config.maxValue) {
        return;
      }
      
      onChange(numericValue);
    } else {
      onChange(null);
    }
  };

  return (
    <TextField
      fullWidth
      label={field.label}
      value={value ? formatCurrency(value, currencyCode) : ''}
      onChange={handleChange}
      disabled={disabled}
      error={!!error}
      helperText={error?.message}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            {getCurrencySymbol(currencyCode)}
          </InputAdornment>
        ),
      }}
      inputProps={{
        inputMode: 'decimal',
        pattern: '[0-9]+(\\.[0-9]+)?',
      }}
    />
  );
};
```

### **2.3 Form Schema API**

#### **Form Schema Management API**
```csharp
// Controllers/FormSchemaController.cs
[ApiController]
[Route("api/[controller]")]
public class FormSchemaController : ControllerBase
{
    private readonly IFormSchemaService _formSchemaService;
    private readonly ITenantContext _tenantContext;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FormSchemaDto>>> GetSchemas(
        [FromQuery] string? category = null,
        [FromQuery] string? status = null)
    {
        var schemas = await _formSchemaService.GetSchemasAsync(
            _tenantContext.TenantId!.Value, 
            category, 
            status);
        return Ok(schemas);
    }

    [HttpGet("{formId}")]
    public async Task<ActionResult<FormSchemaDto>> GetSchema(string formId)
    {
        var schema = await _formSchemaService.GetSchemaAsync(formId, _tenantContext.TenantId!.Value);
        if (schema == null)
            return NotFound();
        
        return Ok(schema);
    }

    [HttpPost]
    public async Task<ActionResult<FormSchemaDto>> CreateSchema([FromBody] CreateFormSchemaDto dto)
    {
        var schema = await _formSchemaService.CreateSchemaAsync(dto, _tenantContext.TenantId!.Value);
        return CreatedAtAction(nameof(GetSchema), new { formId = schema.FormId }, schema);
    }

    [HttpPut("{formId}")]
    public async Task<ActionResult<FormSchemaDto>> UpdateSchema(string formId, [FromBody] UpdateFormSchemaDto dto)
    {
        var schema = await _formSchemaService.UpdateSchemaAsync(formId, dto, _tenantContext.TenantId!.Value);
        if (schema == null)
            return NotFound();
        
        return Ok(schema);
    }

    [HttpPost("{formId}/validate")]
    public async Task<ActionResult<FormValidationResult>> ValidateFormData(
        string formId, 
        [FromBody] Dictionary<string, object> formData)
    {
        var result = await _formSchemaService.ValidateFormDataAsync(formId, formData, _tenantContext.TenantId!.Value);
        return Ok(result);
    }
}
```

---

## 🔌 **3. Plugin Framework Specification**

### **3.1 Plugin Architecture**

#### **Plugin Contract Interfaces**
```csharp
// Core plugin interface
public interface IPlugin
{
    string PluginId { get; }
    string Name { get; }
    string Version { get; }
    string Description { get; }
    string[] Dependencies { get; }
    PluginMetadata Metadata { get; }
    
    Task<bool> InitializeAsync(PluginContext context);
    Task<bool> CanExecuteAsync(PluginContext context);
    Task<PluginExecutionResult> ExecuteAsync(PluginContext context);
    Task ShutdownAsync();
}

// Banking-specific plugin interfaces
public interface IBankingBusinessRulePlugin : IPlugin
{
    Task<ValidationResult> ValidateTransactionAsync(TransactionValidationContext context);
    Task<decimal> CalculateInterestAsync(InterestCalculationContext context);
    Task<ApprovalResult> ProcessApprovalAsync(ApprovalContext context);
}

public interface IBankingIntegrationPlugin : IPlugin
{
    Task<PaymentResult> ProcessPaymentAsync(PaymentContext context);
    Task<KYCResult> VerifyKYCAsync(KYCContext context);
    Task<CreditScoreResult> GetCreditScoreAsync(CreditScoreContext context);
}

public interface IBankingReportPlugin : IPlugin
{
    Task<ReportResult> GenerateReportAsync(ReportContext context);
    Task<byte[]> ExportReportAsync(ReportExportContext context);
}
```

#### **Plugin Context and Execution**
```csharp
public class PluginContext
{
    public Guid TenantId { get; set; }
    public string UserId { get; set; }
    public Dictionary<string, object> Parameters { get; set; } = new();
    public IServiceProvider ServiceProvider { get; set; }
    public CancellationToken CancellationToken { get; set; }
}

public class PluginExecutionResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Dictionary<string, object> Data { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public TimeSpan ExecutionTime { get; set; }
}
```

### **3.2 Plugin Registry and Management**

#### **Plugin Registry Database Schema**
```sql
-- Plugin registry table
CREATE TABLE PluginRegistry (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    PluginId VARCHAR(200) NOT NULL,
    TenantId UUID,  -- NULL for global plugins
    Name VARCHAR(500) NOT NULL,
    Description TEXT,
    Version VARCHAR(100) NOT NULL,
    Author VARCHAR(200),
    
    -- Plugin metadata
    PluginType VARCHAR(100) NOT NULL, -- 'BusinessRule', 'Integration', 'Report', 'UI'
    Category VARCHAR(100) NOT NULL,   -- 'Transaction', 'Customer', 'Loan', 'Compliance'
    Tags JSONB DEFAULT '[]',
    
    -- Assembly information
    AssemblyPath VARCHAR(1000) NOT NULL,
    EntryPoint VARCHAR(500) NOT NULL,
    Dependencies JSONB DEFAULT '[]',
    
    -- Configuration
    Configuration JSONB DEFAULT '{}',
    DefaultParameters JSONB DEFAULT '{}',
    
    -- Status and lifecycle
    Status VARCHAR(50) NOT NULL DEFAULT 'Inactive', -- 'Active', 'Inactive', 'Error'
    IsGlobal BOOLEAN NOT NULL DEFAULT false,
    RequiresApproval BOOLEAN NOT NULL DEFAULT true,
    
    -- Security
    CodeSignature TEXT,
    TrustedPublisher BOOLEAN NOT NULL DEFAULT false,
    SecurityLevel VARCHAR(50) NOT NULL DEFAULT 'Restricted', -- 'Restricted', 'Standard', 'Elevated'
    
    -- Lifecycle timestamps
    InstalledAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    LastActivated TIMESTAMP WITH TIME ZONE,
    LastExecuted TIMESTAMP WITH TIME ZONE,
    CreatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UpdatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT FK_PluginRegistry_TenantId FOREIGN KEY (TenantId) REFERENCES Tenants(Id),
    CONSTRAINT UQ_PluginRegistry_TenantPlugin UNIQUE (TenantId, PluginId, Version)
);

-- Plugin execution history
CREATE TABLE PluginExecutionHistory (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    PluginRegistryId UUID NOT NULL,
    TenantId UUID NOT NULL,
    UserId UUID NOT NULL,
    
    ExecutionContext JSONB NOT NULL,
    InputParameters JSONB NOT NULL,
    OutputResult JSONB NOT NULL,
    
    ExecutionTimeMs INTEGER NOT NULL,
    Success BOOLEAN NOT NULL,
    ErrorMessage TEXT,
    
    ExecutedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT FK_PluginExecutionHistory_PluginRegistry FOREIGN KEY (PluginRegistryId) REFERENCES PluginRegistry(Id),
    CONSTRAINT FK_PluginExecutionHistory_TenantId FOREIGN KEY (TenantId) REFERENCES Tenants(Id)
);

-- Plugin permissions
CREATE TABLE PluginPermissions (
    Id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    PluginRegistryId UUID NOT NULL,
    Permission VARCHAR(200) NOT NULL,
    ResourceType VARCHAR(100) NOT NULL, -- 'Customer', 'Account', 'Transaction', 'Report'
    AccessLevel VARCHAR(50) NOT NULL,   -- 'Read', 'Write', 'Delete', 'Execute'
    
    CONSTRAINT FK_PluginPermissions_PluginRegistry FOREIGN KEY (PluginRegistryId) REFERENCES PluginRegistry(Id),
    CONSTRAINT UQ_PluginPermissions UNIQUE (PluginRegistryId, Permission, ResourceType)
);
```

#### **Plugin Loader Service**
```csharp
// Services/PluginLoaderService.cs
public interface IPluginLoaderService
{
    Task<IPlugin?> LoadPluginAsync(Guid pluginRegistryId);
    Task<IEnumerable<IPlugin>> LoadPluginsAsync(Guid tenantId, string category = null);
    Task<bool> UnloadPluginAsync(Guid pluginRegistryId);
    Task<PluginExecutionResult> ExecutePluginAsync(Guid pluginRegistryId, PluginContext context);
}

public class PluginLoaderService : IPluginLoaderService
{
    private readonly IPluginRegistryRepository _pluginRegistry;
    private readonly ILogger<PluginLoaderService> _logger;
    private readonly ConcurrentDictionary<Guid, IPlugin> _loadedPlugins = new();
    private readonly ConcurrentDictionary<Guid, AssemblyLoadContext> _loadContexts = new();

    public async Task<IPlugin?> LoadPluginAsync(Guid pluginRegistryId)
    {
        if (_loadedPlugins.TryGetValue(pluginRegistryId, out var cachedPlugin))
            return cachedPlugin;

        var pluginInfo = await _pluginRegistry.GetByIdAsync(pluginRegistryId);
        if (pluginInfo == null || pluginInfo.Status != "Active")
            return null;

        try
        {
            // Create isolated assembly load context
            var loadContext = new AssemblyLoadContext($"Plugin-{pluginRegistryId}", isCollectible: true);
            var assembly = loadContext.LoadFromAssemblyPath(pluginInfo.AssemblyPath);
            
            var pluginType = assembly.GetType(pluginInfo.EntryPoint);
            if (pluginType == null)
            {
                _logger.LogError("Plugin entry point not found: {EntryPoint}", pluginInfo.EntryPoint);
                return null;
            }

            var plugin = Activator.CreateInstance(pluginType) as IPlugin;
            if (plugin == null)
            {
                _logger.LogError("Failed to create plugin instance: {PluginId}", pluginInfo.PluginId);
                return null;
            }

            // Initialize plugin
            var context = new PluginContext
            {
                TenantId = pluginInfo.TenantId ?? Guid.Empty,
                Parameters = pluginInfo.Configuration.ToDictionary(),
                ServiceProvider = _serviceProvider // Scoped service provider
            };

            var initialized = await plugin.InitializeAsync(context);
            if (!initialized)
            {
                _logger.LogError("Plugin initialization failed: {PluginId}", pluginInfo.PluginId);
                return null;
            }

            // Cache loaded plugin and context
            _loadedPlugins[pluginRegistryId] = plugin;
            _loadContexts[pluginRegistryId] = loadContext;

            _logger.LogInformation("Plugin loaded successfully: {PluginId}", pluginInfo.PluginId);
            return plugin;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load plugin: {PluginId}", pluginInfo.PluginId);
            return null;
        }
    }

    public async Task<PluginExecutionResult> ExecutePluginAsync(Guid pluginRegistryId, PluginContext context)
    {
        var plugin = await LoadPluginAsync(pluginRegistryId);
        if (plugin == null)
        {
            return new PluginExecutionResult
            {
                Success = false,
                Message = "Plugin not found or failed to load",
                Errors = new List<string> { "Plugin loading failed" }
            };
        }

        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            // Check if plugin can execute in current context
            var canExecute = await plugin.CanExecuteAsync(context);
            if (!canExecute)
            {
                return new PluginExecutionResult
                {
                    Success = false,
                    Message = "Plugin execution not allowed in current context"
                };
            }

            // Execute plugin with timeout
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
            cts.CancelAfter(TimeSpan.FromMinutes(5)); // 5-minute timeout

            var result = await plugin.ExecuteAsync(context);
            result.ExecutionTime = stopwatch.Elapsed;

            // Log execution
            await LogPluginExecutionAsync(pluginRegistryId, context, result);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Plugin execution failed: {PluginId}", plugin.PluginId);
            
            var errorResult = new PluginExecutionResult
            {
                Success = false,
                Message = "Plugin execution failed",
                Errors = new List<string> { ex.Message },
                ExecutionTime = stopwatch.Elapsed
            };

            await LogPluginExecutionAsync(pluginRegistryId, context, errorResult);
            return errorResult;
        }
        finally
        {
            stopwatch.Stop();
        }
    }

    private async Task LogPluginExecutionAsync(Guid pluginRegistryId, PluginContext context, PluginExecutionResult result)
    {
        var history = new PluginExecutionHistory
        {
            PluginRegistryId = pluginRegistryId,
            TenantId = context.TenantId,
            UserId = Guid.Parse(context.UserId),
            ExecutionContext = JsonSerializer.Serialize(context.Parameters),
            InputParameters = JsonSerializer.Serialize(context.Parameters),
            OutputResult = JsonSerializer.Serialize(result),
            ExecutionTimeMs = (int)result.ExecutionTime.TotalMilliseconds,
            Success = result.Success,
            ErrorMessage = string.Join("; ", result.Errors)
        };

        await _pluginExecutionHistoryRepository.CreateAsync(history);
    }
}
```

### **3.3 React Plugin Integration**

#### **Plugin Component Loader**
```typescript
// hooks/usePluginComponents.ts
export const usePluginComponents = (tenantId: string, category: string) => {
  const [plugins, setPlugins] = useState<PluginComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPluginComponents();
  }, [tenantId, category]);

  const loadPluginComponents = async () => {
    try {
      setLoading(true);
      
      // Get plugin registry for UI components
      const response = await apiService.get('/api/plugins', {
        params: { category, type: 'UI', status: 'Active' }
      });

      const pluginComponents = await Promise.all(
        response.data.map(async (plugin: any) => {
          try {
            // Dynamically import plugin component
            const module = await import(`/plugins/${plugin.pluginId}/${plugin.version}/index.js`);
            return {
              id: plugin.id,
              pluginId: plugin.pluginId,
              name: plugin.name,
              component: module.default,
              config: plugin.configuration
            };
          } catch (importError) {
            console.error(`Failed to load plugin component: ${plugin.pluginId}`, importError);
            return null;
          }
        })
      );

      setPlugins(pluginComponents.filter(Boolean));
      setError(null);
    } catch (err) {
      setError('Failed to load plugin components');
      console.error('Plugin loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  return { plugins, loading, error, reload: loadPluginComponents };
};

// components/plugins/PluginRenderer.tsx
interface PluginRendererProps {
  pluginId: string;
  config?: Record<string, any>;
  context?: Record<string, any>;
  onPluginAction?: (action: string, data: any) => void;
}

export const PluginRenderer: React.FC<PluginRendererProps> = ({
  pluginId,
  config = {},
  context = {},
  onPluginAction
}) => {
  const { tenantId } = useTenant();
  const [PluginComponent, setPluginComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPluginComponent();
  }, [pluginId]);

  const loadPluginComponent = async () => {
    try {
      setLoading(true);
      
      // Get plugin information
      const pluginInfo = await apiService.get(`/api/plugins/${pluginId}`);
      
      // Dynamically import plugin component
      const module = await import(
        `/plugins/${pluginInfo.data.pluginId}/${pluginInfo.data.version}/index.js`
      );
      
      setPluginComponent(() => module.default);
      setError(null);
    } catch (err) {
      setError('Failed to load plugin component');
      console.error('Plugin component loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error || !PluginComponent) {
    return (
      <Alert severity="error">
        {error || 'Plugin component not available'}
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={<Alert severity="error">Plugin component crashed</Alert>}
    >
      <PluginComponent
        tenantId={tenantId}
        config={config}
        context={context}
        onAction={onPluginAction}
      />
    </ErrorBoundary>
  );
};
```

---

This comprehensive technical specification provides the detailed implementation guidance for each framework component. The specifications include database schemas, API contracts, React components, and integration patterns necessary for building the MVP framework.

Would you like me to continue with the remaining framework components (Event Framework, Workflow Engine, LLM Integration, Business Rules Engine) or would you prefer to start implementing any specific component based on these specifications?
