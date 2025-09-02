using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ExpressionBuilderService.AI;

/// <summary>
/// Configuration settings for Google Gemini AI integration
/// </summary>
public class GeminiAISettings
{
    public const string SectionName = "GeminiAI";
    
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-pro";
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com";
    public int MaxTokens { get; set; } = 1000;
    public double Temperature { get; set; } = 0.7;
    public double TopP { get; set; } = 0.9;
    public int TopK { get; set; } = 40;
}

/// <summary>
/// Request model for Gemini AI
/// </summary>
public class GeminiRequest
{
    public List<Content> contents { get; set; } = new();
    public GenerationConfig generationConfig { get; set; } = new();
}

public class Content
{
    public List<Part> parts { get; set; } = new();
}

public class Part
{
    public string text { get; set; } = string.Empty;
}

public class GenerationConfig
{
    public double temperature { get; set; }
    public int maxOutputTokens { get; set; }
    public double topP { get; set; }
    public int topK { get; set; }
    public List<string> stopSequences { get; set; } = new();
}

/// <summary>
/// Response model for Gemini AI
/// </summary>
public class GeminiResponse
{
    public List<Candidate> candidates { get; set; } = new();
}

public class Candidate
{
    public Content content { get; set; } = new();
    public string finishReason { get; set; } = string.Empty;
}

/// <summary>
/// AI Expression Builder request model
/// </summary>
public class AIExpressionRequest
{
    public string UserPrompt { get; set; } = string.Empty;
    public string? Context { get; set; }
    public List<string>? ExampleExpressions { get; set; }
    public string? Domain { get; set; } = "banking";
}

/// <summary>
/// AI Expression Builder response model
/// </summary>
public class AIExpressionResponse
{
    public string Explanation { get; set; } = string.Empty;
    public string SuggestedExpression { get; set; } = string.Empty;
    public List<string> AlternativeExpressions { get; set; } = new();
    public List<string> RequiredVariables { get; set; } = new();
    public string Confidence { get; set; } = "medium";
    public bool IsValid { get; set; } = true;
    public List<string> ValidationWarnings { get; set; } = new();
}

/// <summary>
/// Google Gemini AI integration service for banking expression generation
/// </summary>
public interface IGeminiAIService
{
    Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request);
    Task<string> ExplainExpressionAsync(string expression);
    Task<List<string>> SuggestImprovementsAsync(string expression, string context);
    // Generate a JSON form schema string (sanitized) based on request; may return null on failure
    Task<string?> GenerateFormSchemaAsync(AIExpressionRequest request, string? currentSchemaJson = null);
}

// Backwards-compatible: GeminiAIService now implements the generic ILLMService via IGeminiAIService
public class GeminiAIService : ILLMService, IGeminiAIService
{
    private readonly HttpClient _httpClient;
    private readonly GeminiAISettings _settings;
    private readonly ILogger<GeminiAIService> _logger;

    private const string BANKING_SYSTEM_PROMPT = @"
You are an expert banking expression builder AI assistant. Your role is to help create, explain, and improve banking business rule expressions.

CONTEXT:
- You work with banking domain entities like customers, accounts, transactions, loans
- Available functions: CalculateInterest, IsTransactionValid, CheckCreditScore, ValidateAge, etc.
- Variables use dot notation: customer.Age, account.Balance, transaction.Amount
- Operators: =, !=, >, <, >=, <=, AND, OR, NOT
- Return formats: boolean conditions, calculated values, or status strings

BANKING DOMAINS:
- Customer onboarding and KYC validation
- Account opening and maintenance rules
- Transaction processing and limits  
- Loan eligibility and underwriting
- Risk assessment and fraud detection
- Compliance and regulatory checks

RESPONSE FORMAT:
Always respond with practical, executable banking expressions using proper syntax and banking terminology.
Be concise but thorough in explanations. Suggest alternatives when appropriate.
";

