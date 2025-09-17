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

            // If caller asked for JSON-only form, call the LLM and return sanitized schema
            if (request.FormOnly)
            {
                // Determine if we're modifying an existing schema or creating a new one
                bool hasExistingSchema = !string.IsNullOrWhiteSpace(request.CurrentSchemaJson) && 
                                       request.CurrentSchemaJson.Trim() != "{}" && 
                                       request.CurrentSchemaJson.Trim() != "null";

                string promptAction = hasExistingSchema ? "Modify the existing form schema" : "Generate a new JSON form schema";
                string contextInfo = hasExistingSchema ? $"EXISTING SCHEMA TO MODIFY:\n{request.CurrentSchemaJson}\n\nIMPORTANT: Return the complete modified schema with all existing fields plus the requested changes. Do not remove existing fields unless explicitly requested." : "Create a new form schema";

                // Build a comprehensive prompt for form modification/generation
                var aiReq = new ExpressionBuilderService.AI.AIExpressionRequest
                {
                    UserPrompt = $@"{promptAction} based on this request: {request.Message}

{contextInfo}

INSTRUCTIONS:
1. Return ONLY valid JSON without markdown formatting or code blocks
2. Ensure all field names use camelCase (e.g., 'firstName', not 'first_name')
3. Include appropriate validation rules where applicable
4. Maintain the existing structure and add/modify as requested
5. For new fields, include: name, label, type, required, and validation as needed

USER REQUEST: {request.Message}",
                    Context = "form_generation"
                };

                var aiProvider = _llmSelector.GetProvider();
                var response = await aiProvider.GenerateExpressionAsync(aiReq);
                var json = response?.Explanation ?? response?.SuggestedExpression ?? "{}";

                // Clean up the JSON response to remove markdown formatting if present
                json = json.Trim();
                if (json.StartsWith("```json"))
                {
                    json = json.Substring(7);
                }
                if (json.StartsWith("```"))
                {
                    json = json.Substring(3);
                }
                if (json.EndsWith("```"))
                {
                    json = json.Substring(0, json.Length - 3);
                }
                json = json.Trim();

                if (string.IsNullOrWhiteSpace(json) || json == "{}")
                {
                    _logger.LogWarning("AI returned no valid JSON for form-only request. Raw transcript: {Transcript}", request.Message);
                    // Return the existing schema if modification failed, or empty object for new schema
                    return Content(hasExistingSchema ? request.CurrentSchemaJson : "{}", "application/json");
                }

                // Validate that the returned JSON is valid
                try
                {
                    JsonDocument.Parse(json);
                    _logger.LogInformation("AI returned valid JSON schema for form request");
                }
                catch (JsonException)
                {
                    _logger.LogWarning("AI returned invalid JSON, falling back to existing schema or empty object");
                    return Content(hasExistingSchema ? request.CurrentSchemaJson : "{}", "application/json");
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
