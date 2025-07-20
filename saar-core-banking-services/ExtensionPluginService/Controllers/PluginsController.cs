using Microsoft.AspNetCore.Mvc;

namespace ExtensionPluginService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PluginsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetPlugins()
        {
            // Placeholder: Return sample plugins
            return Ok(new[] { new { Id = 1, Name = "GST Calculation" }, new { Id = 2, Name = "Custom Alerts" } });
        }
    }
}
