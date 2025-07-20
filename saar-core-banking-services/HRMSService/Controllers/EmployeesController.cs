using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HRMSService.Models;

namespace HRMSService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EmployeesController : ControllerBase
    {
        private readonly HRMSDbContext _context;
        public EmployeesController(HRMSDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Employee>>> GetEmployees()
        {
            return await _context.Employees.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Employee>> GetEmployee(int id)
        {
            var emp = await _context.Employees.FindAsync(id);
            if (emp == null) return NotFound();
            return emp;
        }

        [HttpPost]
        public async Task<ActionResult<Employee>> CreateEmployee(Employee emp)
        {
            _context.Employees.Add(emp);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetEmployee), new { id = emp.Id }, emp);
        }
    }
}
