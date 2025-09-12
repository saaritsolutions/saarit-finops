using Microsoft.AspNetCore.Mvc;
using ExpressionBuilderService.AI;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIGptOssController : ControllerBase
{
    private readonly GptOssAIService _service;
    private readonly ILogger<AIGptOssController> _logger;

    public AIGptOssController(GptOssAIService service, ILogger<AIGptOssController> logger)
    {
        _service = service;
        _logger = logger;
    }

    public class ChatTestRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? Context { get; set; }
        public bool ExpressionMode { get; set; } = true; // default to expression generation
    }

    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok(new { provider = "gpt-oss", status = "ok" });
    }

    [HttpPost("chat")] // POST api/aigptoss/chat
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
                return Ok(new { provider = "gpt-oss", mode = "chat", durationMs = sw.ElapsedMilliseconds, output = text });
            }
            var aiResp = await _service.GenerateExpressionAsync(new AIExpressionRequest
            {
                // Append trigger to enforce strict one-line expression
                UserPrompt = req.Message + " expression only",
                Context = req.Context
            });
            sw.Stop();
            return Ok(new
            {
                provider = "gpt-oss",
                durationMs = sw.ElapsedMilliseconds,
                mode = "expression",
                output = new
                {
                    aiResp.SuggestedExpression,
                    aiResp.Explanation,
                    aiResp.Confidence,
                    aiResp.ValidationWarnings
                }
            });
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "GPT OSS chat failed");
            return StatusCode(502, new
            {
                provider = "gpt-oss",
                durationMs = sw.ElapsedMilliseconds,
                error = ex.Message
            });
        }
    }
}
