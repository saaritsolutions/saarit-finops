using Microsoft.AspNetCore.Mvc;

namespace DynamicFieldsSchemaService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FieldsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetFields()
        {
            // Placeholder: Return sample dynamic fields
            return Ok(new[] { new { Id = 1, Name = "CustomField1" }, new { Id = 2, Name = "CustomField2" } });
        }
    }
}
