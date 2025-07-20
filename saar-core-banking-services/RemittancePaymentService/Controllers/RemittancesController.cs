using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RemittancePaymentService.Data;
using RemittancePaymentService.Models;

namespace RemittancePaymentService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RemittancesController : ControllerBase
    {
        private readonly RemittancePaymentDbContext _context;
        public RemittancesController(RemittancePaymentDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Remittance>>> GetRemittances()
        {
            return await _context.Remittances.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Remittance>> GetRemittance(int id)
        {
            var remittance = await _context.Remittances.FindAsync(id);
            if (remittance == null) return NotFound();
            return remittance;
        }

        [HttpPost]
        public async Task<ActionResult<Remittance>> CreateRemittance(Remittance remittance)
        {
            remittance.Status = "Initiated";
            remittance.InitiatedAt = DateTime.UtcNow;
            _context.Remittances.Add(remittance);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetRemittance), new { id = remittance.RemittanceId }, remittance);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRemittance(int id, Remittance remittance)
        {
            if (id != remittance.RemittanceId) return BadRequest();
            _context.Entry(remittance).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Remittances.Any(e => e.RemittanceId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRemittance(int id)
        {
            var remittance = await _context.Remittances.FindAsync(id);
            if (remittance == null) return NotFound();
            _context.Remittances.Remove(remittance);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
