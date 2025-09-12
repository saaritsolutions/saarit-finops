using Microsoft.AspNetCore.Mvc;
using ExpressionBuilderService.AI;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIOllamaController : ControllerBase
{
    private readonly OllamaAIService _ollama;
    private readonly ILogger<AIOllamaController> _logger;

    public AIOllamaController(OllamaAIService ollama, ILogger<AIOllamaController> logger)
    {
        _ollama = ollama;
        _logger = logger;
    }

    public class OllamaChatRequest
    {
        public string Message { get; set; } = string.Empty;
        public bool ExpressionMode { get; set; } = false;
        public string? Context { get; set; }
    }

    [HttpGet("ping")]
    public IActionResult Ping() => Ok(new { provider = "ollama", status = "ok" });

    [HttpPost("chat")] // POST api/aiollama/chat
    public async Task<IActionResult> Chat([FromBody] OllamaChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest("Message required");
        _logger.LogInformation("Ollama chat request (exprMode={ExprMode}): {Msg}", req.ExpressionMode, req.Message);
        if (!req.ExpressionMode)
        {
            var raw = await _ollama.ExplainExpressionAsync(req.Message); // lightweight response path
            return Ok(new { provider = "ollama", mode = "chat", output = raw });
        }
        var ai = await _ollama.GenerateExpressionAsync(new AIExpressionRequest
        {
            // Append trigger phrase so the service enforces strict one-line expression output
            UserPrompt = req.Message + " expression only",
            Context = req.Context
        });
        return Ok(new { provider = "ollama", mode = "expression", response = ai });
    }
}
