using System.Threading.Tasks;

namespace LoanService.Services
{
    public interface IExpressionEvaluationService
    {
        Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context);
        Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData);
        Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext);
    }

    public class ExpressionEvaluationService : IExpressionEvaluationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<ExpressionEvaluationService> _logger;

        public ExpressionEvaluationService(HttpClient httpClient, ILogger<ExpressionEvaluationService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context)
        {
            try
            {
                var request = new
                {
                    ExpressionId = expressionId,
                    Variables = context
                };

                // Use configured BaseAddress when available, fall back to fixed demo port 5004
                var url = _httpClient.BaseAddress != null
                    ? new Uri(_httpClient.BaseAddress, "/api/Expressions/execute").ToString()
                    : "http://localhost:5004/api/Expressions/execute";
                var response = await _httpClient.PostAsJsonAsync(url, request);

                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
                
                if (!result.Success)
                    throw new Exception($"Expression execution failed: {result.ErrorMessage}");

                // Convert result.Result (object/JsonElement) to desired T
                if (result.Result is null)
                {
                    return default!;
                }

                // Round-trip serialize to handle JsonElement/object -> T
                var json = System.Text.Json.JsonSerializer.Serialize(result.Result);
                var typed = System.Text.Json.JsonSerializer.Deserialize<T>(json);
                if (typed == null)
                {
                    throw new InvalidCastException($"Unable to deserialize expression result to {typeof(T).Name}");
                }
                return typed;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate expression {ExpressionId}", expressionId);
                throw;
            }
        }

        public async Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData)
        {
            // Fetch latest active eligibility rule from ExpressionBuilderService
            var response = await _httpClient.GetAsync("http://localhost:5004/api/expressions?category=Validation&status=Active&usageType=Validation&page=1&pageSize=1");
            response.EnsureSuccessStatusCode();
            var data = await response.Content.ReadFromJsonAsync<ExpressionListResponse>();
            var latestExpr = data?.expressions?.FirstOrDefault();
            if (latestExpr == null)
                throw new Exception("No active loan eligibility rule found");

            var context = new Dictionary<string, object>
            {
                ["customer.creditScore"] = customerData["creditScore"],
                ["customer.monthlyIncome"] = customerData["monthlyIncome"],
                ["customer.debtToIncomeRatio"] = customerData["debtToIncomeRatio"],
                ["loan.amount"] = loanAmount,
                ["customer.id"] = customerId
            };

            return await EvaluateExpressionAsync<string>(latestExpr.expressionId, context);
        }

        public async Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext)
        {
            // Expression for dynamic interest rate calculation
            const string INTEREST_RATE_EXPRESSION = "EXPR_INTEREST_RATE";
            
            return await EvaluateExpressionAsync<decimal>(INTEREST_RATE_EXPRESSION, loanContext);
        }
    }

// DTOs for expression list response
public class ExpressionListResponse
{
    public List<ExpressionResponse> expressions { get; set; }
}

public class ExpressionResponse
{
    public string expressionId { get; set; }
    // Add other fields as needed
}

public class ExpressionExecutionResponse
{
    public bool Success { get; set; }
    public object Result { get; set; }
    public string ResultType { get; set; }
    public int ExecutionTimeMs { get; set; }
    public string ErrorMessage { get; set; }
    public DateTime ExecutedAt { get; set; }
}

}
