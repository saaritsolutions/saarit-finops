using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace ExpressionBuilderService.AI
{
    public class OllamaAIService : ILLMService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaAIService> _logger;

        public OllamaAIService(HttpClient httpClient, ILogger<OllamaAIService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request)
        {
            // Minimal stub: return a deterministic fallback response so UI and tests can rely on a stable output.
            await Task.CompletedTask;
            return new AIExpressionResponse
            {
                Explanation = "Ollama stub: Unable to generate full expression in stub mode; please review",
                SuggestedExpression = "customer.Age >= 18",
                AlternativeExpressions = new System.Collections.Generic.List<string>(),
                RequiredVariables = new System.Collections.Generic.List<string>(),
                Confidence = "low",
                IsValid = false
            };
        }

        public async Task<string> ExplainExpressionAsync(string expression)
        {
            return await Task.FromResult("Ollama stub explanation");
        }

        public async Task<System.Collections.Generic.List<string>> SuggestImprovementsAsync(string expression, string context)
        {
            return await Task.FromResult(new System.Collections.Generic.List<string> { "Use >= instead of > where appropriate" });
        }
    }
}
