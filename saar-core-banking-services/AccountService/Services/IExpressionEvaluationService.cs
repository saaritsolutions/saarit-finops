using System.Net.Http.Json;

namespace AccountService.Services
{
    public interface IExpressionEvaluationService
    {
        Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context);
        Task<decimal?> CalculateDepositInterestRateAsync(string accountType, decimal amount, int termMonths);

        /// <summary>
        /// Calculates the monthly account maintenance charge using EXPR_AMC_FEE_UCB.
        /// Returns the fee amount (₹); returns the hard-coded fallback (₹50/₹100) if the
        /// expression service is unavailable or no active FeeCalculation expression exists.
        /// </summary>
        Task<decimal> CalculateMaintenanceFeeAsync(
            decimal averageMonthlyBalance,
            string  accountType,
            int     accountAgeMonths,
            string  customerSegment,
            decimal minimumBalanceRequired);
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

                var url = _httpClient.BaseAddress != null
                    ? new Uri(_httpClient.BaseAddress, "/api/expression-engine/execute").ToString()
                    : "http://localhost:5004/api/expression-engine/execute";
                var response = await _httpClient.PostAsJsonAsync(url, request);

                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadFromJsonAsync<ExpressionResult>();

                if (result == null || !result.Success)
                    throw new Exception($"Expression execution failed: {result?.ErrorMessage}");

                if (result.Result is null)
                    return default!;

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
                                return System.Text.Json.JsonSerializer.Deserialize<T>(je.GetRawText())!;
                            case System.Text.Json.JsonValueKind.True:
                            case System.Text.Json.JsonValueKind.False:
                                var b = je.GetBoolean();
                                if (typeof(T) == typeof(string))
                                    return (T)(object)b.ToString();
                                return System.Text.Json.JsonSerializer.Deserialize<T>(je.GetRawText())!;
                            case System.Text.Json.JsonValueKind.Object:
                            case System.Text.Json.JsonValueKind.Array:
                                return System.Text.Json.JsonSerializer.Deserialize<T>(je.GetRawText())!;
                            default:
                                return default!;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to convert JsonElement expression result to {Type}", typeof(T).Name);
                        var fallback = System.Text.Json.JsonSerializer.Serialize(result.Result);
                        return System.Text.Json.JsonSerializer.Deserialize<T>(fallback)!;
                    }
                }

                if (typeof(T) == typeof(string))
                    return (T)(object)result.Result.ToString()!;

                var jsonFallback = System.Text.Json.JsonSerializer.Serialize(result.Result);
                var parsed = System.Text.Json.JsonSerializer.Deserialize<T>(jsonFallback);
                if (parsed == null)
                    throw new InvalidCastException($"Unable to deserialize expression result to {typeof(T).Name}");
                return parsed;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate expression {ExpressionId}", expressionId);
                throw;
            }
        }

        public async Task<decimal?> CalculateDepositInterestRateAsync(string accountType, decimal amount, int termMonths)
        {
            try
            {
                var ctx = new Dictionary<string, object>
                {
                    ["days"]        = termMonths * 30,
                    ["amount"]      = amount,
                    ["accountType"] = accountType
                };
                return await EvaluateExpressionAsync<decimal>("EXPR_FD_RATE_001", ctx);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CalculateDepositInterestRateAsync failed for {AccountType}/{TermMonths}m", accountType, termMonths);
                return null;
            }
        }

        public async Task<decimal> CalculateMaintenanceFeeAsync(
            decimal averageMonthlyBalance,
            string  accountType,
            int     accountAgeMonths,
            string  customerSegment,
            decimal minimumBalanceRequired)
        {
            // Hard-coded fallback: ₹50 for savings, ₹100 for current
            decimal fallback = string.Equals(accountType, "SAVINGS", StringComparison.OrdinalIgnoreCase)
                ? 50m : 100m;

            try
            {
                // Find the latest active FeeCalculation expression
                var baseUrl = _httpClient.BaseAddress?.ToString() ?? "http://localhost:5004";
                var listUrl = $"{baseUrl.TrimEnd('/')}/api/expressions" +
                              "?category=FeeCalculation&status=Active&page=1&pageSize=1";
                var list = await _httpClient.GetFromJsonAsync<ExprListResponse>(listUrl);

                if (list?.expressions == null || list.expressions.Count == 0)
                {
                    _logger.LogDebug("No active FeeCalculation expression — using fallback ₹{Fee}", fallback);
                    return fallback;
                }

                var exprId = list.expressions
                    .OrderByDescending(e => e.updatedAt)
                    .First().expressionId;

                var ctx = new Dictionary<string, object>
                {
                    ["averageMonthlyBalance"]  = averageMonthlyBalance,
                    ["accountType"]            = accountType,
                    ["accountAgeMonths"]       = accountAgeMonths,
                    ["customerSegment"]        = customerSegment,
                    ["minimumBalanceRequired"] = minimumBalanceRequired,
                };
                return await EvaluateExpressionAsync<decimal>(exprId, ctx);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "CalculateMaintenanceFeeAsync failed — using fallback ₹{Fee}", fallback);
                return fallback;
            }
        }
    }

    public class ExpressionResult
    {
        public bool    Success        { get; set; }
        public object? Result         { get; set; }
        public string? ResultType     { get; set; }
        public int     ExecutionTimeMs { get; set; }
        public string? ErrorMessage   { get; set; }
        public DateTime ExecutedAt   { get; set; }
    }

    // Minimal DTO for the list-expressions endpoint (used by CalculateMaintenanceFeeAsync)
    internal class ExprListResponse
    {
        public List<ExprListItem> expressions { get; set; } = new();
    }

    internal class ExprListItem
    {
        public string expressionId { get; set; } = string.Empty;
        public string returnType   { get; set; } = string.Empty;
        public string updatedAt    { get; set; } = string.Empty;
    }
}
