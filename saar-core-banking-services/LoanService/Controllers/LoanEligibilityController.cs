using LoanService.Data;
using LoanService.Models;
using LoanService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Controllers
{
    /// <summary>
    /// Eligibility, FOIR, LTV calculations — live checks called from the frontend wizard.
    /// </summary>
    [ApiController]
    [Route("api/loans")]
    public class LoanEligibilityController : ControllerBase
    {
        private readonly LoanDbContext _db;
        private readonly IExpressionEvaluationService _expressions;
        private readonly IConfiguration _config;
        private readonly ILogger<LoanEligibilityController> _logger;

        public LoanEligibilityController(
            LoanDbContext db,
            IExpressionEvaluationService expressions,
            IConfiguration config,
            ILogger<LoanEligibilityController> logger)
        {
            _db = db;
            _expressions = expressions;
            _config = config;
            _logger = logger;
        }

        // ── POST /api/loans/check-eligibility ─────────────────────────────────
        /// <summary>
        /// Live eligibility check — called from Step 3 of the loan wizard.
        /// Returns eligibility status, max amount, recommended rate, FOIR, rejection reasons.
        /// </summary>
        [HttpPost("check-eligibility")]
        public async Task<ActionResult<EligibilityResult>> CheckEligibility([FromBody] EligibilityRequest req)
        {
            var product = await _db.LoanProducts
                .FirstOrDefaultAsync(p => p.ProductCode == req.ProductType && p.IsActive);

            var result = new EligibilityResult();
            var rejectionReasons = new List<string>();

            // ── FOIR check ──────────────────────────────────────────────────
            decimal proposedEMI = req.ProposedMonthlyEMI > 0
                ? req.ProposedMonthlyEMI
                : ComputeEMI(req.RequestedAmount, req.TenureMonths, product?.BaseRatePercent ?? 12m);

            decimal totalObligation = req.ExistingMonthlyEMI + proposedEMI;
            decimal income = req.GrossMonthlyIncome > 0 ? req.GrossMonthlyIncome : 1;
            decimal foir = totalObligation / income;
            result.FOIRPercent = Math.Round(foir * 100, 2);

            decimal maxFoir = product?.MaxFoirPercent ?? 0.50m;
            if (foir > maxFoir)
                rejectionReasons.Add($"FOIR {result.FOIRPercent}% exceeds limit of {maxFoir * 100}% for this product");

            // ── CIBIL check ──────────────────────────────────────────────────
            int minCibil = product?.MinCibilScore ?? 650;
            if (req.CibilScore > 0 && req.CibilScore < minCibil)
                rejectionReasons.Add($"CIBIL score {req.CibilScore} is below minimum {minCibil} required");

            result.CibilBand = req.CibilScore >= 800 ? "EXCELLENT"
                : req.CibilScore >= 750 ? "GOOD"
                : req.CibilScore >= 700 ? "FAIR"
                : req.CibilScore >= 650 ? "MARGINAL"
                : "POOR";

            // ── Income check ────────────────────────────────────────────────
            decimal minIncome = product?.MinMonthlyIncome ?? 20_000;
            if (req.GrossMonthlyIncome < minIncome)
                rejectionReasons.Add($"Monthly income ₹{req.GrossMonthlyIncome:N0} is below minimum ₹{minIncome:N0} required");

            // ── Amount check ────────────────────────────────────────────────
            if (product != null)
            {
                if (req.RequestedAmount < product.MinAmount)
                    rejectionReasons.Add($"Requested amount ₹{req.RequestedAmount:N0} is below minimum ₹{product.MinAmount:N0}");
                if (req.RequestedAmount > product.MaxAmount)
                    rejectionReasons.Add($"Requested amount ₹{req.RequestedAmount:N0} exceeds maximum ₹{product.MaxAmount:N0}");
            }

            // ── LTV check (secured loans) ────────────────────────────────────
            if (product?.RequiresCollateral == true && req.CollateralValue > 0)
            {
                decimal ltv = req.RequestedAmount / req.CollateralValue;
                result.LTVPercent = Math.Round(ltv * 100, 2);
                decimal maxLtv = product?.MaxLtvPercent ?? 0.80m;
                if (ltv > maxLtv)
                    rejectionReasons.Add($"LTV {result.LTVPercent}% exceeds limit of {maxLtv * 100}%");
            }

            // ── Max eligible amount ──────────────────────────────────────────
            decimal maxEmiByFoir = req.GrossMonthlyIncome * maxFoir - req.ExistingMonthlyEMI;
            decimal baseRate = product?.BaseRatePercent ?? 12m;
            result.MaxEligibleAmount = maxEmiByFoir > 0
                ? Math.Min(
                    ReverseEMI(maxEmiByFoir, req.TenureMonths, baseRate),
                    product?.MaxAmount ?? decimal.MaxValue)
                : 0;
            result.MaxEligibleAmount = Math.Round(result.MaxEligibleAmount / 1000) * 1000; // round to nearest 1000

            // ── Interest rate ────────────────────────────────────────────────
            if (req.CibilScore >= 800)      result.RecommendedRatePercent = baseRate;
            else if (req.CibilScore >= 750) result.RecommendedRatePercent = baseRate + 0.50m;
            else if (req.CibilScore >= 700) result.RecommendedRatePercent = baseRate + 1.00m;
            else if (req.CibilScore >= 650) result.RecommendedRatePercent = baseRate + 2.00m;
            else                            result.RecommendedRatePercent = product?.MaxRatePercent ?? 18m;

            // ── Try expression engine for override ───────────────────────────
            var useExpressions = _config.GetValue<bool>("FeatureFlags:EnableExpressions");
            if (useExpressions)
            {
                try
                {
                    var ctx = new Dictionary<string, object>
                    {
                        ["customer.monthlyIncome"]   = req.GrossMonthlyIncome,
                        ["customer.creditScore"]     = req.CibilScore,
                        ["customer.debtToIncomeRatio"] = foir,
                        ["loan.amount"]              = req.RequestedAmount,
                        ["loan.tenure"]              = req.TenureMonths,
                        ["product.type"]             = req.ProductType,
                    };
                    var exprResult = await _expressions.EvaluateLoanEligibilityAsync(
                        "system", req.RequestedAmount, ctx);
                    if (exprResult == "REJECTED" && !rejectionReasons.Any())
                        rejectionReasons.Add("Loan eligibility criteria not met per bank rules");
                    if (exprResult == "APPROVED" || exprResult == "MANUAL_REVIEW")
                    {
                        var rate = await _expressions.CalculateInterestRateAsync(req.ProductType, ctx);
                        if (rate > 0) result.RecommendedRatePercent = rate;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Expression engine check failed; using rule-based fallback");
                }
            }

            // ── Final verdict ────────────────────────────────────────────────
            result.IsEligible        = !rejectionReasons.Any();
            result.RejectionReasons  = rejectionReasons;
            result.ProposedMonthlyEMI = Math.Round(proposedEMI, 0);
            result.ProcessingFee     = product != null
                ? Math.Round(req.RequestedAmount * product.ProcessingFeePercent / 100, 0)
                : 0;

            return Ok(result);
        }

        // ── GET /api/loans/calculate-foir ─────────────────────────────────────
        [HttpGet("calculate-foir")]
        public ActionResult<FoirResult> CalculateFoir(
            [FromQuery] decimal monthlyIncome,
            [FromQuery] decimal existingEMI,
            [FromQuery] decimal proposedEMI)
        {
            if (monthlyIncome <= 0) return BadRequest("monthlyIncome must be > 0");
            decimal foir = (existingEMI + proposedEMI) / monthlyIncome;
            return Ok(new FoirResult
            {
                FOIRPercent    = Math.Round(foir * 100, 2),
                IsWithinLimit  = foir <= 0.50m,
                LimitPercent   = 50,
                ExistingEMI    = existingEMI,
                ProposedEMI    = proposedEMI,
                TotalObligation = existingEMI + proposedEMI,
                DisposableIncome = monthlyIncome - existingEMI - proposedEMI,
            });
        }

        // ── GET /api/loans/calculate-ltv ─────────────────────────────────────
        [HttpGet("calculate-ltv")]
        public ActionResult<LtvResult> CalculateLtv(
            [FromQuery] decimal propertyValue,
            [FromQuery] decimal loanAmount,
            [FromQuery] string? productType)
        {
            if (propertyValue <= 0) return BadRequest("propertyValue must be > 0");
            decimal ltv = loanAmount / propertyValue;
            decimal limit = productType == "GOLD_LOAN" ? 0.75m : 0.80m;
            return Ok(new LtvResult
            {
                LTVPercent    = Math.Round(ltv * 100, 2),
                IsWithinLimit = ltv <= limit,
                LimitPercent  = limit * 100,
                MaxLoanAmount = Math.Round(propertyValue * limit / 1000) * 1000,
            });
        }

        // ── GET /api/loans/calculate-emi ─────────────────────────────────────
        [HttpGet("calculate-emi")]
        public ActionResult<EmiResult> CalculateEMI(
            [FromQuery] decimal principal,
            [FromQuery] int tenureMonths,
            [FromQuery] decimal annualRatePercent)
        {
            if (principal <= 0 || tenureMonths <= 0 || annualRatePercent <= 0)
                return BadRequest("All parameters must be > 0");

            decimal emi = ComputeEMI(principal, tenureMonths, annualRatePercent);
            decimal totalPayment = emi * tenureMonths;
            return Ok(new EmiResult
            {
                MonthlyEMI      = Math.Round(emi, 0),
                TotalPayment    = Math.Round(totalPayment, 0),
                TotalInterest   = Math.Round(totalPayment - principal, 0),
                Principal       = principal,
                AnnualRate      = annualRatePercent,
                TenureMonths    = tenureMonths,
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        private static decimal ComputeEMI(decimal principal, int months, decimal annualRatePercent)
        {
            if (annualRatePercent <= 0 || months <= 0) return 0;
            decimal r = annualRatePercent / 12 / 100;
            decimal factor = (decimal)Math.Pow((double)(1 + r), months);
            return principal * r * factor / (factor - 1);
        }

        private static decimal ReverseEMI(decimal maxEmi, int months, decimal annualRatePercent)
        {
            if (annualRatePercent <= 0 || months <= 0) return maxEmi * months;
            decimal r = annualRatePercent / 12 / 100;
            decimal factor = (decimal)Math.Pow((double)(1 + r), months);
            return maxEmi * (factor - 1) / (r * factor);
        }
    }

    // ── Request / Response DTOs ───────────────────────────────────────────────
    public class EligibilityRequest
    {
        public string ProductType { get; set; } = "PERSONAL_LOAN";
        public decimal RequestedAmount { get; set; }
        public int TenureMonths { get; set; }
        public decimal GrossMonthlyIncome { get; set; }
        public decimal ExistingMonthlyEMI { get; set; }
        public decimal ProposedMonthlyEMI { get; set; }
        public int CibilScore { get; set; }
        public decimal CollateralValue { get; set; }
    }

    public class EligibilityResult
    {
        public bool IsEligible { get; set; }
        public decimal MaxEligibleAmount { get; set; }
        public decimal RecommendedRatePercent { get; set; }
        public decimal FOIRPercent { get; set; }
        public decimal? LTVPercent { get; set; }
        public decimal ProposedMonthlyEMI { get; set; }
        public decimal ProcessingFee { get; set; }
        public string CibilBand { get; set; } = string.Empty;
        public List<string> RejectionReasons { get; set; } = new();
    }

    public class FoirResult
    {
        public decimal FOIRPercent { get; set; }
        public bool IsWithinLimit { get; set; }
        public decimal LimitPercent { get; set; }
        public decimal ExistingEMI { get; set; }
        public decimal ProposedEMI { get; set; }
        public decimal TotalObligation { get; set; }
        public decimal DisposableIncome { get; set; }
    }

    public class LtvResult
    {
        public decimal LTVPercent { get; set; }
        public bool IsWithinLimit { get; set; }
        public decimal LimitPercent { get; set; }
        public decimal MaxLoanAmount { get; set; }
    }

    public class EmiResult
    {
        public decimal MonthlyEMI { get; set; }
        public decimal TotalPayment { get; set; }
        public decimal TotalInterest { get; set; }
        public decimal Principal { get; set; }
        public decimal AnnualRate { get; set; }
        public int TenureMonths { get; set; }
    }
}
