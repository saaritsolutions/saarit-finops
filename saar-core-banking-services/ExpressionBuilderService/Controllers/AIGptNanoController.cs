using Microsoft.AspNetCore.Mvc;
using ExpressionBuilderService.AI;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIGptNanoController : ControllerBase
{
    private readonly OpenAIGptService _service;
    private readonly ILogger<AIGptNanoController> _logger;

    public AIGptNanoController(OpenAIGptService service, ILogger<AIGptNanoController> logger)
    {
        _service = service;
        _logger = logger;
    }

    public class ChatTestRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? Context { get; set; }
        public bool ExpressionMode { get; set; } = true;
    public string? Entity { get; set; } // optional: Customer or Loan
    }

    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok(new { provider = "openai", model = "gpt-nano", status = "ok" });
    }

    [HttpPost("chat")] // POST api/aigptnano/chat
    public async Task<IActionResult> Chat([FromBody] ChatTestRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest("Message required");
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            if (!req.ExpressionMode)
            {
                var text = await _service.ExplainExpressionAsync(req.Message);
                sw.Stop();
                return Ok(new { provider = "openai", mode = "chat", durationMs = sw.ElapsedMilliseconds, output = text });
            }
            // Build contextual hints for entities and functions
            var ctx = string.IsNullOrWhiteSpace(req.Context) ? BuildDefaultContext(req.Entity) : req.Context + "\n" + BuildDefaultContext(req.Entity);
            var aiResp = await _service.GenerateExpressionAsync(new AIExpressionRequest
            {
                UserPrompt = req.Message + " expression only",
                Context = ctx
            });
            sw.Stop();
            // Return ONLY the single-line expression as plain text
            var expr = (aiResp.SuggestedExpression ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(expr)) return StatusCode(502, "Expression generation failed");
            return Content(expr, "text/plain");
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "OpenAI nano chat failed");
            return StatusCode(502, new
            {
                provider = "openai",
                durationMs = sw.ElapsedMilliseconds,
                error = ex.Message
            });
        }
    }

    private static string BuildDefaultContext(string? entity)
    {
        var baseCtx = @"Entities and fields:
- customer: age, monthlyIncome, creditScore, debtToIncomeRatio, HasDefaultHistory
- loan: RequestedAmount, InterestRate, TenureMonths, DebtToIncomeRatio, LoanType

Functions available (use conceptually, output can omit prefix):
- CalculateEMI(principal, annualRatePercent, months)
- Percentage(value, percent)
- CalculateLTV(loanAmount, collateralValue)

Constraints:
- Output ONLY a single C# expression in one line (<= 140 chars)
- Use customer.* or loan.* identifiers; no quotes, JSON, or extra text";
        if (string.IsNullOrWhiteSpace(entity)) return baseCtx;
        return baseCtx + "\nFocus entity: " + entity;
    }
}
