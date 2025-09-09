using System.Text.Json;
using System.Text.Json.Serialization;

namespace LoanService.Services
{
    public interface IWorkflowOrchestrator
    {
        Task<LocalWorkflowInstance> StartAsync(Guid entityId, Dictionary<string, object> context, string workflowType);
        Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, string workflowType);
        Task<WorkflowDefinition> GetDefinitionAsync(string workflowType);
        Task SaveDefinitionAsync(string workflowType, WorkflowDefinition definition);
    }

    public class FileWorkflowOrchestrator : IWorkflowOrchestrator
    {
        private readonly ILogger<FileWorkflowOrchestrator> _logger;
        private readonly IServiceProvider _sp;

        public FileWorkflowOrchestrator(ILogger<FileWorkflowOrchestrator> logger, IServiceProvider sp)
        {
            _logger = logger;
            _sp = sp;
        }

        public async Task<LocalWorkflowInstance> StartAsync(Guid entityId, Dictionary<string, object> context, string workflowType)
        {
            var def = await GetDefinitionAsync(workflowType);
            var start = def.StartStep ?? def.Steps.FirstOrDefault()?.Name ?? "START";
            var next = await ResolveNextAsync(def, "START", context) ?? start;
            return new LocalWorkflowInstance
            {
                Id = Guid.NewGuid(),
                WorkflowType = workflowType,
                EntityId = entityId,
                EntityType = "LOAN",
                CurrentStep = next,
                Status = next.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) ? "COMPLETED" : "ACTIVE",
                Context = new Dictionary<string, object>(context)
            };
        }

        public async Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, string workflowType)
        {
            var def = await GetDefinitionAsync(workflowType);
            // For demo, compute routing from provided context only.
            var current = context.TryGetValue("workflow.currentStep", out var v) ? v?.ToString() ?? string.Empty : string.Empty;
            if (string.IsNullOrWhiteSpace(current)) current = def.StartStep ?? def.Steps.FirstOrDefault()?.Name ?? "START";
            var next = await ResolveNextAsync(def, current, context) ?? "COMPLETED";
            var status = next.Equals("COMPLETED", StringComparison.OrdinalIgnoreCase) ? "COMPLETED" : "ACTIVE";
            var step = def.Steps.FirstOrDefault(s => s.Name.Equals(current, StringComparison.OrdinalIgnoreCase));
            return new WorkflowStepResult
            {
                InstanceId = instanceId,
                Success = true,
                CurrentStep = current,
                NextStep = next,
                WorkflowStatus = status,
                Message = "Processed via local orchestrator",
                RequiredActions = step?.RequiredActions
            };
        }

        public async Task<WorkflowDefinition> GetDefinitionAsync(string workflowType)
        {
            var path = GetWorkflowConfigPath(workflowType);
            if (!File.Exists(path))
            {
                _logger.LogWarning("Workflow definition not found at {Path}. Returning empty.", path);
                return new WorkflowDefinition { WorkflowType = workflowType, Steps = new List<WorkflowStep>() };
            }
            await using var fs = File.OpenRead(path);
            var def = await JsonSerializer.DeserializeAsync<WorkflowDefinition>(fs, JsonOptions());
            return def ?? new WorkflowDefinition { WorkflowType = workflowType, Steps = new List<WorkflowStep>() };
        }

        public async Task SaveDefinitionAsync(string workflowType, WorkflowDefinition definition)
        {
            definition.WorkflowType = workflowType;
            var path = GetWorkflowConfigPath(workflowType);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await using var fs = File.Create(path);
            await JsonSerializer.SerializeAsync(fs, definition, JsonOptions(new JsonSerializerOptions { WriteIndented = true }));
        }

        private async Task<string?> ResolveNextAsync(WorkflowDefinition def, string currentStep, Dictionary<string, object> context)
        {
            // Special START node routes to startStep
            if (currentStep.Equals("START", StringComparison.OrdinalIgnoreCase))
            {
                return def.StartStep ?? def.Steps.FirstOrDefault()?.Name;
            }

            var step = def.Steps.FirstOrDefault(s => s.Name.Equals(currentStep, StringComparison.OrdinalIgnoreCase));
            if (step == null) return def.StartStep ?? def.Steps.FirstOrDefault()?.Name ?? "COMPLETED";

            if (!string.IsNullOrWhiteSpace(step.ConditionExpressionId))
            {
                try
                {
                    // Evaluate boolean condition via Expression service if available
                    using var scope = _sp.CreateScope();
                    var expr = scope.ServiceProvider.GetService<IExpressionEvaluationService>();
                    if (expr != null)
                    {
                        var res = await expr.EvaluateExpressionAsync<bool>(step.ConditionExpressionId!, context);
                        return res ? (step.Next ?? "COMPLETED") : (step.ElseNext ?? step.Next ?? "COMPLETED");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Condition evaluation failed for step {Step}", step.Name);
                }
            }
            return step.Next ?? "COMPLETED";
        }

        private static string GetWorkflowConfigPath(string workflowType)
        {
            var file = $"workflow_config_{workflowType.ToUpperInvariant()}.json";
            return Path.Combine(AppContext.BaseDirectory, "Static", file);
        }

        private static JsonSerializerOptions JsonOptions(JsonSerializerOptions? baseOpts = null)
        {
            var opts = baseOpts ?? new JsonSerializerOptions();
            opts.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            opts.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            return opts;
        }
    }

    public class WorkflowDefinition
    {
        public string WorkflowType { get; set; } = string.Empty;
        public string? StartStep { get; set; }
        public List<WorkflowStep> Steps { get; set; } = new();
    }

    public class WorkflowStep
    {
        public string Name { get; set; } = string.Empty;
        public string? ConditionExpressionId { get; set; }
        public string? Next { get; set; }
        public string? ElseNext { get; set; }
    // Optional list of actions the UI should present to the user at this step
    public List<string>? RequiredActions { get; set; }
    }

    public class LocalWorkflowInstance
    {
        public Guid Id { get; set; }
        public string WorkflowType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public string CurrentStep { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
    }

    // No-op fallback orchestrator for tests or when not configured
    public class NullWorkflowOrchestrator : IWorkflowOrchestrator
    {
        public Task<LocalWorkflowInstance> StartAsync(Guid entityId, Dictionary<string, object> context, string workflowType)
        {
            var inst = new LocalWorkflowInstance
            {
                Id = Guid.NewGuid(),
                WorkflowType = workflowType,
                EntityId = entityId,
                EntityType = "LOAN",
                CurrentStep = "START",
                Status = "ACTIVE",
                Context = new Dictionary<string, object>(context)
            };
            return Task.FromResult(inst);
        }

        public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, string workflowType)
        {
            return Task.FromResult(new WorkflowStepResult
            {
                InstanceId = instanceId,
                Success = true,
                CurrentStep = context.TryGetValue("workflow.currentStep", out var v) ? v?.ToString() ?? "START" : "START",
                NextStep = "COMPLETED",
                WorkflowStatus = "COMPLETED",
                Message = "Processed by Null orchestrator",
                RequiredActions = null
            });
        }

        public Task<WorkflowDefinition> GetDefinitionAsync(string workflowType)
        {
            return Task.FromResult(new WorkflowDefinition { WorkflowType = workflowType, Steps = new List<WorkflowStep>() });
        }

        public Task SaveDefinitionAsync(string workflowType, WorkflowDefinition definition)
        {
            return Task.CompletedTask;
        }
    }
}
