namespace WorkflowOrchestrationService.Models
{
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
