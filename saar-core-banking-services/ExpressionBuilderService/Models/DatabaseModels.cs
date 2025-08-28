using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Net;

namespace ExpressionBuilderService.Models;

/// <summary>
/// Database entity for expression definitions
/// </summary>
public class ExpressionDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid TenantId { get; set; }
    
    [Required, MaxLength(200)]
    public string ExpressionId { get; set; } = string.Empty;
    
    [Required, MaxLength(500)]
    public string Name { get; set; } = string.Empty;
    
    public string? Description { get; set; }
    
    [Required, MaxLength(100)]
    public string Category { get; set; } = string.Empty;
    
    [MaxLength(100)]
    public string? SubCategory { get; set; }
    
    [Required]
    public string ExpressionText { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string ReturnType { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string ContextType { get; set; } = string.Empty;
    
    public string? CompiledCode { get; set; }
    
    [Required, MaxLength(100)]
    public string UsageType { get; set; } = string.Empty;
    
    [Required, MaxLength(50)]
    public string Version { get; set; } = "1.0";
    
    [Required, MaxLength(50)]
    public string Status { get; set; } = "Draft";
    
    public bool IsGlobal { get; set; }
    public bool IsTemplate { get; set; }
    
    // Performance metrics
    public int AverageExecutionTimeMs { get; set; }
    public long TotalExecutions { get; set; }
    public long SuccessfulExecutions { get; set; }
    public DateTime? LastExecutionAt { get; set; }
    
    // Metadata
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastCompiledAt { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    // JSON properties for flexible storage
    private string _tags = "[]";
    private string _dependencies = "[]";
    private string _variables = "{}";
    private string _functions = "[]";
    private string _integrationPoints = "[]";
    
    public List<string> Tags
    {
        get => JsonSerializer.Deserialize<List<string>>(_tags) ?? new List<string>();
        set => _tags = JsonSerializer.Serialize(value);
    }
    
    public List<string> Dependencies
    {
        get => JsonSerializer.Deserialize<List<string>>(_dependencies) ?? new List<string>();
        set => _dependencies = JsonSerializer.Serialize(value);
    }
    
    public Dictionary<string, object> Variables
    {
        get => JsonSerializer.Deserialize<Dictionary<string, object>>(_variables) ?? new Dictionary<string, object>();
        set => _variables = JsonSerializer.Serialize(value);
    }
    
    public List<string> Functions
    {
        get => JsonSerializer.Deserialize<List<string>>(_functions) ?? new List<string>();
        set => _functions = JsonSerializer.Serialize(value);
    }
    
    public List<string> IntegrationPoints
    {
        get => JsonSerializer.Deserialize<List<string>>(_integrationPoints) ?? new List<string>();
        set => _integrationPoints = JsonSerializer.Serialize(value);
    }
}

/// <summary>
/// Database entity for expression execution history
/// </summary>
public class ExpressionExecutionLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid ExpressionDefinitionId { get; set; }
    
    [Required]
    public Guid TenantId { get; set; }
    
    public Guid? UserId { get; set; }
    
    [Required, MaxLength(500)]
    public string ExecutionContext { get; set; } = string.Empty;
    
    public Guid? ContextEntityId { get; set; }
    
    [Required, MaxLength(100)]
    public string ResultType { get; set; } = string.Empty;
    
    [Required]
    public DateTime ExecutionStartTime { get; set; }
    
    [Required]
    public DateTime ExecutionEndTime { get; set; }
    
    [Required]
    public int ExecutionTimeMs { get; set; }
    
    public int MemoryUsedKB { get; set; }
    
    [Required]
    public bool Success { get; set; }
    
    public string? ErrorMessage { get; set; }
    public string? StackTrace { get; set; }
    
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    
    [MaxLength(500)]
    public string? UserAgent { get; set; }
    
    public IPAddress? IPAddress { get; set; }
    
    // JSON properties
    private string _inputVariables = "{}";
    private string _executionResult = "{}";
    
    public Dictionary<string, object> InputVariables
    {
        get => JsonSerializer.Deserialize<Dictionary<string, object>>(_inputVariables) ?? new Dictionary<string, object>();
        set => _inputVariables = JsonSerializer.Serialize(value);
    }
    
    public Dictionary<string, object> ExecutionResult
    {
        get => JsonSerializer.Deserialize<Dictionary<string, object>>(_executionResult) ?? new Dictionary<string, object>();
        set => _executionResult = JsonSerializer.Serialize(value);
    }
    
    // Navigation properties
    public ExpressionDefinition ExpressionDefinition { get; set; } = null!;
}

/// <summary>
/// Database entity for expression templates
/// </summary>
public class ExpressionTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required, MaxLength(200)]
    public string TemplateId { get; set; } = string.Empty;
    
    [Required, MaxLength(500)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    public string Description { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string Category { get; set; } = string.Empty;
    
    [Required]
    public string TemplateExpression { get; set; } = string.Empty;
    
    [Required]
    public string SampleExpression { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string ContextType { get; set; } = string.Empty;
    
    [Required, MaxLength(100)]
    public string ReturnType { get; set; } = string.Empty;
    
    public string? UsageInstructions { get; set; }
    
    public bool IsBuiltIn { get; set; } = true;
    public int SortOrder { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // JSON property for template variables
    private string _templateVariables = "{}";
    
    public Dictionary<string, object> TemplateVariables
    {
        get => JsonSerializer.Deserialize<Dictionary<string, object>>(_templateVariables) ?? new Dictionary<string, object>();
        set => _templateVariables = JsonSerializer.Serialize(value);
    }
}

/// <summary>
/// DTOs for API communication
/// </summary>
public class CreateExpressionRequest
{
    // ExpressionId is optional; if not provided the server will generate a unique one
    public string ExpressionId { get; set; } = string.Empty;
    
    [Required]
    public string Name { get; set; } = string.Empty;
    
    public string? Description { get; set; }
    
    [Required]
    public string Category { get; set; } = string.Empty;
    
    public string? SubCategory { get; set; }
    
    [Required]
    public string ExpressionText { get; set; } = string.Empty;
    
    [Required]
    public string ReturnType { get; set; } = string.Empty;
    
    [Required]
    public string ContextType { get; set; } = string.Empty;
    
    [Required]
    public string UsageType { get; set; } = string.Empty;
    
    public List<string> Tags { get; set; } = new();
    public Dictionary<string, object> Variables { get; set; } = new();
}

public class UpdateExpressionRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ExpressionText { get; set; }
    public string? Category { get; set; }
    public string? SubCategory { get; set; }
    public List<string>? Tags { get; set; }
    public Dictionary<string, object>? Variables { get; set; }
}

public class ExpressionValidationRequest
{
    [Required]
    public string ExpressionText { get; set; } = string.Empty;
    
    [Required]
    public string ContextType { get; set; } = string.Empty;
    
    [Required]
    public string ReturnType { get; set; } = string.Empty;
    
    public Dictionary<string, object> Variables { get; set; } = new();
}

public class ExpressionExecutionRequest
{
    [Required]
    public string ExpressionId { get; set; } = string.Empty;
    
    [Required]
    public Dictionary<string, object> Variables { get; set; } = new();
    
    public string? ExecutionContext { get; set; }
    public Guid? ContextEntityId { get; set; }
}

public class ExpressionResponse
{
    public Guid Id { get; set; }
    public string ExpressionId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? SubCategory { get; set; }
    public string ExpressionText { get; set; } = string.Empty;
    public string ReturnType { get; set; } = string.Empty;
    public string ContextType { get; set; } = string.Empty;
    public string UsageType { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool IsGlobal { get; set; }
    public bool IsTemplate { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<string> Dependencies { get; set; } = new();
    public Dictionary<string, object> Variables { get; set; } = new();
    public List<string> Functions { get; set; } = new();
    public int AverageExecutionTimeMs { get; set; }
    public long TotalExecutions { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LastCompiledAt { get; set; }
}

public class ExpressionExecutionResponse
{
    public bool Success { get; set; }
    public object? Result { get; set; }
    public string? ResultType { get; set; }
    public int ExecutionTimeMs { get; set; }
    public long MemoryUsedKB { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime ExecutedAt { get; set; }
}

public class ExpressionValidationResponse
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public ExpressionMetadata? Metadata { get; set; }
}
