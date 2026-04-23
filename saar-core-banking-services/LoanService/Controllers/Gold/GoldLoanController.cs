using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using LoanService.Data;
using LoanService.Extensions;
using LoanService.Models;
using LoanService.Models.Gold;
using LoanService.Services;
using LoanService.Services.Gold;

namespace LoanService.Controllers.Gold
{
    /// <summary>
    /// Gold Loan Phase 1 — Core origination, pledge management, and bullet repayment.
    /// State machine: DRAFT → SUBMITTED → APPRAISED → SANCTIONED → DISBURSED → CLOSED
    /// All routes under /api/gold-loan
    /// </summary>
    [ApiController]
    [Route("api/gold-loan")]
    [Authorize]
    public class GoldLoanController : ControllerBase
    {
        private readonly LoanDbContext             _db;
        private readonly IGoldRateService          _goldRateService;
        private readonly ITransactionServiceClient _transactionService;
        private readonly ILogger<GoldLoanController> _logger;

        public GoldLoanController(
            LoanDbContext db,
            IGoldRateService goldRateService,
            ITransactionServiceClient transactionService,
            ILogger<GoldLoanController> logger)
        {
            _db                 = db;
            _goldRateService    = goldRateService;
            _transactionService = transactionService;
            _logger             = logger;
        }

        // ── POST /api/gold-loan/applications ──────────────────────────────────────
        /// <summary>Create a new gold loan application (LoanApplication + GoldLoanDetails atomically).</summary>
        [HttpPost("applications")]
        public async Task<IActionResult> Create(
            [FromBody] CreateGoldLoanRequest req,
            CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            // Generate GL-{year}-{seq:D6} application number
            var year  = DateTime.UtcNow.Year;
            var count = await _db.LoanApplications
                .Where(a => a.ProductType == "GOLD_LOAN" &&
                            a.ApplicationNumber.StartsWith($"GL-{year}-"))
                .CountAsync(ct);
            var appNumber = $"GL-{year}-{(count + 1):D6}";

            var app = new LoanApplication
            {
                ApplicationNumber    = appNumber,
                ProductType          = "GOLD_LOAN",
                Status               = "DRAFT",
                RequestedAmount      = req.RequestedAmount,
                TenureMonths         = req.TenureMonths,
                PurposeOfLoan        = req.PurposeOfLoan,
                ApplicantName        = req.ApplicantName,
                MobileNumber         = req.MobileNumber,
                Email                = req.Email,
                PanNumber            = req.PanNumber,
                AadhaarLast4         = req.AadhaarLast4,
                CurrentAddressLine1  = req.AddressLine1,
                CurrentCity          = req.City,
                CurrentState         = req.State,
                CurrentPinCode       = req.PinCode,
                CollateralType       = "GOLD",
                CreatedBy            = User.Identity?.Name ?? "system",
                CreatedAt            = DateTime.UtcNow,
                UpdatedAt            = DateTime.UtcNow,
            };

            var gold = new GoldLoanDetails
            {
                LoanApplication  = app,
                GoldLoanStatus   = "DRAFT",
                RepaymentScheme  = "BULLET",
                TenureMonths     = req.TenureMonths,
                InterestRatePercent = req.InterestRatePercent > 0 ? req.InterestRatePercent : 7.00m,
                CreatedAt        = DateTime.UtcNow,
                UpdatedAt        = DateTime.UtcNow,
            };

            _db.LoanApplications.Add(app);
            _db.GoldLoanDetails.Add(gold);

            _db.LoanApprovalActions.Add(new LoanApprovalAction
            {
                LoanApplicationId  = app.Id,
                Action             = "CREATED",
                ActionDescription  = $"Gold loan application created — {appNumber}",
                ActionBy           = User.Identity?.Name ?? "system",
                Role               = "MAKER",
                FromStatus         = null,
                ToStatus           = "DRAFT",
                ActionAt           = DateTime.UtcNow,
            });

            await _db.SaveChangesAsync(ct);

            return CreatedAtAction(nameof(GetById), new { id = app.Id }, new
            {
                app.Id,
                app.ApplicationNumber,
                GoldLoanDetailsId = gold.Id,
                app.Status,
                gold.GoldLoanStatus,
            });
        }

