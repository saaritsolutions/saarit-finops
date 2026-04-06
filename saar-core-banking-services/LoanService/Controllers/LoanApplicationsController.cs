using LoanService.Data;
using LoanService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanService.Controllers
{
    /// <summary>
    /// Loan application management: list, detail, approval actions, maker-checker.
    /// All routes under /api/loans/applications
    /// </summary>
    [ApiController]
    [Route("api/loans/applications")]
    public class LoanApplicationsController : ControllerBase
    {
        private readonly LoanDbContext _db;
        private readonly ILogger<LoanApplicationsController> _logger;

        public LoanApplicationsController(LoanDbContext db, ILogger<LoanApplicationsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // ── GET /api/loans/applications ─────────────────────────────────────────
        /// <summary>Paginated, filtered list of loan applications.</summary>
        [HttpGet]
        public async Task<ActionResult<ApplicationListResponse>> GetApplications(
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] string? productType,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _db.LoanApplications.AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                query = query.Where(a => a.Status == status);

            if (!string.IsNullOrWhiteSpace(productType) && productType != "ALL")
                query = query.Where(a => a.ProductType == productType);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(a =>
                    (a.ApplicantName != null && a.ApplicantName.ToLower().Contains(s)) ||
                    (a.ApplicationNumber != null && a.ApplicationNumber.ToLower().Contains(s)) ||
                    (a.MobileNumber != null && a.MobileNumber.Contains(s)) ||
                    (a.PanNumber != null && a.PanNumber.ToLower().Contains(s)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new ApplicationSummaryDto
                {
                    Id              = a.Id,
                    ApplicationNumber = a.ApplicationNumber,
                    ApplicantName   = a.ApplicantName,
                    MobileNumber    = a.MobileNumber,
                    Email           = a.Email,
                    ProductType     = a.ProductType,
                    RequestedAmount = a.RequestedAmount,
                    TenureMonths    = a.TenureMonths,
                    InterestRate    = a.InterestRate,
                    Status          = a.Status,
                    CibilScore      = a.CibilScore,
                    FOIRPercent     = a.FOIRPercent,
                    GrossMonthlyIncome = a.GrossMonthlyIncome,
                    PurposeOfLoan   = a.PurposeOfLoan,
                    AssignedTo      = a.AssignedTo,
                    CreatedAt       = a.CreatedAt,
                    UpdatedAt       = a.UpdatedAt,
                })
                .ToListAsync();

            return Ok(new ApplicationListResponse
            {
                Total    = total,
                Page     = page,
                PageSize = pageSize,
                Items    = items,
            });
        }

        // ── GET /api/loans/applications/pending-approval ─────────────────────────
        /// <summary>Applications awaiting credit/sanction action (maker-checker queue).</summary>
        [HttpGet("pending-approval")]
        public async Task<ActionResult<IEnumerable<ApplicationSummaryDto>>> GetPendingApproval()
        {
            var statuses = new[] { "SUBMITTED", "IN_REVIEW", "CREDIT_APPROVED" };
            var items = await _db.LoanApplications
                .Where(a => statuses.Contains(a.Status))
                .OrderBy(a => a.CreatedAt)
                .Take(50)
                .Select(a => new ApplicationSummaryDto
                {
                    Id              = a.Id,
                    ApplicationNumber = a.ApplicationNumber,
                    ApplicantName   = a.ApplicantName,
                    MobileNumber    = a.MobileNumber,
                    Email           = a.Email,
                    ProductType     = a.ProductType,
                    RequestedAmount = a.RequestedAmount,
                    TenureMonths    = a.TenureMonths,
                    InterestRate    = a.InterestRate,
                    Status          = a.Status,
                    CibilScore      = a.CibilScore,
                    FOIRPercent     = a.FOIRPercent,
                    GrossMonthlyIncome = a.GrossMonthlyIncome,
                    PurposeOfLoan   = a.PurposeOfLoan,
                    AssignedTo      = a.AssignedTo,
                    CreatedAt       = a.CreatedAt,
                    UpdatedAt       = a.UpdatedAt,
                })
                .ToListAsync();

            return Ok(items);
        }

        // ── GET /api/loans/applications/{id} ────────────────────────────────────
        /// <summary>Full application detail including documents and approval timeline.</summary>
        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ApplicationDetailDto>> GetById(Guid id)
        {
            var app = await _db.LoanApplications.FindAsync(id);
            if (app == null) return NotFound();

            var docs = await _db.LoanDocuments
                .Where(d => d.LoanApplicationId == id)
                .OrderBy(d => d.IsMandatory ? 0 : 1)
                .ThenBy(d => d.DocumentType)
                .ToListAsync();

            var actions = await _db.LoanApprovalActions
                .Where(a => a.LoanApplicationId == id)
                .OrderBy(a => a.ActionAt)
                .ToListAsync();

            return Ok(new ApplicationDetailDto
            {
                Application = app,
                Documents   = docs,
                Actions     = actions,
            });
        }

        // ── POST /api/loans/applications/{id}/action ─────────────────────────────
        /// <summary>
        /// Take an approval action: CREDIT_APPROVE | SANCTION | REJECT | REQUEST_INFO | DISBURSE | SEND_TO_REVIEW
        /// </summary>
        [HttpPost("{id:guid}/action")]
        public async Task<ActionResult<ApplicationDetailDto>> TakeAction(
            Guid id,
            [FromBody] LoanActionRequest req)
        {
            var app = await _db.LoanApplications.FindAsync(id);
            if (app == null) return NotFound();

            var fromStatus = app.Status;
            string toStatus;

            switch (req.Action.ToUpperInvariant())
            {
                case "SEND_TO_REVIEW":
                    toStatus = "IN_REVIEW";
                    break;

                case "CREDIT_APPROVE":
                    if (app.Status != "SUBMITTED" && app.Status != "IN_REVIEW")
                        return BadRequest(new { error = "Application must be SUBMITTED or IN_REVIEW to credit-approve" });
                    toStatus = "CREDIT_APPROVED";
                    break;

                case "SANCTION":
                    if (app.Status != "CREDIT_APPROVED")
                        return BadRequest(new { error = "Application must be CREDIT_APPROVED to sanction" });
                    toStatus = "APPROVED";
                    app.SanctionedAmount = req.SanctionedAmount ?? app.RequestedAmount;
                    app.SanctionRemarks  = req.Comments;
                    break;

                case "REJECT":
                    toStatus = "REJECTED";
                    app.RejectionReason = req.Comments;
                    break;

                case "REQUEST_INFO":
                    toStatus = "INFO_REQUESTED";
                    break;

                case "DISBURSE":
                    if (app.Status != "APPROVED")
                        return BadRequest(new { error = "Application must be APPROVED to disburse" });
                    toStatus = "DISBURSED";
                    app.DisbursedAt = DateTime.UtcNow;
                    break;

                default:
                    return BadRequest(new { error = $"Unknown action: {req.Action}" });
            }

            app.Status    = toStatus;
            app.UpdatedAt = DateTime.UtcNow;

            var action = new LoanApprovalAction
            {
                Id                = Guid.NewGuid(),
                LoanApplicationId = id,
                Action            = req.Action.ToUpperInvariant(),
                ActionBy          = req.ActionBy ?? "system",
                Role              = req.Role     ?? "OFFICER",
                Comments          = req.Comments,
                FromStatus        = fromStatus,
                ToStatus          = toStatus,
                ActionAt          = DateTime.UtcNow,
            };

            _db.LoanApprovalActions.Add(action);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Loan {AppId} ({AppNo}) transitioned {From} → {To} by {By}",
                id, app.ApplicationNumber, fromStatus, toStatus, req.ActionBy);

            return await GetById(id);
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────────

    public class ApplicationSummaryDto
    {
        public Guid    Id                { get; set; }
        public string  ApplicationNumber { get; set; } = string.Empty;
        public string  ApplicantName     { get; set; } = string.Empty;
        public string? MobileNumber      { get; set; }
        public string? Email             { get; set; }
        public string  ProductType       { get; set; } = string.Empty;
        public decimal RequestedAmount   { get; set; }
        public int     TenureMonths      { get; set; }
        public decimal? InterestRate     { get; set; }
        public string  Status            { get; set; } = string.Empty;
        public int?    CibilScore        { get; set; }
        public decimal? FOIRPercent      { get; set; }
        public decimal GrossMonthlyIncome { get; set; }
        public string? PurposeOfLoan     { get; set; }
        public string? AssignedTo        { get; set; }
        public DateTime CreatedAt        { get; set; }
        public DateTime UpdatedAt        { get; set; }
    }

    public class ApplicationListResponse
    {
        public int Total    { get; set; }
        public int Page     { get; set; }
        public int PageSize { get; set; }
        public List<ApplicationSummaryDto> Items { get; set; } = new();
    }

    public class ApplicationDetailDto
    {
        public LoanApplication         Application { get; set; } = null!;
        public List<LoanDocument>      Documents   { get; set; } = new();
        public List<LoanApprovalAction> Actions    { get; set; } = new();
    }

    public class LoanActionRequest
    {
        /// <summary>CREDIT_APPROVE | SANCTION | REJECT | REQUEST_INFO | DISBURSE | SEND_TO_REVIEW</summary>
        public string  Action          { get; set; } = string.Empty;
        public string? ActionBy        { get; set; }
        public string? Role            { get; set; }
        public string? Comments        { get; set; }
        public decimal? SanctionedAmount { get; set; }
    }
}
