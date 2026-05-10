using LoanService.Data;
using LoanService.Models;
using LoanService.Services;
using Microsoft.AspNetCore.Authorization;
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
        private readonly IWorkflowClient _workflowClient;
        private readonly IExpressionEvaluationService _expressions;
        private readonly ITransactionServiceClient _transactionService;
        private readonly ILogger<LoanApplicationsController> _logger;

        public LoanApplicationsController(
            LoanDbContext db,
            IWorkflowClient workflowClient,
            IExpressionEvaluationService expressions,
            ITransactionServiceClient transactionService,
            ILogger<LoanApplicationsController> logger)
        {
            _db                 = db;
            _workflowClient     = workflowClient;
            _expressions        = expressions;
            _transactionService = transactionService;
            _logger             = logger;
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

        // ── GET /api/loans/applications/overdue ──────────────────────────────────
        /// <summary>
        /// All DISBURSED loans where NextDueDate is in the past, with SMA classification.
        /// </summary>
        [HttpGet("overdue")]
        public async Task<IActionResult> GetOverdueLoans(
            [FromQuery] string? smaStatus = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            CancellationToken ct = default)
        {
            var today = DateTime.UtcNow.Date;

            var query = _db.LoanApplications
                .Where(a => a.Status == "DISBURSED" && a.NextDueDate.HasValue && a.NextDueDate.Value.Date < today)
                .OrderBy(a => a.NextDueDate);

            var total = await query.CountAsync(ct);

            var rows = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new OverdueLoanDto
                {
                    Id                   = a.Id,
                    ApplicationNumber    = a.ApplicationNumber,
                    ApplicantName        = a.ApplicantName,
                    MobileNumber         = a.MobileNumber,
                    ProductType          = a.ProductType,
                    OutstandingPrincipal = a.OutstandingPrincipal,
                    NextDueDate          = a.NextDueDate,
                    InterestRate         = a.InterestRate,
                    TenureMonths         = a.TenureMonths,
                    DisbursedAt          = a.DisbursedAt,
                })
                .ToListAsync(ct);

            // OverdueDays and SmaStatus are [NotMapped] — compute in-memory after fetch
            foreach (var r in rows)
            {
                r.OverdueDays = r.NextDueDate.HasValue
                    ? (int)(today - r.NextDueDate.Value.Date).TotalDays
                    : 0;
                r.SmaStatus = r.OverdueDays switch
                {
                    0     => "STANDARD",
                    <= 30 => "SMA-0",
                    <= 60 => "SMA-1",
                    <= 90 => "SMA-2",
                    _     => "NPA"
                };
            }

            // Optional in-memory smaStatus filter (applied after SMA computation)
            if (!string.IsNullOrEmpty(smaStatus) && smaStatus != "ALL")
                rows = rows.Where(r => r.SmaStatus == smaStatus).ToList();

            return Ok(new { total, page, pageSize, items = rows });
        }

        // ── GET /api/loans/applications/restructured ─────────────────────────────
        /// <summary>
        /// All restructured loans — any status — ordered by restructured date descending.
        /// </summary>
        [HttpGet("restructured")]
        public async Task<IActionResult> GetRestructuredLoans(CancellationToken ct = default)
        {
            var today = DateTime.UtcNow.Date;

            var rows = await _db.LoanApplications
                .Where(a => a.IsRestructured)
                .OrderByDescending(a => a.RestructuredDate)
                .ToListAsync(ct);

            var items = rows.Select(a =>
            {
                var overdueDays = a.NextDueDate.HasValue && a.NextDueDate.Value.Date < today
                    ? (int)(today - a.NextDueDate.Value.Date).TotalDays : 0;
                var smaStatus = overdueDays switch
                {
                    0     => "STANDARD",
                    <= 30 => "SMA-0",
                    <= 60 => "SMA-1",
                    <= 90 => "SMA-2",
                    _     => "NPA"
                };
                var provisioningPct = smaStatus == "NPA" ? a.RequiredProvisioningPct : 5m;
                return new RestructuredLoanDto
                {
                    Id                          = a.Id,
                    ApplicationNumber           = a.ApplicationNumber,
                    ApplicantName               = a.ApplicantName,
                    ProductType                 = a.ProductType,
                    OutstandingPrincipal        = a.OutstandingPrincipal ?? 0m,
                    SmaStatus                   = smaStatus,
                    OverdueDays                 = overdueDays,
                    RestructuredDate            = a.RestructuredDate,
                    RestructuredNewEmi          = a.RestructuredNewEmi,
                    RestructuredNewTenureMonths = a.RestructuredNewTenureMonths,
                    RestructuredNewInterestRate = a.RestructuredNewInterestRate,
                    RestructuredReason          = a.RestructuredReason,
                    RequiredProvisioningPct     = provisioningPct,
                    RequiredProvisioning        = Math.Round((a.OutstandingPrincipal ?? 0m) * provisioningPct / 100m, 2),
                };
            }).ToList();

            return Ok(new { total = items.Count, items });
        }

        // ── POST /api/loans/{id}/restructure ─────────────────────────────────────
        /// <summary>
        /// Restructure a DISBURSED loan: record revised EMI / tenure / rate and mark IsRestructured=true.
        /// No GL journal — administrative action with no immediate cash movement.
        /// </summary>
        [HttpPost("/api/loans/{id:guid}/restructure")]
        [AllowAnonymous]
        public async Task<IActionResult> RestructureLoan(
            Guid id,
            [FromBody] RestructureRequest req,
            CancellationToken ct = default)
        {
            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app == null) return NotFound(new { error = "Loan not found" });

            if (app.Status != "DISBURSED")
                return BadRequest(new { error = "Only DISBURSED loans can be restructured" });

            if (app.IsRestructured)
                return BadRequest(new { error = "Loan is already restructured" });

            // Save original terms before overwriting (for potential upgrade later)
            app.OriginalTenureMonths         = app.TenureMonths;
            app.OriginalInterestRate         = app.InterestRate;

            app.IsRestructured               = true;
            app.RestructuredDate             = DateTime.UtcNow;
            app.RestructuredReason           = req.Reason;
            app.RestructuredNewEmi           = req.NewMonthlyEmi;
            app.RestructuredNewTenureMonths  = req.NewTenureMonths;
            app.RestructuredNewInterestRate  = req.NewInterestRate;
            app.TenureMonths                 = req.NewTenureMonths;
            app.InterestRate                 = req.NewInterestRate;
            // Reset NextDueDate to today+1 month to give borrower a fresh start
            app.NextDueDate                  = DateTime.UtcNow.Date.AddMonths(1);
            app.UpdatedAt                    = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Loan {AppNo} restructured — newEmi={Emi}, newTenure={Tenure}, newRate={Rate}",
                app.ApplicationNumber, req.NewMonthlyEmi, req.NewTenureMonths, req.NewInterestRate);

            return Ok(new
            {
                applicationNumber           = app.ApplicationNumber,
                isRestructured              = app.IsRestructured,
                restructuredDate            = app.RestructuredDate,
                newMonthlyEmi               = app.RestructuredNewEmi,
                newTenureMonths             = app.RestructuredNewTenureMonths,
                newInterestRate             = app.RestructuredNewInterestRate,
            });
        }

        // ── POST /api/loans/{id}/restructure-upgrade ────────────────────────────────
        /// <summary>
        /// Upgrade a restructured DISBURSED loan back to original terms after 1-year satisfactory repayment.
        /// Guards: DISBURSED + IsRestructured + !IsUpgraded + RestructuredDate ≤ (today-365 days) + last 6 months SMA=STANDARD.
        /// Calls GL service to post upgrade reversal journal (reverses the restructure journal).
        /// </summary>
        [HttpPost("/api/loans/{id:guid}/restructure-upgrade")]
        [AllowAnonymous]
        public async Task<IActionResult> UpgradeLoan(
            Guid id,
            [FromBody] UpgradeRequest req,
            CancellationToken ct = default)
        {
            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app == null) return NotFound(new { error = "Loan not found" });

            if (app.Status != "DISBURSED")
                return BadRequest(new { error = "Only DISBURSED loans can be upgraded" });

            if (!app.IsRestructured)
                return BadRequest(new { error = "Loan is not restructured — cannot upgrade" });

            if (app.IsUpgraded)
                return BadRequest(new { error = "Loan has already been upgraded" });

            if (!app.RestructuredDate.HasValue)
                return BadRequest(new { error = "Restructured date is missing" });

            // Check 1-year elapsed since restructuring
            var daysElapsed = (DateTime.UtcNow - app.RestructuredDate.Value).TotalDays;
            if (daysElapsed < 365)
                return BadRequest(new { error = $"Loan must be restructured for 1 year. Currently {Math.Floor(daysElapsed)} days." });

            // Check last 6 months SMA status is STANDARD (no defaults)
            if (app.SmaStatus != "STANDARD")
                return BadRequest(new { error = $"Loan is in {app.SmaStatus} status. Must be STANDARD for 6 months before upgrade." });

            // Call GL service to post upgrade journal (reversal of restructure journal)
            try
            {
                var journalResult = await _transactionService.PostLoanUpgradeJournalAsync(
                    app.ApplicationNumber,
                    app.OutstandingPrincipal ?? 0m,
                    ct);
                app.UpgradeJournalNumber = journalResult?.JournalNumber;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to post upgrade journal for loan {AppNo}", app.ApplicationNumber);
                return StatusCode(500, new { error = "Failed to post GL journal. Please retry." });
            }

            // Restore original terms
            if (app.OriginalTenureMonths.HasValue)
                app.TenureMonths = app.OriginalTenureMonths.Value;
            if (app.OriginalInterestRate.HasValue)
                app.InterestRate = app.OriginalInterestRate.Value;

            // Mark as upgraded
            app.IsUpgraded       = true;
            app.UpgradedDate     = DateTime.UtcNow;
            app.UpgradedReason   = req.Reason;
            // Clear restructure flags
            app.IsRestructured   = false;
            app.UpdatedAt        = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Loan {AppNo} upgraded — restored to tenure={Tenure}mo, rate={Rate}%, journalNo={JournalNo}",
                app.ApplicationNumber, app.TenureMonths, app.InterestRate, app.UpgradeJournalNumber);

            return Ok(new
            {
                applicationNumber   = app.ApplicationNumber,
                isUpgraded          = app.IsUpgraded,
                upgradedDate        = app.UpgradedDate,
                restoredTenure      = app.TenureMonths,
                restoredRate        = app.InterestRate,
                journalNumber       = app.UpgradeJournalNumber,
            });
        }

        // ── GET /api/loans/npa-board ─────────────────────────────────────────────
        /// <summary>
        /// Portfolio NPA summary with sub-classification and provisioning per RBI IRAC norms.
        /// Absolute route overrides the controller [Route("api/loans/applications")] prefix.
        /// </summary>
        [HttpGet("/api/loans/npa-board")]
        [AllowAnonymous]
        public async Task<IActionResult> GetNpaBoard(CancellationToken ct = default)
        {
            var loans = await _db.LoanApplications
                .Where(a => a.Status == "DISBURSED" && a.OutstandingPrincipal.HasValue)
                .ToListAsync(ct);

            var writtenOff = await _db.LoanApplications
                .Where(a => a.Status == "WRITTEN_OFF" && a.OutstandingPrincipal.HasValue)
                .ToListAsync(ct);

            var totalLoanBook     = loans.Sum(a => a.OutstandingPrincipal ?? 0m);
            var npaLoans          = loans.Where(a => a.SmaStatus == "NPA").ToList();
            var smaWatch          = loans.Where(a => a.SmaStatus is "SMA-0" or "SMA-1" or "SMA-2").ToList();
            var totalNpa          = npaLoans.Sum(a => a.OutstandingPrincipal ?? 0m);
            var totalProvisioning = npaLoans.Sum(a => a.RequiredProvisioning);
            var npaRatio          = totalLoanBook > 0 ? Math.Round(totalNpa / totalLoanBook, 6) : 0m;

            return Ok(new NpaBoardResult
            {
                AsOfDate                  = DateTime.UtcNow.Date,
                TotalLoanBook             = totalLoanBook,
                TotalNpaOutstanding       = totalNpa,
                NpaRatio                  = npaRatio,
                TotalRequiredProvisioning = totalProvisioning,
                SmaWatchCount             = smaWatch.Count,
                SmaWatchOutstanding       = smaWatch.Sum(a => a.OutstandingPrincipal ?? 0m),
                WrittenOffCount           = writtenOff.Count,
                WrittenOffOutstanding     = writtenOff.Sum(a => a.OutstandingPrincipal ?? 0m),
                NpaLoans = npaLoans
                    .Select(a => new NpaLoanDto
                    {
                        Id                   = a.Id,
                        ApplicationNumber    = a.ApplicationNumber,
                        ApplicantName        = a.ApplicantName,
                        ProductType          = a.ProductType,
                        OutstandingPrincipal = a.OutstandingPrincipal ?? 0m,
                        OverdueDays          = a.OverdueDays,
                        SmaStatus            = a.SmaStatus,
                        NpaSubClassification = a.NpaSubClassification,
                        RequiredProvisioning = a.RequiredProvisioning,
                    })
                    .OrderByDescending(a => a.OverdueDays)
                    .ToList(),
                SmaWatchList = smaWatch
                    .Select(a => new SmaWatchDto
                    {
                        Id                   = a.Id,
                        ApplicationNumber    = a.ApplicationNumber,
                        ApplicantName        = a.ApplicantName,
                        ProductType          = a.ProductType,
                        OutstandingPrincipal = a.OutstandingPrincipal ?? 0m,
                        OverdueDays          = a.OverdueDays,
                        SmaStatus            = a.SmaStatus,
                    })
                    .OrderByDescending(a => a.OverdueDays)
                    .ToList(),
                WrittenOffLoans = writtenOff
                    .Select(a => new WrittenOffLoanDto
                    {
                        Id                   = a.Id,
                        ApplicationNumber    = a.ApplicationNumber,
                        ApplicantName        = a.ApplicantName,
                        ProductType          = a.ProductType,
                        OutstandingPrincipal = a.OutstandingPrincipal ?? 0m,
                        WriteOffDate         = a.WriteOffDate,
                        WriteOffReason       = a.WriteOffReason,
                        WriteOffJournalNumber = a.WriteOffJournalNumber,
                    })
                    .OrderByDescending(a => a.WriteOffDate)
                    .ToList(),
            });
        }

        // ── GET /api/loans/reports/regulatory-summary ──────────────────────────
        /// <summary>
        /// RBI regulatory reporting summary: NPA ratio, provision coverage, restructured/upgraded counts.
        /// Consolidates metrics from NPA, restructured, and upgraded loan portfolios.
        /// </summary>
        [HttpGet("/api/loans/reports/regulatory-summary")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRegulatorySummary(CancellationToken ct = default)
        {
            var loans = await _db.LoanApplications
                .Where(a => a.Status == "DISBURSED" || a.Status == "WRITTEN_OFF")
                .ToListAsync(ct);

            var disbursed = loans.Where(a => a.Status == "DISBURSED").ToList();
            var writtenOff = loans.Where(a => a.Status == "WRITTEN_OFF").ToList();

            var totalBook       = disbursed.Sum(a => a.OutstandingPrincipal ?? 0m);
            var npaLoans        = disbursed.Where(a => a.SmaStatus == "NPA").ToList();
            var npaOutstanding  = npaLoans.Sum(a => a.OutstandingPrincipal ?? 0m);
            var provisioning    = disbursed.Sum(a => a.RequiredProvisioning);
            var smaWatch        = disbursed.Where(a => a.SmaStatus is "SMA-0" or "SMA-1" or "SMA-2").ToList();

            return Ok(new RegulatoryMetricsDto
            {
                AsOfDate                  = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                TotalLoanBook             = totalBook,
                TotalNpaOutstanding       = npaOutstanding,
                NpaRatio                  = totalBook > 0 ? Math.Round(npaOutstanding / totalBook * 100, 2) : 0m,
                TotalRequiredProvisioning = provisioning,
                ProvisionCoverage         = npaOutstanding > 0 ? Math.Round(provisioning / npaOutstanding * 100, 2) : 100m,
                RestructuredCount         = disbursed.Count(a => a.IsRestructured),
                RestructuredOutstanding   = disbursed.Where(a => a.IsRestructured).Sum(a => a.OutstandingPrincipal ?? 0m),
                RestructuredRatio         = totalBook > 0 ? Math.Round(disbursed.Where(a => a.IsRestructured).Sum(a => a.OutstandingPrincipal ?? 0m) / totalBook * 100, 2) : 0m,
                UpgradedCount             = disbursed.Count(a => a.IsUpgraded),
                UpgradedOutstanding       = disbursed.Where(a => a.IsUpgraded).Sum(a => a.OutstandingPrincipal ?? 0m),
                WrittenOffCount           = writtenOff.Count,
                WrittenOffOutstanding     = writtenOff.Sum(a => a.OutstandingPrincipal ?? 0m),
                SmaWatchCount             = smaWatch.Count,
                SmaWatchOutstanding       = smaWatch.Sum(a => a.OutstandingPrincipal ?? 0m),
                StandardCount             = disbursed.Count(a => a.SmaStatus == "STANDARD"),
                StandardOutstanding       = disbursed.Where(a => a.SmaStatus == "STANDARD").Sum(a => a.OutstandingPrincipal ?? 0m),
            });
        }

        // ── POST /api/loans/{id}/write-off ─────────────────────────────────────
        /// <summary>
        /// Write off an NPA loan that is DOUBTFUL_3 (≥ 1096 DPD, 100% provisioned).
        /// Posts DR 5040 / CR 1020 to the GL. Fail-open on TransactionService unavailability.
        /// </summary>
        [HttpPost("/api/loans/{id:guid}/write-off")]
        [AllowAnonymous]
        public async Task<IActionResult> WriteOffLoan(
            Guid id,
            [FromBody] WriteOffRequest req,
            CancellationToken ct = default)
        {
            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app == null) return NotFound(new { error = "Loan not found" });

            if (app.Status == "WRITTEN_OFF")
                return BadRequest(new { error = "Loan is already written off" });

            if (app.Status != "DISBURSED")
                return BadRequest(new { error = "Only DISBURSED loans can be written off" });

            if (app.NpaSubClassification != "DOUBTFUL_3")
                return BadRequest(new { error = $"Only DOUBTFUL_3 loans are eligible for write-off. This loan is classified as: {app.NpaSubClassification ?? app.SmaStatus}" });

            var outstanding = app.OutstandingPrincipal ?? 0m;

            // Post GL journal — fail-open
            var journalResult = await _transactionService.PostWriteOffJournalAsync(
                app.ApplicationNumber, outstanding, ct);

            app.Status             = "WRITTEN_OFF";
            app.WriteOffDate       = DateTime.UtcNow;
            app.WriteOffReason     = req.Reason;
            app.WriteOffAuthorizedBy = req.AuthorizedBy;
            app.WriteOffJournalNumber = journalResult.JournalNumber;
            app.UpdatedAt          = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Loan {AppNo} written off — outstanding={Amt}, journal={JNo}",
                app.ApplicationNumber, outstanding, journalResult.JournalNumber ?? "failed");

            return Ok(new
            {
                applicationNumber    = app.ApplicationNumber,
                status               = app.Status,
                writeOffDate         = app.WriteOffDate,
                writeOffJournalNumber = app.WriteOffJournalNumber,
                outstanding
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
                    // Fire-and-forget approval chain init — non-fatal
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _workflowClient.InitApprovalChainAsync(
                                app.ApplicationNumber ?? id.ToString(),
                                app.RequestedAmount,
                                "LOAN_ORIGINATION");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "InitApprovalChain failed for {AppId} — continuing", id);
                        }
                    });
                    break;

                case "CREDIT_APPROVE":
                    if (app.Status != "SUBMITTED" && app.Status != "IN_REVIEW")
                        return BadRequest(new { error = "Application must be SUBMITTED or IN_REVIEW to credit-approve" });
                    toStatus = "CREDIT_APPROVED";
                    // Advance chain step 1 to APPROVED — fire-and-forget, non-fatal
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _workflowClient.SubmitChainStepActionAsync(
                                app.ApplicationNumber ?? id.ToString(), "APPROVE", req.ActionBy, req.Comments);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "SubmitChainStep APPROVE (credit) failed for {AppId} — continuing", id);
                        }
                    });
                    break;

                case "SANCTION":
                    if (app.Status != "CREDIT_APPROVED")
                        return BadRequest(new { error = "Application must be CREDIT_APPROVED to sanction" });
                    // Sequential enforcement: check prior approval levels are all APPROVED
                    {
                        var chain = await _workflowClient.GetApprovalChainAsync(app.ApplicationNumber ?? id.ToString());
                        if (chain != null && chain.Steps.Any())
                        {
                            var maxSeq         = chain.Steps.Max(s => s.Sequence);
                            var priorNotApproved = chain.Steps
                                .Any(s => s.Sequence < maxSeq && s.Status != "APPROVED");
                            if (priorNotApproved)
                                return BadRequest(new { error = "Previous approval level must be completed first" });
                        }
                    }
                    toStatus = "APPROVED";
                    app.SanctionedAmount = req.SanctionedAmount ?? app.RequestedAmount;
                    app.SanctionRemarks  = req.Comments;
                    // Advance final chain step to APPROVED — fire-and-forget, non-fatal
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _workflowClient.SubmitChainStepActionAsync(
                                app.ApplicationNumber ?? id.ToString(), "APPROVE", req.ActionBy, req.Comments);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "SubmitChainStep APPROVE (sanction) failed for {AppId} — continuing", id);
                        }
                    });
                    break;

                case "REJECT":
                    toStatus = "REJECTED";
                    app.RejectionReason = req.Comments;
                    // Terminate chain — fire-and-forget, non-fatal
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _workflowClient.SubmitChainStepActionAsync(
                                app.ApplicationNumber ?? id.ToString(), "REJECT", req.ActionBy, req.Comments);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "SubmitChainStep REJECT failed for {AppId} — continuing", id);
                        }
                    });
                    break;

                case "REQUEST_INFO":
                    toStatus = "INFO_REQUESTED";
                    break;

                case "DISBURSE":
                    if (app.Status != "APPROVED")
                        return BadRequest(new { error = "Application must be APPROVED to disburse" });
                    toStatus = "DISBURSED";
                    app.DisbursedAt = DateTime.UtcNow;
                    app.OutstandingPrincipal = app.SanctionedAmount ?? app.RequestedAmount;
                    app.NextDueDate = DateTime.UtcNow.Date.AddMonths(1);

                    // ── Double-entry ledger posting ────────────────────────────────────────────
                    // Use the expression service to resolve GL account codes (tenant-configurable).
                    // DR 1020 (Loans and Advances) / CR 1010 (Cash and Bank) by default.
                    // Non-fatal: if TransactionService is unreachable the disbursal still completes.
                    {
                        var disbursalAmount = app.SanctionedAmount ?? app.RequestedAmount;
                        var debitCode  = "1020";
                        var creditCode = "1010";

                        try
                        {
                            var glMapping = await _expressions.EvaluateExpressionAsync<string>(
                                "EXPR_GL_MAPPING_LOAN_DISBURSAL",
                                new Dictionary<string, object>
                                {
                                    ["productType"] = app.ProductType ?? "PERSONAL_LOAN"
                                });

                            if (!string.IsNullOrWhiteSpace(glMapping))
                            {
                                var parts = glMapping.Split('|');
                                if (parts.Length == 2)
                                {
                                    debitCode  = parts[0].Trim();
                                    creditCode = parts[1].Trim();
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex,
                                "GL mapping expression EXPR_GL_MAPPING_LOAN_DISBURSAL failed for {AppId} — using default 1020/1010",
                                id);
                        }

                        var journalResult = await _transactionService.PostDisbursalJournalAsync(
                            app.ApplicationNumber ?? id.ToString(),
                            app.ProductType ?? "PERSONAL_LOAN",
                            disbursalAmount,
                            debitCode,
                            creditCode);

                        if (!journalResult.Success)
                        {
                            _logger.LogWarning(
                                "Disbursal journal posting failed for loan {AppId} — {Error}. Disbursal continues.",
                                id, journalResult.Error);
                        }
                        else
                        {
                            app.DisbursalJournalNumber = journalResult.JournalNumber;
                            _logger.LogInformation(
                                "Disbursal journal {JNo} posted for loan {AppId} ({AppNo}) — amount ₹{Amount:N2}",
                                journalResult.JournalNumber, id, app.ApplicationNumber, disbursalAmount);
                        }
                    }

                    // Notify workflow engine — fire-and-forget, never block the loan state machine
                    if (app.WorkflowInstanceId.HasValue)
                    {
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var wfCtx = new Dictionary<string, object>
                                {
                                    ["application.id"] = id.ToString(),
                                    ["application.status"] = "DISBURSED"
                                };
                                await _workflowClient.ProcessStepAsync(app.WorkflowInstanceId.Value, "DISBURSE", wfCtx);
                                _logger.LogInformation("Workflow step DISBURSE processed for instance {WfId}", app.WorkflowInstanceId.Value);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Workflow ProcessStep DISBURSE failed for loan {AppId} — continuing", id);
                            }
                        });
                    }
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

        // ── POST /api/loans/applications/{id}/collect-emi ───────────────────────
        [HttpPost("{id:guid}/collect-emi")]
        public async Task<IActionResult> CollectEmi(
            Guid id,
            [FromBody] CollectEmiRequest req,
            CancellationToken ct)
        {
            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app is null) return NotFound(new { error = "Loan application not found" });
            if (app.Status != "DISBURSED") return BadRequest(new { error = "EMI can only be collected on a DISBURSED loan" });

            var outstanding = app.OutstandingPrincipal ?? app.SanctionedAmount ?? app.RequestedAmount;
            if (outstanding <= 0) return BadRequest(new { error = "No outstanding principal remaining" });

            var monthlyRate    = (app.InterestRate ?? 0m) / 100m / 12m;
            var interestComp   = Math.Round(outstanding * monthlyRate, 2);
            var principalComp  = Math.Max(0m, Math.Min(req.Amount - interestComp, outstanding));

            var installmentNo  = await _db.LoanRepayments.CountAsync(r => r.LoanApplicationId == id, ct) + 1;

            // ── GL journal — fail-open ─────────────────────────────────────────
            string? journalNumber = null;
            try
            {
                var journalResult = await _transactionService.PostEmiJournalAsync(
                    app.ApplicationNumber ?? id.ToString(), installmentNo, principalComp, interestComp, ct);
                if (journalResult.Success)
                    journalNumber = journalResult.JournalNumber;
                else
                    _logger.LogWarning("EMI journal posting failed for {AppId} #{No} — {Err}. EMI record will still be saved.",
                        id, installmentNo, journalResult.Error);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TransactionService unreachable for EMI {AppId} #{No} — continuing", id, installmentNo);
            }

            var repayment = new LoanRepayment
            {
                Id                = Guid.NewGuid(),
                LoanApplicationId = id,
                InstallmentNumber = installmentNo,
                PrincipalComponent = principalComp,
                InterestComponent  = interestComp,
                TotalAmount        = req.Amount,
                DueDate            = app.NextDueDate ?? DateTime.UtcNow.Date,
                PaidAt             = req.PaymentDate?.ToUniversalTime() ?? DateTime.UtcNow,
                PaymentMode        = req.PaymentMode,
                PaymentReference   = req.PaymentReference,
                JournalNumber      = journalNumber,
                TenantId           = "public",
                CreatedAt          = DateTime.UtcNow,
            };

            _db.LoanRepayments.Add(repayment);
            app.OutstandingPrincipal = outstanding - principalComp;
            app.NextDueDate          = (app.NextDueDate ?? DateTime.UtcNow.Date).AddMonths(1);
            app.UpdatedAt            = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "EMI #{No} collected for loan {AppId} ({AppNo}) — principal={P:N2} interest={I:N2} outstanding={O:N2}",
                installmentNo, id, app.ApplicationNumber, principalComp, interestComp, app.OutstandingPrincipal);

            return Ok(new
            {
                repayment,
                outstandingPrincipal = app.OutstandingPrincipal,
                nextDueDate          = app.NextDueDate,
                smaStatus            = app.SmaStatus,
                overdueDays          = app.OverdueDays,
            });
        }

        // ── GET /api/loans/applications/{id}/repayment-history ─────────────────
        [HttpGet("{id:guid}/repayment-history")]
        public async Task<IActionResult> GetRepaymentHistory(Guid id, CancellationToken ct)
        {
            var app = await _db.LoanApplications
                .Include(a => a.Repayments)
                .FirstOrDefaultAsync(a => a.Id == id, ct);

            if (app is null) return NotFound(new { error = "Loan application not found" });

            return Ok(new
            {
                applicationNumber    = app.ApplicationNumber,
                outstandingPrincipal = app.OutstandingPrincipal,
                nextDueDate          = app.NextDueDate,
                smaStatus            = app.SmaStatus,
                overdueDays          = app.OverdueDays,
                repayments           = app.Repayments.OrderBy(r => r.InstallmentNumber),
            });
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

    public class CollectEmiRequest
    {
        public decimal  Amount           { get; set; }
        /// <summary>CASH | NEFT | RTGS | UPI | CHEQUE</summary>
        public string   PaymentMode      { get; set; } = "CASH";
        public string?  PaymentReference { get; set; }
        public DateTime? PaymentDate     { get; set; }
    }

    public class OverdueLoanDto
    {
        public Guid      Id                   { get; set; }
        public string    ApplicationNumber    { get; set; } = "";
        public string    ApplicantName        { get; set; } = "";
        public string?   MobileNumber         { get; set; }
        public string    ProductType          { get; set; } = "";
        public decimal?  OutstandingPrincipal { get; set; }
        public DateTime? NextDueDate          { get; set; }
        public int       OverdueDays          { get; set; }
        public string    SmaStatus            { get; set; } = "";
        public decimal?  InterestRate         { get; set; }
        public int       TenureMonths         { get; set; }
        public DateTime? DisbursedAt          { get; set; }
    }

    // ── SAAR-NPA-001 / SAAR-NPA-002 DTOs ────────────────────────────────────

    public class NpaBoardResult
    {
        public DateTime AsOfDate                  { get; set; }
        public decimal  TotalLoanBook             { get; set; }
        public decimal  TotalNpaOutstanding       { get; set; }
        public decimal  NpaRatio                  { get; set; }
        public decimal  TotalRequiredProvisioning { get; set; }
        public int      SmaWatchCount             { get; set; }
        public decimal  SmaWatchOutstanding       { get; set; }
        public int      WrittenOffCount           { get; set; }
        public decimal  WrittenOffOutstanding     { get; set; }
        public List<NpaLoanDto>      NpaLoans      { get; set; } = new();
        public List<SmaWatchDto>     SmaWatchList  { get; set; } = new();
        public List<WrittenOffLoanDto> WrittenOffLoans { get; set; } = new();
    }

    public class NpaLoanDto
    {
        public Guid    Id                   { get; set; }
        public string  ApplicationNumber    { get; set; } = "";
        public string  ApplicantName        { get; set; } = "";
        public string  ProductType          { get; set; } = "";
        public decimal OutstandingPrincipal { get; set; }
        public int     OverdueDays          { get; set; }
        public string  SmaStatus            { get; set; } = "";
        public string? NpaSubClassification { get; set; }
        public decimal RequiredProvisioning { get; set; }
    }

    public class SmaWatchDto
    {
        public Guid    Id                   { get; set; }
        public string  ApplicationNumber    { get; set; } = "";
        public string  ApplicantName        { get; set; } = "";
        public string  ProductType          { get; set; } = "";
        public decimal OutstandingPrincipal { get; set; }
        public int     OverdueDays          { get; set; }
        public string  SmaStatus            { get; set; } = "";
    }

    public class WrittenOffLoanDto
    {
        public Guid      Id                    { get; set; }
        public string    ApplicationNumber     { get; set; } = "";
        public string    ApplicantName         { get; set; } = "";
        public string    ProductType           { get; set; } = "";
        public decimal   OutstandingPrincipal  { get; set; }
        public DateTime? WriteOffDate          { get; set; }
        public string?   WriteOffReason        { get; set; }
        public string?   WriteOffJournalNumber { get; set; }
    }

    public class WriteOffRequest
    {
        public string Reason       { get; set; } = "";
        public string AuthorizedBy { get; set; } = "";
    }

    // ── SAAR-LRP-003 DTOs ────────────────────────────────────────────────────

    public class RestructuredLoanDto
    {
        public Guid      Id                          { get; set; }
        public string    ApplicationNumber           { get; set; } = "";
        public string    ApplicantName               { get; set; } = "";
        public string    ProductType                 { get; set; } = "";
        public decimal   OutstandingPrincipal        { get; set; }
        public string    SmaStatus                   { get; set; } = "";
        public int       OverdueDays                 { get; set; }
        public DateTime? RestructuredDate            { get; set; }
        public decimal?  RestructuredNewEmi          { get; set; }
        public int?      RestructuredNewTenureMonths { get; set; }
        public decimal?  RestructuredNewInterestRate { get; set; }
        public string?   RestructuredReason          { get; set; }
        public decimal   RequiredProvisioningPct     { get; set; }
        public decimal   RequiredProvisioning        { get; set; }
    }

    public class RestructureRequest
    {
        public decimal NewMonthlyEmi    { get; set; }
        public int     NewTenureMonths  { get; set; }
        public decimal NewInterestRate  { get; set; }
        public string  Reason           { get; set; } = "";
    }

    public class UpgradeRequest
    {
        public string Reason { get; set; } = "";
    }

    // ── SAAR-RPT-002 DTOs ────────────────────────────────────────────────────

    public class RegulatoryMetricsDto
    {
        public string   AsOfDate                  { get; set; } = "";
        public decimal  TotalLoanBook             { get; set; }
        public decimal  TotalNpaOutstanding       { get; set; }
        public decimal  NpaRatio                  { get; set; }
        public decimal  TotalRequiredProvisioning { get; set; }
        public decimal  ProvisionCoverage         { get; set; }
        public int      RestructuredCount         { get; set; }
        public decimal  RestructuredOutstanding   { get; set; }
        public decimal  RestructuredRatio         { get; set; }
        public int      UpgradedCount             { get; set; }
        public decimal  UpgradedOutstanding       { get; set; }
        public int      WrittenOffCount           { get; set; }
        public decimal  WrittenOffOutstanding     { get; set; }
        public int      SmaWatchCount             { get; set; }
        public decimal  SmaWatchOutstanding       { get; set; }
        public int      StandardCount             { get; set; }
        public decimal  StandardOutstanding       { get; set; }
    }
}
