using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExpressionBuilderService.AI;

public class OllamaSettings
{
    public const string SectionName = "OllamaAI";
    public string BaseUrl { get; set; } = "http://localhost:11434"; // default ollama host
    public string Model { get; set; } = "mistral"; // any pulled model name
    public double Temperature { get; set; } = 0.7;
    public int MaxTokens { get; set; } = 512; // guidance; Ollama may ignore
    public int RequestTimeoutSeconds { get; set; } = 120; // local models can be slow
}

internal class OllamaChatRequest
{
    [JsonPropertyName("model")] public string Model { get; set; } = string.Empty;
    [JsonPropertyName("messages")] public List<OllamaChatMessage> Messages { get; set; } = new();
    [JsonPropertyName("stream")] public bool Stream { get; set; } = false;
    // Some forks honor these optional params
    [JsonPropertyName("options")] public Dictionary<string, object> Options { get; set; } = new();
}

internal class OllamaChatMessage
{
    [JsonPropertyName("role")] public string Role { get; set; } = "user";
    [JsonPropertyName("content")] public string Content { get; set; } = string.Empty;
}

internal class OllamaChatResponse
{
    [JsonPropertyName("message")] public OllamaChatMessage? Message { get; set; }
        = new();
    [JsonPropertyName("done")] public bool Done { get; set; }
        = true;
}

/// <summary>
/// Real Ollama integration calling /api/chat.
/// </summary>
public class OllamaAIService : ILLMService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OllamaAIService> _logger;
    private readonly OllamaSettings _settings;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const string SYSTEM_PROMPT = "You are a banking rules assistant. Produce concise, executable expressions first, then a short explanation.";

    public OllamaAIService(HttpClient httpClient, IOptions<OllamaSettings> settings, ILogger<OllamaAIService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _settings = settings.Value;

        if (_httpClient.BaseAddress == null && Uri.TryCreate(_settings.BaseUrl.TrimEnd('/'), UriKind.Absolute, out var baseUri))
        {
            _httpClient.BaseAddress = baseUri;
        }
        try { _httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(30, _settings.RequestTimeoutSeconds)); } catch { }
    }

    public async Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var userPrompt = BuildExpressionPrompt(request);
            var text = await SendChatAsync(userPrompt);
            sw.Stop();
            return new AIExpressionResponse
            {
                Explanation = text,
                SuggestedExpression = ExtractExpression(text),
                Confidence = "low",
                IsValid = true
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "Ollama GenerateExpression failed after {Ms}ms", sw.ElapsedMilliseconds);
            return new AIExpressionResponse
            {
                Explanation = "Ollama unavailable; fallback expression returned.",
                SuggestedExpression = "customer.Age >= 18 AND account.Balance >= 1000",
                Confidence = "low",
                IsValid = true,
                ValidationWarnings = new List<string> { "Ollama offline or timed out" }
            };
        }
    }

    public async Task<string> ExplainExpressionAsync(string expression)
    {
        try
        {
            return await SendChatAsync($"Explain this banking rule briefly and clearly.\nRule: {expression}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama ExplainExpression failed");
            return "Explanation unavailable (Ollama).";
        }
    }

    public async Task<List<string>> SuggestImprovementsAsync(string expression, string context)
    {
        try
        {
            var raw = await SendChatAsync($"Suggest 3 improvements to this rule for clarity, edge cases, or compliance. Return a simple list.\nContext: {context}\nRule: {expression}");
            return raw.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrWhiteSpace(l)).Take(5).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Ollama SuggestImprovements failed");
            return new List<string> { "Improvements unavailable (Ollama)." };
        }
    }

    private string BuildExpressionPrompt(AIExpressionRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("User request: " + req.UserPrompt);
        if (!string.IsNullOrWhiteSpace(req.Context)) sb.AppendLine("Context: " + req.Context);
        if (req.ExampleExpressions?.Any() == true)
        {
            sb.AppendLine("Examples:");
            foreach (var e in req.ExampleExpressions) sb.AppendLine(e);
        }
        sb.AppendLine();
        if (req.UserPrompt.ToLowerInvariant().Contains("expression only"))
        {
            sb.AppendLine("STRICT OUTPUT FORMAT:");
            sb.AppendLine("Return EXACTLY one line containing ONLY the final banking rule expression.");
            sb.AppendLine("ABSOLUTELY NO: explanations, extra lines, markdown, quotes, labels, JSON, commentary, code fences.");
            sb.AppendLine("No trailing period. No surrounding backticks. No prefix.");
            sb.AppendLine("HARD LENGTH LIMIT: The single-line expression must be <= 140 characters.");
            sb.AppendLine("If uncertain, output: customer.Age >= 18 AND account.Balance >= 1000");
        }
        else
        {
            sb.AppendLine("Return FIRST line containing only the best executable expression (<= 140 chars). Then a blank line, then a short explanation (<= 30 words).");
        }
        return sb.ToString();
    }

    private async Task<string> SendChatAsync(string userPrompt)
    {
        var req = new OllamaChatRequest
        {
            Model = _settings.Model,
            Stream = false,
            Messages = new List<OllamaChatMessage>
            {
                new() { Role = "system", Content = SYSTEM_PROMPT },
                new() { Role = "user", Content = userPrompt }
            },
            Options = new Dictionary<string, object>
            {
                { "temperature", _settings.Temperature },
                { "num_predict", userPrompt.ToLowerInvariant().Contains("expression only") ? Math.Min(48, _settings.MaxTokens) : _settings.MaxTokens }
            }
        };

        var json = JsonSerializer.Serialize(req, JsonOpts);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        if (!_httpClient.DefaultRequestHeaders.Contains("Accept"))
        {
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
        }
        _logger.LogInformation("[Ollama] Request JSON (truncated 300): {Snippet}", json.Length > 300 ? json.Substring(0,300) + "..." : json);
        // If expression-only, allow a shorter timeout to fail fast
        var timeout = userPrompt.ToLowerInvariant().Contains("expression only") ? Math.Min(45, _settings.RequestTimeoutSeconds) : _settings.RequestTimeoutSeconds;
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(20, timeout)));
        var url = _httpClient.BaseAddress != null && _httpClient.BaseAddress.ToString().EndsWith("/") ? "api/chat" : "/api/chat";
        _logger.LogInformation("[Ollama] Sending chat request to {Url} (model={Model}, exprOnly={ExprOnly}, timeout={Timeout}s)", url, _settings.Model, userPrompt.ToLowerInvariant().Contains("expression only"), timeout);
        var resp = await _httpClient.PostAsync(url, content, cts.Token);
        var body = await resp.Content.ReadAsStringAsync();
        _logger.LogInformation("[Ollama] Response status {Status} length={Len}", resp.StatusCode, body?.Length);
        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Ollama non-success {Code}: {Snippet}", resp.StatusCode, body.Length > 200 ? body[..200] : body);
            throw new HttpRequestException($"Ollama error: {resp.StatusCode}");
        }
        try
        {
            var parsed = JsonSerializer.Deserialize<OllamaChatResponse>(body, JsonOpts);
            return parsed?.Message?.Content?.Trim() ?? body;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Ollama JSON; returning raw body snippet");
            return body;
        }
    }

    private string ExtractExpression(string fullText)
    {
        if (string.IsNullOrWhiteSpace(fullText)) return string.Empty;
        var firstLine = fullText.Split('\n').FirstOrDefault()?.Trim() ?? string.Empty;
        if (firstLine.Length < 4) return fullText;
        // Remove markdown fences if any
        firstLine = firstLine.Trim('`');
        return firstLine;
    }
}

