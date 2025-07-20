using Microsoft.AspNetCore.Mvc;

namespace APIGateway.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GatewayController : ControllerBase
    {
        [HttpGet("ping")]
        public IActionResult Ping() => Ok("API Gateway is running.");
    }
}