        // ── GET /api/gold-loan/applications ───────────────────────────────────────
        /// <summary>Paginated, filtered list of gold loan applications.</summary>
        [HttpGet("applications")]
        public async Task<IActionResult> GetList(
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var query = _db.LoanApplications
                .Where(a => a.ProductType == "GOLD_LOAN")
                .Join(_db.GoldLoanDetails,
                      a  => a.Id,
                      g  => g.LoanApplicationId,
                      (a, g) => new { App = a, Gold = g });

            if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                query = query.Where(x => x.Gold.GoldLoanStatus == status);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(x =>
                    x.App.ApplicantName.ToLower().Contains(s) ||
                    x.App.ApplicationNumber.ToLower().Contains(s) ||
                    (x.App.MobileNumber != null && x.App.MobileNumber.Contains(s)) ||
                    (x.App.PanNumber    != null && x.App.PanNumber.ToLower().Contains(s)));
            }

            var total = await query.CountAsync(ct);

            var items = await query
                .OrderByDescending(x => x.App.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.App.Id,
                    x.App.ApplicationNumber,
                    x.App.ApplicantName,
                    x.App.MobileNumber,
                    x.App.PanNumber,
                    x.App.CreatedAt,
                    x.Gold.GoldLoanStatus,
                    x.Gold.TotalNetWeightGrams,
                    x.Gold.TotalValuedAmount,
                    x.Gold.LtvPercent,
                    x.Gold.SanctionedAmount,
                    x.Gold.DisbursedAt,
                    x.Gold.MaturityDate,
                    x.Gold.ClosedAt,
                })
                .ToListAsync(ct);

