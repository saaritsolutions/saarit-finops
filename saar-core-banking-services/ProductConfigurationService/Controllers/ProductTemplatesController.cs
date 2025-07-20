using Microsoft.AspNetCore.Mvc;

namespace ProductConfigurationService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductTemplatesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetTemplates()
        {
            // Placeholder: Return sample product templates
            return Ok(new[] { new { Id = 1, Name = "Savings Account" }, new { Id = 2, Name = "Current Account" } });
        }
    }
}
