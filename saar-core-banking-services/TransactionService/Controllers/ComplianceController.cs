using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TransactionService.Data;
using TransactionService.Models;

namespace TransactionService.Controllers
{
    /// <summary>
    /// Provides access to compliance alerts created by the PostingEngine.
    /// Currently surfaces CTR (Cash Transaction Report) alerts triggered when a journal
    /// post exceeds the RBI cash transaction reporting threshold (EXPR_CTR_TRIGGER).
    /// </summary>
    [ApiController]
    [Route("api/compliance")]
    [Authorize]
    public class ComplianceController : ControllerBase
    {
        private readonly TransactionDbContext _db;
        private readonly ILogger<ComplianceController> _logger;

        public ComplianceController(TransactionDbContext db, ILogger<ComplianceController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// List compliance alerts, optionally filtered by status and/or alert type.
        /// </summary>
        [HttpGet("alerts")]
        public async Task<ActionResult<ComplianceAlertsResponse>> GetAlerts(
            [FromQuery] string? status    = null,
            [FromQuery] string? alertType = null,
            [FromQuery] int page          = 1,
            [FromQuery] int pageSize      = 20,
            CancellationToken ct          = default)
        {
            var query = _db.ComplianceAlerts.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(a => a.Status == status.ToUpper());

            if (!string.IsNullOrWhiteSpace(alertType))
                query = query.Where(a => a.AlertType == alertType.ToUpper());

            var total = await query.CountAsync(ct);
            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

            return Ok(new ComplianceAlertsResponse
            {
                Total    = total,
                Page     = page,
                PageSize = pageSize,
                Items    = items,
            });
        }

        /// <summary>
        /// Update the status of a compliance alert (FILED or DISMISSED).
        /// </summary>
        [HttpPatch("alerts/{id:guid}")]
        public async Task<ActionResult<ComplianceAlert>> ReviewAlert(
            Guid id,
            [FromBody] ReviewAlertRequest req,
            CancellationToken ct = default)
        {
            var alert = await _db.ComplianceAlerts.FindAsync(new object[] { id }, ct);
            if (alert == null) return NotFound();

            if (alert.Status != "PENDING")
                return BadRequest($"Alert is already {alert.Status} — cannot update.");

            var newStatus = req.Action?.ToUpper();
            if (newStatus != "FILED" && newStatus != "DISMISSED")
                return BadRequest("Action must be FILED or DISMISSED.");

            alert.Status     = newStatus;
            alert.ReviewedBy = User.Identity?.Name ?? req.ReviewedBy ?? "system";
            alert.ReviewedAt = DateTime.UtcNow;
            alert.ReviewNotes = req.Notes;

            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Compliance alert {Id} ({Type}) marked {Status} by {By}.",
                id, alert.AlertType, newStatus, alert.ReviewedBy);

            return Ok(alert);
        }
    }

    public class ComplianceAlertsResponse
    {
        public int Total    { get; set; }
        public int Page     { get; set; }
        public int PageSize { get; set; }
        public List<ComplianceAlert> Items { get; set; } = new();
    }

    public class ReviewAlertRequest
    {
        /// <summary>FILED | DISMISSED</summary>
        public string? Action     { get; set; }
        public string? ReviewedBy { get; set; }
        public string? Notes      { get; set; }
    }
}
