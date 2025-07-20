using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChequeClearingService.Data;
using ChequeClearingService.Models;

namespace ChequeClearingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChequesController : ControllerBase
    {
        private readonly ChequeClearingDbContext _context;
        public ChequesController(ChequeClearingDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Cheque>>> GetCheques()
        {
            return await _context.Cheques.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Cheque>> GetCheque(int id)
        {
            var cheque = await _context.Cheques.FindAsync(id);
            if (cheque == null) return NotFound();
            return cheque;
        }

        [HttpPost]
        public async Task<ActionResult<Cheque>> CreateCheque(Cheque cheque)
        {
            cheque.Status = "Issued";
            cheque.IssueDate = DateTime.UtcNow;
            _context.Cheques.Add(cheque);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCheque), new { id = cheque.ChequeId }, cheque);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCheque(int id, Cheque cheque)
        {
            if (id != cheque.ChequeId) return BadRequest();
            _context.Entry(cheque).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Cheques.Any(e => e.ChequeId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCheque(int id)
        {
            var cheque = await _context.Cheques.FindAsync(id);
            if (cheque == null) return NotFound();
            _context.Cheques.Remove(cheque);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
