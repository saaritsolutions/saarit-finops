using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace ExpressionBuilderService.AI;

/// <summary>
/// Configuration for OpenAI GPT (nano) endpoint.
/// </summary>
public class OpenAISettings
{
    public const string SectionName = "OpenAI";
    public string BaseUrl { get; set; } = "https://api.openai.com/v1";
    public string Model { get; set; } = "gpt-5-nano";
    public string? ApiKey { get; set; }
    public int MaxTokens { get; set; } = 512;
    public double Temperature { get; set; } = 0.7;
    public int RequestTimeoutSeconds { get; set; } = 60;
}

/// <summary>
/// Service that talks to OpenAI Chat Completions for GPT nano.
/// Reuses OpenAIChatRequest/Response types declared in the same assembly/namespace.
/// </summary>
public class OpenAIGptService : ILLMService
{
    private readonly HttpClient _httpClient;
    private readonly OpenAISettings _settings;
    private readonly ILogger<OpenAIGptService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const string SYSTEM_PROMPT = @"You are a banking rule engine that outputs Roslyn-parsable C# expressions only.

DOMAIN ENTITIES:
- customer: age (alias: age), monthlyIncome (alias: monthlyIncome), creditScore, debtToIncomeRatio (alias: debtToIncomeRatio), hasDefaultHistory (alias: HasDefaultHistory)
- loan: RequestedAmount, InterestRate, TenureMonths, DebtToIncomeRatio, LoanType

FUNCTIONS (call as banking.* in code generation context; output can omit prefix):
- CalculateEMI(principal, annualRatePercent, months)
- Percentage(value, percent)
- CalculateLTV(loanAmount, collateralValue)

OUTPUT RULES:
- When asked for an expression, output EXACTLY one single-line expression (<= 140 chars) with no quotes, markdown, or extra text.
- Prefer entity-qualified identifiers like customer.age, loan.TenureMonths, etc.
- Do not include comments, labels, JSON, or fences. Return only the expression line.";

