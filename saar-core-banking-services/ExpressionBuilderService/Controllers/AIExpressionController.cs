using ExpressionBuilderService.AI;
using Microsoft.AspNetCore.Mvc;

namespace ExpressionBuilderService.Controllers;

/// <summary>
/// AI-powered Expression Builder API endpoints
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AIExpressionController : ControllerBase
{
    private readonly IGeminiAIService _geminiAIService;
    private readonly ILogger<AIExpressionController> _logger;

    public AIExpressionController(IGeminiAIService geminiAIService, ILogger<AIExpressionController> logger)
    {
        _geminiAIService = geminiAIService;
        _logger = logger;
    }

    /// <summary>
    /// Generate banking expression using AI based on natural language input
    /// </summary>
    /// <param name="request">Natural language request for expression generation</param>
    /// <returns>AI-generated banking expression with explanation</returns>
    [HttpPost("generate")]
    public async Task<ActionResult<AIExpressionResponse>> GenerateExpression([FromBody] AIExpressionRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.UserPrompt))
            {
                return BadRequest(new { error = "UserPrompt is required" });
            }

            _logger.LogInformation("Generating AI expression for prompt: {Prompt}", request.UserPrompt);
            
            var response = await _geminiAIService.GenerateExpressionAsync(request);
            
            _logger.LogInformation("Successfully generated AI expression");
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating AI expression");
            return StatusCode(500, new { error = "Failed to generate AI expression" });
        }
    }

    /// <summary>
    /// Get AI explanation for an existing banking expression
    /// </summary>
    /// <param name="expression">The banking expression to explain</param>
    /// <returns>Human-readable explanation of the expression</returns>
    [HttpPost("explain")]
    public async Task<ActionResult<string>> ExplainExpression([FromBody] string expression)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(expression))
            {
                return BadRequest(new { error = "Expression is required" });
            }

            _logger.LogInformation("Explaining expression: {Expression}", expression);
            
            var explanation = await _geminiAIService.ExplainExpressionAsync(expression);
            
            return Ok(new { explanation });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error explaining expression");
            return StatusCode(500, new { error = "Failed to explain expression" });
        }
    }

    /// <summary>
    /// Get AI suggestions to improve an existing banking expression
    /// </summary>
    /// <param name="request">Expression and context for improvement suggestions</param>
    /// <returns>List of improvement suggestions</returns>
    [HttpPost("suggest-improvements")]
    public async Task<ActionResult<List<string>>> SuggestImprovements([FromBody] ImprovementRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Expression))
            {
                return BadRequest(new { error = "Expression is required" });
            }

            _logger.LogInformation("Suggesting improvements for expression: {Expression}", request.Expression);
            
            var suggestions = await _geminiAIService.SuggestImprovementsAsync(request.Expression, request.Context ?? "");
            
            return Ok(new { suggestions });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error suggesting improvements");
            return StatusCode(500, new { error = "Failed to suggest improvements" });
        }
    }

    /// <summary>
    /// Chat with AI assistant about banking expressions (minimal prompts supported)
    /// </summary>
    /// <param name="request">Simple chat request</param>
    /// <returns>AI assistant response</returns>
    [HttpPost("chat")]
    public async Task<ActionResult<string>> ChatWithAI([FromBody] ChatRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "Message is required" });
            }

            _logger.LogInformation("AI Chat request: {Message}", request.Message);

            // Convert simple chat messages to expression generation requests
            var aiRequest = new AIExpressionRequest
            {
                UserPrompt = request.Message,
                Context = "User is asking for help with banking expressions. Provide a helpful response with examples if appropriate.",
                Domain = "banking"
            };

            var response = await _geminiAIService.GenerateExpressionAsync(aiRequest);
            
            // Format response for chat
            var chatResponse = FormatChatResponse(response, request.Message);
            
            return Ok(new { response = chatResponse });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in AI chat");
            return StatusCode(500, new { error = "AI chat temporarily unavailable" });
        }
    }

    /// <summary>
    /// Get AI suggestions for expression variables and functions
    /// </summary>
    /// <param name="context">Domain context (customer, account, transaction, loan)</param>
    /// <returns>Available variables and functions for the context</returns>
    [HttpGet("context/{context}")]
    public ActionResult GetContextSuggestions(string context)
    {
        try
        {
            var suggestions = context.ToLower() switch
            {
                "customer" => new
                {
                    variables = new[] { "customer.Age", "customer.CreditScore", "customer.MonthlyIncome", "customer.AccountBalance", "customer.IsExistingCustomer" },
                    functions = new[] { "ValidateAge(customer.Age, 18)", "CheckCreditScore(customer.CreditScore, 650)", "CalculateDebtRatio(customer)" }
                },
                "account" => new
                {
                    variables = new[] { "account.Balance", "account.Type", "account.OpenDate", "account.IsActive", "account.MinimumBalance" },
                    functions = new[] { "IsAccountActive(account)", "CheckMinimumBalance(account)", "CalculateInterest(account)" }
                },
                "transaction" => new
                {
                    variables = new[] { "transaction.Amount", "transaction.Type", "transaction.Date", "transaction.IsInternational", "transaction.MerchantCategory" },
                    functions = new[] { "ValidateTransactionLimit(transaction)", "DetectFraud(transaction)", "CalculateFees(transaction)" }
                },
                "loan" => new
                {
                    variables = new[] { "loan.Amount", "loan.InterestRate", "loan.Term", "loan.LTV", "loan.ApplicantIncome" },
                    functions = new[] { "CalculateEMI(loan.Amount, loan.InterestRate, loan.Term)", "CheckLoanEligibility(loan)", "AssessRisk(loan)" }
                },
                _ => new
                {
                    variables = new[] { "customer.Age", "account.Balance", "transaction.Amount" },
                    functions = new[] { "ValidateAge()", "CheckBalance()", "CalculateAmount()" }
                }
            };

            return Ok(suggestions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting context suggestions");
            return StatusCode(500, new { error = "Failed to get context suggestions" });
        }
    }

    private string FormatChatResponse(AIExpressionResponse aiResponse, string originalMessage)
    {
        // Handle different types of user messages
        if (originalMessage.ToLower().Contains("age") || originalMessage.ToLower().Contains("minimum age"))
        {
            return $"🎯 {aiResponse.Explanation}\n\n**Suggested Expression:**\n```\n{aiResponse.SuggestedExpression}\n```\n\nThis expression helps validate customer age requirements for banking services.";
        }
        
        if (originalMessage.ToLower().Contains("loan") || originalMessage.ToLower().Contains("credit"))
        {
            return $"💰 {aiResponse.Explanation}\n\n**Recommended Expression:**\n```\n{aiResponse.SuggestedExpression}\n```\n\nThis evaluates loan eligibility based on multiple banking criteria.";
        }
        
        if (originalMessage.ToLower().Contains("balance") || originalMessage.ToLower().Contains("account"))
        {
            return $"🏦 {aiResponse.Explanation}\n\n**Expression:**\n```\n{aiResponse.SuggestedExpression}\n```\n\nThis handles account balance validation and requirements.";
        }

        // Default response format
        if (!string.IsNullOrEmpty(aiResponse.SuggestedExpression))
        {
            return $"{aiResponse.Explanation}\n\n**Suggested Expression:**\n```\n{aiResponse.SuggestedExpression}\n```";
        }

        return aiResponse.Explanation;
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
}
