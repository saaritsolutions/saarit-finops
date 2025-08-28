using ExpressionBuilderService.Models;
using ExpressionBuilderService.Data;
using ExpressionBuilderService.Engine;
using Microsoft.EntityFrameworkCore;

namespace ExpressionBuilderService.Services;

/// <summary>
/// Interface for expression management service
/// </summary>
public interface IExpressionService
{
    Task<ExpressionResponse> CreateExpressionAsync(CreateExpressionRequest request, Guid tenantId, Guid userId);
    Task<ExpressionResponse> UpdateExpressionAsync(Guid id, UpdateExpressionRequest request, Guid tenantId, Guid userId);
    Task<bool> DeleteExpressionAsync(Guid id, Guid tenantId);
    Task<ExpressionResponse?> GetExpressionAsync(Guid id, Guid tenantId);
    Task<ExpressionResponse?> GetExpressionByExpressionIdAsync(string expressionId, Guid tenantId);
    Task<List<ExpressionResponse>> GetExpressionsAsync(Guid tenantId, string? category = null, string? status = null, int page = 1, int pageSize = 20);
    Task<ExpressionValidationResponse> ValidateExpressionAsync(ExpressionValidationRequest request, Guid tenantId);
    Task<ExpressionExecutionResponse> ExecuteExpressionAsync(ExpressionExecutionRequest request, Guid tenantId, Guid? userId = null);
    Task<List<ExpressionTemplate>> GetTemplatesAsync(string? category = null);
    Task<bool> ApproveExpressionAsync(Guid id, Guid tenantId, Guid approverId);
    Task<List<ExpressionExecutionLog>> GetExecutionHistoryAsync(Guid expressionId, Guid tenantId, int page = 1, int pageSize = 50);
}

/// <summary>
/// Expression management service implementation
/// </summary>
public class ExpressionService : IExpressionService
{
    private readonly ExpressionDbContext _context;
    private readonly IExpressionEngine _expressionEngine;
    private readonly ILogger<ExpressionService> _logger;

    public ExpressionService(
        ExpressionDbContext context,
        IExpressionEngine expressionEngine,
        ILogger<ExpressionService> logger)
    {
        _context = context;
        _expressionEngine = expressionEngine;
        _logger = logger;
    }

    // Helper to truncate long strings to avoid DB column length limits
    private static string? TruncateString(string? input, int maxLength)
    {
        if (string.IsNullOrEmpty(input)) return input;
        return input.Length <= maxLength ? input : input.Substring(0, maxLength);
    }

    public async Task<ExpressionResponse> CreateExpressionAsync(CreateExpressionRequest request, Guid tenantId, Guid userId)
    {
        try
        {
            _logger.LogInformation("Creating expression {ExpressionId} for tenant {TenantId}", request.ExpressionId, tenantId);

            // If client did not provide an ExpressionId, generate a unique one
            if (string.IsNullOrWhiteSpace(request.ExpressionId))
            {
                request.ExpressionId = $"EXPR_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}_{Guid.NewGuid().ToString().Split('-')[0].ToUpper()}";
                _logger.LogInformation("No ExpressionId provided; generated {ExpressionId}", request.ExpressionId);
            }

            // Check if expression ID already exists for this tenant
            var existingExpression = await _context.ExpressionDefinitions
                .FirstOrDefaultAsync(e => e.TenantId == tenantId && e.ExpressionId == request.ExpressionId);

            if (existingExpression != null)
            {
                throw new InvalidOperationException($"Expression with ID '{request.ExpressionId}' already exists for this tenant");
            }

            // Validate the expression
            var validationResult = await _expressionEngine.ValidateExpressionAsync(
                request.ExpressionText, 
                request.ContextType, 
                request.ReturnType, 
                request.Variables);

            if (!validationResult.IsValid)
            {
                throw new InvalidOperationException($"Expression validation failed: {string.Join(", ", validationResult.Errors)}");
            }

            // Compile the expression for performance
            var compilationResult = await _expressionEngine.CompileExpressionAsync(
                request.ExpressionText, 
                request.ContextType, 
                request.ReturnType);

            // Create the expression definition
            var expressionDefinition = new ExpressionDefinition
            {
                TenantId = tenantId,
                ExpressionId = request.ExpressionId,
                Name = request.Name,
                Description = request.Description,
                Category = request.Category,
                SubCategory = request.SubCategory,
                ExpressionText = request.ExpressionText,
                ReturnType = request.ReturnType,
                ContextType = request.ContextType,
                UsageType = request.UsageType,
                CompiledCode = compilationResult.GeneratedCode,
                Tags = request.Tags,
                Variables = request.Variables,
                CreatedBy = userId,
                Status = "Active"
            };

            // Analyze the expression for metadata
            var metadata = await _expressionEngine.AnalyzeExpressionAsync(request.ExpressionText, request.ContextType);
            expressionDefinition.Functions = metadata.Functions;
            expressionDefinition.Dependencies = metadata.Dependencies;

            _context.ExpressionDefinitions.Add(expressionDefinition);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Successfully created expression {ExpressionId} with ID {Id}", request.ExpressionId, expressionDefinition.Id);

            return MapToResponse(expressionDefinition);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating expression {ExpressionId} for tenant {TenantId}", request.ExpressionId, tenantId);
            throw;
        }
    }

