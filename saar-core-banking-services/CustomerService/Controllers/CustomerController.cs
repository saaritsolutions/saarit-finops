using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CustomerService.Data;
using CustomerService.Models;

namespace CustomerService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        private readonly CustomerDbContext _context;
        public CustomerController(CustomerDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Customer>>> GetCustomers()
        {
            return await _context.Customers.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Customer>> GetCustomer(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            return customer;
        }

        [HttpPost]
        public async Task<ActionResult<Customer>> CreateCustomer(Customer customer)
        {
            if (!string.IsNullOrEmpty(customer.PAN) && _context.Customers.Any(c => c.PAN == customer.PAN))
                return BadRequest("A customer with this PAN already exists.");
            if (!string.IsNullOrEmpty(customer.UID) && _context.Customers.Any(c => c.UID == customer.UID))
                return BadRequest("A customer with this UID already exists.");
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCustomer), new { id = customer.CustomerId }, customer);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCustomer(int id, Customer customer)
        {
            if (id != customer.CustomerId) return BadRequest();
            var existing = await _context.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.CustomerId == id);
            if (existing == null) return NotFound();
            customer.CreatedBy = existing.CreatedBy;
            customer.CreatedAt = existing.CreatedAt;
            customer.ApprovalStatus = "Pending";
            customer.ApprovedBy = null;
            customer.ApprovedAt = null;
            _context.Entry(customer).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Customers.Any(e => e.CustomerId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var customer = await _context.Customers.FindAsync(id);
            if (customer == null) return NotFound();
            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
