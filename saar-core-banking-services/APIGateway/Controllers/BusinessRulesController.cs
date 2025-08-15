using Microsoft.AspNetCore.Mvc;

namespace APIGateway.Controllers
{
    /// <summary>
    /// Centralized gateway for expression-based business rule evaluation
    /// </summary>
    [ApiController]
    [Route("api/gateway/[controller]")]
    public class BusinessRulesController : ControllerBase
    {
        private readonly HttpClient _expressionClient;
        private readonly ILogger<BusinessRulesController> _logger;

        public BusinessRulesController(IHttpClientFactory clientFactory, ILogger<BusinessRulesController> logger)
        {
            _expressionClient = clientFactory.CreateClient("ExpressionBuilder");
            _logger = logger;
        }

        /// <summary>
        /// Universal rule evaluation endpoint for any service
        /// </summary>
        [HttpPost("evaluate")]
        public async Task<ActionResult<RuleEvaluationResponse>> EvaluateRule([FromBody] RuleEvaluationRequest request)
        {
            try
            {
                // Add common context (tenant, user, timestamp)
                var enrichedContext = new Dictionary<string, object>(request.Context)
                {
                    ["evaluation.timestamp"] = DateTime.UtcNow,
                    ["evaluation.service"] = request.ServiceName,
                    ["evaluation.tenantId"] = GetTenantId(),
                    ["evaluation.userId"] = GetUserId()
                };

                var expressionRequest = new
                {
                    ExpressionId = request.RuleId,
                    Variables = enrichedContext,
                    ExecutionContext = request.ServiceName,
                    ContextEntityId = request.EntityId
                };

                var response = await _expressionClient.PostAsJsonAsync("/api/Expressions/execute", expressionRequest);
                response.EnsureSuccessStatusCode();

                var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResult>();

                return Ok(new RuleEvaluationResponse
                {
                    RuleId = request.RuleId,
                    ServiceName = request.ServiceName,
                    EntityId = request.EntityId,
                    Success = result.Success,
                    Result = result.Result,
                    ResultType = result.ResultType,
                    ExecutionTimeMs = result.ExecutionTimeMs,
                    EvaluatedAt = result.ExecutedAt,
                    ErrorMessage = result.ErrorMessage
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate rule {RuleId} for service {ServiceName}", 
                    request.RuleId, request.ServiceName);
                
                return StatusCode(500, new RuleEvaluationResponse
                {
                    RuleId = request.RuleId,
                    ServiceName = request.ServiceName,
                    Success = false,
                    ErrorMessage = "Rule evaluation failed"
                });
            }
        }

        /// <summary>
        /// Batch rule evaluation for multiple rules
        /// </summary>
        [HttpPost("evaluate/batch")]
        public async Task<ActionResult<BatchRuleEvaluationResponse>> EvaluateBatchRules([FromBody] BatchRuleEvaluationRequest request)
        {
            var results = new List<RuleEvaluationResponse>();

            foreach (var rule in request.Rules)
            {
                try
                {
                    var singleRequest = new RuleEvaluationRequest
                    {
                        RuleId = rule.RuleId,
                        ServiceName = request.ServiceName,
                        EntityId = request.EntityId,
                        Context = rule.Context ?? request.CommonContext
                    };

                    var actionResult = await EvaluateRule(singleRequest);
                    if (actionResult.Value != null)
                    {
                        results.Add(actionResult.Value);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to evaluate rule {RuleId} in batch", rule.RuleId);
                    results.Add(new RuleEvaluationResponse
                    {
                        RuleId = rule.RuleId,
                        ServiceName = request.ServiceName,
                        Success = false,
                        ErrorMessage = ex.Message
                    });
                }
            }

            return Ok(new BatchRuleEvaluationResponse
            {
                ServiceName = request.ServiceName,
                EntityId = request.EntityId,
                TotalRules = request.Rules.Count,
                SuccessfulEvaluations = results.Count(r => r.Success),
                Results = results,
                ProcessedAt = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Rule-based routing for workflow decisions
        /// </summary>
        [HttpPost("workflow/route")]
        public async Task<ActionResult<WorkflowRoutingResponse>> RouteWorkflow([FromBody] WorkflowRoutingRequest request)
        {
            try
            {
                // Evaluate routing rules
                const string WORKFLOW_ROUTING_EXPRESSION = "EXPR_WORKFLOW_ROUTING";
                
                var routingContext = new Dictionary<string, object>(request.Context)
                {
                    ["workflow.type"] = request.WorkflowType,
                    ["entity.type"] = request.EntityType,
                    ["entity.id"] = request.EntityId,
                    ["current.stage"] = request.CurrentStage
                };

                var ruleRequest = new RuleEvaluationRequest
                {
                    RuleId = WORKFLOW_ROUTING_EXPRESSION,
                    ServiceName = "WorkflowOrchestration",
                    EntityId = request.EntityId,
                    Context = routingContext
                };

                var routingResult = await EvaluateRule(ruleRequest);
                
                if (!routingResult.Value?.Success ?? true)
                {
                    throw new Exception($"Workflow routing failed: {routingResult.Value?.ErrorMessage}");
                }

                return Ok(new WorkflowRoutingResponse
                {
                    WorkflowType = request.WorkflowType,
                    EntityId = request.EntityId,
                    NextStage = routingResult.Value?.Result?.ToString(),
                    RequiresApproval = IsApprovalRequired(routingResult.Value?.Result?.ToString()),
                    ApproverLevel = GetRequiredApproverLevel(routingResult.Value?.Result?.ToString()),
                    RoutedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to route workflow for {WorkflowType} {EntityId}", 
                    request.WorkflowType, request.EntityId);
                return StatusCode(500, new { error = "Workflow routing failed" });
            }
        }

        private string GetTenantId() => "default-tenant"; // Get from JWT/headers
        private string GetUserId() => "system-user"; // Get from JWT/headers

        private bool IsApprovalRequired(string? nextStage)
        {
            return nextStage?.Contains("APPROVAL") ?? false;
        }

        private string? GetRequiredApproverLevel(string? nextStage)
        {
            return nextStage switch
            {
                "MANAGER_APPROVAL" => "MANAGER",
                "SENIOR_APPROVAL" => "SENIOR_MANAGER",
                "EXECUTIVE_APPROVAL" => "EXECUTIVE",
                _ => null
            };
        }
    }

    // Request/Response Models
    public class RuleEvaluationRequest
    {
        public string RuleId { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class RuleEvaluationResponse
    {
        public string RuleId { get; set; } = string.Empty;
        public string ServiceName { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public bool Success { get; set; }
        public object? Result { get; set; }
        public string? ResultType { get; set; }
        public int ExecutionTimeMs { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime EvaluatedAt { get; set; }
    }

    public class BatchRuleEvaluationRequest
    {
        public string ServiceName { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public Dictionary<string, object> CommonContext { get; set; } = new();
        public List<BatchRuleItem> Rules { get; set; } = new();
    }

    public class BatchRuleItem
    {
        public string RuleId { get; set; } = string.Empty;
        public Dictionary<string, object>? Context { get; set; }
    }

    public class BatchRuleEvaluationResponse
    {
        public string ServiceName { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public int TotalRules { get; set; }
        public int SuccessfulEvaluations { get; set; }
        public List<RuleEvaluationResponse> Results { get; set; } = new();
        public DateTime ProcessedAt { get; set; }
    }

    public class WorkflowRoutingRequest
    {
        public string WorkflowType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string CurrentStage { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class WorkflowRoutingResponse
    {
        public string WorkflowType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string? NextStage { get; set; }
        public bool RequiresApproval { get; set; }
        public string? ApproverLevel { get; set; }
        public DateTime RoutedAt { get; set; }
    }

    public class ExpressionExecutionResult
    {
        public bool Success { get; set; }
        public object? Result { get; set; }
        public string? ResultType { get; set; }
        public int ExecutionTimeMs { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime ExecutedAt { get; set; }
    }
}
