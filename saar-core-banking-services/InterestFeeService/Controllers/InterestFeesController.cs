using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Services;

namespace InterestFeeService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InterestFeesController : ControllerBase
    {
        private readonly InterestFeeDbContext _context;
        private readonly IAccountServiceClient _accountClient;
        public InterestFeesController(InterestFeeDbContext context, IAccountServiceClient accountClient)
        {
            _context = context;
            _accountClient = accountClient;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<InterestFee>>> GetInterestFees()
        {
            return await _context.InterestFees.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InterestFee>> GetInterestFee(int id)
        {
            var interestFee = await _context.InterestFees.FindAsync(id);
            if (interestFee == null) return NotFound();
            return interestFee;
        }

        [HttpPost]
        public async Task<ActionResult<InterestFee>> CreateInterestFee(InterestFee interestFee)
        {
            interestFee.CalculationDate = DateTime.UtcNow;
            _context.InterestFees.Add(interestFee);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetInterestFee), new { id = interestFee.InterestFeeId }, interestFee);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateInterestFee(int id, InterestFee interestFee)
        {
            if (id != interestFee.InterestFeeId) return BadRequest();
            _context.Entry(interestFee).State = EntityState.Modified;
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.InterestFees.Any(e => e.InterestFeeId == id))
                    return NotFound();
                else
                    throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInterestFee(int id)
        {
            var interestFee = await _context.InterestFees.FindAsync(id);
            if (interestFee == null) return NotFound();
            _context.InterestFees.Remove(interestFee);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{accountId}/accrue-interest")]
        public async Task<IActionResult> AccrueInterest(int accountId, [FromQuery] decimal ratePerAnnum)
        {
            // This assumes AccountService is the source of truth for account data.
            // In a real microservice, this would call AccountService via API or event.
            var interestFee = await _context.InterestFees.OrderByDescending(f => f.CalculationDate)
                .FirstOrDefaultAsync(f => f.AccountId == accountId && f.CalculationType == "Interest");
            decimal balance = 1000; // Default for demo
            // For demo, allow balance=1000 if not found
            if (balance == 0) balance = 1000;
            var dailyInterest = (balance * ratePerAnnum / 100m) / 365m;
            var newFee = new InterestFee
            {
                AccountId = accountId,
                InterestAmount = dailyInterest,
                FeeAmount = 0,
                TdsAmount = 0,
                CalculationDate = DateTime.UtcNow,
                CalculationType = "Interest",
                Remarks = $"Accrued at {ratePerAnnum}% p.a.",
            };
            _context.InterestFees.Add(newFee);
            await _context.SaveChangesAsync();
            return Ok(dailyInterest);
        }

        [HttpPost("{accountId}/apply-interest")]
        public async Task<IActionResult> ApplyInterest(int accountId, [FromQuery] decimal tdsRate)
        {
            var interestFees = await _context.InterestFees
                .Where(f => f.AccountId == accountId && f.CalculationType == "Interest")
                .ToListAsync();
            var totalInterest = interestFees.Sum(f => f.InterestAmount);
            if (totalInterest <= 0) return BadRequest("No accrued interest to apply.");
            decimal tds = totalInterest * tdsRate / 100m;
            var newFee = new InterestFee
            {
                AccountId = accountId,
                InterestAmount = 0,
                FeeAmount = 0,
                TdsAmount = tds,
                CalculationDate = DateTime.UtcNow,
                CalculationType = "TDS",
                Remarks = $"TDS applied at {tdsRate}%",
            };
            _context.InterestFees.Add(newFee);
            await _context.SaveChangesAsync();
            var result = new {
                AppliedInterest = totalInterest,
                TDS = tds,
                Balance = 0, // Not tracked here
                AccruedInterest = 0, // All interest applied
                AccruedTDS = _context.InterestFees.Where(f => f.AccountId == accountId && f.CalculationType == "TDS").Sum(f => f.TdsAmount),
                IsTDSExempt = false // Not tracked here
            };
            return Ok(result);
        }

        [HttpGet("{accountId}/interest-tds")]
        public async Task<IActionResult> GetInterestAndTDS(int accountId)
        {
            var interest = await _context.InterestFees
                .Where(f => f.AccountId == accountId && f.CalculationType == "Interest")
                .SumAsync(f => f.InterestAmount);
            var tds = await _context.InterestFees
                .Where(f => f.AccountId == accountId && f.CalculationType == "TDS")
                .SumAsync(f => f.TdsAmount);
            var account = await _accountClient.GetAccountAsync(accountId);
            var result = new {
                AppliedInterest = 0,
                TDS = tds,
                Balance = account?.Balance ?? 0,
                AccruedInterest = interest,
                AccruedTDS = tds,
                IsTDSExempt = account?.IsTDSExempt ?? false
            };
            return Ok(result);
        }
    }
}
