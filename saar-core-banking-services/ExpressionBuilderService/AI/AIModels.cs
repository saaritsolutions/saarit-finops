using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ExpressionBuilderService.AI;

/// <summary>
/// Request model for AI expression generation
/// </summary>
public class AIExpressionRequest
{
    public string UserPrompt { get; set; } = string.Empty;
    public string? Context { get; set; }
    public string? Domain { get; set; }
    public List<string>? ExampleExpressions { get; set; }
}

/// <summary>
/// Response model for AI expression generation
/// </summary>
public class AIExpressionResponse
{
    public string Explanation { get; set; } = string.Empty;
    public string SuggestedExpression { get; set; } = string.Empty;
    public string Confidence { get; set; } = "medium";
    public bool IsValid { get; set; } = true;
}

/// <summary>
/// OpenAI Chat message model
/// </summary>
internal class OpenAIChatMessage
{
    [JsonPropertyName("role")] public string Role { get; set; } = string.Empty;
    [JsonPropertyName("content")] public string Content { get; set; } = string.Empty;
}

/// <summary>
/// OpenAI Response format configuration
/// </summary>
internal class OpenAIResponseFormat
{
    [JsonPropertyName("type")] public string Type { get; set; } = "text";
}

/// <summary>
/// OpenAI Chat completion response
/// </summary>
internal class OpenAIChatResponse
{
    [JsonPropertyName("choices")] public List<OpenAIChoice>? Choices { get; set; }
}

/// <summary>
/// OpenAI choice within response
/// </summary>
internal class OpenAIChoice
{
    [JsonPropertyName("message")] public OpenAIChatMessage? Message { get; set; }
}
