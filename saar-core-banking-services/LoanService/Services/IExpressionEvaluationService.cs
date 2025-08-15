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

                var response = await _httpClient.PostAsJsonAsync(
                    "http://localhost:5001/api/Expressions/execute", 
                    request);

                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
                
                if (!result.Success)
                    throw new Exception($"Expression execution failed: {result.ErrorMessage}");
                
                return (T)result.Result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate expression {ExpressionId}", expressionId);
                throw;
            }
        }

        public async Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData)
        {
            // Use the loan eligibility expression we created
            const string LOAN_ELIGIBILITY_EXPRESSION = "EXPR_1755237353842";
            
            var context = new Dictionary<string, object>
            {
                ["customer.creditScore"] = customerData["creditScore"],
                ["customer.monthlyIncome"] = customerData["monthlyIncome"],
                ["customer.debtToIncomeRatio"] = customerData["debtToIncomeRatio"],
                ["loan.amount"] = loanAmount,
                ["customer.id"] = customerId
            };

            return await EvaluateExpressionAsync<string>(LOAN_ELIGIBILITY_EXPRESSION, context);
        }

        public async Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext)
        {
            // Expression for dynamic interest rate calculation
            const string INTEREST_RATE_EXPRESSION = "EXPR_INTEREST_RATE";
            
            return await EvaluateExpressionAsync<decimal>(INTEREST_RATE_EXPRESSION, loanContext);
        }
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