    public GeminiAIService(HttpClient httpClient, IOptions<GeminiAISettings> settings, ILogger<GeminiAIService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request)
    {
        try
        {
            var prompt = BuildExpressionGenerationPrompt(request);
            var geminiResponse = await CallGeminiAPI(prompt);
            
            return ParseExpressionResponse(geminiResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating expression with Gemini AI");
            return new AIExpressionResponse
            {
                Explanation = "Unable to generate AI response at the moment. Please try a manual expression.",
                IsValid = false,
                ValidationWarnings = new List<string> { "AI service temporarily unavailable" }
            };
        }
    }

    // New: generate a JSON form schema string only. Attempts to coerce/sanitize output to first JSON object found.
    public async Task<string?> GenerateFormSchemaAsync(AIExpressionRequest request, string? currentSchemaJson = null)
    {
        try
        {
            var prompt = BuildFormSchemaPrompt(request, currentSchemaJson);
            var geminiResponse = await CallGeminiAPI(prompt);
            var text = ExtractTextFromResponse(geminiResponse);
            _logger.LogInformation("Gemini returned text for form schema: {TextShort}", text?.Substring(0, Math.Min(200, text?.Length ?? 0)));
            var json = ExtractFirstJsonObject(text);
            if (!string.IsNullOrWhiteSpace(json))
            {
                _logger.LogInformation("Extracted JSON schema from Gemini response (len={Len})", json.Length);
                return json;
            }

            _logger.LogWarning("No JSON object extracted from Gemini response; falling back to simple parser.");

            // Lightweight fallback: try to parse simple field:list patterns from the user's prompt
            var fallback = BuildSimpleSchemaFromPrompt(request.UserPrompt);
            _logger.LogInformation("Fallback schema generated (len={Len})", fallback.Length);
            return fallback;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating form schema with Gemini AI");
            return null;
        }
    }

    // Very small heuristic parser to create a JSON schema from the user's prompt when LLM isn't available.
    private string BuildSimpleSchemaFromPrompt(string prompt)
    {
        try
        {
            // Look for patterns like: name (type), age (number), email (string)
            var fields = new List<Dictionary<string, object>>();
            var parts = prompt.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                var p = part.Trim();
                // match 'fieldName (type)'
                var idx = p.IndexOf('(');
                if (idx > 0 && p.Contains(')'))
                {
                    var name = p.Substring(0, idx).Trim();
                    var type = p.Substring(idx + 1, p.IndexOf(')') - idx - 1).Trim();
                    // sanitize
                    name = name.Replace(" ", "").Replace("-", "_").Replace("'", "");
                    var field = new Dictionary<string, object>
                    {
                        { "name", name },
                        { "label", System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(name) },
                        { "type", type.ToLower() },
                        { "required", false }
                    };
                    fields.Add(field);
                }
            }

            if (fields.Count == 0)
            {
                // Generic fallback fields
                fields.Add(new Dictionary<string, object> { { "name", "firstName" }, { "label", "First Name" }, { "type", "string" }, { "required", true } });
                fields.Add(new Dictionary<string, object> { { "name", "age" }, { "label", "Age" }, { "type", "number" }, { "required", true } });
                fields.Add(new Dictionary<string, object> { { "name", "email" }, { "label", "Email" }, { "type", "string" }, { "required", false } });
            }

            var obj = new Dictionary<string, object>
            {
                { "entityName", "GeneratedForm" },
                { "title", "Generated Form" },
                { "fields", fields }
            };

            return JsonSerializer.Serialize(obj, new JsonSerializerOptions { WriteIndented = false });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fallback schema builder failed");
            return "{}";
        }
    }

