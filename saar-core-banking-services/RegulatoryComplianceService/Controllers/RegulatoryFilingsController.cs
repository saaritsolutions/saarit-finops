using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegulatoryComplianceService.Data;
using RegulatoryComplianceService.Models;

namespace RegulatoryComplianceService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RegulatoryFilingsController : ControllerBase
    {
        private readonly RegulatoryComplianceDbContext _context;
        public RegulatoryFilingsController(RegulatoryComplianceDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<RegulatoryFiling>>> GetAll()
        {
            return await _context.RegulatoryFilings.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<RegulatoryFiling>> Get(int id)
        {
            var filing = await _context.RegulatoryFilings.FindAsync(id);
            if (filing == null) return NotFound();
            return filing;
        }

        [HttpPost]
        public async Task<ActionResult<RegulatoryFiling>> Create(RegulatoryFiling filing)
        {
            filing.FilingDate = DateTime.UtcNow;
            _context.RegulatoryFilings.Add(filing);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = filing.Id }, filing);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, RegulatoryFiling filing)
        {
            if (id != filing.Id) return BadRequest();
            _context.Entry(filing).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var filing = await _context.RegulatoryFilings.FindAsync(id);
            if (filing == null) return NotFound();
            _context.RegulatoryFilings.Remove(filing);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
