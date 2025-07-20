using Microsoft.AspNetCore.Mvc;

namespace TemplateManagementService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TemplatesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetTemplates()
        {
            // Placeholder: Return sample templates
            return Ok(new[] { new { Id = 1, Name = "Account Statement" }, new { Id = 2, Name = "Welcome Email" } });
        }
    }
}
