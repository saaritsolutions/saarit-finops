using Microsoft.AspNetCore.Mvc;

namespace BusinessRulesEngineService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RulesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetRules()
        {
            // Placeholder: Return sample rules
            return Ok(new[] { new { Id = 1, Name = "Age Eligibility" }, new { Id = 2, Name = "Minimum Balance" } });
        }
    }
}
