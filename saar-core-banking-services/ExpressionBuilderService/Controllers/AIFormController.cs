using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using ExpressionBuilderService.AI;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIFormController : ControllerBase
{
    private readonly ILogger<AIFormController> _logger;
    private readonly IWebHostEnvironment _env;
    private readonly ILlmSelectorService _llmSelector;

    public AIFormController(ILogger<AIFormController> logger, IWebHostEnvironment env, ILlmSelectorService llmSelector)
    {
        _logger = logger;
        _env = env;
        _llmSelector = llmSelector;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> ChatForm([FromBody] AIFormRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Message)) return BadRequest("Message cannot be empty");

            _logger.LogInformation("Form chat request: {Message} (formOnly={FormOnly}) CurrentSchema: {CurrentSchema}", request.Message, request.FormOnly, request.CurrentSchemaJson);
            // Log the bound request payload so we can see incoming flags (use Information so it appears in default logs)
            _logger.LogInformation("Bound AIFormRequest: {RequestJson}", System.Text.Json.JsonSerializer.Serialize(request));

            // Basic deterministic handling for the demo Aadhar prompt
            var lower = request.Message.ToLower();
            if (lower.Contains("aadhar") || lower.Contains("aadhaar") || lower.Contains("aadhar number"))
            {
                var field = new SuggestedField
                {
                    Name = "aadharNumber",
                    Label = "Aadhar Number",
                    Type = "text",
                    Required = true,
                    ValidationRegex = "^[0-9]{12}$",
                    MaxLength = 12,
                    Description = "12-digit Aadhar number as per regulation"
                };

                var schema = new { fields = new[] { field } };
                var resp = new AIFormResponse
                {
                    Explanation = "Adds a mandatory 12-digit Aadhar number field to the loan form.",
                    SuggestedFields = new System.Collections.Generic.List<SuggestedField> { field },
                    SchemaJson = JsonSerializer.Serialize(schema),
                    Confidence = "high",
                    IsValid = true,
                    Transcript = request.Message
                };

                return Ok(resp);
            }

            // If caller asked for JSON-only form, call the LLM and return sanitized schema
            if (request.FormOnly)
            {
                // Build a lightweight expression request to the LLM
                var aiReq = new ExpressionBuilderService.AI.AIExpressionRequest
                {
                    UserPrompt = $"Generate a JSON form schema based on this request: {request.Message}. Current schema context: {request.CurrentSchemaJson}",
                    Context = "form_generation"
                };

                var aiProvider = _llmSelector.GetProvider();
                var response = await aiProvider.GenerateExpressionAsync(aiReq);
                var json = response?.Explanation ?? response?.SuggestedExpression ?? "{}";

                if (string.IsNullOrWhiteSpace(json) || json == "{}")
                {
                    _logger.LogWarning("AI returned no valid JSON for form-only request. Raw transcript: {Transcript}", request.Message);
                    // Return an empty JSON object to indicate no schema could be generated
                    return Content("{}", "application/json");
                }

                // Return the raw JSON schema directly (LLM output is sanitized by the AI service)
                return Content(json, "application/json");
            }

            // Generic reply for interactive/demo
            return Ok(new AIFormResponse
            {
                Explanation = "I can help add or modify form fields. Try: 'Add mandatory field aadharNumber (12 digits)'.",
                IsValid = false,
                Confidence = "low",
                Transcript = request.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Form chat");
            return StatusCode(500, new { error = "Error processing form chat" });
        }
    }

    // Apply suggested schema (demo-only: persist to local file in data/last-applied-form.json)
    [HttpPost("apply")]
    public async Task<IActionResult> ApplySuggestion([FromBody] AIFormResponse suggestion)
    {
        try
        {
            var dataDir = Path.Combine(_env.ContentRootPath, "data");
            if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);

            var file = Path.Combine(dataDir, "last-applied-form.json");
            await System.IO.File.WriteAllTextAsync(file, suggestion.SchemaJson ?? JsonSerializer.Serialize(suggestion));

            // Simple audit: write transcript
            var auditFile = Path.Combine(dataDir, "last-applied-form-audit.txt");
            await System.IO.File.WriteAllTextAsync(auditFile, $"AppliedAt: {DateTime.UtcNow}\nTranscript:\n{suggestion.Transcript}\n");

            return Ok(new { success = true, file = file });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error applying form suggestion");
            return StatusCode(500, new { error = "Unable to apply suggestion" });
        }
    }

    [HttpGet("last-applied")]
    public IActionResult GetLastApplied()
    {
        try
        {
            var dataDir = Path.Combine(_env.ContentRootPath, "data");
            var file = Path.Combine(dataDir, "last-applied-form.json");
            if (!System.IO.File.Exists(file)) return NotFound();
            var content = System.IO.File.ReadAllText(file);
            return Ok(new { schema = content });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving last applied");
            return StatusCode(500, new { error = "Unable to retrieve last applied schema" });
        }
    }
}
