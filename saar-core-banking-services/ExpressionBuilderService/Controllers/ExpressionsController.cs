using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using ExpressionBuilderService.Models;
using ExpressionBuilderService.Services;
using ExpressionBuilderService.Engine;

namespace ExpressionBuilderService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExpressionsController : ControllerBase
    {
        private readonly IExpressionService _expressionService;
        private readonly ILogger<ExpressionsController> _logger;

        public ExpressionsController(IExpressionService expressionService, ILogger<ExpressionsController> logger)
        {
            _expressionService = expressionService;
            _logger = logger;
        }

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

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ExpressionResponse>> GetExpression(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var response = await _expressionService.GetExpressionAsync(id, tenantId);
                if (response == null) return NotFound();
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expression {Id}", id);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("by-expression-id/{expressionId}")]
        public async Task<ActionResult<ExpressionResponse>> GetExpressionByExpressionId(string expressionId)
        {
            try
            {
                var tenantId = GetTenantId();
                var response = await _expressionService.GetExpressionByExpressionIdAsync(expressionId, tenantId);
                if (response == null) return NotFound();
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expression {ExpressionId}", expressionId);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet]
        public async Task<ActionResult<object>> GetExpressions([FromQuery] string? category = null, [FromQuery] string? status = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var tenantId = GetTenantId();
                if (page < 1) page = 1;
                if (pageSize < 1 || pageSize > 100) pageSize = 20;
                var expressions = await _expressionService.GetExpressionsAsync(tenantId, category, status, page, pageSize);
                var response = new { expressions, pagination = new { page, pageSize, hasNext = expressions.Count == pageSize } };
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expressions");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteExpression(Guid id)
        {
            try
            {
                var tenantId = GetTenantId();
                var result = await _expressionService.DeleteExpressionAsync(id, tenantId);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expression {Id}", id);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        private Guid GetTenantId()
        {
            var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                return Guid.Parse("00000000-0000-0000-0000-000000000001");
            }
            return tenantId;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Guid.Parse("00000000-0000-0000-0000-000000000001");
            }
            return userId;
        }
    }

    [ApiController]
    [Route("api/expression-engine")]
    public class ExpressionEngineController : ControllerBase
    {
        private readonly IExpressionService _expressionService;
        private readonly IExpressionEngine _expressionEngine;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<ExpressionEngineController> _logger;

        public ExpressionEngineController(IExpressionService expressionService, IExpressionEngine expressionEngine, IWebHostEnvironment env, ILogger<ExpressionEngineController> logger)
        {
            _expressionService = expressionService;
            _expressionEngine = expressionEngine;
            _env = env;
            _logger = logger;
        }

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

        [HttpPost("execute")]
        public async Task<IActionResult> ExecuteExpression([FromBody] ExpressionExecutionRequest request)
        {
            try
            {
                var tenantId = GetTenantId();
                var userId = GetUserId();
                var result = await _expressionService.ExecuteExpressionAsync(request, tenantId, userId);
                if (!result.Success)
                {
                    if (_env.EnvironmentName?.Equals("Development", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        return BadRequest(new { success = false, error = result.ErrorMessage, details = result });
                    }
                    return BadRequest(new { success = false, error = result.ErrorMessage });
                }
                return Ok(new { success = true, result = result.Result, executionTimeMs = result.ExecutionTimeMs });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing expression");
                if (_env.EnvironmentName?.Equals("Development", StringComparison.OrdinalIgnoreCase) == true)
                {
                    return StatusCode(500, new { success = false, error = ex.Message, details = ex.ToString() });
                }
                return StatusCode(500, new { success = false, error = "Internal server error" });
            }
        }

        [HttpPost("test-simple")]
        public async Task<ActionResult<object>> TestExpressionSimple([FromBody] SimpleTestRequest request)
        {
            try
            {
                _logger.LogInformation("Testing simple expression: {Expression}", request.Expression);

                if (string.IsNullOrWhiteSpace(request.Expression))
                {
                    return Ok(new { success = false, result = (object?)null, expression = request.Expression, error = "Expression cannot be empty", executionTime = 0 });
                }

                var startTime = DateTime.UtcNow;
                var variables = request.Variables ?? new Dictionary<string, object>();

                var validationRequest = new ExpressionValidationRequest
                {
                    ExpressionText = request.Expression,
                    ReturnType = request.ReturnType ?? "boolean",
                    ContextType = request.ContextType ?? "dynamic",
                    Variables = variables
                };

                var tenantId = GetTenantId();
                var validation = await _expressionService.ValidateExpressionAsync(validationRequest, tenantId);

                if (!validation.IsValid)
                {
                    return Ok(new { success = false, result = (object?)null, expression = request.Expression, error = validation.Errors?.FirstOrDefault() ?? "Expression validation failed", executionTime = (int)(DateTime.UtcNow - startTime).TotalMilliseconds });
                }

                var exec = await _expressionEngine.ExecuteExpressionAsync(request.Expression, request.ContextType ?? "dynamic", variables);
                var executionTime = (int)(DateTime.UtcNow - startTime).TotalMilliseconds;

                if (!exec.Success)
                {
                    return Ok(new { success = false, result = (object?)null, expression = request.Expression, executionTime = executionTime, error = exec.ErrorMessage });
                }

                return Ok(new { success = true, result = exec.Result, expression = request.Expression, executionTime = executionTime, error = (string?)null });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing expression: {Expression}", request.Expression);
                return StatusCode(500, new { success = false, error = ex.Message, expression = request.Expression, executionTime = 0 });
            }
        }

        private Guid GetTenantId()
        {
            var tenantIdClaim = User.FindFirst("tenant_id")?.Value;
            if (string.IsNullOrEmpty(tenantIdClaim) || !Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                return Guid.Parse("00000000-0000-0000-0000-000000000001");
            }
            return tenantId;
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Guid.Parse("00000000-0000-0000-0000-000000000001");
            }
            return userId;
        }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class SystemController : ControllerBase
    {
        private readonly ILogger<SystemController> _logger;

        public SystemController(ILogger<SystemController> logger)
        {
            _logger = logger;
        }

        [HttpGet("health")]
        public ActionResult GetHealth()
        {
            return Ok(new
            {
                status = "healthy",
                service = "Expression Builder Service",
                version = "1.0.0",
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

    public class SimpleTestRequest
    {
        public string Expression { get; set; } = string.Empty;
        public string? ReturnType { get; set; }
        public string? ContextType { get; set; }
        public Dictionary<string, object>? Variables { get; set; }
    }
    }
