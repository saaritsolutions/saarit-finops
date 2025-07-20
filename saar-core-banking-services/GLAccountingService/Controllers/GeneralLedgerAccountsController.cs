using GLAccountingService.Data;
using GLAccountingService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GLAccountingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GeneralLedgerAccountsController : ControllerBase
    {
        private readonly GLAccountingDbContext _context;
        public GeneralLedgerAccountsController(GLAccountingDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<GeneralLedgerAccount>>> GetAll()
        {
            return await _context.GeneralLedgerAccounts.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<GeneralLedgerAccount>> Get(int id)
        {
            var account = await _context.GeneralLedgerAccounts.FindAsync(id);
            if (account == null) return NotFound();
            return account;
        }

        [HttpPost]
        public async Task<ActionResult<GeneralLedgerAccount>> Create(GeneralLedgerAccount account)
        {
            account.CreatedAt = DateTime.UtcNow;
            _context.GeneralLedgerAccounts.Add(account);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = account.Id }, account);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, GeneralLedgerAccount account)
        {
            if (id != account.Id) return BadRequest();
            _context.Entry(account).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var account = await _context.GeneralLedgerAccounts.FindAsync(id);
            if (account == null) return NotFound();
            _context.GeneralLedgerAccounts.Remove(account);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
