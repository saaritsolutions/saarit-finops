using Microsoft.AspNetCore.Mvc;

namespace VersioningAuditService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAuditLogs()
        {
            // Placeholder: Return sample audit logs
            return Ok(new[] { new { Id = 1, Action = "Product Created" }, new { Id = 2, Action = "Workflow Updated" } });
        }
    }
}
