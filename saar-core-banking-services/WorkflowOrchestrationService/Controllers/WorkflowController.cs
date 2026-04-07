using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WorkflowOrchestrationService.Data;
using WorkflowOrchestrationService.Models;

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

        /// <summary>Start a workflow with rule-based routing</summary>
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

        /// <summary>Process workflow step with dynamic rule evaluation</summary>
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
        private readonly WorkflowDbContext _db;
        private readonly ILogger<WorkflowRuleService> _logger;

        public WorkflowRuleService(IHttpClientFactory clientFactory, WorkflowDbContext db, ILogger<WorkflowRuleService> logger)
        {
            _expressionClient = clientFactory.CreateClient("ExpressionBuilder");
            _db = db;
            _logger = logger;
        }

        public async Task<WorkflowInstance> StartWorkflowAsync(StartWorkflowRequest request)
        {
            var routing = await EvaluateRoutingRulesAsync(request.WorkflowType, "START", request.Context);
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

            await ApplyInitialConditionsAsync(instance);
            await SaveWorkflowInstanceAsync(instance);

            return instance;
        }

        public async Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, ProcessStepRequest request)
        {
            var instance = await LoadWorkflowInstanceAsync(instanceId);

            if (instance == null)
                throw new Exception($"Workflow instance {instanceId} not found");

            foreach (var kvp in request.Context)
                instance.Context[kvp.Key] = kvp.Value;

            var stepCompleteResult = await EvaluateStepCompletionRulesAsync(instance, request.Action);

            if (!stepCompleteResult.CanProceed)
            {
                return new WorkflowStepResult
                {
                    InstanceId = instanceId,
                    Success = false,
                    CurrentStep = instance.CurrentStep,
                    Message = stepCompleteResult.ErrorMessage ?? "Cannot proceed",
                    RequiredActions = stepCompleteResult.RequiredActions
                };
            }

            var routing = await EvaluateRoutingRulesAsync(instance.WorkflowType, instance.CurrentStep, instance.Context);

            instance.CurrentStep = routing.NextStep;
            instance.Status = routing.WorkflowStatus;
            instance.UpdatedAt = DateTime.UtcNow;

            if (routing.NextStep == "COMPLETED")
                await FinalizeWorkflowAsync(instance);

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
                    ["workflow_type"] = workflowType,
                    ["workflow_currentStep"] = currentStep,
                    ["evaluation_timestamp"] = DateTime.UtcNow.ToString("O")
                };

                var routingResult = await EvaluateExpressionAsync<dynamic>(routingExpressionId, routingContext);

                // Try structured object first, fall back to plain string (Roslyn returns primitives)
                string? nextStep = null;
                string? status = null;
                bool requiresApproval = false;

                try { nextStep = routingResult.nextStep?.ToString(); } catch { }
                try { status = routingResult.status?.ToString(); } catch { }
                try { requiresApproval = routingResult.requiresApproval ?? false; } catch { }

                // Plain-string fallback: expression returned the step name directly
                if (string.IsNullOrEmpty(nextStep))
                {
                    var raw = routingResult?.ToString() ?? string.Empty;
                    nextStep = raw.Trim('"');
                }

                if (string.IsNullOrEmpty(nextStep)) nextStep = "MANUAL_REVIEW";
                if (string.IsNullOrEmpty(status)) status = nextStep == "COMPLETED" ? "COMPLETED" : "ACTIVE";

                List<string> autoActions = new();
                List<string> notifications = new();
                try
                {
                    if (routingResult.autoActions != null)
                    {
                        var json = System.Text.Json.JsonSerializer.Serialize(routingResult.autoActions);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                        if (parsed != null) autoActions = parsed;
                    }
                }
                catch { }
                try
                {
                    if (routingResult.notifications != null)
                    {
                        var json = System.Text.Json.JsonSerializer.Serialize(routingResult.notifications);
                        var parsed = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                        if (parsed != null) notifications = parsed;
                    }
                }
                catch { }

                return new WorkflowRouting
                {
                    NextStep = nextStep,
                    WorkflowStatus = status,
                    RequiresApproval = requiresApproval,
                    AutoActions = autoActions,
                    Notifications = notifications
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate routing rules for {WorkflowType} step {CurrentStep}", workflowType, currentStep);
                return new WorkflowRouting { NextStep = "MANUAL_REVIEW", WorkflowStatus = "PENDING", RequiresApproval = true };
            }
        }

        public async Task<List<ApprovalRequirement>> EvaluateApprovalRulesAsync(string workflowType, Dictionary<string, object> context)
        {
            try
            {
                var approvalExpressionId = GetApprovalExpressionId(workflowType);
                var approvalContext = new Dictionary<string, object>(context)
                {
                    ["workflow_type"] = workflowType,
                    ["evaluation_timestamp"] = DateTime.UtcNow.ToString("O")
                };

                // Approval expression returns a plain string (role name)
                var approvalResult = await EvaluateExpressionAsync<string>(approvalExpressionId, approvalContext);
                var role = approvalResult?.Trim('"') ?? "MANAGER";

                return new List<ApprovalRequirement>
                {
                    new ApprovalRequirement { Level = role, Role = role, IsRequired = true, TimeoutHours = 24 }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to evaluate approval rules for {WorkflowType}", workflowType);
                return new List<ApprovalRequirement>
                {
                    new ApprovalRequirement { Level = "MANAGER", Role = "APPROVER", IsRequired = true, TimeoutHours = 24 }
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
                    ["step_action"] = action,
                    ["step_current"] = instance.CurrentStep,
                    ["workflow_status"] = instance.Status
                };

                var completionResult = await EvaluateExpressionAsync<dynamic>(completionExpressionId, completionContext);

                bool canProceed = false;
                string? errorMessage = null;
                try { canProceed = completionResult.canProceed ?? false; } catch { }
                try { errorMessage = completionResult.errorMessage?.ToString(); } catch { }

                // Plain bool result
                if (completionResult is System.Text.Json.JsonElement je && je.ValueKind == System.Text.Json.JsonValueKind.True)
                    canProceed = true;

                return new StepCompletionResult { CanProceed = canProceed, ErrorMessage = errorMessage };
            }
            catch (Exception ex)
            {
                // No step-completion expression for this step — allow it to proceed
                _logger.LogWarning(ex, "Step completion expression missing for {WorkflowType}/{Step} — defaulting to allow", instance.WorkflowType, instance.CurrentStep);
                return new StepCompletionResult { CanProceed = true };
            }
        }

        private async Task ApplyInitialConditionsAsync(WorkflowInstance instance)
        {
            try
            {
                var conditions = await EvaluateExpressionAsync<Dictionary<string, object>>(
                    "EXPR_WORKFLOW_INITIAL_CONDITIONS", instance.Context);
                foreach (var condition in conditions)
                    instance.Context[$"condition.{condition.Key}"] = condition.Value;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Initial conditions expression missing for {WorkflowType} — skipping", instance.WorkflowType);
            }
        }

        private async Task FinalizeWorkflowAsync(WorkflowInstance instance)
        {
            try
            {
                await EvaluateExpressionAsync<object>("EXPR_WORKFLOW_FINALIZATION", instance.Context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Finalization expression missing for {InstanceId} — marking COMPLETED anyway", instance.Id);
            }
            instance.Status = "COMPLETED";
            instance.CompletedAt = DateTime.UtcNow;
        }

        // ── DB persistence ────────────────────────────────────────────────────────

        private async Task<WorkflowInstance?> LoadWorkflowInstanceAsync(Guid instanceId)
        {
            var entity = await _db.WorkflowInstances.FirstOrDefaultAsync(w => w.Id == instanceId);
            if (entity == null) return null;

            var ctx = string.IsNullOrEmpty(entity.ContextJson)
                ? new Dictionary<string, object>()
                : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(entity.ContextJson) ?? new();

            var approvals = string.IsNullOrEmpty(entity.ApprovalRequirementsJson)
                ? new List<ApprovalRequirement>()
                : System.Text.Json.JsonSerializer.Deserialize<List<ApprovalRequirement>>(entity.ApprovalRequirementsJson) ?? new();

            return new WorkflowInstance
            {
                Id = entity.Id,
                WorkflowType = entity.WorkflowType,
                EntityId = entity.EntityId,
                EntityType = entity.EntityType,
                CurrentStep = entity.CurrentStep,
                Status = entity.Status,
                Context = ctx,
                ApprovalRequirements = approvals,
                CreatedAt = entity.CreatedAt,
                UpdatedAt = entity.UpdatedAt,
                CompletedAt = entity.CompletedAt
            };
        }

        private async Task SaveWorkflowInstanceAsync(WorkflowInstance instance)
        {
            var contextJson = System.Text.Json.JsonSerializer.Serialize(instance.Context);
            var approvalJson = System.Text.Json.JsonSerializer.Serialize(instance.ApprovalRequirements);

            var entity = await _db.WorkflowInstances.FirstOrDefaultAsync(w => w.Id == instance.Id);

            if (entity == null)
            {
                entity = new WorkflowInstanceEntity
                {
                    Id = instance.Id,
                    WorkflowType = instance.WorkflowType,
                    EntityId = instance.EntityId,
                    EntityType = instance.EntityType,
                    CurrentStep = instance.CurrentStep,
                    Status = instance.Status,
                    ContextJson = contextJson,
                    ApprovalRequirementsJson = approvalJson,
                    CreatedAt = instance.CreatedAt,
                    UpdatedAt = instance.UpdatedAt,
                    CompletedAt = instance.CompletedAt
                };
                _db.WorkflowInstances.Add(entity);
            }
            else
            {
                entity.CurrentStep = instance.CurrentStep;
                entity.Status = instance.Status;
                entity.ContextJson = contextJson;
                entity.ApprovalRequirementsJson = approvalJson;
                entity.UpdatedAt = instance.UpdatedAt;
                entity.CompletedAt = instance.CompletedAt;
            }

            await _db.SaveChangesAsync();
            _logger.LogInformation("Saved workflow instance {InstanceId} at step {Step}", instance.Id, instance.CurrentStep);
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private async Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context)
        {
            var request = new { ExpressionId = expressionId, Variables = context };
            var response = await _expressionClient.PostAsJsonAsync("/api/Expressions/execute", request);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<ExpressionExecutionResponse>();
            if (result == null || !result.Success)
                throw new Exception($"Expression execution failed: {result?.ErrorMessage}");

            return System.Text.Json.JsonSerializer.Deserialize<T>(
                System.Text.Json.JsonSerializer.Serialize(result.Result))!;
        }

        private string GetRoutingExpressionId(string workflowType)
            => $"EXPR_ROUTING_{workflowType.ToUpper()}";

        private string GetApprovalExpressionId(string workflowType)
            => $"EXPR_APPROVAL_{workflowType.ToUpper()}";

        private string GetStepCompletionExpressionId(string workflowType, string step)
            => $"EXPR_STEP_COMPLETION_{workflowType.ToUpper()}_{step.ToUpper()}";
    }
}
