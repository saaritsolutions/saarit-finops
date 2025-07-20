using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LoanService.Data;
using LoanService.Models;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LoanAccountsController : ControllerBase
    {
        private readonly LoanDbContext _context;
        public LoanAccountsController(LoanDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoanAccount>>> GetLoanAccounts()
        {
            return await _context.LoanAccounts.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoanAccount>> GetLoanAccount(int id)
        {
            var loan = await _context.LoanAccounts.FindAsync(id);
            if (loan == null) return NotFound();
            return loan;
        }

        [HttpPost]
        public async Task<ActionResult<LoanAccount>> CreateLoanAccount(LoanAccount loanAccount)
        {
            loanAccount.Status = "Active";
            loanAccount.StartDate = DateTime.UtcNow;
            _context.LoanAccounts.Add(loanAccount);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetLoanAccount), new { id = loanAccount.LoanAccountId }, loanAccount);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLoanAccount(int id, LoanAccount loanAccount)
        {
            if (id != loanAccount.LoanAccountId) return BadRequest();
            _context.Entry(loanAccount).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.LoanAccounts.Any(e => e.LoanAccountId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanAccount(int id)
        {
            var loan = await _context.LoanAccounts.FindAsync(id);
            if (loan == null) return NotFound();
            _context.LoanAccounts.Remove(loan);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