    public async Task<ExpressionResponse> UpdateExpressionAsync(Guid id, UpdateExpressionRequest request, Guid tenantId, Guid userId)
    {
        try
        {
            _logger.LogInformation("Updating expression {Id} for tenant {TenantId}", id, tenantId);

            var expression = await _context.ExpressionDefinitions
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);

            if (expression == null)
            {
                throw new InvalidOperationException("Expression not found");
            }

            // Update basic properties
            if (!string.IsNullOrEmpty(request.Name))
                expression.Name = request.Name;
            
            if (request.Description != null)
                expression.Description = request.Description;
            
            if (!string.IsNullOrEmpty(request.Category))
                expression.Category = request.Category;
            
            if (request.SubCategory != null)
                expression.SubCategory = request.SubCategory;
            
            if (request.Tags != null)
                expression.Tags = request.Tags;
            
            if (request.Variables != null)
                expression.Variables = request.Variables;

            // Handle expression text update
            if (!string.IsNullOrEmpty(request.ExpressionText) && request.ExpressionText != expression.ExpressionText)
            {
                // Validate the new expression
                var validationResult = await _expressionEngine.ValidateExpressionAsync(
                    request.ExpressionText, 
                    expression.ContextType, 
                    expression.ReturnType, 
                    request.Variables ?? expression.Variables);

                if (!validationResult.IsValid)
                {
                    throw new InvalidOperationException($"Expression validation failed: {string.Join(", ", validationResult.Errors)}");
                }

                // Compile the new expression
                var compilationResult = await _expressionEngine.CompileExpressionAsync(
                    request.ExpressionText, 
                    expression.ContextType, 
                    expression.ReturnType);

                expression.ExpressionText = request.ExpressionText;
                expression.CompiledCode = compilationResult.GeneratedCode;
                expression.LastCompiledAt = DateTime.UtcNow;
                expression.Status = "Active"; // Reset to active after successful compilation

                // Update metadata
                var metadata = await _expressionEngine.AnalyzeExpressionAsync(request.ExpressionText, expression.ContextType);
                expression.Functions = metadata.Functions;
                expression.Dependencies = metadata.Dependencies;
            }

            expression.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Successfully updated expression {Id}", id);

            return MapToResponse(expression);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating expression {Id} for tenant {TenantId}", id, tenantId);
            throw;
        }
    }

    public async Task<bool> DeleteExpressionAsync(Guid id, Guid tenantId)
    {
        try
        {
            _logger.LogInformation("Deleting expression {Id} for tenant {TenantId}", id, tenantId);

            var expression = await _context.ExpressionDefinitions
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);

            if (expression == null)
            {
                return false;
            }

            // Soft delete by updating status
            expression.Status = "Deleted";
            expression.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Successfully deleted expression {Id}", id);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting expression {Id} for tenant {TenantId}", id, tenantId);
            throw;
        }
    }

    public async Task<ExpressionResponse?> GetExpressionAsync(Guid id, Guid tenantId)
    {
        var expression = await _context.ExpressionDefinitions
            .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId && e.Status != "Deleted");

        return expression != null ? MapToResponse(expression) : null;
    }

    public async Task<ExpressionResponse?> GetExpressionByExpressionIdAsync(string expressionId, Guid tenantId)
    {
        var expression = await _context.ExpressionDefinitions
            .FirstOrDefaultAsync(e => e.ExpressionId == expressionId && e.TenantId == tenantId && e.Status != "Deleted");

        return expression != null ? MapToResponse(expression) : null;
    }

    public async Task<List<ExpressionResponse>> GetExpressionsAsync(Guid tenantId, string? category = null, string? status = null, int page = 1, int pageSize = 20)
    {
        var query = _context.ExpressionDefinitions
            .Where(e => e.TenantId == tenantId && e.Status != "Deleted");

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(e => e.Category == category);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(e => e.Status == status);
        }

        var expressions = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return expressions.Select(MapToResponse).ToList();
    }

    public async Task<ExpressionValidationResponse> ValidateExpressionAsync(ExpressionValidationRequest request, Guid tenantId)
    {
        try
        {
            _logger.LogInformation("Validating expression for tenant {TenantId}", tenantId);

            // Run standard validation
            var validation = await _expressionEngine.ValidateExpressionAsync(
                request.ExpressionText,
                request.ContextType,
                request.ReturnType,
                request.Variables);

            // In Development, include generated code when validation failed to aid debugging
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
            if (!validation.IsValid && env.Equals("Development", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var compile = await _expressionEngine.CompileExpressionAsync(request.ExpressionText, request.ContextType, request.ReturnType);
                    if (compile != null && !string.IsNullOrEmpty(compile.GeneratedCode))
                    {
                        validation.Errors = validation.Errors ?? new List<string>();
                        validation.Errors.Add("--- Generated code start ---");
                        validation.Errors.Add(compile.GeneratedCode);
                        validation.Errors.Add("--- Generated code end ---");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to compile expression for debug output");
                }
            }

            return validation;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating expression for tenant {TenantId}", tenantId);
            return new ExpressionValidationResponse
            {
                IsValid = false,
                Errors = new List<string> { $"Validation error: {ex.Message}" }
            };
        }
    }

    public async Task<ExpressionExecutionResponse> ExecuteExpressionAsync(ExpressionExecutionRequest request, Guid tenantId, Guid? userId = null)
    {
        var executionStartTime = DateTime.UtcNow;
        
        try
        {
            _logger.LogInformation("Executing expression {ExpressionId} for tenant {TenantId}", request.ExpressionId, tenantId);

            // Get the expression
            var expression = await _context.ExpressionDefinitions
                .FirstOrDefaultAsync(e => e.ExpressionId == request.ExpressionId && e.TenantId == tenantId && e.Status == "Active");

            if (expression == null)
            {
                return new ExpressionExecutionResponse
                {
                    Success = false,
                    ErrorMessage = "Expression not found or not active",
                    ExecutedAt = DateTime.UtcNow
                };
            }

            // Execute the expression
            var result = await _expressionEngine.ExecuteExpressionAsync(
                expression.ExpressionText,
                expression.ContextType,
                request.Variables);

            // Helper to truncate long strings to avoid DB column length limits
            static string? TruncateString(string? input, int maxLength)
            {
                if (string.IsNullOrEmpty(input)) return input;
                return input.Length <= maxLength ? input : input.Substring(0, maxLength);
            }

            // Log the execution (capture JSON to help debug serialization issues)
            var executionLog = new ExpressionExecutionLog
            {
                ExpressionDefinitionId = expression.Id,
                TenantId = tenantId,
                UserId = userId,
                ExecutionContext = request.ExecutionContext ?? "API",
                ContextEntityId = request.ContextEntityId,
                ResultType = result.ResultType ?? "Unknown",
                ExecutionStartTime = executionStartTime,
                ExecutionEndTime = DateTime.UtcNow,
                ExecutionTimeMs = result.ExecutionTimeMs,
                MemoryUsedKB = (int)result.MemoryUsedKB,
                Success = result.Success,
                ErrorMessage = TruncateString(result.ErrorMessage, 1900),
                InputVariables = request.Variables,
                // Avoid storing very large execution results that can exceed DB column limits
                ExecutionResult = result.Result != null ? new Dictionary<string, object> { { "result", TruncateString(result.Result?.ToString(), 1800) as object } } : new Dictionary<string, object>(),
                IPAddress = GetValidIpAddress(request)
            };

        // Helper to safely extract and validate IP address
        static System.Net.IPAddress? GetValidIpAddress(ExpressionExecutionRequest req)
        {
            if (req == null) return null;

            // Prefer explicit ExecutionContext if it looks like an IP
            if (!string.IsNullOrWhiteSpace(req.ExecutionContext) && System.Net.IPAddress.TryParse(req.ExecutionContext, out var parsedFromContext))
            {
                return parsedFromContext;
            }

            // Sometimes IP may be provided in variables or metadata, try common keys
            if (req.Variables != null)
            {
                try
                {
                    if (req.Variables.TryGetValue("ipAddress", out var ipObj) && ipObj != null)
                    {
                        var ipStr = ipObj.ToString();
                        if (System.Net.IPAddress.TryParse(ipStr, out var parsed)) return parsed;
                    }
                    if (req.Variables.TryGetValue("ip", out var ipObj2) && ipObj2 != null)
                    {
                        var ipStr = ipObj2.ToString();
                        if (System.Net.IPAddress.TryParse(ipStr, out var parsed2)) return parsed2;
                    }
                }
                catch { /* ignore parsing errors */ }
            }

            return null;
        }

            _context.ExpressionExecutionLogs.Add(executionLog);

            // Update expression statistics
            expression.TotalExecutions++;
            if (result.Success)
            {
                expression.SuccessfulExecutions++;
                expression.AverageExecutionTimeMs = (expression.AverageExecutionTimeMs + result.ExecutionTimeMs) / 2;
            }
            expression.LastExecutionAt = DateTime.UtcNow;

            // Try to persist execution and capture DB-level errors for debugging
            try
            {
                // Attempt to serialize input variables & result for debug log (won't throw)
                try
                {
                    var ivJson = System.Text.Json.JsonSerializer.Serialize(request.Variables);
                    var erJson = System.Text.Json.JsonSerializer.Serialize(executionLog.ExecutionResult);
                    _logger.LogDebug("Persisting execution log for {ExpressionId}. InputVariables: {InputVars}, ExecutionResult: {ExecResult}", request.ExpressionId, ivJson, erJson);
                }
                catch { /* ignore serialization debug failures */ }

                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
            {
                // Log full DB exception and return a helpful execution response for debugging
                _logger.LogError(dbEx, "Failed to save execution log for expression {ExpressionId}. DbUpdateException", request.ExpressionId);
                var inner = dbEx.InnerException?.Message;
                return new ExpressionExecutionResponse
                {
                    Success = false,
                    ErrorMessage = $"DbUpdateException saving execution log: {dbEx.Message}" + (inner != null ? $" | Inner: {inner}" : string.Empty),
                    ExecutedAt = DateTime.UtcNow,
                    ExecutionTimeMs = (int)(DateTime.UtcNow - executionStartTime).TotalMilliseconds
                };
            }

            _logger.LogInformation("Successfully executed expression {ExpressionId}. Success: {Success}, Time: {ExecutionTime}ms", 
                request.ExpressionId, result.Success, result.ExecutionTimeMs);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing expression {ExpressionId} for tenant {TenantId}", request.ExpressionId, tenantId);
            
            // Still log the failed execution
            try
            {
                var expression = await _context.ExpressionDefinitions
                    .FirstOrDefaultAsync(e => e.ExpressionId == request.ExpressionId && e.TenantId == tenantId);

                if (expression != null)
                {
                    var executionLog = new ExpressionExecutionLog
                    {
                        ExpressionDefinitionId = expression.Id,
                        TenantId = tenantId,
                        UserId = userId,
                        ExecutionContext = request.ExecutionContext ?? "API",
                        ContextEntityId = request.ContextEntityId,
                        ResultType = "Error",
                        ExecutionStartTime = executionStartTime,
                        ExecutionEndTime = DateTime.UtcNow,
                        ExecutionTimeMs = (int)(DateTime.UtcNow - executionStartTime).TotalMilliseconds,
                        Success = false,
                        ErrorMessage = TruncateString(ex.Message, 1900),
                        StackTrace = TruncateString(ex.StackTrace, 1900),
                        InputVariables = request.Variables
                    };

                    _context.ExpressionExecutionLogs.Add(executionLog);
                    expression.TotalExecutions++;
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception logEx)
            {
                _logger.LogError(logEx, "Failed to log execution error");
            }

            return new ExpressionExecutionResponse
            {
                Success = false,
                ErrorMessage = ex.Message,
                ExecutedAt = DateTime.UtcNow,
                ExecutionTimeMs = (int)(DateTime.UtcNow - executionStartTime).TotalMilliseconds
            };
        }
    }

    public async Task<List<ExpressionTemplate>> GetTemplatesAsync(string? category = null)
    {
        var query = _context.ExpressionTemplates.AsQueryable();

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(t => t.Category == category);
        }

        return await query
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToListAsync();
    }

    public async Task<bool> ApproveExpressionAsync(Guid id, Guid tenantId, Guid approverId)
    {
        try
        {
            var expression = await _context.ExpressionDefinitions
                .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId);

            if (expression == null)
            {
                return false;
            }

            expression.Status = "Approved";
            expression.ApprovedBy = approverId;
            expression.ApprovedAt = DateTime.UtcNow;
            expression.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Expression {Id} approved by user {ApproverId}", id, approverId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving expression {Id}", id);
            return false;
        }
    }

    public async Task<List<ExpressionExecutionLog>> GetExecutionHistoryAsync(Guid expressionId, Guid tenantId, int page = 1, int pageSize = 50)
    {
        return await _context.ExpressionExecutionLogs
            .Include(l => l.ExpressionDefinition)
            .Where(l => l.ExpressionDefinitionId == expressionId && l.TenantId == tenantId)
            .OrderByDescending(l => l.ExecutedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    private static ExpressionResponse MapToResponse(ExpressionDefinition expression)
    {
        return new ExpressionResponse
        {
            Id = expression.Id,
            ExpressionId = expression.ExpressionId,
            Name = expression.Name,
            Description = expression.Description,
            Category = expression.Category,
            SubCategory = expression.SubCategory,
            ExpressionText = expression.ExpressionText,
            ReturnType = expression.ReturnType,
            ContextType = expression.ContextType,
            UsageType = expression.UsageType,
            Version = expression.Version,
            Status = expression.Status,
            IsGlobal = expression.IsGlobal,
            IsTemplate = expression.IsTemplate,
            Tags = expression.Tags,
            Dependencies = expression.Dependencies,
            Variables = expression.Variables,
            Functions = expression.Functions,
            AverageExecutionTimeMs = expression.AverageExecutionTimeMs,
            TotalExecutions = expression.TotalExecutions,
            CreatedAt = expression.CreatedAt,
            UpdatedAt = expression.UpdatedAt,
            LastCompiledAt = expression.LastCompiledAt
        };
    }
}
