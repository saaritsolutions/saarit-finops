using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChequeClearingService.Data;
using ChequeClearingService.Models;

namespace ChequeClearingService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ClearingBatchesController : ControllerBase
    {
        private readonly ChequeClearingDbContext _context;
        public ClearingBatchesController(ChequeClearingDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClearingBatch>>> GetBatches()
        {
            return await _context.ClearingBatches.Include(b => b.Cheques).ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ClearingBatch>> GetBatch(int id)
        {
            var batch = await _context.ClearingBatches.Include(b => b.Cheques).FirstOrDefaultAsync(b => b.ClearingBatchId == id);
            if (batch == null) return NotFound();
            return batch;
        }

        [HttpPost]
        public async Task<ActionResult<ClearingBatch>> CreateBatch(ClearingBatch batch)
        {
            batch.Status = "Open";
            batch.BatchDate = DateTime.UtcNow;
            _context.ClearingBatches.Add(batch);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetBatch), new { id = batch.ClearingBatchId }, batch);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBatch(int id, ClearingBatch batch)
        {
            if (id != batch.ClearingBatchId) return BadRequest();
            _context.Entry(batch).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.ClearingBatches.Any(e => e.ClearingBatchId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBatch(int id)
        {
            var batch = await _context.ClearingBatches.FindAsync(id);
            if (batch == null) return NotFound();
            _context.ClearingBatches.Remove(batch);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
