using Microsoft.AspNetCore.Mvc;

namespace LowCodeNoCodeAdminService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAdminFeatures()
        {
            // Placeholder: Return sample admin features
            return Ok(new[] { new { Id = 1, Name = "Configure Product" }, new { Id = 2, Name = "Design Workflow" } });
        }
    }
}
