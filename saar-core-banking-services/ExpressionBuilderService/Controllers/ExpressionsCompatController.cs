using Microsoft.AspNetCore.Mvc;
using ExpressionBuilderService.Models;
using ExpressionBuilderService.Services;
using System.Security.Claims;

namespace ExpressionBuilderService.Controllers;

/// <summary>
/// Backward-compatibility controller to support legacy route /api/Expressions/execute
/// This forwards to the same service used by api/expression-engine/execute
/// </summary>
[ApiController]
[Route("api/Expressions")]
public class ExpressionsCompatController : ControllerBase
{
    private readonly IExpressionService _expressionService;
    private readonly ILogger<ExpressionsCompatController> _logger;

    public ExpressionsCompatController(IExpressionService expressionService, ILogger<ExpressionsCompatController> logger)
    {
        _expressionService = expressionService;
        _logger = logger;
    }

    /// <summary>
    /// Executes an expression by ExpressionId (legacy route)
    /// </summary>
    [HttpPost("execute")]
    public async Task<ActionResult<ExpressionExecutionResponse>> Execute([FromBody] ExpressionExecutionRequest request)
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
            _logger.LogError(ex, "Error executing expression via compatibility endpoint");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    private Guid GetTenantId()
    {
        var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
        {
            // Default tenant for testing without auth
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return tenantId;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            // Default user for testing without auth
            return Guid.Parse("00000000-0000-0000-0000-000000000001");
        }
        return userId;
    }
}
