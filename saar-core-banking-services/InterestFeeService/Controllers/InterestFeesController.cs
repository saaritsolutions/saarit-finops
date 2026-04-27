using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Services;
using InterestFeeService.Jobs;

namespace InterestFeeService.Controllers
{
    [ApiController]
    [Route("api/interest-fees")]
    public class InterestFeesController : ControllerBase
    {
        private readonly InterestFeeDbContext _context;
        private readonly IAccountServiceClient _accountClient;
        private readonly DailyAccrualJob _accrualJob;
        private readonly ILogger<InterestFeesController> _logger;

        public InterestFeesController(
            InterestFeeDbContext context,
            IAccountServiceClient accountClient,
            DailyAccrualJob accrualJob,
            ILogger<InterestFeesController> logger)
        {
            _context     = context;
            _accountClient = accountClient;
            _accrualJob  = accrualJob;
            _logger      = logger;
        }

        // ── CRUD ──────────────────────────────────────────────────────────────────

        [HttpGet]
        public async Task<ActionResult<IEnumerable<InterestFee>>> GetInterestFees(
            [FromQuery] string? tenantId = null,
            [FromQuery] string? type = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var q = _context.InterestFees.AsQueryable();
            if (!string.IsNullOrEmpty(tenantId)) q = q.Where(f => f.TenantId == tenantId);
            if (!string.IsNullOrEmpty(type))     q = q.Where(f => f.CalculationType == type);
            return await q.OrderByDescending(f => f.CalculationDate)
                          .Skip((page - 1) * pageSize).Take(pageSize)
                          .ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InterestFee>> GetInterestFee(int id)
        {
            var fee = await _context.InterestFees.FindAsync(id);
            if (fee == null) return NotFound();
            return fee;
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
            try { await _context.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.InterestFees.Any(e => e.InterestFeeId == id)) return NotFound();
                throw;
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInterestFee(int id)
        {
            var fee = await _context.InterestFees.FindAsync(id);
            if (fee == null) return NotFound();
            _context.InterestFees.Remove(fee);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Interest + TDS summary for one account ────────────────────────────────

        [HttpGet("{accountId}/interest-tds")]
        public async Task<IActionResult> GetInterestAndTDS(int accountId)
        {
            var interest = await _context.InterestFees
                .Where(f => f.AccountId == accountId &&
                            (f.CalculationType == "DailyAccrual" || f.CalculationType == "Interest"))
                .SumAsync(f => f.InterestAmount);
            var tds = await _context.InterestFees
                .Where(f => f.AccountId == accountId &&
                            (f.CalculationType == "TDS" || f.CalculationType == "MonthlyPosted"))
                .SumAsync(f => f.TdsAmount);
            var account = await _accountClient.GetAccountAsync(accountId);
            return Ok(new
            {
                AccruedInterest = interest,
                AccruedTDS      = tds,
                Balance         = account?.Balance ?? 0,
                IsTDSExempt     = account?.IsTDSExempt ?? false
            });
        }

        // ── Manual trigger: run daily accrual ─────────────────────────────────────

        /// <summary>
        /// POST /api/interest-fees/run-daily-accrual
        /// Manually triggers the daily accrual job (useful for demo / testing).
        /// </summary>
        [HttpPost("run-daily-accrual")]
        public async Task<IActionResult> RunDailyAccrual(CancellationToken ct)
        {
            _logger.LogInformation("Manual daily accrual triggered via API");
            await _accrualJob.RunAccrualAsync(ct);
            return Ok(new { message = "Daily accrual completed", date = DateTime.UtcNow.Date });
        }

        // ── Manual trigger: run monthly posting ───────────────────────────────────

        /// <summary>
        /// POST /api/interest-fees/run-monthly-posting?period=202604
        /// Sums accrued interest for the period, posts GL journals, deducts TDS.
        /// </summary>
        [HttpPost("run-monthly-posting")]
        public async Task<IActionResult> RunMonthlyPosting(
            [FromQuery] string? period, CancellationToken ct)
        {
            period ??= DateTime.UtcNow.ToString("yyyyMM");
            _logger.LogInformation("Manual monthly posting triggered via API for period {Period}", period);
            try
            {
                var result = await _accrualJob.RunMonthlyPostingAsync(period, ct);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // ── Accrual summary (for frontend chart) ──────────────────────────────────

        /// <summary>
        /// GET /api/interest-fees/accrual-summary?tenantId=public&amp;from=2026-04-01&amp;to=2026-04-26
        /// Returns per-day aggregated accrual totals for the Deposit Interest report chart.
        /// </summary>
        [HttpGet("accrual-summary")]
        public async Task<IActionResult> GetAccrualSummary(
            [FromQuery] string? tenantId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            var fromDate = from?.Date ?? DateTime.UtcNow.AddDays(-30).Date;
            var toDate   = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1); // exclusive upper bound

            var q = _context.InterestFees
                .Where(f => f.CalculationType == "DailyAccrual" &&
                            f.CalculationDate >= fromDate &&
                            f.CalculationDate < toDate);

            if (!string.IsNullOrEmpty(tenantId))
                q = q.Where(f => f.TenantId == tenantId);

            var rows = await q
                .GroupBy(f => new { f.CalculationDate, f.TenantId })
                .Select(g => new
                {
                    Date          = g.Key.CalculationDate,
                    TenantId      = g.Key.TenantId,
                    TotalInterest = g.Sum(f => f.InterestAmount),
                    AccountCount  = g.Count()
                })
                .OrderBy(r => r.Date)
                .ToListAsync();

            return Ok(rows);
        }
    }
}