    public OpenAIGptService(HttpClient httpClient, IOptions<OpenAISettings> settings, ILogger<OpenAIGptService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;

        if (_httpClient.BaseAddress == null && Uri.TryCreate(_settings.BaseUrl.TrimEnd('/'), UriKind.Absolute, out var baseUri))
        {
            _httpClient.BaseAddress = baseUri;
        }
        try { _httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(30, _settings.RequestTimeoutSeconds)); } catch { }
        if (!string.IsNullOrWhiteSpace(_settings.ApiKey) && !_httpClient.DefaultRequestHeaders.Contains("Authorization"))
        {
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
        }
    }

    public async Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var content = await SendChatAsync(BuildExpressionPrompt(request), preferJson:false);
            sw.Stop();
            return new AIExpressionResponse
            {
                Explanation = content,
                SuggestedExpression = ExtractLikelyExpression(content),
                Confidence = "low",
                IsValid = true
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "OpenAI GenerateExpression failed after {Ms}ms", sw.ElapsedMilliseconds);
            return new AIExpressionResponse
            {
                Explanation = "OpenAI unavailable; fallback expression provided.",
                SuggestedExpression = "customer.Age >= 18 AND account.Balance >= 1000",
                Confidence = "low",
                IsValid = true,
                ValidationWarnings = new List<string> { "OpenAI offline, quota, or model unavailable" }
            };
        }
    }

    public async Task<string> ExplainExpressionAsync(string expression)
    {
        try
        {
            return await SendChatAsync($"Explain the following banking rule succinctly and clearly.\nRule: {expression}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI ExplainExpression failed");
            return "Explanation unavailable (OpenAI).";
        }
    }

    public async Task<List<string>> SuggestImprovementsAsync(string expression, string context)
    {
        try
        {
            var raw = await SendChatAsync($"Suggest 3 specific, actionable improvements to this rule for robustness, clarity, or compliance. Return a simple numbered list.\nContext: {context}\nRule: {expression}");
            return raw.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrWhiteSpace(l)).Take(5).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenAI SuggestImprovements failed");
            return new List<string> { "OpenAI unavailable for suggestions." };
        }
    }

    private string BuildExpressionPrompt(AIExpressionRequest req)
    {
        var sb = new StringBuilder();
        // System prompt is provided as a system role message; here we build the user content only
        sb.AppendLine("User request: " + req.UserPrompt);
        if (!string.IsNullOrWhiteSpace(req.Context)) sb.AppendLine("Context: " + req.Context);
        if (req.ExampleExpressions?.Any() == true)
        {
            sb.AppendLine("Examples:");
            foreach (var ex in req.ExampleExpressions) sb.AppendLine(ex);
        }
        sb.AppendLine();
        if (req.UserPrompt.ToLowerInvariant().Contains("expression only"))
        {
            sb.AppendLine("STRICT OUTPUT FORMAT INSTRUCTIONS:");
            sb.AppendLine("Return EXACTLY one line containing ONLY the final executable banking rule expression.");
            sb.AppendLine("Do NOT include:");
            sb.AppendLine("- Explanations");
            sb.AppendLine("- Extra lines or blank lines");
            sb.AppendLine("- Code fences, markdown, quotes, JSON, labels, or commentary");
            sb.AppendLine("- Prefixes like 'Expression:'");
            sb.AppendLine("HARD LENGTH LIMIT: The single-line expression must be <= 140 characters.");
            sb.AppendLine("Do not wrap in quotes. Do not add trailing period.");
            sb.AppendLine("If you cannot determine an answer, return: customer.Age >= 18 AND account.Balance >= 1000");
        }
        else
        {
            sb.AppendLine("Return first a single best expression on one line (<= 140 characters), then a short explanation (<= 30 words).");
        }
        return sb.ToString();
    }

    private string ExtractLikelyExpression(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return string.Empty;
        foreach (var line in content.Split('\n'))
        {
            var l = line.Trim();
            if (l.Contains("customer.") || l.Contains("account.") || l.Contains("loan."))
            {
                l = l.Trim('`');
                return l;
            }
        }
        return content.Split('\n').FirstOrDefault()?.Trim() ?? string.Empty;
    }

    private async Task<string> SendChatAsync(string userPrompt, bool preferJson = false)
    {
        var expressionOnly = userPrompt.ToLowerInvariant().Contains("expression only");
        var req = new OpenAIChatRequest
        {
            Model = _settings.Model,
            Temperature = _settings.Temperature,
            MaxTokens = expressionOnly ? Math.Min(64, _settings.MaxTokens) : _settings.MaxTokens,
            Messages = new List<OpenAIChatMessage>
            {
                new() { Role = "system", Content = SYSTEM_PROMPT },
                new() { Role = "user", Content = userPrompt }
            },
            ResponseFormat = preferJson ? new OpenAIResponseFormat { Type = "json_object" } : null
        };

        var json = JsonSerializer.Serialize(req, JsonOpts);
        using var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(30, _settings.RequestTimeoutSeconds)));
        var url = _httpClient.BaseAddress != null && _httpClient.BaseAddress.ToString().EndsWith("/")
            ? "chat/completions" : "chat/completions";

        var resp = await _httpClient.PostAsync(url, httpContent, cts.Token);
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("OpenAI non-success {Code}: {Snippet}", resp.StatusCode, body.Length > 200 ? body[..200] : body);
            throw new HttpRequestException($"OpenAI error: {resp.StatusCode}");
        }
        try
        {
            var parsed = JsonSerializer.Deserialize<OpenAIChatResponse>(body, JsonOpts);
            var text = parsed?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Empty model response");
            // If JSON object was requested, try to extract a single string property value that looks like an expression
            if (preferJson && (text.StartsWith("{") || text.Contains("\"")))
            {
                try
                {
                    using var doc = JsonDocument.Parse(text);
                    // pick the first string value
                    foreach (var prop in doc.RootElement.EnumerateObject())
                    {
                        if (prop.Value.ValueKind == JsonValueKind.String)
                        {
                            var val = prop.Value.GetString()?.Trim();
                            if (!string.IsNullOrWhiteSpace(val)) return val!;
                        }
                    }
                }
                catch { /* fallthrough */ }
            }
            return text;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse OpenAI JSON, returning raw body snippet");
            return body;
        }
    }
}
