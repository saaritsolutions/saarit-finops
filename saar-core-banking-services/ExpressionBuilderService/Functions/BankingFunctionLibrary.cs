namespace ExpressionBuilderService.Functions;

/// <summary>
/// Interface for banking-specific function library
/// </summary>
public interface IBankingFunctionLibrary
{
    // Interest Calculations
    decimal CalculateSimpleInterest(decimal principal, decimal rate, int days);
    decimal CalculateCompoundInterest(decimal principal, decimal rate, int periods, int compoundingFrequency);
    decimal CalculateEMI(decimal principal, decimal annualRate, int months);
    decimal CalculateNPV(decimal[] cashFlows, decimal discountRate);
    decimal CalculateIRR(decimal[] cashFlows);

    // Account Operations
    bool IsAccountActive(string accountNumber);
    decimal GetAccountBalance(string accountNumber);
    string GetAccountType(string accountNumber);
    bool IsAccountBlocked(string accountNumber);
    DateTime GetLastTransactionDate(string accountNumber);

    // Customer Functions
    bool IsCustomerValid(string customerId);
    int GetCustomerAge(string customerId);
    string GetCustomerRiskCategory(string customerId);
    decimal GetCustomerCreditLimit(string customerId);
    bool HasActiveLoans(string customerId);

    // Transaction Validations
    bool IsTransactionLimitExceeded(decimal amount, string transactionType, string accountNumber);
    bool IsTransactionTimeValid(DateTime transactionTime);
    bool IsTransactionTypeAllowed(string transactionType, string accountType);
    decimal GetDailyTransactionSum(string accountNumber, DateTime date);
    int GetTransactionCount(string accountNumber, DateTime from, DateTime to);

    // Risk Assessment
    decimal CalculateRiskScore(string customerId, decimal transactionAmount);
    bool IsSuspiciousTransaction(decimal amount, string customerId, string transactionType);
    string GetTransactionRiskLevel(decimal amount, string customerId, string accountNumber);
    bool RequiresManualApproval(decimal amount, string transactionType, string customerId);

    // Loan Functions
    bool IsEligibleForLoan(string customerId, decimal requestedAmount, string loanType);
    decimal CalculateLoanEligibility(string customerId);
    decimal GetMaxLoanAmount(string customerId, string loanType);
    bool IsLoanDefaulter(string customerId);
    decimal CalculateLTV(decimal loanAmount, decimal collateralValue);

    // Date and Time Utilities
    int CalculateBusinessDays(DateTime startDate, DateTime endDate);
    DateTime GetNextBusinessDay(DateTime date);
    bool IsBusinessDay(DateTime date);
    bool IsHoliday(DateTime date);
    DateTime AddBusinessDays(DateTime startDate, int businessDays);

    // Currency and Conversion
    decimal ConvertCurrency(decimal amount, string fromCurrency, string toCurrency);
    decimal GetExchangeRate(string fromCurrency, string toCurrency);
    decimal RoundToCurrency(decimal amount, string currency);

    // Regulatory Compliance
    bool IsCTRRequired(decimal amount, string transactionType);
    bool IsSARRequired(decimal amount, string customerId, string transactionType);
    bool IsKYCCompliant(string customerId);
    bool IsAMLCompliant(string customerId, decimal amount);

    // Utility Functions
    string GenerateReferenceNumber(string prefix);
    bool IsValidIBAN(string iban);
    bool IsValidAccountNumber(string accountNumber);
    string MaskAccountNumber(string accountNumber);
    string MaskCardNumber(string cardNumber);

    // Math and Statistical Functions
    decimal Percentage(decimal value, decimal percentage);
    decimal Average(decimal[] values);
    decimal Median(decimal[] values);
    decimal StandardDeviation(decimal[] values);
    decimal Min(decimal[] values);
    decimal Max(decimal[] values);

    // Available functions metadata
    List<string> GetAvailableFunctions();
    Dictionary<string, string> GetFunctionDescriptions();
    Dictionary<string, Type[]> GetFunctionParameters();
}

/// <summary>
/// Implementation of banking function library
/// </summary>
public class BankingFunctionLibrary : IBankingFunctionLibrary
{
    private readonly ILogger<BankingFunctionLibrary>? _logger;

    public BankingFunctionLibrary()
    {
        // For now, we'll create without DI for simplicity
        // In real implementation, this would be injected
    }

    public BankingFunctionLibrary(ILogger<BankingFunctionLibrary> logger)
    {
        _logger = logger;
    }

    #region Interest Calculations

