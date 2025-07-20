using GLAccountingService.Data;
using GLAccountingService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GLAccountingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class JournalEntriesController : ControllerBase
    {
        private readonly GLAccountingDbContext _context;
        public JournalEntriesController(GLAccountingDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<JournalEntry>>> GetAll()
        {
            return await _context.JournalEntries.Include(j => j.GLAccount).ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<JournalEntry>> Get(int id)
        {
            var entry = await _context.JournalEntries.Include(j => j.GLAccount).FirstOrDefaultAsync(j => j.Id == id);
            if (entry == null) return NotFound();
            return entry;
        }

        [HttpPost]
        public async Task<ActionResult<JournalEntry>> Create(JournalEntry entry)
        {
            entry.EntryDate = DateTime.UtcNow;
            _context.JournalEntries.Add(entry);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = entry.Id }, entry);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, JournalEntry entry)
        {
            if (id != entry.Id) return BadRequest();
            _context.Entry(entry).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var entry = await _context.JournalEntries.FindAsync(id);
            if (entry == null) return NotFound();
            _context.JournalEntries.Remove(entry);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
