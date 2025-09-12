using Microsoft.AspNetCore.Mvc;
using ExpressionBuilderService.AI;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIGeminiController : ControllerBase
{
    private readonly IGeminiAIService _gemini;
    private readonly ILogger<AIGeminiController> _logger;

    public AIGeminiController(IGeminiAIService gemini, ILogger<AIGeminiController> logger)
    {
        _gemini = gemini;
        _logger = logger;
    }

    public class GeminiChatRequest
    {
        public string Message { get; set; } = string.Empty;
        public bool ExpressionMode { get; set; } = false; // if true wrap similar to expression generation
    }

    [HttpPost("chat")] // POST api/aigemini/chat
    public async Task<IActionResult> Chat([FromBody] GeminiChatRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest("Message required");
        _logger.LogInformation("Gemini chat request (exprMode={ExprMode}): {Msg}", req.ExpressionMode, req.Message);
        if (!req.ExpressionMode)
        {
            var raw = await _gemini.ChatAsync(req.Message, ct);
            return Ok(new { provider = "gemini", mode = "chat", output = raw });
        }
        var exprResp = await _gemini.GenerateExpressionAsync(new AIExpressionRequest { UserPrompt = req.Message });
        return Ok(new { provider = "gemini", mode = "expression", response = exprResp });
    }

    [HttpGet("ping")] // GET api/aigemini/ping
    public IActionResult Ping() => Ok(new { provider = "gemini", status = "ok" });
}
