using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace ExpressionBuilderService.AI;

/// <summary>
/// Configuration for locally hosted / self-hosted OpenAI-compatible GPT OSS endpoint.
/// </summary>
public class GptOssSettings
{
    public const string SectionName = "GptOssAI";
    public string BaseUrl { get; set; } = "http://localhost:11434/api"; // e.g. LocalAI, llama.cpp server, vLLM, Ollama OpenAI compatibility proxy
    public string Model { get; set; } = "gpt-oss"; // local model name
    public string? ApiKey { get; set; } // optional (some local servers ignore)
    public int MaxTokens { get; set; } = 512;
    public double Temperature { get; set; } = 0.7;
    public int RequestTimeoutSeconds { get; set; } = 120; // local models can be slow
}

/// <summary>
/// Minimal OpenAI Chat Completions request format (subset) for OSS providers.
/// </summary>
internal class OpenAIChatRequest
{
    [JsonPropertyName("model")] public string Model { get; set; } = string.Empty;
    [JsonPropertyName("messages")] public List<OpenAIChatMessage> Messages { get; set; } = new();
    [JsonPropertyName("temperature")] public double Temperature { get; set; }
    = 0.7;
    [JsonPropertyName("max_tokens")] public int MaxTokens { get; set; } = 256;
    // Optional: OpenAI-specific structured output
    [JsonPropertyName("response_format")] public OpenAIResponseFormat? ResponseFormat { get; set; }
}

internal class OpenAIChatMessage
{
    [JsonPropertyName("role")] public string Role { get; set; } = "user";
    [JsonPropertyName("content")] public string Content { get; set; } = string.Empty;
}

internal class OpenAIChatResponse
{
    [JsonPropertyName("choices")] public List<OpenAIChatChoice> Choices { get; set; } = new();
}

internal class OpenAIChatChoice
{
    [JsonPropertyName("message")] public OpenAIChatMessage Message { get; set; } = new();
    [JsonPropertyName("finish_reason")] public string? FinishReason { get; set; }
        = string.Empty;
}

internal class OpenAIResponseFormat
{
    [JsonPropertyName("type")] public string Type { get; set; } = string.Empty; // e.g., "json_object"
}

/// <summary>
/// Service that talks to a self / locally hosted OpenAI compatible endpoint.
/// Implements ILLMService so it can be selected by existing controller logic.
/// </summary>
public class GptOssAIService : ILLMService
{
    private readonly HttpClient _httpClient;
    private readonly GptOssSettings _settings;
    private readonly ILogger<GptOssAIService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const string SYSTEM_PROMPT = "You are a concise banking rules assistant. Produce clear, executable rule expressions when asked. If user wants explanation, be brief.";

    public GptOssAIService(HttpClient httpClient, IOptions<GptOssSettings> settings, ILogger<GptOssAIService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _logger = logger;

        // Ensure base address (avoid overriding if already set by caller)
        if (_httpClient.BaseAddress == null && Uri.TryCreate(_settings.BaseUrl.TrimEnd('/'), UriKind.Absolute, out var baseUri))
        {
            _httpClient.BaseAddress = baseUri;
        }
        // Adjust timeout for slow local models
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
            var content = await SendChatAsync(BuildExpressionPrompt(request));
            sw.Stop();
            return new AIExpressionResponse
            {
                Explanation = content,
                SuggestedExpression = ExtractLikelyExpression(content),
                Confidence = "low", // heuristically low until we add validation
                IsValid = true
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "GPT OSS GenerateExpression failed after {Ms}ms", sw.ElapsedMilliseconds);
            return new AIExpressionResponse
            {
                Explanation = "Local model unavailable; fallback expression provided.",
                SuggestedExpression = "customer.Age >= 18 AND account.Balance >= 1000",
                Confidence = "low",
                IsValid = true,
                ValidationWarnings = new List<string> { "GPT OSS offline or slow" }
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
            _logger.LogWarning(ex, "GPT OSS ExplainExpression failed");
            return "Explanation unavailable (local model).";
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
            _logger.LogWarning(ex, "GPT OSS SuggestImprovements failed");
            return new List<string> { "Local model unavailable for suggestions." };
        }
    }

    private string BuildExpressionPrompt(AIExpressionRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine(SYSTEM_PROMPT);
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
        // pick first line that has common variable tokens
        foreach (var line in content.Split('\n'))
        {
            var l = line.Trim();
            if (l.Contains("customer.") || l.Contains("account.") || l.Contains("loan."))
            {
                // strip markdown fencing if present
                l = l.Trim('`');
                return l;
            }
        }
        return content.Split('\n').FirstOrDefault()?.Trim() ?? string.Empty;
    }

    private async Task<string> SendChatAsync(string userPrompt)
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
            }
        };

        var json = JsonSerializer.Serialize(req, JsonOpts);
        using var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(30, _settings.RequestTimeoutSeconds)));
        var url = _httpClient.BaseAddress != null && _httpClient.BaseAddress.ToString().EndsWith("/")
            ? "chat/completions" : "chat/completions"; // relative path

        var resp = await _httpClient.PostAsync(url, httpContent, cts.Token);
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("GPT OSS non-success {Code}: {Snippet}", resp.StatusCode, body.Length > 200 ? body[..200] : body);
            throw new HttpRequestException($"GPT OSS error: {resp.StatusCode}");
        }
        try
        {
            var parsed = JsonSerializer.Deserialize<OpenAIChatResponse>(body, JsonOpts);
            var text = parsed?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("Empty model response");
            return text;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse GPT OSS JSON, returning raw body snippet");
            return body;
        }
    }
}
