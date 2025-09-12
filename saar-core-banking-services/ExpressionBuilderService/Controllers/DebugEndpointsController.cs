using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ExpressionBuilderService.Controllers;

[ApiController]
[Route("api/debug")]
public class DebugEndpointsController : ControllerBase
{
    private readonly IEnumerable<EndpointDataSource> _sources;
    public DebugEndpointsController(IEnumerable<EndpointDataSource> sources) => _sources = sources;

    [HttpGet("endpoints")] // GET api/debug/endpoints
    public IActionResult List()
    {
        var list = _sources
            .SelectMany(s => s.Endpoints)
            .Select(e => new {
                DisplayName = e.DisplayName,
                RoutePattern = (e as RouteEndpoint)?.RoutePattern?.RawText
            })
            .OrderBy(e => e.RoutePattern)
            .ToList();
        return Ok(list);
    }
}
