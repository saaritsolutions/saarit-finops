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
            // Demo dynamic schema for Personal Loan (aligns with LoanService static fallback shape)
            var fields = new object[]
            {
                new { id = 1, name = "fullName", label = "Full Name", type = "text", required = true },
                new { id = 2, name = "email", label = "Email", type = "text", required = true },
                new { id = 3, name = "loanAmount", label = "Loan Amount", type = "number", required = true, min = 10000 },
                new { id = 4, name = "tenureMonths", label = "Tenure (months)", type = "number", required = true, min = 6 },
                new { id = 5, name = "monthlyIncome", label = "Monthly Income", type = "number", required = true, min = 0 },
                new { id = 6, name = "creditScore", label = "Credit Score", type = "number", required = true, min = 300, max = 900 },
                new { id = 7, name = "debtToIncomeRatio", label = "Debt-to-Income Ratio", type = "number", required = true, min = 0, max = 1 }
            };

            return Ok(fields);
        }
    }
}
