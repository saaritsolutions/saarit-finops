using System.Text.Json;

namespace TransactionService.Services
{
    /// <summary>
    /// Event-driven rule evaluation service for transaction processing
    /// </summary>
    public interface ITransactionRuleEvaluationService
    {
        Task<TransactionValidationResult> EvaluateTransactionRulesAsync(TransactionContext transaction);
        Task<RiskAssessmentResult> EvaluateRiskRulesAsync(TransactionContext transaction);
        Task HandleTransactionEventAsync(TransactionEvent eventData);
    }

    public class TransactionRuleEvaluationService : ITransactionRuleEvaluationService
    {
        private readonly HttpClient _expressionClient;
        private readonly ILogger<TransactionRuleEvaluationService> _logger;

        public TransactionRuleEvaluationService(IHttpClientFactory clientFactory, ILogger<TransactionRuleEvaluationService> logger)
        {
            _expressionClient = clientFactory.CreateClient("ExpressionBuilder");
            _logger = logger;
        }

        public async Task<TransactionValidationResult> EvaluateTransactionRulesAsync(TransactionContext transaction)
        {
            try
            {
                var validationRules = new[]
                {
                    "EXPR_DAILY_LIMIT_CHECK",
                    "EXPR_ACCOUNT_STATUS_CHECK", 
                    "EXPR_FRAUD_DETECTION",
                    "EXPR_REGULATORY_COMPLIANCE"
                };

                var context = new Dictionary<string, object>
                {
                    ["transaction.amount"] = transaction.Amount,
                    ["transaction.type"] = transaction.Type,
                    ["account.balance"] = transaction.AccountBalance,
                    ["account.status"] = transaction.AccountStatus,
                    ["customer.id"] = transaction.CustomerId,
                    ["customer.riskLevel"] = transaction.CustomerRiskLevel,
                    ["transaction.isInternational"] = transaction.IsInternational,
                    ["transaction.timestamp"] = transaction.Timestamp,
                    ["daily.transactionCount"] = transaction.DailyTransactionCount,
                    ["daily.transactionSum"] = transaction.DailyTransactionSum
                };

                var validationResults = new List<RuleResult>();

                // Evaluate all validation rules in parallel
                var tasks = validationRules.Select(async ruleId =>
                {
                    try
                    {
                        var result = await EvaluateRuleAsync<bool>(ruleId, context);
                        return new RuleResult
                        {
                            RuleId = ruleId,
                            Success = true,
                            Result = result,
                            ErrorMessage = null
                        };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to evaluate rule {RuleId}", ruleId);
                        return new RuleResult
                        {
                            RuleId = ruleId,
                            Success = false,
                            Result = false,
                            ErrorMessage = ex.Message
                        };
                    }
                });

                validationResults.AddRange(await Task.WhenAll(tasks));

                // Determine overall validation result
                var failedRules = validationResults.Where(r => !r.Success || !(bool)r.Result).ToList();
                
                return new TransactionValidationResult
                {
                    IsValid = !failedRules.Any(),
                    ValidationResults = validationResults,
                    FailedRules = failedRules.Select(r => r.RuleId).ToList(),
                    ValidationMessage = GetValidationMessage(failedRules),
                    ValidatedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Transaction validation failed for {TransactionId}", transaction.TransactionId);
                throw;
            }
        }

        public async Task<RiskAssessmentResult> EvaluateRiskRulesAsync(TransactionContext transaction)
        {
            try
            {
                const string RISK_ASSESSMENT_EXPRESSION = "EXPR_TRANSACTION_RISK_ASSESSMENT";
                
                var riskContext = new Dictionary<string, object>
                {
                    ["transaction"] = new
                    {
                        amount = transaction.Amount,
                        type = transaction.Type,
                        isInternational = transaction.IsInternational,
                        hour = transaction.Timestamp.Hour,
                        dayOfWeek = transaction.Timestamp.DayOfWeek.ToString()
                    },
                    ["customer"] = new 
                    {
                        id = transaction.CustomerId,
                        riskLevel = transaction.CustomerRiskLevel,
                        dailyTransactionCount = transaction.DailyTransactionCount,
                        dailyTransactionSum = transaction.DailyTransactionSum,
                        accountAge = transaction.AccountAge
                    }
                };

                var riskScore = await EvaluateRuleAsync<decimal>(RISK_ASSESSMENT_EXPRESSION, riskContext);
                
                return new RiskAssessmentResult
                {
                    TransactionId = transaction.TransactionId,
                    RiskScore = riskScore,
                    RiskLevel = GetRiskLevel(riskScore),
                    RequiresManualReview = riskScore > 0.7m,
                    RequiresBlocking = riskScore > 0.9m,
                    RecommendedAction = GetRecommendedAction(riskScore),
                    AssessedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Risk assessment failed for {TransactionId}", transaction.TransactionId);
                throw;
            }
        }

        public async Task HandleTransactionEventAsync(TransactionEvent eventData)
        {
            try
            {
                switch (eventData.EventType)
                {
                    case "TRANSACTION_INITIATED":
                        await ProcessTransactionInitiated(eventData);
                        break;
                    case "TRANSACTION_COMPLETED":
                        await ProcessTransactionCompleted(eventData);
                        break;
                    case "SUSPICIOUS_ACTIVITY_DETECTED":
                        await ProcessSuspiciousActivity(eventData);
                        break;
                    default:
                        _logger.LogWarning("Unknown transaction event type: {EventType}", eventData.EventType);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to handle transaction event {EventType} for {TransactionId}", 
                    eventData.EventType, eventData.TransactionId);
            }
        }

        private async Task ProcessTransactionInitiated(TransactionEvent eventData)
        {
            // Real-time fraud detection
            const string FRAUD_DETECTION_EXPRESSION = "EXPR_REAL_TIME_FRAUD_DETECTION";
            
            var fraudResult = await EvaluateRuleAsync<string>(FRAUD_DETECTION_EXPRESSION, eventData.Data);
            
            if (fraudResult == "SUSPICIOUS")
            {
                // Trigger fraud alert workflow
                await TriggerFraudAlert(eventData.TransactionId);
            }
        }

        private async Task ProcessTransactionCompleted(TransactionEvent eventData)
        {
            // Post-transaction analysis
            const string POST_TRANSACTION_ANALYSIS = "EXPR_POST_TRANSACTION_ANALYSIS";
            
            await EvaluateRuleAsync<object>(POST_TRANSACTION_ANALYSIS, eventData.Data);
        }

        private async Task ProcessSuspiciousActivity(TransactionEvent eventData)
        {
            // Escalate suspicious activity
            const string SUSPICIOUS_ACTIVITY_ESCALATION = "EXPR_SUSPICIOUS_ACTIVITY_ESCALATION";
            
            var escalationLevel = await EvaluateRuleAsync<string>(SUSPICIOUS_ACTIVITY_ESCALATION, eventData.Data);
            
            await EscalateToSecurityTeam(eventData.TransactionId, escalationLevel);
        }

        private async Task<T> EvaluateRuleAsync<T>(string ruleId, Dictionary<string, object> context)
        {
            var request = new
            {
                ExpressionId = ruleId,
                Variables = context
            };

            var response = await _expressionClient.PostAsJsonAsync("/api/Expressions/execute", request);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
            
            if (!result.Success)
                throw new Exception($"Rule evaluation failed: {result.ErrorMessage}");
            
            return JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(result.Result));
        }

        private string GetValidationMessage(List<RuleResult> failedRules)
        {
            if (!failedRules.Any()) return "Transaction validation successful";
            
            return $"Transaction failed validation: {string.Join(", ", failedRules.Select(r => r.RuleId))}";
        }

        private string GetRiskLevel(decimal riskScore)
        {
            return riskScore switch
            {
                <= 0.3m => "LOW",
                <= 0.6m => "MEDIUM", 
                <= 0.8m => "HIGH",
                _ => "CRITICAL"
            };
        }

        private string GetRecommendedAction(decimal riskScore)
        {
            return riskScore switch
            {
                <= 0.5m => "APPROVE",
                <= 0.7m => "REVIEW",
                <= 0.9m => "MANUAL_APPROVAL_REQUIRED",
                _ => "BLOCK"
            };
        }

        private async Task TriggerFraudAlert(string transactionId)
        {
            _logger.LogWarning("Fraud alert triggered for transaction {TransactionId}", transactionId);
            // Implementation would send to fraud detection system
        }

        private async Task EscalateToSecurityTeam(string transactionId, string escalationLevel)
        {
            _logger.LogWarning("Escalating suspicious activity for transaction {TransactionId} at level {EscalationLevel}", 
                transactionId, escalationLevel);
            // Implementation would notify security team
        }
    }

