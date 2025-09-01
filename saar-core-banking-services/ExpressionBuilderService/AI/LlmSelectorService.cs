using System;
using Microsoft.Extensions.Options;

namespace ExpressionBuilderService.AI
{
    public interface ILlmSelectorService
    {
        ILLMService GetProvider();
    }

    public class LlmSelectorService : ILlmSelectorService
    {
        private readonly LlmSettings _settings;
        private readonly IServiceProvider _serviceProvider;

        public LlmSelectorService(IOptions<LlmSettings> settings, IServiceProvider serviceProvider)
        {
            _settings = settings.Value;
            _serviceProvider = serviceProvider;
        }

        public ILLMService GetProvider()
        {
            var provider = _settings.DefaultProvider?.ToLowerInvariant() ?? "gemini";
            return provider switch
            {
                "ollama" => (ILLMService)_serviceProvider.GetService(typeof(OllamaAIService))!,
                _ => (ILLMService)_serviceProvider.GetService(typeof(GeminiAIService))!,
            };
        }
    }
}
