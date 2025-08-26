using Microsoft.AspNetCore.Mvc;

namespace WorkflowOrchestrationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowController : ControllerBase
    {
        private readonly IWorkflowRuleService _workflowRuleService;
        private readonly ILogger<WorkflowController> _logger;

        public WorkflowController(IWorkflowRuleService workflowRuleService, ILogger<WorkflowController> logger)
        {
            _workflowRuleService = workflowRuleService;
            _logger = logger;
        }

        /// <summary>
        /// Start a workflow with rule-based routing
        /// </summary>
        [HttpPost("start")]
        public async Task<ActionResult<WorkflowInstance>> StartWorkflow([FromBody] StartWorkflowRequest request)
        {
            try
            {
                var instance = await _workflowRuleService.StartWorkflowAsync(request);
                return Ok(instance);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start workflow {WorkflowType}", request.WorkflowType);
                return StatusCode(500, new { error = "Failed to start workflow" });
            }
        }

        /// <summary>
        /// Process workflow step with dynamic rule evaluation
        /// </summary>
        [HttpPost("{instanceId}/process")]
        public async Task<ActionResult<WorkflowStepResult>> ProcessWorkflowStep(Guid instanceId, [FromBody] ProcessStepRequest request)
        {
            try
            {
                var result = await _workflowRuleService.ProcessStepAsync(instanceId, request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process workflow step for instance {InstanceId}", instanceId);
                return StatusCode(500, new { error = "Failed to process workflow step" });
            }
        }
    }

    public interface IWorkflowRuleService
    {
        Task<WorkflowInstance> StartWorkflowAsync(StartWorkflowRequest request);
        Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, ProcessStepRequest request);
        Task<WorkflowRouting> EvaluateRoutingRulesAsync(string workflowType, string currentStep, Dictionary<string, object> context);
        Task<List<ApprovalRequirement>> EvaluateApprovalRulesAsync(string workflowType, Dictionary<string, object> context);
    }

    public class WorkflowRuleService : IWorkflowRuleService
    {
        private readonly HttpClient _expressionClient;
        private readonly ILogger<WorkflowRuleService> _logger;

        public WorkflowRuleService(IHttpClientFactory clientFactory, ILogger<WorkflowRuleService> logger)
        {
            _expressionClient = clientFactory.CreateClient("ExpressionBuilder");
            _logger = logger;
        }

        public async Task<WorkflowInstance> StartWorkflowAsync(StartWorkflowRequest request)
        {
            // Evaluate initial routing rules
            var routing = await EvaluateRoutingRulesAsync(request.WorkflowType, "START", request.Context);
            
            // Evaluate approval requirements
            var approvalRequirements = await EvaluateApprovalRulesAsync(request.WorkflowType, request.Context);

            var instance = new WorkflowInstance
            {
                Id = Guid.NewGuid(),
                WorkflowType = request.WorkflowType,
                EntityId = request.EntityId,
                EntityType = request.EntityType,
                CurrentStep = routing.NextStep,
                Status = "ACTIVE",
                Context = request.Context,
                ApprovalRequirements = approvalRequirements,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Apply rule-based initial conditions
            await ApplyInitialConditionsAsync(instance);

            return instance;
        }

        public async Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, ProcessStepRequest request)
        {
            // Load workflow instance (would be from database in real implementation)
            var instance = await LoadWorkflowInstanceAsync(instanceId);
            
            if (instance == null)
                throw new Exception($"Workflow instance {instanceId} not found");

            // Merge new context with existing context
            foreach (var kvp in request.Context)
            {
                instance.Context[kvp.Key] = kvp.Value;
            }

            // Evaluate step completion rules
            var stepCompleteResult = await EvaluateStepCompletionRulesAsync(instance, request.Action);

            if (!stepCompleteResult.CanProceed)
            {
                return new WorkflowStepResult
                {
                    InstanceId = instanceId,
                    Success = false,
                    CurrentStep = instance.CurrentStep,
                    Message = stepCompleteResult.ErrorMessage,
                    RequiredActions = stepCompleteResult.RequiredActions
                };
            }

            // Evaluate routing for next step
            var routing = await EvaluateRoutingRulesAsync(instance.WorkflowType, instance.CurrentStep, instance.Context);

            // Update instance
            instance.CurrentStep = routing.NextStep;
            instance.Status = routing.WorkflowStatus;
            instance.UpdatedAt = DateTime.UtcNow;

            // Check if workflow is complete
            if (routing.NextStep == "COMPLETED")
            {
                await FinalizeWorkflowAsync(instance);
            }

            // Save instance (would persist to database)
            await SaveWorkflowInstanceAsync(instance);

            return new WorkflowStepResult
            {
                InstanceId = instanceId,
                Success = true,
                CurrentStep = instance.CurrentStep,
                NextStep = routing.NextStep,
                WorkflowStatus = instance.Status,
                Message = "Step processed successfully",
                AutoActions = routing.AutoActions,
                Notifications = routing.Notifications
            };
        }

        public async Task<WorkflowRouting> EvaluateRoutingRulesAsync(string workflowType, string currentStep, Dictionary<string, object> context)
        {
            try
            {
                var routingExpressionId = GetRoutingExpressionId(workflowType);
                
                var routingContext = new Dictionary<string, object>(context)
                {
                    ["workflow.type"] = workflowType,
                    ["workflow.currentStep"] = currentStep,
                    ["evaluation.timestamp"] = DateTime.UtcNow
                };

                var routingResult = await EvaluateExpressionAsync<dynamic>(routingExpressionId, routingContext);

                // Convert dynamic collections safely to typed structures
                List<string> autoActions = new();
                if (routingResult.autoActions != null)
                {
                    try
                    {
                        // Attempt to serialize/deserialize to List<string>
                        var json = System.Text.Json.JsonSerializer.Serialize(routingResult.autoActions);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                        if (parsed != null) autoActions = parsed;
                    }
                    catch { /* ignore and keep empty */ }
                }

                List<string> notifications = new();
                if (routingResult.notifications != null)
                {
                    try
                    {
                        var json = System.Text.Json.JsonSerializer.Serialize(routingResult.notifications);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                        if (parsed != null) notifications = parsed;
                    }
                    catch { /* ignore and keep empty */ }
                }

                Dictionary<string, object> conditions = new();
                if (routingResult.conditions != null)
                {
                    try
                    {
                        var json = System.Text.Json.JsonSerializer.Serialize(routingResult.conditions);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                        if (parsed != null) conditions = parsed;
                    }
                    catch { /* ignore and keep empty */ }
                }

                return new WorkflowRouting
                {
                    NextStep = routingResult.nextStep?.ToString() ?? "ERROR",
                    WorkflowStatus = routingResult.status?.ToString() ?? "ERROR",
                    RequiresApproval = routingResult.requiresApproval ?? false,
                    AutoActions = autoActions,
                    Notifications = notifications,
                    Conditions = conditions
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate routing rules for {WorkflowType} step {CurrentStep}", workflowType, currentStep);
                
                // Return safe default
                return new WorkflowRouting
                {
                    NextStep = "MANUAL_REVIEW",
                    WorkflowStatus = "PENDING",
                    RequiresApproval = true
                };
            }
        }

        public async Task<List<ApprovalRequirement>> EvaluateApprovalRulesAsync(string workflowType, Dictionary<string, object> context)
        {
            try
            {
                var approvalExpressionId = GetApprovalExpressionId(workflowType);
                
                var approvalContext = new Dictionary<string, object>(context)
                {
                    ["workflow.type"] = workflowType,
                    ["evaluation.timestamp"] = DateTime.UtcNow
                };

                var approvalRules = await EvaluateExpressionAsync<List<dynamic>>(approvalExpressionId, approvalContext);

                return approvalRules.Select(rule => new ApprovalRequirement
                {
                    Level = rule.level?.ToString() ?? "MANAGER",
                    Role = rule.role?.ToString() ?? "LOAN_OFFICER",
                    MinAmount = rule.minAmount ?? 0,
                    MaxAmount = rule.maxAmount ?? decimal.MaxValue,
                    Condition = rule.condition?.ToString(),
                    IsRequired = rule.required ?? true,
                    TimeoutHours = rule.timeoutHours ?? 24
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate approval rules for {WorkflowType}", workflowType);
                
                // Return default approval requirement
                return new List<ApprovalRequirement>
                {
                    new ApprovalRequirement
                    {
                        Level = "MANAGER",
                        Role = "APPROVER",
                        IsRequired = true,
                        TimeoutHours = 24
                    }
                };
            }
        }

        private async Task<StepCompletionResult> EvaluateStepCompletionRulesAsync(WorkflowInstance instance, string action)
        {
            try
            {
                var completionExpressionId = GetStepCompletionExpressionId(instance.WorkflowType, instance.CurrentStep);
                
                var completionContext = new Dictionary<string, object>(instance.Context)
                {
                    ["step.action"] = action,
                    ["step.current"] = instance.CurrentStep,
                    ["workflow.status"] = instance.Status
                };

                var completionResult = await EvaluateExpressionAsync<dynamic>(completionExpressionId, completionContext);

                // Convert dynamic list for requiredActions
                List<string> requiredActions = new();
                if (completionResult.requiredActions != null)
                {
                    try
                    {
                        var json = System.Text.Json.JsonSerializer.Serialize(completionResult.requiredActions);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                        if (parsed != null) requiredActions = parsed;
                    }
                    catch { /* ignore and keep default */ }
                }

                return new StepCompletionResult
                {
                    CanProceed = completionResult.canProceed ?? false,
                    ErrorMessage = completionResult.errorMessage?.ToString(),
                    RequiredActions = requiredActions
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate step completion rules");
                
                // Safe default - require manual review
                return new StepCompletionResult
                {
                    CanProceed = false,
                    ErrorMessage = "Unable to validate step completion",
                    RequiredActions = new List<string> { "MANUAL_REVIEW" }
                };
            }
        }

        private async Task ApplyInitialConditionsAsync(WorkflowInstance instance)
        {
            // Apply initial business rule conditions
            const string INITIAL_CONDITIONS_EXPRESSION = "EXPR_WORKFLOW_INITIAL_CONDITIONS";
            
            try
            {
                var conditions = await EvaluateExpressionAsync<Dictionary<string, object>>(
                    INITIAL_CONDITIONS_EXPRESSION, 
                    instance.Context);

                foreach (var condition in conditions)
                {
                    instance.Context[$"condition.{condition.Key}"] = condition.Value;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to apply initial conditions for workflow {WorkflowType}", instance.WorkflowType);
            }
        }

        private async Task FinalizeWorkflowAsync(WorkflowInstance instance)
        {
            // Apply finalization rules
            const string FINALIZATION_EXPRESSION = "EXPR_WORKFLOW_FINALIZATION";
            
            try
            {
                await EvaluateExpressionAsync<object>(FINALIZATION_EXPRESSION, instance.Context);
                instance.Status = "COMPLETED";
                instance.CompletedAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to finalize workflow {InstanceId}", instance.Id);
                instance.Status = "ERROR";
            }
        }

        private async Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context)
        {
            var request = new
            {
                ExpressionId = expressionId,
                Variables = context
            };

            var response = await _expressionClient.PostAsJsonAsync("/api/Expressions/execute", request);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
            
            if (!result.Success)
                throw new Exception($"Expression execution failed: {result.ErrorMessage}");
            
            return System.Text.Json.JsonSerializer.Deserialize<T>(System.Text.Json.JsonSerializer.Serialize(result.Result));
        }

        private string GetRoutingExpressionId(string workflowType)
        {
            return $"EXPR_ROUTING_{workflowType.ToUpper()}";
        }

        private string GetApprovalExpressionId(string workflowType)
        {
            return $"EXPR_APPROVAL_{workflowType.ToUpper()}";
        }

        private string GetStepCompletionExpressionId(string workflowType, string step)
        {
            return $"EXPR_STEP_COMPLETION_{workflowType.ToUpper()}_{step.ToUpper()}";
        }

        private async Task<WorkflowInstance?> LoadWorkflowInstanceAsync(Guid instanceId)
        {
            // In real implementation, load from database
            // For demo, return mock instance
            return new WorkflowInstance { Id = instanceId };
        }

        private async Task SaveWorkflowInstanceAsync(WorkflowInstance instance)
        {
            // In real implementation, save to database
            _logger.LogInformation("Saved workflow instance {InstanceId} at step {Step}", 
                instance.Id, instance.CurrentStep);
        }
    }

    // Supporting Models
    public class StartWorkflowRequest
    {
        public string WorkflowType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class ProcessStepRequest
    {
        public string Action { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
        public string? Comments { get; set; }
    }

    public class WorkflowInstance
    {
        public Guid Id { get; set; }
        public string WorkflowType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public string CurrentStep { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
        public List<ApprovalRequirement> ApprovalRequirements { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }

    public class WorkflowStepResult
    {
        public Guid InstanceId { get; set; }
        public bool Success { get; set; }
        public string CurrentStep { get; set; } = string.Empty;
        public string? NextStep { get; set; }
        public string? WorkflowStatus { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<string> RequiredActions { get; set; } = new();
        public List<string> AutoActions { get; set; } = new();
        public List<string> Notifications { get; set; } = new();
    }

    public class WorkflowRouting
    {
        public string NextStep { get; set; } = string.Empty;
        public string WorkflowStatus { get; set; } = string.Empty;
        public bool RequiresApproval { get; set; }
        public List<string> AutoActions { get; set; } = new();
        public List<string> Notifications { get; set; } = new();
        public Dictionary<string, object> Conditions { get; set; } = new();
    }

    public class ApprovalRequirement
    {
        public string Level { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public decimal MinAmount { get; set; }
        public decimal MaxAmount { get; set; }
        public string? Condition { get; set; }
        public bool IsRequired { get; set; }
        public int TimeoutHours { get; set; }
    }

    public class StepCompletionResult
    {
        public bool CanProceed { get; set; }
        public string? ErrorMessage { get; set; }
        public List<string> RequiredActions { get; set; } = new();
    }

    public class ExpressionExecutionResponse
    {
        public bool Success { get; set; }
        public object Result { get; set; } = new();
        public string? ErrorMessage { get; set; }
    }
}
