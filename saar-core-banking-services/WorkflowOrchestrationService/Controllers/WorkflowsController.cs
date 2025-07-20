using Microsoft.AspNetCore.Mvc;

namespace WorkflowOrchestrationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetWorkflows()
        {
            // Placeholder: Return sample workflows
            return Ok(new[] { new { Id = 1, Name = "Account Opening" }, new { Id = 2, Name = "Loan Origination" } });
        }
    }
}