    public decimal CalculateSimpleInterest(decimal principal, decimal rate, int days)
    {
        if (principal <= 0 || rate < 0 || days <= 0)
            throw new ArgumentException("Invalid parameters for simple interest calculation");

        return principal * (rate / 100) * (days / 365m);
    }

    public decimal CalculateCompoundInterest(decimal principal, decimal rate, int periods, int compoundingFrequency)
    {
        if (principal <= 0 || rate < 0 || periods <= 0 || compoundingFrequency <= 0)
            throw new ArgumentException("Invalid parameters for compound interest calculation");

        var ratePerPeriod = rate / 100 / compoundingFrequency;
        var totalPeriods = periods * compoundingFrequency;
        
        return principal * (decimal)Math.Pow((double)(1 + ratePerPeriod), totalPeriods) - principal;
    }

    public decimal CalculateEMI(decimal principal, decimal annualRate, int months)
    {
        if (principal <= 0 || annualRate < 0 || months <= 0)
            throw new ArgumentException("Invalid parameters for EMI calculation");

        if (annualRate == 0)
            return principal / months;

        var monthlyRate = annualRate / 100 / 12;
        return principal * monthlyRate * (decimal)Math.Pow((double)(1 + monthlyRate), months) / 
               ((decimal)Math.Pow((double)(1 + monthlyRate), months) - 1);
    }

    public decimal CalculateNPV(decimal[] cashFlows, decimal discountRate)
    {
        if (cashFlows == null || cashFlows.Length == 0)
            throw new ArgumentException("Cash flows cannot be null or empty");

        decimal npv = 0;
        for (int i = 0; i < cashFlows.Length; i++)
        {
            npv += cashFlows[i] / (decimal)Math.Pow((double)(1 + discountRate / 100), i);
        }
        return npv;
    }

    public decimal CalculateIRR(decimal[] cashFlows)
    {
        // Simplified IRR calculation using Newton-Raphson method
        if (cashFlows == null || cashFlows.Length < 2)
            throw new ArgumentException("Invalid cash flows for IRR calculation");

        decimal guess = 0.1m; // 10% initial guess
        decimal tolerance = 0.00001m;
        int maxIterations = 100;

        for (int i = 0; i < maxIterations; i++)
        {
            decimal npv = CalculateNPV(cashFlows, guess * 100);
            if (Math.Abs(npv) < tolerance)
                return guess;

            // Simple adjustment - in real implementation, use derivative
            guess += npv > 0 ? 0.01m : -0.01m;
        }

        throw new InvalidOperationException("IRR calculation did not converge");
    }

    #endregion

    #region Account Operations

    public bool IsAccountActive(string accountNumber)
    {
        // Mock implementation - would query actual database
        return !string.IsNullOrEmpty(accountNumber) && accountNumber.Length >= 8;
    }

    public decimal GetAccountBalance(string accountNumber)
    {
        // Mock implementation - would query actual database
        return 10000m; // Default balance for demo
    }

    public string GetAccountType(string accountNumber)
    {
        // Mock implementation based on account number pattern
        if (string.IsNullOrEmpty(accountNumber))
            return "Unknown";

        return accountNumber.StartsWith("SAV") ? "Savings" :
               accountNumber.StartsWith("CHK") ? "Checking" :
               accountNumber.StartsWith("LON") ? "Loan" : "Unknown";
    }

    public bool IsAccountBlocked(string accountNumber)
    {
        // Mock implementation
        return false;
    }

    public DateTime GetLastTransactionDate(string accountNumber)
    {
        // Mock implementation
        return DateTime.UtcNow.AddDays(-1);
    }

    #endregion

    #region Customer Functions

    public bool IsCustomerValid(string customerId)
    {
        return !string.IsNullOrEmpty(customerId) && customerId.Length >= 6;
    }

    public int GetCustomerAge(string customerId)
    {
        // Mock implementation - would calculate from DOB
        return 35; // Default age for demo
    }

    public string GetCustomerRiskCategory(string customerId)
    {
        // Mock implementation based on customer ID
        var hash = customerId?.GetHashCode() ?? 0;
        var mod = Math.Abs(hash) % 3;
        return mod switch
        {
            0 => "Low",
            1 => "Medium",
            _ => "High"
        };
    }

    public decimal GetCustomerCreditLimit(string customerId)
    {
        // Mock implementation
        return 50000m;
    }

    public bool HasActiveLoans(string customerId)
    {
        // Mock implementation
        return true;
    }

    #endregion

    #region Transaction Validations

