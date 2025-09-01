using System.Threading.Tasks;

namespace ExpressionBuilderService.AI
{
    public interface ILLMService
    {
        Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request);
        Task<string> ExplainExpressionAsync(string expression);
        Task<System.Collections.Generic.List<string>> SuggestImprovementsAsync(string expression, string context);
    }
}
