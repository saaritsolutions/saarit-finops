using LoanService.Services;
using Microsoft.AspNetCore.Mvc;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/admin/config")]
    public class AdminConfigController : ControllerBase
    {
        private readonly IWorkflowOrchestrator _orchestrator;
        private readonly ILogger<AdminConfigController> _logger;

        public AdminConfigController(IWorkflowOrchestrator orchestrator, ILogger<AdminConfigController> logger)
        {
            _orchestrator = orchestrator;
            _logger = logger;
        }

        [HttpGet("workflow/{workflowType}")]
        public async Task<ActionResult<WorkflowDefinition>> GetWorkflow(string workflowType)
        {
            var def = await _orchestrator.GetDefinitionAsync(workflowType);
            return Ok(def);
        }

        [HttpPost("workflow/{workflowType}")]
        public async Task<ActionResult> SaveWorkflow(string workflowType, [FromBody] WorkflowDefinition definition)
        {
            await _orchestrator.SaveDefinitionAsync(workflowType, definition);
            return NoContent();
        }

        [HttpGet("forms/{productType}")]
        public async Task<ActionResult> GetFormSchema(string productType)
        {
            var staticPath = Path.Combine(AppContext.BaseDirectory, "Static", $"loan_form_{productType.ToUpperInvariant()}.json");
            if (!System.IO.File.Exists(staticPath)) return NotFound();
            var json = await System.IO.File.ReadAllTextAsync(staticPath);
            return Content(json, "application/json");
        }

        [HttpPost("forms/{productType}")]
        public async Task<ActionResult> SaveFormSchema(string productType)
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();
            var staticDir = Path.Combine(AppContext.BaseDirectory, "Static");
            Directory.CreateDirectory(staticDir);
            var staticPath = Path.Combine(staticDir, $"loan_form_{productType.ToUpperInvariant()}.json");
            await System.IO.File.WriteAllTextAsync(staticPath, body);
            return NoContent();
        }
    }
}
