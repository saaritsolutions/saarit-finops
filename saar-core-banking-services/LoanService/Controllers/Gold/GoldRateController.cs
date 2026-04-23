using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LoanService.Extensions;
using LoanService.Services.Gold;

namespace LoanService.Controllers.Gold
{
    [ApiController]
    [Route("api/gold-rate")]
    [Authorize]
    public class GoldRateController : ControllerBase
    {
        private readonly IGoldRateService _goldRateService;
        private readonly ILogger<GoldRateController> _logger;

        public GoldRateController(IGoldRateService goldRateService, ILogger<GoldRateController> logger)
        {
            _goldRateService = goldRateService;
            _logger = logger;
        }

        /// <summary>GET /api/gold-rate/today — today's rate or latest available</summary>
        [HttpGet("today")]
        public async Task<IActionResult> GetTodayRate(CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var (rate, isLatest) = await _goldRateService.GetTodayRateAsync(ct);
            if (rate == null)
                return NotFound(new { error = "No gold rate has been entered yet." });

            return Ok(new
            {
                rate.Id,
                rate.RateDate,
                rate.RatePerGramFor22K,
                rate.Source,
                rate.EnteredBy,
                rate.CreatedAt,
                IsLatest = isLatest,
            });
        }

        /// <summary>GET /api/gold-rate — history (last 30 days)</summary>
        [HttpGet]
        public async Task<IActionResult> GetHistory([FromQuery] int days = 30, CancellationToken ct = default)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var history = await _goldRateService.GetHistoryAsync(days, ct);
            return Ok(history);
        }

        /// <summary>POST /api/gold-rate — enter a new daily rate</summary>
        [HttpPost]
        public async Task<IActionResult> CreateRate([FromBody] CreateGoldRateRequest request, CancellationToken ct)
        {
            if (request.RatePerGramFor22K <= 0)
                return BadRequest(new { error = "Rate must be greater than zero." });

            try
            {
                var entry = await _goldRateService.CreateRateAsync(
                    request.RateDate,
                    request.RatePerGramFor22K,
                    request.Source ?? "MANUAL",
                    request.EnteredBy ?? User.Identity?.Name ?? "system",
                    ct);

                return CreatedAtAction(nameof(GetHistory), new { }, new
                {
                    entry.Id,
                    entry.RateDate,
                    entry.RatePerGramFor22K,
                    entry.Source,
                    entry.EnteredBy,
                    entry.CreatedAt,
                    IsLatest = true,
                });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { error = ex.Message });
            }
        }

        public record CreateGoldRateRequest(
            DateTime RateDate,
            decimal RatePerGramFor22K,
            string? Source,
            string? EnteredBy);
    }
}
