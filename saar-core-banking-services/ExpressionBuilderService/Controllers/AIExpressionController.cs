using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIExpressionController : ControllerBase
{
    private readonly ILogger<AIExpressionController> _logger;
    private readonly ExpressionBuilderService.AI.ILlmSelectorService _llmSelector;

    public AIExpressionController(ILogger<AIExpressionController> logger, ExpressionBuilderService.AI.ILlmSelectorService llmSelector)
    {
        _logger = logger;
        _llmSelector = llmSelector;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> ChatWithAI([FromBody] ChatRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("Message cannot be empty");
            }

            _logger.LogInformation("Received chat request: {Message} (category: {Category})", request.Message, request.Category);

            // Use configured LLM provider when available; no fallback desired
            try
            {
                var provider = _llmSelector.GetProvider();
                if (provider == null)
                {
                    _logger.LogWarning("No LLM provider resolved");
                    return StatusCode(502, new { error = "LLM provider unavailable" });
                }

                // Build rich context like AIGptNanoController
                var defaultContext = BuildDefaultContext(request.Category);
                var ctx = string.IsNullOrWhiteSpace(request.Category) ? defaultContext : request.Category + "\n" + defaultContext;

                var aiReq = new ExpressionBuilderService.AI.AIExpressionRequest
                {
                    UserPrompt = request.Message + " expression only",  // Add "expression only" suffix
                    Context = ctx,
                    ExampleExpressions = new List<string>
                    {
                        "customer.creditScore >= 700 && customer.monthlyIncome >= 50000",
                        "loan.RequestedAmount <= customer.monthlyIncome * 12 * 0.4",
                        "CalculateEMI(loan.RequestedAmount, loan.InterestRate, loan.TenureMonths) <= Percentage(customer.monthlyIncome, 40)"
                    }
                };

                var aiResp = await provider.GenerateExpressionAsync(aiReq);
                if (aiResp == null || !aiResp.IsValid)
                {
                    return StatusCode(502, new { error = "LLM response invalid" });
                }
                
                // Return just the expression string that the frontend expects for saving
                var expressionText = !string.IsNullOrWhiteSpace(aiResp.SuggestedExpression) 
                    ? aiResp.SuggestedExpression 
                    : aiResp.Explanation;
                    
                return Ok(new { response = expressionText });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "LLM provider error");
                return StatusCode(502, new { error = ex.Message });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing chat request");
            return StatusCode(500, new { error = "An error occurred while processing your request." });
        }
    }

    [HttpPost("improve")]
    public async Task<IActionResult> ImproveExpression([FromBody] ImprovementRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Expression))
            {
                return BadRequest("Expression cannot be empty");
            }

            var suggestions = new List<string>
            {
                "Add null checks: customer.Age != null AND customer.Age >= 18",
                "Consider edge cases: customer.Age BETWEEN 18 AND 120",
                "Add validation: customer.Status = 'ACTIVE' AND customer.Age >= 18",
                "Optimize performance: Use indexed fields where possible"
            };

            return Ok(new { 
                originalExpression = request.Expression,
                suggestions = suggestions,
                context = request.Context ?? "general"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error improving expression");
            return StatusCode(500, new { error = "An error occurred while improving the expression." });
        }
    }

    private string GenerateFallbackResponse(string userMessage)
    {
    var message = userMessage.ToLower();
    // Common flag: when user wants only the raw expression (no formatting)
    bool wantsExpressionOnly = message.Contains("expression only") ||
                   message.Contains("just expression") ||
                   message.Contains("code only") ||
                   message.Contains("raw expression") ||
                   message.Contains("direct expression");
        
        // Special handling: if user specifies creditScore/monthlyIncome, generate a matching eligibility expression
        // Supports prompts like: "loan eligibility expression only using creditScore >= 750 and monthlyIncome >= 60000"
        // or "make it stricter: creditScore >= 800 and monthlyIncome >= 100000"
        if (message.Contains("creditscore") || message.Contains("monthlyincome"))
        {
            // Try to extract thresholds if provided
            // Pattern 1: creditScore >= N and monthlyIncome >= M
            // Pattern 2: monthlyIncome >= M and creditScore >= N
            int cs = 750;
            int mi = 60000;
            try
            {
                var re1 = new System.Text.RegularExpressions.Regex(@"creditscore\s*[><=!]+\s*(\d+).*?monthlyincome\s*[><=!]+\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var re2 = new System.Text.RegularExpressions.Regex(@"monthlyincome\s*[><=!]+\s*(\d+).*?creditscore\s*[><=!]+\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var m1 = re1.Match(userMessage);
                var m2 = m1.Success ? null : re2.Match(userMessage);
                if (m1.Success)
                {
                    int.TryParse(m1.Groups[1].Value, out cs);
                    int.TryParse(m1.Groups[2].Value, out mi);
                }
                else if (m2 != null && m2.Success)
                {
                    int.TryParse(m2.Groups[1].Value, out mi);
                    int.TryParse(m2.Groups[2].Value, out cs);
                }
            }
            catch { /* ignore parse issues; use defaults */ }

            var expr = $"(creditScore >= {cs} && monthlyIncome >= {mi}) ? \"APPROVED\" : \"DECLINED\"";

            if (wantsExpressionOnly)
            {
                return expr;
            }

            var header = "💰 **Loan Eligibility Rule (Using creditScore and monthlyIncome)**\n\n";
            var blockStart = "**Ready-to-Use Expression:**\n```\n";
            var blockEnd = "\n```\n\n";
            var footer = "**Variables:** creditScore (integer), monthlyIncome (number)\n💡 Tip: Ask for \"expression only\" to get raw expression without formatting.";
            return header + blockStart + expr + blockEnd + footer;
        }
        
        // Check if user wants only the expression (for direct application)
    if (wantsExpressionOnly)
        {
            return GenerateExpressionOnly(message);
        }
        
        // Age-related queries
        if (message.Contains("age") && (message.Contains("18") || message.Contains("minimum") || message.Contains("adult")))
        {
            return @"🎯 **Age Validation Rule**

**Ready-to-Use Expression:**
```
customer.Age >= 18 AND customer.Age <= 100
```

**Alternative Expressions:**
```
customer.Age > 17 AND customer.DateOfBirth <= DateTime.Now.AddYears(-18)
(DateTime.Now.Year - customer.DateOfBirth.Year) >= 18
```

**Variables:** customer.Age, customer.DateOfBirth
**Use Cases:** Account opening, KYC compliance, product eligibility

💡 *Tip: For direct use, request ""age validation expression only""*";
        }
        
        // Premium account upgrade
        if (message.Contains("premium") && (message.Contains("upgrade") || message.Contains("account")))
        {
            return @"💎 **Premium Account Upgrade Rule**

**Ready-to-Use Expression:**
```
(account.Balance >= 100000 AND customer.MonthlyIncome >= 75000) OR
(account.Balance >= 250000 AND customer.CreditScore >= 750) OR
(customer.RelationshipYears >= 5 AND account.AverageMonthlyBalance >= 50000)
```

**Simplified Version:**
```
customer.MonthlyIncome >= 100000 AND account.Balance >= 50000 AND customer.CreditScore >= 700
```

**Variables:** account.Balance, customer.MonthlyIncome, customer.CreditScore
💡 *Tip: For direct use, request ""premium upgrade expression only""*";
        }
        
        // Risk calculation and assessment
        if (message.Contains("risk") && (message.Contains("calculation") || message.Contains("assessment") || message.Contains("score")))
        {
            return @"⚠️ **Risk Assessment Rule**

**Ready-to-Use Risk Score Expression:**
```
(customer.CreditScore < 600 ? 50 : 0) + 
(account.Balance < 5000 ? 30 : 0) + 
(customer.Age < 25 ? 20 : 0) + 
(customer.DelinquencyHistory > 2 ? 40 : 0) + 
(account.OverdraftFrequency > 5 ? 25 : 0)
```

**Risk Category Expression:**
```
riskScore >= 100 ? 'HIGH_RISK' : riskScore >= 50 ? 'MEDIUM_RISK' : 'LOW_RISK'
```

**Variables:** customer.CreditScore, account.Balance, customer.Age
💡 *Tip: For direct use, request ""risk calculation expression only""*";
        }
        
        // Loan eligibility
    if (message.Contains("loan") || message.Contains("credit") || message.Contains("eligibility"))
        {
            return @"💰 **Loan Eligibility Rule**

**Ready-to-Use Expression:**
```
customer.Age BETWEEN 21 AND 65 AND 
customer.MonthlyIncome >= (loan.RequestedAmount * 0.15) AND 
customer.CreditScore >= 650 AND 
customer.DebtToIncomeRatio <= 0.40
```

**Variables:** customer.Age, customer.MonthlyIncome, loan.RequestedAmount, customer.CreditScore
💡 *Tip: For direct use, request ""loan eligibility expression only""*";
        }
        
        // Transaction limits
        if (message.Contains("transaction") || message.Contains("transfer") || message.Contains("limit"))
        {
            return @"💳 **Transaction Limit Rule**

**Ready-to-Use Expression:**
```
transaction.Amount <= (customer.AccountType == 'PREMIUM' ? 500000 : 
                      customer.AccountType == 'GOLD' ? 200000 : 25000) AND 
account.Balance >= transaction.Amount
```

**Variables:** transaction.Amount, customer.AccountType, account.Balance
💡 *Tip: For direct use, request ""transaction limit expression only""*";
        }
        
        // Balance validation
        if (message.Contains("balance") || message.Contains("minimum"))
        {
            return @"🏦 **Balance Validation Rule**

**Ready-to-Use Expression:**
```
account.Balance >= (account.Type == 'PREMIUM' ? 100000 : 
                   account.Type == 'GOLD' ? 50000 : 
                   account.Type == 'SAVINGS' ? 1000 : 500)
```

**Variables:** account.Balance, account.Type
💡 *Tip: For direct use, request ""balance validation expression only""*";
        }
        
        // Interest calculation
        if (message.Contains("interest") || message.Contains("rate"))
        {
            return @"📈 **Interest Rate Rule**

**Ready-to-Use Expression:**
```
account.Balance >= 1000000 ? 2.50 : 
account.Balance >= 100000 ? 2.00 : 
account.Balance >= 25000 ? 1.50 : 
account.Balance >= 5000 ? 1.00 : 0.25
```

**Variables:** account.Balance
💡 *Tip: For direct use, request ""interest rate expression only""*";
        }
        
        // KYC compliance
        if (message.Contains("kyc") || message.Contains("compliance") || message.Contains("verification"))
        {
            return @"🔍 **KYC Compliance Rule**

**Ready-to-Use Expression:**
```
customer.IdentityVerified = true AND 
customer.AddressVerified = true AND 
customer.IncomeVerified = true AND 
customer.PEPStatus = 'CLEARED' AND 
customer.SanctionScreening = 'PASSED'
```

**Variables:** customer.IdentityVerified, customer.AddressVerified, customer.IncomeVerified
💡 *Tip: For direct use, request ""kyc compliance expression only""*";
        }
        
        return GetGeneralHelp();
    }

    private string GenerateExpressionOnly(string message)
    {
        // Variable-aware: When explicitly asking to use creditScore/monthlyIncome
        if ((message.Contains("creditscore") || message.Contains("monthlyincome")))
        {
            int cs = 750;
            int mi = 60000;
            try
            {
                var re1 = new System.Text.RegularExpressions.Regex(@"creditscore\s*[><=!]+\s*(\d+).*?monthlyincome\s*[><=!]+\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var re2 = new System.Text.RegularExpressions.Regex(@"monthlyincome\s*[><=!]+\s*(\d+).*?creditscore\s*[><=!]+\s*(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var m1 = re1.Match(message);
                var m2 = m1.Success ? null : re2.Match(message);
                if (m1.Success)
                {
                    int.TryParse(m1.Groups[1].Value, out cs);
                    int.TryParse(m1.Groups[2].Value, out mi);
                }
                else if (m2 != null && m2.Success)
                {
                    int.TryParse(m2.Groups[1].Value, out mi);
                    int.TryParse(m2.Groups[2].Value, out cs);
                }
            }
            catch { }
            return $"(creditScore >= {cs} && monthlyIncome >= {mi}) ? \"APPROVED\" : \"DECLINED\"";
        }

        // Age validation
        if (message.Contains("age"))
        {
            return "customer.Age >= 18 AND customer.Age <= 100";
        }
        
        // Premium account upgrade
        if (message.Contains("premium"))
        {
            return "(account.Balance >= 100000 AND customer.MonthlyIncome >= 75000) OR (account.Balance >= 250000 AND customer.CreditScore >= 750)";
        }
        
        // Risk calculation
        if (message.Contains("risk"))
        {
            return "(customer.CreditScore < 600 ? 50 : 0) + (account.Balance < 5000 ? 30 : 0) + (customer.Age < 25 ? 20 : 0) + (customer.DelinquencyHistory > 2 ? 40 : 0) + (account.OverdraftFrequency > 5 ? 25 : 0)";
        }
        
        // Loan eligibility
        if (message.Contains("loan") || message.Contains("credit") || message.Contains("eligibility"))
        {
            return "customer.Age BETWEEN 21 AND 65 AND customer.MonthlyIncome >= (loan.RequestedAmount * 0.15) AND customer.CreditScore >= 650 AND customer.DebtToIncomeRatio <= 0.40";
        }
        
        // Transaction validation
        if (message.Contains("transaction") || message.Contains("transfer") || message.Contains("limit"))
        {
            return "transaction.Amount <= (customer.AccountType == 'PREMIUM' ? 500000 : customer.AccountType == 'GOLD' ? 200000 : 25000) AND account.Balance >= transaction.Amount";
        }
        
        // Balance validation
        if (message.Contains("balance") || message.Contains("account") || message.Contains("minimum"))
        {
            return "account.Balance >= (account.Type == 'PREMIUM' ? 100000 : account.Type == 'GOLD' ? 50000 : account.Type == 'SAVINGS' ? 1000 : 500)";
        }
        
        // Interest calculation
        if (message.Contains("interest") || message.Contains("rate"))
        {
            return "account.Balance >= 1000000 ? 2.50 : account.Balance >= 100000 ? 2.00 : account.Balance >= 25000 ? 1.50 : account.Balance >= 5000 ? 1.00 : 0.25";
        }
        
        // KYC compliance
        if (message.Contains("kyc") || message.Contains("compliance") || message.Contains("verification"))
        {
            return "customer.IdentityVerified = true AND customer.AddressVerified = true AND customer.IncomeVerified = true AND customer.PEPStatus = 'CLEARED' AND customer.SanctionScreening = 'PASSED'";
        }
        
        // Wire transfer compliance
        if (message.Contains("wire") || message.Contains("international"))
        {
            return "customer.WireTransferEnabled = true AND transaction.Amount <= customer.WireLimit AND customer.ComplianceStatus = 'VERIFIED' AND transaction.RecipientCountry NOT IN sanctionedCountries";
        }
        
        // Fee calculation
        if (message.Contains("fee") || message.Contains("charge"))
        {
            return "account.Balance < account.MinimumBalance ? account.MaintenanceFee : (customer.RelationshipValue >= 250000 ? 0 : account.TransactionCount > account.FreeTransactions ? (account.TransactionCount - account.FreeTransactions) * account.PerTransactionFee : 0)";
        }
        
        // Default simple expression
        return "customer.Age >= 18 AND account.Balance >= 1000";
    }

    private string GetGeneralHelp()
    {
        return @"🤖 **Banking Expression Generator**

**Quick Expression Format (Direct Use):**
Add ""expression only"" to any request for raw expressions:
- ""Age validation expression only"" → `customer.Age >= 18 AND customer.Age <= 100`
- ""Loan eligibility expression only"" → `customer.CreditScore >= 650 AND ...`
- ""Risk calculation expression only"" → `(customer.CreditScore < 600 ? 50 : 0) + ...`

**Available Expression Types:**
🎯 **Customer Rules:** Age validation, KYC verification, risk scoring
💰 **Credit Rules:** Loan eligibility, credit limits, DTI ratios  
🏦 **Account Rules:** Balance requirements, fee calculations, upgrades
💳 **Transaction Rules:** Limits, velocity checks, fraud detection
📈 **Rate Rules:** Interest tiers, promotional rates, pricing
🔍 **Compliance Rules:** AML monitoring, PEP screening, sanctions

**Standard Variables:**
- Customer: Age, CreditScore, MonthlyIncome, AccountType, DebtToIncomeRatio
- Account: Balance, Type, MinimumBalance, DailyLimit, AverageMonthlyBalance  
- Transaction: Amount, Type, DailyTotal, CountToday, Location
- Loan: RequestedAmount, Term, LTV, Purpose

**Pro Tip:** For production use, always request ""[rule type] expression only"" to get clean, parseable expressions ready for immediate application.

What banking rule do you need?";
    }

    private string BuildDefaultContext(string entity)
    {
        var context = @"
You are a business rule expression generator for a core banking system. Generate only valid C#-like boolean expressions.

Available Entities:
- customer: creditScore(int), monthlyIncome(decimal), age(int), employmentType(string), HasDefaultHistory(bool)
- loan: RequestedAmount(decimal), InterestRate(decimal), TenureMonths(int), LoanType(string), CollateralValue(decimal)
- account: Balance(decimal), AccountType(string), IsActive(bool), LastTransactionDate(DateTime)

Available Functions:
- CalculateEMI(amount, rate, tenure): Calculate EMI for loan
- Percentage(value, percent): Calculate percentage of a value
- CalculateLTV(loanAmount, collateralValue): Calculate Loan-to-Value ratio
- GetCreditUtilization(customer): Get customer's credit utilization ratio

Rules:
- Use only the entities and functions listed above
- Generate syntactically correct C# boolean expressions
- Use proper operators: &&, ||, !, ==, !=, <, >, <=, >=
- Return only the expression, no explanations
- Ensure expressions are realistic for banking scenarios";

        // Add entity-specific context if provided
        if (!string.IsNullOrWhiteSpace(entity))
        {
            context += $"\n\nFocus on {entity.ToLower()} related expressions.";
        }

        return context;
    }
}

/// <summary>
/// Request model for expression improvement suggestions
/// </summary>
public class ImprovementRequest
{
    public string Expression { get; set; } = string.Empty;
    public string? Context { get; set; }
}

/// <summary>
/// Request model for AI chat
/// </summary>
public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    // Optional domain/category hint: "expression" | "form" | "workflow"
    public string? Category { get; set; }

    // Allow legacy/alternate client payload key: userPrompt
    [JsonPropertyName("userPrompt")] // if client sends userPrompt it will bind here
    public string? UserPrompt
    {
        get => Message;
        set
        {
            if (!string.IsNullOrWhiteSpace(value)) Message = value!;
        }
    }
}