            return Ok(new { total, page, pageSize, items });
        }

        // ── GET /api/gold-loan/applications/{id} ──────────────────────────────────
        /// <summary>Full detail — GoldLoanDetails + pledge items + approval timeline.</summary>
        [HttpGet("applications/{id:guid}")]
        public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app == null || app.ProductType != "GOLD_LOAN")
                return NotFound();

            var gold = await _db.GoldLoanDetails
                .Include(g => g.PledgeItems)
                .FirstOrDefaultAsync(g => g.LoanApplicationId == id, ct);

            if (gold == null) return NotFound();

            var actions = await _db.LoanApprovalActions
                .Where(a => a.LoanApplicationId == id)
                .OrderBy(a => a.ActionAt)
                .ToListAsync(ct);

            return Ok(new
            {
                // LoanApplication fields
                app.Id,
                app.ApplicationNumber,
                app.ApplicantName,
                app.MobileNumber,
                app.Email,
                app.PanNumber,
                app.AadhaarLast4,
                app.CurrentAddressLine1,
                app.CurrentCity,
                app.CurrentState,
                app.CurrentPinCode,
                app.PurposeOfLoan,
                app.RequestedAmount,
                app.Status,
                app.DisbursalJournalNumber,
                app.CreatedBy,
                app.CreatedAt,
                app.UpdatedAt,
                // GoldLoanDetails
                GoldLoanDetailsId        = gold.Id,
                gold.GoldLoanStatus,
                gold.RepaymentScheme,
                gold.TenureMonths,
                gold.MaturityDate,
                gold.SanctionedAmount,
                gold.InterestRatePercent,
                gold.TotalInterestAmount,
                gold.TotalAmountDue,
                gold.TotalNetWeightGrams,
                gold.TotalValuedAmount,
                gold.LtvPercent,
                gold.GoldRateAtAppraisal,
                gold.AppraiserName,
                gold.AppraiserEmployeeId,
                gold.VaultLocation,
                gold.PledgeReceiptNumber,
                gold.AppraisedAt,
                gold.SanctionedAt,
                gold.DisbursedAt,
                gold.ClosedAt,
                gold.GoldReleasedAt,
                gold.ClosureJournalNumber,
                PledgeItems = gold.PledgeItems.Select(p => new
                {
                    p.Id,
                    p.ItemType,
                    p.Description,
                    p.GrossWeightGrams,
                    p.StoneDeductionGrams,
                    p.NetWeightGrams,
                    p.PurityCarats,
                    p.PurityFactor,
                    p.GoldRatePerGram,
                    p.ValuedAmount,
                    p.PacketNumber,
                    p.IsReleased,
                    p.ReleasedAt,
                    p.CreatedAt,
                }),
                Actions = actions.Select(a => new
                {
                    a.Id,
                    a.Action,
                    a.ActionDescription,
                    a.ActionBy,
                    a.Role,
                    a.Comments,
                    a.FromStatus,
                    a.ToStatus,
                    a.ActionAt,
                }),
            });
        }

        // ── POST /api/gold-loan/applications/{id}/pledge-items ────────────────────
        /// <summary>Add a pledge item to a DRAFT gold loan application.</summary>
        [HttpPost("applications/{id:guid}/pledge-items")]
        public async Task<IActionResult> AddPledgeItem(
            Guid id,
            [FromBody] AddPledgeItemRequest req,
            CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var gold = await _db.GoldLoanDetails
                .Include(g => g.PledgeItems)
                .FirstOrDefaultAsync(g => g.LoanApplicationId == id, ct);

            if (gold == null) return NotFound();
            if (gold.GoldLoanStatus != "DRAFT")
                return BadRequest(new { error = "Pledge items can only be added in DRAFT status." });

            var purityFactor  = Math.Round((decimal)req.PurityCarats / 24m, 4);
            var netWeight     = Math.Round(req.GrossWeightGrams - req.StoneDeductionGrams, 3);

            var item = new GoldPledgeItem
            {
                GoldLoanDetailsId    = gold.Id,
                ItemType             = req.ItemType,
                Description          = req.Description,
                GrossWeightGrams     = req.GrossWeightGrams,
                StoneDeductionGrams  = req.StoneDeductionGrams,
                NetWeightGrams       = netWeight,
                PurityCarats         = req.PurityCarats,
                PurityFactor         = purityFactor,
                GoldRatePerGram      = 0m,     // set at APPRAISE
                ValuedAmount         = 0m,     // set at APPRAISE
                PacketNumber         = req.PacketNumber,
                IsReleased           = false,
                CreatedAt            = DateTime.UtcNow,
            };

            _db.GoldPledgeItems.Add(item);
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                item.Id,
                item.ItemType,
                item.Description,
                item.GrossWeightGrams,
                item.StoneDeductionGrams,
                item.NetWeightGrams,
                item.PurityCarats,
                item.PurityFactor,
                item.PacketNumber,
            });
        }

        // ── DELETE /api/gold-loan/applications/{id}/pledge-items/{itemId} ─────────
        /// <summary>Remove a pledge item from a DRAFT gold loan application.</summary>
        [HttpDelete("applications/{id:guid}/pledge-items/{itemId:guid}")]
        public async Task<IActionResult> RemovePledgeItem(
            Guid id,
            Guid itemId,
            CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var gold = await _db.GoldLoanDetails
                .FirstOrDefaultAsync(g => g.LoanApplicationId == id, ct);

            if (gold == null) return NotFound();
            if (gold.GoldLoanStatus != "DRAFT")
                return BadRequest(new { error = "Pledge items can only be removed in DRAFT status." });

            var item = await _db.GoldPledgeItems
                .FirstOrDefaultAsync(p => p.Id == itemId && p.GoldLoanDetailsId == gold.Id, ct);

            if (item == null) return NotFound();

            _db.GoldPledgeItems.Remove(item);
            await _db.SaveChangesAsync(ct);

            return NoContent();
        }

        // ── POST /api/gold-loan/applications/{id}/action ─────────────────────────
        /// <summary>
        /// Drive the gold loan state machine.
        /// Actions: SUBMIT | APPRAISE | SANCTION | DISBURSE | CLOSE
        /// </summary>
        [HttpPost("applications/{id:guid}/action")]
        public async Task<IActionResult> TakeAction(
            Guid id,
            [FromBody] GoldLoanActionRequest req,
            CancellationToken ct)
        {
            if (!User.HasFeature("gold_loan"))
                return StatusCode(403, new { error = "Gold Loan module is not enabled for this tenant." });

            var app = await _db.LoanApplications.FindAsync(new object[] { id }, ct);
            if (app == null || app.ProductType != "GOLD_LOAN")
                return NotFound();

            var gold = await _db.GoldLoanDetails
                .Include(g => g.PledgeItems)
                .FirstOrDefaultAsync(g => g.LoanApplicationId == id, ct);

            if (gold == null) return NotFound();

            var action = req.Action.ToUpperInvariant();
            var now    = DateTime.UtcNow;
            string fromStatus = gold.GoldLoanStatus;
            string toStatus;

            switch (action)
            {
                // ── SUBMIT ──────────────────────────────────────────────────────
                case "SUBMIT":
                    if (gold.GoldLoanStatus != "DRAFT")
                        return BadRequest(new { error = $"Cannot SUBMIT from status {gold.GoldLoanStatus}." });

                    if (!gold.PledgeItems.Any())
                        return BadRequest(new { error = "At least one pledge item is required before submission." });

                    toStatus              = "SUBMITTED";
                    gold.GoldLoanStatus   = toStatus;
                    app.Status            = "SUBMITTED";
                    gold.UpdatedAt        = now;
                    app.UpdatedAt         = now;
                    break;

                // ── APPRAISE ────────────────────────────────────────────────────
                case "APPRAISE":
                    if (gold.GoldLoanStatus != "SUBMITTED")
                        return BadRequest(new { error = $"Cannot APPRAISE from status {gold.GoldLoanStatus}." });

                    if (string.IsNullOrWhiteSpace(req.AppraiserName))
                        return BadRequest(new { error = "AppraiserName is required for APPRAISE." });

                    var (rateEntry, _) = await _goldRateService.GetTodayRateAsync(ct);
                    if (rateEntry == null)
                        return BadRequest(new { error = "No gold rate is available. Please enter today's gold rate first." });

                    var ratePerGram = rateEntry.RatePerGramFor22K;

                    // Revalue each pledge item using today's rate
                    decimal totalNet   = 0m;
                    decimal totalValue = 0m;

                    foreach (var item in gold.PledgeItems)
                    {
                        var purityFactor  = Math.Round((decimal)item.PurityCarats / 24m, 4);
                        var netWeight     = Math.Round(item.GrossWeightGrams - item.StoneDeductionGrams, 3);
                        var valued        = Math.Round(netWeight * purityFactor * ratePerGram, 2);

                        item.PurityFactor    = purityFactor;
                        item.NetWeightGrams  = netWeight;
                        item.GoldRatePerGram = ratePerGram;
                        item.ValuedAmount    = valued;

                        totalNet   += netWeight;
                        totalValue += valued;
                    }

                    gold.TotalNetWeightGrams  = Math.Round(totalNet, 3);
                    gold.TotalValuedAmount    = Math.Round(totalValue, 2);
                    gold.GoldRateAtAppraisal  = ratePerGram;
                    gold.AppraiserName        = req.AppraiserName;
                    gold.AppraiserEmployeeId  = req.AppraiserEmployeeId;
                    gold.VaultLocation        = req.VaultLocation;
                    gold.AppraisedAt          = now;

                    toStatus            = "APPRAISED";
                    gold.GoldLoanStatus = toStatus;
                    gold.UpdatedAt      = now;
                    app.UpdatedAt       = now;
                    break;

                // ── SANCTION ────────────────────────────────────────────────────
                case "SANCTION":
                    if (gold.GoldLoanStatus != "APPRAISED")
                        return BadRequest(new { error = $"Cannot SANCTION from status {gold.GoldLoanStatus}." });

                    if (req.SanctionedAmount is null or <= 0)
                        return BadRequest(new { error = "SanctionedAmount is required for SANCTION." });

                    if (gold.TotalValuedAmount <= 0)
                        return BadRequest(new { error = "No valued amount on file — appraise first." });

                    var ltv = Math.Round(req.SanctionedAmount.Value / gold.TotalValuedAmount * 100m, 4);
                    if (ltv > 75m)
                        return BadRequest(new { error = $"LTV {ltv:F2}% exceeds the maximum allowed 75%. Reduce the sanctioned amount." });

                    // Generate pledge receipt number: PR-{year}-{seq:D6}
                    var prYear  = now.Year;
                    var prCount = await _db.GoldLoanDetails
                        .Where(g => g.PledgeReceiptNumber != null &&
                                    g.PledgeReceiptNumber.StartsWith($"PR-{prYear}-"))
                        .CountAsync(ct);

                    gold.SanctionedAmount     = req.SanctionedAmount.Value;
                    gold.LtvPercent           = ltv;
                    gold.PledgeReceiptNumber  = $"PR-{prYear}-{(prCount + 1):D6}";
                    gold.SanctionedAt         = now;

                    app.SanctionedAmount = req.SanctionedAmount.Value;
                    app.LTVPercent       = ltv;
                    app.SanctionRemarks  = req.Comments;

                    toStatus            = "SANCTIONED";
                    gold.GoldLoanStatus = toStatus;
                    app.Status          = "SANCTIONED";
                    gold.UpdatedAt      = now;
                    app.UpdatedAt       = now;
                    break;

                // ── DISBURSE ────────────────────────────────────────────────────
                case "DISBURSE":
                    if (gold.GoldLoanStatus != "SANCTIONED")
                        return BadRequest(new { error = $"Cannot DISBURSE from status {gold.GoldLoanStatus}." });

                    var disbursalResult = await _transactionService.PostGoldLoanDisbursalJournalAsync(
                        app.ApplicationNumber,
                        gold.SanctionedAmount,
                        ct);

                    if (!disbursalResult.Success)
                    {
                        _logger.LogWarning(
                            "GL disbursal journal failed for {AppNo}: {Error}",
                            app.ApplicationNumber, disbursalResult.Error);
                        return StatusCode(502, new { error = $"GL journal failed: {disbursalResult.Error}" });
                    }

                    var maturityDate = now.AddMonths(gold.TenureMonths);
                    var totalInterest = Math.Round(
                        gold.SanctionedAmount * gold.InterestRatePercent / 100m * gold.TenureMonths / 12m, 2);

                    gold.MaturityDate          = maturityDate;
                    gold.TotalInterestAmount   = totalInterest;
                    gold.TotalAmountDue        = gold.SanctionedAmount + totalInterest;
                    gold.DisbursedAt           = now;

                    app.DisbursedAt              = now;
                    app.DisbursalJournalNumber   = disbursalResult.JournalNumber;
                    app.DisbursementAccountNumber = req.DisbursementAccountNumber;

                    toStatus            = "DISBURSED";
                    gold.GoldLoanStatus = toStatus;
                    app.Status          = "DISBURSED";
                    gold.UpdatedAt      = now;
                    app.UpdatedAt       = now;
                    break;

                // ── CLOSE ────────────────────────────────────────────────────────
                case "CLOSE":
                    if (gold.GoldLoanStatus != "DISBURSED")
                        return BadRequest(new { error = $"Cannot CLOSE from status {gold.GoldLoanStatus}." });

                    var principal = req.PrincipalRepaid ?? gold.SanctionedAmount;
                    var interest  = req.InterestPaid    ?? (gold.TotalInterestAmount ?? 0m);

                    var closureResult = await _transactionService.PostGoldLoanClosureJournalAsync(
                        app.ApplicationNumber,
                        principal,
                        interest,
                        ct);

                    if (!closureResult.Success)
                    {
                        _logger.LogWarning(
                            "GL closure journal failed for {AppNo}: {Error}",
                            app.ApplicationNumber, closureResult.Error);
                        return StatusCode(502, new { error = $"GL journal failed: {closureResult.Error}" });
                    }

                    // Release all pledge items
                    foreach (var item in gold.PledgeItems)
                    {
                        item.IsReleased  = true;
                        item.ReleasedAt  = now;
                    }

                    gold.ClosureJournalNumber = closureResult.JournalNumber;
                    gold.ClosedAt             = now;
                    gold.GoldReleasedAt       = now;

                    toStatus            = "CLOSED";
                    gold.GoldLoanStatus = toStatus;
                    app.Status          = "CLOSED";
                    gold.UpdatedAt      = now;
                    app.UpdatedAt       = now;
                    break;

                default:
                    return BadRequest(new { error = $"Unknown action '{req.Action}'. Valid: SUBMIT, APPRAISE, SANCTION, DISBURSE, CLOSE." });
            }

            _db.LoanApprovalActions.Add(new LoanApprovalAction
            {
                LoanApplicationId  = app.Id,
                Action             = action,
                ActionDescription  = BuildActionDescription(action, gold, app),
                ActionBy           = User.Identity?.Name ?? "system",
                Role               = "CREDIT_OFFICER",
                Comments           = req.Comments,
                FromStatus         = fromStatus,
                ToStatus           = toStatus,
                ActionAt           = now,
            });

            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                app.Id,
                app.ApplicationNumber,
                app.Status,
                gold.GoldLoanStatus,
                gold.PledgeReceiptNumber,
                gold.SanctionedAmount,
                gold.LtvPercent,
                gold.MaturityDate,
                gold.TotalAmountDue,
                gold.DisbursedAt,
                gold.ClosedAt,
                app.DisbursalJournalNumber,
                gold.ClosureJournalNumber,
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static string BuildActionDescription(
            string action, GoldLoanDetails gold, LoanApplication app) => action switch
        {
            "SUBMIT"   => $"Application {app.ApplicationNumber} submitted for appraisal.",
            "APPRAISE" => $"Gold appraised by {gold.AppraiserName}. Total value: ₹{gold.TotalValuedAmount:N2} ({gold.TotalNetWeightGrams:F3}g net).",
            "SANCTION" => $"Loan sanctioned for ₹{gold.SanctionedAmount:N2} (LTV {gold.LtvPercent:F2}%). Receipt: {gold.PledgeReceiptNumber}.",
            "DISBURSE" => $"₹{gold.SanctionedAmount:N2} disbursed. Maturity: {gold.MaturityDate:yyyy-MM-dd}. Journal: {app.DisbursalJournalNumber}.",
            "CLOSE"    => $"Loan closed. Principal + interest received. Journal: {gold.ClosureJournalNumber}. Gold released.",
            _          => $"Action {action} completed.",
        };

        // ── Request records ───────────────────────────────────────────────────────

        public record CreateGoldLoanRequest(
            string   ApplicantName,
            string?  MobileNumber,
            string?  Email,
            string?  PanNumber,
            string?  AadhaarLast4,
            string?  AddressLine1,
            string?  City,
            string?  State,
            string?  PinCode,
            string?  PurposeOfLoan,
            decimal  RequestedAmount,
            int      TenureMonths,
            decimal  InterestRatePercent);

        public record AddPledgeItemRequest(
            string   ItemType,
            string?  Description,
            decimal  GrossWeightGrams,
            decimal  StoneDeductionGrams,
            int      PurityCarats,
            string?  PacketNumber);

        public record GoldLoanActionRequest(
            string   Action,
            // APPRAISE
            string?  AppraiserName,
            string?  AppraiserEmployeeId,
            string?  VaultLocation,
            // SANCTION
            decimal? SanctionedAmount,
            string?  Comments,
            // DISBURSE
            string?  DisbursementAccountNumber,
            // CLOSE
            decimal? PrincipalRepaid,
            decimal? InterestPaid);
    }
}
