using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ExpressionBuilderService.Models;
using ExpressionBuilderService.Services;
using System.Security.Claims;

namespace ExpressionBuilderService.Controllers;

/// <summary>
/// Controller for managing expressions
/// </summary>
[ApiController]
[Route("api/[controller]")]
// [Authorize] // Temporarily disabled for testing
public class ExpressionsController : ControllerBase
{
    private readonly IExpressionService _expressionService;
    private readonly ILogger<ExpressionsController> _logger;

    public ExpressionsController(IExpressionService expressionService, ILogger<ExpressionsController> logger)
    {
        _expressionService = expressionService;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new expression
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ExpressionResponse>> CreateExpression([FromBody] CreateExpressionRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            var response = await _expressionService.CreateExpressionAsync(request, tenantId, userId);
            return CreatedAtAction(nameof(GetExpression), new { id = response.Id }, response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating expression");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Updates an existing expression
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExpressionResponse>> UpdateExpression(Guid id, [FromBody] UpdateExpressionRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            var response = await _expressionService.UpdateExpressionAsync(id, request, tenantId, userId);
            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating expression {Id}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Deletes an expression
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteExpression(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var result = await _expressionService.DeleteExpressionAsync(id, tenantId);

            if (!result)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting expression {Id}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Gets a specific expression by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExpressionResponse>> GetExpression(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var response = await _expressionService.GetExpressionAsync(id, tenantId);

            if (response == null)
            {
                return NotFound();
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving expression {Id}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Gets a specific expression by expression ID
    /// </summary>
    [HttpGet("by-expression-id/{expressionId}")]
    public async Task<ActionResult<ExpressionResponse>> GetExpressionByExpressionId(string expressionId)
    {
        try
        {
            var tenantId = GetTenantId();
            var response = await _expressionService.GetExpressionByExpressionIdAsync(expressionId, tenantId);

            if (response == null)
            {
                return NotFound();
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving expression {ExpressionId}", expressionId);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Gets a list of expressions with optional filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ExpressionResponse>>> GetExpressions(
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var tenantId = GetTenantId();

            // Validate pagination parameters
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var     expressions = await _expressionService.GetExpressionsAsync(tenantId, category, status, page, pageSize);

            var response = new
            {
                expressions,
                pagination = new
                {
                    page,
                    pageSize,
                    hasNext = expressions.Count == pageSize,
                    total = expressions.Count
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving expressions");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Approves an expression
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> ApproveExpression(Guid id)
    {
        try
        {
            var tenantId = GetTenantId();
            var approverId = GetUserId();

            var result = await _expressionService.ApproveExpressionAsync(id, tenantId, approverId);

            if (!result)
            {
                return NotFound();
            }

            return Ok(new { message = "Expression approved successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving expression {Id}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Gets execution history for an expression
    /// </summary>
    [HttpGet("{id:guid}/execution-history")]
    public async Task<ActionResult<IEnumerable<ExpressionExecutionLog>>> GetExecutionHistory(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var tenantId = GetTenantId();

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 50;

            var history = await _expressionService.GetExecutionHistoryAsync(id, tenantId, page, pageSize);

            var response = new
            {
                executionLogs = history,
                pagination = new
                {
                    page,
                    pageSize,
                    hasNext = history.Count == pageSize
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving execution history for expression {Id}", id);
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private Guid GetTenantId()
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
        {
            // For testing without authentication, use a default tenant ID
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return tenantId;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            // For testing without authentication, use a default user ID
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return userId;
    }
}

/// <summary>
/// Controller for expression validation and execution
/// </summary>
[ApiController]
[Route("api/expression-engine")]
[Authorize]
public class ExpressionEngineController : ControllerBase
{
    private readonly IExpressionService _expressionService;
    private readonly ILogger<ExpressionEngineController> _logger;

    public ExpressionEngineController(IExpressionService expressionService, ILogger<ExpressionEngineController> logger)
    {
        _expressionService = expressionService;
        _logger = logger;
    }

    /// <summary>
    /// Validates an expression without saving it
    /// </summary>
    [HttpPost("validate")]
    public async Task<ActionResult<ExpressionValidationResponse>> ValidateExpression([FromBody] ExpressionValidationRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var response = await _expressionService.ValidateExpressionAsync(request, tenantId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating expression");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Executes an expression
    /// </summary>
    [HttpPost("execute")]
    public async Task<ActionResult<ExpressionExecutionResponse>> ExecuteExpression([FromBody] ExpressionExecutionRequest request)
    {
        try
        {
            var tenantId = GetTenantId();
            var userId = GetUserId();

            var response = await _expressionService.ExecuteExpressionAsync(request, tenantId, userId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing expression");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Gets available expression templates
    /// </summary>
    [HttpGet("templates")]
    public async Task<ActionResult<IEnumerable<ExpressionTemplate>>> GetTemplates([FromQuery] string? category = null)
    {
        try
        {
            var templates = await _expressionService.GetTemplatesAsync(category);
            return Ok(templates);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving templates");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private Guid GetTenantId()
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
        {
            // For testing without authentication, use a default tenant ID
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return tenantId;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            // For testing without authentication, use a default user ID
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return userId;
    }
}

/// <summary>
/// Controller for health checks and system information
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SystemController : ControllerBase
{
    private readonly ILogger<SystemController> _logger;

    public SystemController(ILogger<SystemController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "healthy",
            timestamp = DateTime.UtcNow,
            service = "Expression Builder Service",
            version = "1.0.0"
        });
    }

    /// <summary>
    /// Gets system information
    /// </summary>
    [HttpGet("info")]
    [Authorize]
    public IActionResult Info()
    {
        return Ok(new
        {
            service = "Expression Builder Service",
            version = "1.0.0",
            description = "Banking expression builder and execution engine using Roslyn",
            features = new[]
            {
                "Real-time C# expression compilation",
                "Banking function library",
                "Security validation",
                "Multi-tenant support",
                "Expression templates",
                "Execution history tracking",
                "Performance metrics"
            },
            environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development",
            timestamp = DateTime.UtcNow
        });
    }
}