    public bool IsTransactionLimitExceeded(decimal amount, string transactionType, string accountNumber)
    {
        var limits = new Dictionary<string, decimal>
        {
            { "ATM_WITHDRAWAL", 5000m },
            { "ONLINE_TRANSFER", 25000m },
            { "POS_PURCHASE", 15000m },
            { "DEFAULT", 10000m }
        };

        var limit = limits.GetValueOrDefault(transactionType.ToUpper(), limits["DEFAULT"]);
        return amount > limit;
    }

    public bool IsTransactionTimeValid(DateTime transactionTime)
    {
        var hour = transactionTime.Hour;
        return hour >= 6 && hour <= 23; // Banking hours 6 AM to 11 PM
    }

    public bool IsTransactionTypeAllowed(string transactionType, string accountType)
    {
        var allowedCombinations = new Dictionary<string, List<string>>
        {
            { "Savings", new List<string> { "DEPOSIT", "WITHDRAWAL", "TRANSFER", "INTEREST" } },
            { "Checking", new List<string> { "DEPOSIT", "WITHDRAWAL", "TRANSFER", "POS_PURCHASE" } },
            { "Loan", new List<string> { "PAYMENT", "INTEREST_CHARGE" } }
        };

        return allowedCombinations.GetValueOrDefault(accountType, new List<string>())
                                 .Contains(transactionType.ToUpper());
    }

    public decimal GetDailyTransactionSum(string accountNumber, DateTime date)
    {
        // Mock implementation - would sum actual transactions
        return 5000m;
    }

    public int GetTransactionCount(string accountNumber, DateTime from, DateTime to)
    {
        // Mock implementation
        return (int)(to - from).TotalDays * 3; // 3 transactions per day average
    }

    #endregion

    #region Risk Assessment

    public decimal CalculateRiskScore(string customerId, decimal transactionAmount)
    {
        var baseScore = 50m;
        var amountFactor = transactionAmount / 10000m; // Risk increases with amount
        var customerRisk = GetCustomerRiskCategory(customerId) switch
        {
            "Low" => 0.5m,
            "Medium" => 1.0m,
            "High" => 2.0m,
            _ => 1.0m
        };

        return Math.Min(100m, baseScore + (amountFactor * customerRisk * 10));
    }

    public bool IsSuspiciousTransaction(decimal amount, string customerId, string transactionType)
    {
        var riskScore = CalculateRiskScore(customerId, amount);
        return riskScore > 75m;
    }

    public string GetTransactionRiskLevel(decimal amount, string customerId, string accountNumber)
    {
        var riskScore = CalculateRiskScore(customerId, amount);
        return riskScore switch
        {
            < 30 => "Low",
            < 70 => "Medium",
            _ => "High"
        };
    }

    public bool RequiresManualApproval(decimal amount, string transactionType, string customerId)
    {
        return amount > 100000m || IsSuspiciousTransaction(amount, customerId, transactionType);
    }

    #endregion

    #region Loan Functions

    public bool IsEligibleForLoan(string customerId, decimal requestedAmount, string loanType)
    {
        var age = GetCustomerAge(customerId);
        var creditLimit = GetCustomerCreditLimit(customerId);
        var riskCategory = GetCustomerRiskCategory(customerId);

        return age >= 21 && age <= 65 && 
               requestedAmount <= creditLimit && 
               riskCategory != "High" &&
               !IsLoanDefaulter(customerId);
    }

    public decimal CalculateLoanEligibility(string customerId)
    {
        var baseEligibility = GetCustomerCreditLimit(customerId);
        var riskMultiplier = GetCustomerRiskCategory(customerId) switch
        {
            "Low" => 1.0m,
            "Medium" => 0.8m,
            "High" => 0.5m,
            _ => 0.8m
        };

        return baseEligibility * riskMultiplier;
    }

    public decimal GetMaxLoanAmount(string customerId, string loanType)
    {
        var baseEligibility = CalculateLoanEligibility(customerId);
        
        return loanType.ToUpper() switch
        {
            "PERSONAL" => baseEligibility * 0.5m,
            "HOME" => baseEligibility * 3.0m,
            "AUTO" => baseEligibility * 1.5m,
            "EDUCATION" => baseEligibility * 2.0m,
            _ => baseEligibility * 0.3m
        };
    }

    public bool IsLoanDefaulter(string customerId)
    {
        // Mock implementation - would check actual loan history
        return false;
    }

    public decimal CalculateLTV(decimal loanAmount, decimal collateralValue)
    {
        if (collateralValue <= 0)
            throw new ArgumentException("Collateral value must be positive");

        return (loanAmount / collateralValue) * 100;
    }

    #endregion

    #region Date and Time Utilities