    // Supporting Models
    public class TransactionContext
    {
        public string TransactionId { get; set; } = string.Empty;
        public string CustomerId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Type { get; set; } = string.Empty;
        public string AccountStatus { get; set; } = string.Empty;
        public decimal AccountBalance { get; set; }
        public string CustomerRiskLevel { get; set; } = "MEDIUM";
        public bool IsInternational { get; set; }
        public DateTime Timestamp { get; set; }
        public int DailyTransactionCount { get; set; }
        public decimal DailyTransactionSum { get; set; }
        public int AccountAge { get; set; }
    }

    public class TransactionEvent
    {
        public string EventType { get; set; } = string.Empty;
        public string TransactionId { get; set; } = string.Empty;
        public Dictionary<string, object> Data { get; set; } = new();
        public DateTime EventTimestamp { get; set; }
    }

    public class TransactionValidationResult
    {
        public bool IsValid { get; set; }
        public List<RuleResult> ValidationResults { get; set; } = new();
        public List<string> FailedRules { get; set; } = new();
        public string ValidationMessage { get; set; } = string.Empty;
        public DateTime ValidatedAt { get; set; }
    }

    public class RiskAssessmentResult
    {
        public string TransactionId { get; set; } = string.Empty;
        public decimal RiskScore { get; set; }
        public string RiskLevel { get; set; } = string.Empty;
        public bool RequiresManualReview { get; set; }
        public bool RequiresBlocking { get; set; }
        public string RecommendedAction { get; set; } = string.Empty;
        public DateTime AssessedAt { get; set; }
    }

    public class RuleResult
    {
        public string RuleId { get; set; } = string.Empty;
        public bool Success { get; set; }
        public object Result { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }

    public class ExpressionExecutionResponse
    {
        public bool Success { get; set; }
        public object Result { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }
}