    public async Task<string> ExplainExpressionAsync(string expression)
    {
        try
        {
            var prompt = $@"{BANKING_SYSTEM_PROMPT}

TASK: Explain this banking expression in simple terms:
Expression: {expression}

Provide a clear, business-friendly explanation of what this expression does, when it would be used, and what the expected outcome is.";

            var response = await CallGeminiAPI(prompt);
            return ExtractTextFromResponse(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error explaining expression with Gemini AI");
            return "Unable to provide AI explanation at the moment.";
        }
    }

    public async Task<List<string>> SuggestImprovementsAsync(string expression, string context)
    {
        try
        {
            var prompt = $@"{BANKING_SYSTEM_PROMPT}

TASK: Suggest improvements for this banking expression:
Expression: {expression}
Context: {context}

Provide 3-5 specific improvement suggestions focusing on:
1. Performance optimization
2. Edge case handling  
3. Compliance considerations
4. Readability enhancements
5. Risk mitigation

Format as a numbered list.";

            var response = await CallGeminiAPI(prompt);
            var text = ExtractTextFromResponse(response);
            
            return text.Split('\n')
                      .Where(line => !string.IsNullOrWhiteSpace(line))
                      .Select(line => line.Trim())
                      .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error suggesting improvements with Gemini AI");
            return new List<string> { "Unable to provide AI suggestions at the moment." };
        }
    }

    private string BuildExpressionGenerationPrompt(AIExpressionRequest request)
    {
        var prompt = new StringBuilder(BANKING_SYSTEM_PROMPT);
        
        prompt.AppendLine($@"
USER REQUEST: {request.UserPrompt}
DOMAIN: {request.Domain ?? "banking"}");

        if (!string.IsNullOrEmpty(request.Context))
        {
            prompt.AppendLine($"ADDITIONAL CONTEXT: {request.Context}");
        }

        if (request.ExampleExpressions?.Any() == true)
        {
            prompt.AppendLine("EXAMPLE EXPRESSIONS:");
            foreach (var example in request.ExampleExpressions)
            {
                prompt.AppendLine($"- {example}");
            }
        }

        prompt.AppendLine(@"
TASK: Generate a banking expression that fulfills the user's request.

RESPONSE FORMAT (return as JSON):
{
  ""explanation"": ""Clear explanation of what the expression does"",
  ""suggestedExpression"": ""The main recommended expression"",
  ""alternativeExpressions"": [""alternative 1"", ""alternative 2""],
  ""requiredVariables"": [""variable1"", ""variable2""],
  ""confidence"": ""high|medium|low"",
  ""isValid"": true,
  ""validationWarnings"": [""any warnings or considerations""]
}");

        return prompt.ToString();
    }

    private string BuildFormSchemaPrompt(AIExpressionRequest request, string? currentSchema)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are a forms generation assistant. Return ONLY a single JSON object which represents the form schema. Do NOT include any explanation, markdown, or surrounding text. If you cannot produce a valid JSON object, return an empty JSON object {}.");
        sb.AppendLine();
        sb.AppendLine("The JSON schema format should be:\n{\n  \"entityName\": \"Name\",\n  \"title\": \"Title\",\n  \"fields\": [ { \"name\": \"age\", \"type\": \"number\", \"label\": \"Age\", \"required\": true } ]\n}");
        sb.AppendLine();
        sb.AppendLine($"USER REQUEST: {request.UserPrompt}");
        if (!string.IsNullOrEmpty(request.Context)) sb.AppendLine($"CONTEXT: {request.Context}");
        if (!string.IsNullOrEmpty(currentSchema))
        {
            sb.AppendLine("CURRENT_SCHEMA: (if provided, the existing schema is below; modify it according to the user's request)");
            sb.AppendLine(currentSchema);
            sb.AppendLine();
            sb.AppendLine("IMPORTANT: You must decide where to place any new or modified field within the existing 'fields' array based on semantic meaning."
                          + " Preserve existing fields and their semantics. If the user's request asks to add or modify a field, insert or update that field in the most appropriate position (beginning/middle/end) rather than always appending."
                          + " Avoid creating duplicate fields: if a field with the same name exists, update its properties (type, required, validationRegex) instead of adding a second entry.");
            sb.AppendLine("If you change field order, keep it logical for a typical data-entry form (for example: identity fields, personal details, contact info, identifiers).\n");
        }
        sb.AppendLine();
    sb.AppendLine("REMEMBER: Output must be a single JSON object only. No prose, no markdown, no backticks.");
    sb.AppendLine("If CURRENT_SCHEMA is provided, return the modified schema JSON object with the requested changes applied (for example, adding a mandatory field). Do not invent unrelated fields.");
        return sb.ToString();
    }

    private async Task<GeminiResponse> CallGeminiAPI(string prompt)
    {
        var request = new GeminiRequest
        {
            contents = new List<Content>
            {
                new Content
                {
                    parts = new List<Part>
                    {
                        new Part { text = prompt }
                    }
                }
            },
            generationConfig = new GenerationConfig
            {
                temperature = _settings.Temperature,
                maxOutputTokens = _settings.MaxTokens,
                topP = _settings.TopP,
                topK = _settings.TopK
            }
        };

        var json = JsonSerializer.Serialize(request, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        var url = $"{_settings.BaseUrl}/v1beta/models/{_settings.Model}:generateContent?key={_settings.ApiKey}";
        
        // Set a reasonable timeout for the HTTP request
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var response = await _httpClient.PostAsync(url, content, cts.Token);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            _logger.LogError("Gemini API error: {StatusCode} - {Content}", response.StatusCode, errorContent);
            throw new HttpRequestException($"Gemini API error: {response.StatusCode}");
        }

        var responseJson = await response.Content.ReadAsStringAsync();
        // Log raw response for debugging; be careful about sensitive data in production
        _logger.LogInformation("Raw Gemini response (truncated 200 chars): {Response}", responseJson?.Substring(0, Math.Min(200, responseJson?.Length ?? 0)));
        var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseJson, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        return geminiResponse ?? throw new InvalidOperationException("Invalid response from Gemini API");
    }

    private AIExpressionResponse ParseExpressionResponse(GeminiResponse geminiResponse)
    {
        try
        {
            var text = ExtractTextFromResponse(geminiResponse);
            
            // Try to parse as JSON first
            if (text.Contains("{") && text.Contains("}"))
            {
                var jsonStart = text.IndexOf('{');
                var jsonEnd = text.LastIndexOf('}') + 1;
                var jsonText = text.Substring(jsonStart, jsonEnd - jsonStart);
                
                var parsed = JsonSerializer.Deserialize<AIExpressionResponse>(jsonText, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                
                if (parsed != null)
                {
                    return parsed;
                }
            }
            
            // Fallback: parse as plain text
            return new AIExpressionResponse
            {
                Explanation = text,
                SuggestedExpression = ExtractExpressionFromText(text),
                IsValid = true,
                Confidence = "medium"
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error parsing Gemini response, using fallback");
            
            return new AIExpressionResponse
            {
                Explanation = ExtractTextFromResponse(geminiResponse),
                IsValid = true,
                Confidence = "low"
            };
        }
    }

    // Extracts the first JSON object from a text blob. Returns null if not found.
    private string? ExtractFirstJsonObject(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var start = text.IndexOf('{');
        if (start == -1) return null;

        int depth = 0;
        for (int i = start; i < text.Length; i++)
        {
            if (text[i] == '{') depth++;
            else if (text[i] == '}') depth--;

            if (depth == 0)
            {
                var json = text.Substring(start, i - start + 1).Trim();
                // quick validation
                try
                {
                    using var doc = JsonDocument.Parse(json);
                    return json;
                }
                catch { return null; }
            }
        }

        return null;
    }

    private string ExtractTextFromResponse(GeminiResponse response)
    {
        return response.candidates.FirstOrDefault()?.content.parts.FirstOrDefault()?.text ?? "No response generated";
    }

    private string ExtractExpressionFromText(string text)
    {
        // Simple heuristic to extract expression-like text
        var lines = text.Split('\n');
        foreach (var line in lines)
        {
            if (line.Contains("IF") || line.Contains("customer.") || line.Contains("account.") || line.Contains("transaction."))
            {
                return line.Trim();
            }
        }
        
        return text.Split('\n').FirstOrDefault(l => !string.IsNullOrWhiteSpace(l))?.Trim() ?? "";
    }
}