    public int CalculateBusinessDays(DateTime startDate, DateTime endDate)
    {
        if (startDate > endDate)
            throw new ArgumentException("Start date cannot be after end date");

        int businessDays = 0;
        var current = startDate.Date;

        while (current <= endDate.Date)
        {
            if (IsBusinessDay(current))
                businessDays++;
            current = current.AddDays(1);
        }

        return businessDays;
    }

    public DateTime GetNextBusinessDay(DateTime date)
    {
        var nextDay = date.Date.AddDays(1);
        while (!IsBusinessDay(nextDay))
        {
            nextDay = nextDay.AddDays(1);
        }
        return nextDay;
    }

    public bool IsBusinessDay(DateTime date)
    {
        return date.DayOfWeek != DayOfWeek.Saturday && 
               date.DayOfWeek != DayOfWeek.Sunday && 
               !IsHoliday(date);
    }

    public bool IsHoliday(DateTime date)
    {
        // Simplified holiday check - would use actual holiday calendar
        var holidays = new[]
        {
            new DateTime(date.Year, 1, 1),   // New Year
            new DateTime(date.Year, 12, 25), // Christmas
            new DateTime(date.Year, 7, 4),   // Independence Day (US example)
        };

        return holidays.Contains(date.Date);
    }

    public DateTime AddBusinessDays(DateTime startDate, int businessDays)
    {
        var current = startDate.Date;
        var daysAdded = 0;

        while (daysAdded < businessDays)
        {
            current = current.AddDays(1);
            if (IsBusinessDay(current))
                daysAdded++;
        }

        return current;
    }

    #endregion

    #region Currency and Conversion

    public decimal ConvertCurrency(decimal amount, string fromCurrency, string toCurrency)
    {
        if (fromCurrency == toCurrency)
            return amount;

        var rate = GetExchangeRate(fromCurrency, toCurrency);
        return amount * rate;
    }

    public decimal GetExchangeRate(string fromCurrency, string toCurrency)
    {
        // Mock exchange rates - would fetch from actual service
        var rates = new Dictionary<string, decimal>
        {
            { "USD_EUR", 0.85m },
            { "USD_GBP", 0.75m },
            { "EUR_USD", 1.18m },
            { "GBP_USD", 1.33m }
        };

        var key = $"{fromCurrency}_{toCurrency}";
        return rates.GetValueOrDefault(key, 1.0m);
    }

    public decimal RoundToCurrency(decimal amount, string currency)
    {
        // Different currencies have different rounding rules
        return currency.ToUpper() switch
        {
            "USD" or "EUR" or "GBP" => Math.Round(amount, 2),
            "JPY" => Math.Round(amount, 0),
            _ => Math.Round(amount, 2)
        };
    }

    #endregion

    #region Regulatory Compliance

    public bool IsCTRRequired(decimal amount, string transactionType)
    {
        // Currency Transaction Report required for transactions > $10,000
        return amount > 10000m;
    }

    public bool IsSARRequired(decimal amount, string customerId, string transactionType)
    {
        // Suspicious Activity Report
        return IsSuspiciousTransaction(amount, customerId, transactionType) || amount > 50000m;
    }

    public bool IsKYCCompliant(string customerId)
    {
        // Mock KYC check
        return !string.IsNullOrEmpty(customerId);
    }

    public bool IsAMLCompliant(string customerId, decimal amount)
    {
        // Anti-Money Laundering compliance check
        return IsKYCCompliant(customerId) && !IsSuspiciousTransaction(amount, customerId, "TRANSFER");
    }

    #endregion

    #region Utility Functions

