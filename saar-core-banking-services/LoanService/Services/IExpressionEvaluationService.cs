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
                // Correct endpoint route lives under ExpressionEngineController
                var url = _httpClient.BaseAddress != null
                    ? new Uri(_httpClient.BaseAddress, "/api/expression-engine/execute").ToString()
                    : "http://localhost:5004/api/expression-engine/execute";
                var response = await _httpClient.PostAsJsonAsync(url, request);

                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
                
                if (!result.Success)
                    throw new Exception($"Expression execution failed: {result.ErrorMessage}");

                // Convert result.Result (object/JsonElement/primitive) to desired T safely
                if (result.Result is null)
                {
                    return default!;
                }

                // If the engine returned a JsonElement (common when using System.Text.Json on the receiver), handle kinds explicitly
                if (result.Result is System.Text.Json.JsonElement je)
                {
                    try
                    {
                        switch (je.ValueKind)
                        {
                            case System.Text.Json.JsonValueKind.String:
                                var s = je.GetString();
                                if (typeof(T) == typeof(string))
                                    return (T)(object?)s!;
                                return System.Text.Json.JsonSerializer.Deserialize<T>(System.Text.Json.JsonSerializer.Serialize(s))!;
                            case System.Text.Json.JsonValueKind.Number:
                                // Use raw text to preserve numeric formatting
                                var rawNum = je.GetRawText();
                                return System.Text.Json.JsonSerializer.Deserialize<T>(rawNum)!;
                            case System.Text.Json.JsonValueKind.True:
                            case System.Text.Json.JsonValueKind.False:
                                var b = je.GetBoolean();
                                if (typeof(T) == typeof(string))
                                    return (T)(object)b.ToString();
                                return System.Text.Json.JsonSerializer.Deserialize<T>(je.GetRawText())!;
                            case System.Text.Json.JsonValueKind.Object:
                            case System.Text.Json.JsonValueKind.Array:
                                var raw = je.GetRawText();
                                return System.Text.Json.JsonSerializer.Deserialize<T>(raw)!;
                            case System.Text.Json.JsonValueKind.Null:
                            case System.Text.Json.JsonValueKind.Undefined:
                            default:
                                return default!;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to convert JsonElement expression result to {Type}, falling back to string round-trip", typeof(T).Name);
                        var fallback = System.Text.Json.JsonSerializer.Serialize(result.Result);
                        return System.Text.Json.JsonSerializer.Deserialize<T>(fallback)!;
                    }
                }

                // If result.Result is a CLR primitive that doesn't match T, try safe conversions
                try
                {
                    // If caller expects string, just call ToString() on the result
                    if (typeof(T) == typeof(string))
                    {
                        return (T)(object)result.Result.ToString()!;
                    }

                    // As a general fallback, serialize then deserialize to T
                    var jsonFallback = System.Text.Json.JsonSerializer.Serialize(result.Result);
                    var parsed = System.Text.Json.JsonSerializer.Deserialize<T>(jsonFallback);
                    if (parsed == null)
                        throw new InvalidCastException($"Unable to deserialize expression result to {typeof(T).Name}");
                    return parsed;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unable to coerce expression result to {Type}", typeof(T).Name);
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate expression {ExpressionId}", expressionId);
                throw;
            }
        }

        public async Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData)
        {
            // Fetch active eligibility rules from ExpressionBuilderService
            // Get more than 1 to find the most recently updated expression
            var response = await _httpClient.GetAsync("http://localhost:5004/api/expressions?category=Validation&status=Active&usageType=Validation&page=1&pageSize=10");
            response.EnsureSuccessStatusCode();
            var data = await response.Content.ReadFromJsonAsync<ExpressionListResponse>();
            
            if (data?.expressions == null || !data.expressions.Any())
                throw new Exception("No active loan eligibility rule found");

            // Find the expression with the most recent updatedAt timestamp
            var latestExpr = data.expressions
                .Where(e => !string.IsNullOrEmpty(e.updatedAt))
                .OrderByDescending(e => DateTime.Parse(e.updatedAt))
                .FirstOrDefault();
                
            if (latestExpr == null)
                throw new Exception("No valid loan eligibility rule found");

            // Some expressions expect a strongly-typed `customer` object (ExpressionBuilder.Models.CustomerData).
            // Wrap the customer fields into a nested object so the remote service can deserialize to the expected type.
            var customerObj = new
            {
                creditScore = customerData.ContainsKey("creditScore") ? customerData["creditScore"] : null,
                monthlyIncome = customerData.ContainsKey("monthlyIncome") ? customerData["monthlyIncome"] : null,
                debtToIncomeRatio = customerData.ContainsKey("debtToIncomeRatio") ? customerData["debtToIncomeRatio"] : null,
                id = customerId
            };

            // Provide both flattened variables and a nested `customer` object so expressions
            // written as `creditScore` or `customer.creditScore` both work.
            var context = new Dictionary<string, object>
            {
                ["customer"] = customerObj,
                ["creditScore"] = customerData.ContainsKey("creditScore") ? customerData["creditScore"]! : null,
                ["monthlyIncome"] = customerData.ContainsKey("monthlyIncome") ? customerData["monthlyIncome"]! : null,
                ["debtToIncomeRatio"] = customerData.ContainsKey("debtToIncomeRatio") ? customerData["debtToIncomeRatio"]! : null,
                ["loan.amount"] = loanAmount
            };

            // Check if the expression returns boolean or string
            if (latestExpr.returnType.Equals("boolean", StringComparison.OrdinalIgnoreCase))
            {
                // For boolean expressions, evaluate as bool and convert to APPROVED/DECLINED
                var boolResult = await EvaluateExpressionAsync<bool>(latestExpr.expressionId, context);
                return boolResult ? "APPROVED" : "DECLINED";
            }
            else
            {
                // For string expressions, return as-is
                return await EvaluateExpressionAsync<string>(latestExpr.expressionId, context);
            }
        }

        public async Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext)
        {
            // Try to fetch a dynamic interest-rate expression from ExpressionBuilderService.
            try
            {
                var resp = await _httpClient.GetAsync("http://localhost:5004/api/expressions?category=Interest&status=Active&page=1&pageSize=1");
                if (resp.IsSuccessStatusCode)
                {
                    var data = await resp.Content.ReadFromJsonAsync<ExpressionListResponse>();
                    var latest = data?.expressions?.FirstOrDefault();
                    if (latest != null)
                    {
                        try
                        {
                            return await EvaluateExpressionAsync<decimal>(latest.expressionId, loanContext);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Interest rate expression {Expr} failed, falling back to local calculation", latest.expressionId);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch interest rate expression from ExpressionBuilderService");
            }

            // Fallback: local calculation based on credit score (if available) or a default.
            try
            {
                decimal creditScore = 700m;
                if (loanContext != null)
                {
                    if (loanContext.TryGetValue("customer.creditScore", out var csObj) && csObj != null)
                    {
                        creditScore = Convert.ToDecimal(csObj);
                    }
                    else if (loanContext.TryGetValue("customer", out var custObj) && custObj != null)
                    {
                        // Attempt to read creditScore from nested customer object via JSON round-trip
                        var json = System.Text.Json.JsonSerializer.Serialize(custObj);
                        using var doc = System.Text.Json.JsonDocument.Parse(json);
                        if (doc.RootElement.TryGetProperty("creditScore", out var el) && el.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            creditScore = el.GetDecimal();
                        }
                    }
                }

                var rateLocal = Math.Round(10m + Math.Max(0, 750 - creditScore) * 0.01m, 2);
                return rateLocal;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to compute fallback interest rate");
                return 10m; // safe default
            }
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
    public string returnType { get; set; }
    public string updatedAt { get; set; }
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