    public string GenerateReferenceNumber(string prefix)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var random = new Random().Next(1000, 9999);
        return $"{prefix}{timestamp}{random}";
    }

    public bool IsValidIBAN(string iban)
    {
        // Simplified IBAN validation
        return !string.IsNullOrEmpty(iban) && iban.Length >= 15 && iban.Length <= 34;
    }

    public bool IsValidAccountNumber(string accountNumber)
    {
        return !string.IsNullOrEmpty(accountNumber) && 
               accountNumber.Length >= 8 && 
               accountNumber.All(char.IsLetterOrDigit);
    }

    public string MaskAccountNumber(string accountNumber)
    {
        if (string.IsNullOrEmpty(accountNumber) || accountNumber.Length < 4)
            return accountNumber;

        var visibleChars = 4;
        var masked = new string('*', accountNumber.Length - visibleChars);
        return masked + accountNumber.Substring(accountNumber.Length - visibleChars);
    }

    public string MaskCardNumber(string cardNumber)
    {
        if (string.IsNullOrEmpty(cardNumber) || cardNumber.Length < 4)
            return cardNumber;

        var cleaned = cardNumber.Replace(" ", "").Replace("-", "");
        if (cleaned.Length < 4)
            return cardNumber;

        return "****-****-****-" + cleaned.Substring(cleaned.Length - 4);
    }

    #endregion

    #region Math and Statistical Functions

    public decimal Percentage(decimal value, decimal percentage)
    {
        return value * (percentage / 100);
    }

    public decimal Average(decimal[] values)
    {
        if (values == null || values.Length == 0)
            throw new ArgumentException("Values cannot be null or empty");

        return values.Average();
    }

    public decimal Median(decimal[] values)
    {
        if (values == null || values.Length == 0)
            throw new ArgumentException("Values cannot be null or empty");

        var sorted = values.OrderBy(x => x).ToArray();
        var count = sorted.Length;

        if (count % 2 == 0)
        {
            return (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
        }
        else
        {
            return sorted[count / 2];
        }
    }

    public decimal StandardDeviation(decimal[] values)
    {
        if (values == null || values.Length == 0)
            throw new ArgumentException("Values cannot be null or empty");

        var avg = values.Average();
        var sumOfSquares = values.Sum(x => (double)((x - avg) * (x - avg)));
        return (decimal)Math.Sqrt(sumOfSquares / values.Length);
    }

    public decimal Min(decimal[] values)
    {
        if (values == null || values.Length == 0)
            throw new ArgumentException("Values cannot be null or empty");

        return values.Min();
    }

    public decimal Max(decimal[] values)
    {
        if (values == null || values.Length == 0)
            throw new ArgumentException("Values cannot be null or empty");

        return values.Max();
    }

    #endregion

    #region Metadata Functions

    public List<string> GetAvailableFunctions()
    {
        return new List<string>
        {
            // Interest calculations
            "CalculateSimpleInterest", "CalculateCompoundInterest", "CalculateEMI", "CalculateNPV", "CalculateIRR",
            
            // Account operations
            "IsAccountActive", "GetAccountBalance", "GetAccountType", "IsAccountBlocked", "GetLastTransactionDate",
            
            // Customer functions
            "IsCustomerValid", "GetCustomerAge", "GetCustomerRiskCategory", "GetCustomerCreditLimit", "HasActiveLoans",
            
            // Transaction validations
            "IsTransactionLimitExceeded", "IsTransactionTimeValid", "IsTransactionTypeAllowed", "GetDailyTransactionSum", "GetTransactionCount",
            
            // Risk assessment
            "CalculateRiskScore", "IsSuspiciousTransaction", "GetTransactionRiskLevel", "RequiresManualApproval",
            
            // Loan functions
            "IsEligibleForLoan", "CalculateLoanEligibility", "GetMaxLoanAmount", "IsLoanDefaulter", "CalculateLTV",
            
            // Date and time utilities
            "CalculateBusinessDays", "GetNextBusinessDay", "IsBusinessDay", "IsHoliday", "AddBusinessDays",
            
            // Currency and conversion
            "ConvertCurrency", "GetExchangeRate", "RoundToCurrency",
            
            // Regulatory compliance
            "IsCTRRequired", "IsSARRequired", "IsKYCCompliant", "IsAMLCompliant",
            
            // Utility functions
            "GenerateReferenceNumber", "IsValidIBAN", "IsValidAccountNumber", "MaskAccountNumber", "MaskCardNumber",
            
            // Math and statistical functions
            "Percentage", "Average", "Median", "StandardDeviation", "Min", "Max"
        };
    }

    public Dictionary<string, string> GetFunctionDescriptions()
    {
        return new Dictionary<string, string>
        {
            { "CalculateSimpleInterest", "Calculates simple interest for given principal, rate and days" },
            { "CalculateEMI", "Calculates Equated Monthly Installment for loans" },
            { "IsAccountActive", "Checks if an account is active and operational" },
            { "GetAccountBalance", "Retrieves current balance of an account" },
            { "CalculateRiskScore", "Calculates risk score for a transaction" },
            { "IsTransactionLimitExceeded", "Checks if transaction exceeds allowed limits" },
            // ... more descriptions would be added here
        };
    }

    public Dictionary<string, Type[]> GetFunctionParameters()
    {
        return new Dictionary<string, Type[]>
        {
            { "CalculateSimpleInterest", new[] { typeof(decimal), typeof(decimal), typeof(int) } },
            { "CalculateEMI", new[] { typeof(decimal), typeof(decimal), typeof(int) } },
            { "IsAccountActive", new[] { typeof(string) } },
            { "GetAccountBalance", new[] { typeof(string) } },
            { "CalculateRiskScore", new[] { typeof(string), typeof(decimal) } },
            // ... more parameter definitions would be added here
        };
    }

    #endregion
}
