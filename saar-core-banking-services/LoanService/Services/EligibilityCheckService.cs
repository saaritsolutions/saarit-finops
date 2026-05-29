using LoanService.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace LoanService.Services
{
    /// <summary>
    /// PHASE 1: Loan Eligibility Checking Service
    /// Real-time credit scoring with CIBIL band mapping, FOIR, LTV calculations.
    /// Fallback to mock CIBIL scoring if real service unavailable.
    /// </summary>
    public interface IEligibilityCheckService
    {
        Task<LoanEligibilityCheck> PerformEligibilityCheckAsync(
            string applicantName,
            string? panNumber,
            DateTime? dateOfBirth,
            string productType,
            string? employmentType,
            decimal grossMonthlyIncome,
            decimal existingMonthlyEmi,
            decimal monthlyObligations,
            decimal otherMonthlyIncome,
            int? cibilScore,
            string? collateralType,
            decimal? collateralValue);
    }

    public class EligibilityCheckService : IEligibilityCheckService
    {
        private readonly ILogger<EligibilityCheckService> _logger;
        private readonly ILoanProductRepository _productRepository;

        public EligibilityCheckService(
            ILogger<EligibilityCheckService> logger,
            ILoanProductRepository productRepository)
        {
            _logger = logger;
            _productRepository = productRepository;
        }

        public async Task<LoanEligibilityCheck> PerformEligibilityCheckAsync(
            string applicantName,
            string? panNumber,
            DateTime? dateOfBirth,
            string productType,
            string? employmentType,
            decimal grossMonthlyIncome,
            decimal existingMonthlyEmi,
            decimal monthlyObligations,
            decimal otherMonthlyIncome,
            int? cibilScore,
            string? collateralType,
            decimal? collateralValue)
        {
            _logger.LogInformation($"Performing eligibility check for {applicantName} ({panNumber}), product: {productType}");

            var product = await _productRepository.GetByProductCodeAsync(productType);
            if (product == null)
            {
                throw new InvalidOperationException($"Product {productType} not found");
            }

            var eligibility = new LoanEligibilityCheck
            {
                ApplicantName = applicantName,
                PanNumber = panNumber,
                DateOfBirth = dateOfBirth,
                ProductType = productType,
                EmploymentType = employmentType ?? "SALARIED",
                GrossMonthlyIncome = grossMonthlyIncome,
                ExistingMonthlyEMI = existingMonthlyEmi,
                MonthlyObligations = monthlyObligations,
                OtherMonthlyIncome = otherMonthlyIncome,
                CibilScore = cibilScore,
                CollateralType = collateralType,
                CollateralValue = collateralValue,
                CheckedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(24),
            };

            // ── Age Validation ──────────────────────────────────────────────────
            if (dateOfBirth.HasValue)
            {
                var age = (int)((DateTime.UtcNow - dateOfBirth.Value).TotalDays / 365.25);
                var minAge = employmentType == "RETIRED" ? 21 : 21;
                var maxAge = employmentType == "RETIRED" ? 70 : 60;

                if (age < minAge || age > maxAge)
                {
                    eligibility.Status = "DECLINED";
                    eligibility.RejectionReasonsJson = JsonSerializer.Serialize(new[] {
                        $"Age {age} is outside permitted range ({minAge}-{maxAge}) for {employmentType}"
                    });
                    eligibility.EligibilityScore = 0;
                    return eligibility;
                }
            }

            // ── CIBIL Band Mapping ──────────────────────────────────────────────
            if (cibilScore.HasValue)
            {
                eligibility.CibilBand = cibilScore switch
                {
                    >= 750 => "EXCELLENT",
                    >= 700 => "GOOD",
                    >= 650 => "FAIR",
                    _ => "POOR"
                };
            }
            else if (string.IsNullOrEmpty(panNumber))
            {
                // No CIBIL data, may still be eligible for certain products
                eligibility.CibilBand = "FAIR"; // Default assumption
            }

            // ── FOIR Calculation ────────────────────────────────────────────────
            var foirLimit = employmentType == "SELF_EMPLOYED" ? 40m : 50m;
            eligibility.FOIRLimit = foirLimit;

            var totalMonthlyObligations = existingMonthlyEmi + monthlyObligations;
            var foirPercent = grossMonthlyIncome > 0 ? (totalMonthlyObligations / grossMonthlyIncome) * 100 : 0;
            eligibility.FOIRPercent = foirPercent;

            if (foirPercent > foirLimit)
            {
                eligibility.FOIRBreach = true;
                _logger.LogWarning($"FOIR breach: {foirPercent}% > {foirLimit}%");
            }

            // ── LTV Calculation (for secured products) ──────────────────────────
            if (product.RequiresCollateral && collateralValue > 0)
            {
                eligibility.LTVLimit = (product.MaxLtvPercent * 100);
                // LTV will be calculated when applicant provides requested amount
                // For now, just capture the limit
            }

            // ── Max Eligible Amount Calculation ─────────────────────────────────
            // Based on FOIR: Max = (GrossMonthlyIncome × FOIR% / 100) - ExistingEMI
            var maxBasedOnFoir = grossMonthlyIncome > 0
                ? (grossMonthlyIncome * (foirLimit / 100)) - totalMonthlyObligations
                : 0;

            // Based on product limits
            var maxBasedOnProduct = (decimal)product.MaxAmount;

            // Based on min income requirement
            var maxBasedOnIncome = grossMonthlyIncome > 0
                ? ((decimal)product.MinMonthlyIncome / grossMonthlyIncome) * maxBasedOnProduct
                : 0;

            // Collateral-based limit (if secured)
            decimal? maxBasedOnCollateral = null;
            if (product.RequiresCollateral && collateralValue.HasValue)
            {
                var ltvLimit = product.MaxLtvPercent;
                maxBasedOnCollateral = collateralValue.Value * ltvLimit;
            }

            var limits = new List<decimal> { maxBasedOnFoir, maxBasedOnProduct, maxBasedOnIncome };
            if (maxBasedOnCollateral.HasValue)
                limits.Add(maxBasedOnCollateral.Value);

            eligibility.MaxEligibleAmount = limits.Min();

            // ── Risk Grade & Rate Recommendation ────────────────────────────────
            (eligibility.RiskGrade, eligibility.EligibilityScore, eligibility.RecommendedRate) =
                CalculateRiskGradeAndRate(
                    cibilScore ?? 0,
                    foirPercent,
                    foirLimit,
                    product.BaseRatePercent,
                    product.MaxRatePercent,
                    !(cibilScore.HasValue && cibilScore >= product.MinCibilScore));

            // ── Final Eligibility Decision ──────────────────────────────────────
            var rejectionReasons = new List<string>();

            // Check CIBIL requirement
            if (product.MinCibilScore > 0 && (!cibilScore.HasValue || cibilScore < product.MinCibilScore))
            {
                rejectionReasons.Add($"CIBIL score {cibilScore ?? 0} below minimum {product.MinCibilScore}");
            }

            // Check income requirement
            if (grossMonthlyIncome < (decimal)product.MinMonthlyIncome)
            {
                rejectionReasons.Add($"Monthly income ₹{grossMonthlyIncome} below minimum ₹{product.MinMonthlyIncome}");
            }

            // Check FOIR breach
            if (foirPercent > foirLimit)
            {
                rejectionReasons.Add($"FOIR {foirPercent:F2}% exceeds limit {foirLimit}%");
            }

            // Check age (if applicable)
            if (dateOfBirth.HasValue)
            {
                var age = (int)((DateTime.UtcNow - dateOfBirth.Value).TotalDays / 365.25);
                var maxAge = employmentType == "RETIRED" ? 70 : 60;
                if (age > maxAge)
                {
                    rejectionReasons.Add($"Age {age} exceeds maximum {maxAge}");
                }
            }

            if (rejectionReasons.Count > 0)
            {
                eligibility.Status = "DECLINED";
                eligibility.RejectionReasonsJson = JsonSerializer.Serialize(rejectionReasons.ToArray());
                eligibility.EligibilityScore = 0;
            }
            else
            {
                eligibility.Status = eligibility.EligibilityScore >= 75 ? "APPROVED" : "APPROVED_WITH_CONDITIONS";
                eligibility.ConditionsJson = eligibility.EligibilityScore >= 75 ? null :
                    JsonSerializer.Serialize(new[] { "Manual review recommended", "May require higher rate" });
            }

            _logger.LogInformation($"Eligibility check completed: {applicantName} - {eligibility.Status} (Score: {eligibility.EligibilityScore}, Grade: {eligibility.RiskGrade})");

            return eligibility;
        }

        private (string riskGrade, int score, decimal? rate) CalculateRiskGradeAndRate(
            int cibilScore,
            decimal foirPercent,
            decimal foirLimit,
            decimal baseRate,
            decimal maxRate,
            bool noCibilData)
        {
            // Risk score based on multiple factors (0-100)
            var score = 100;

            // CIBIL impact (40 points max)
            if (noCibilData)
            {
                score -= 20; // Unknown credit history
            }
            else if (cibilScore < 600)
            {
                score -= 40;
            }
            else if (cibilScore < 700)
            {
                score -= 20;
            }
            else if (cibilScore < 750)
            {
                score -= 10;
            }

            // FOIR impact (30 points max)
            var foirBreach = (foirPercent / foirLimit) * 100;
            if (foirBreach > 150)
            {
                score -= 30;
            }
            else if (foirBreach > 120)
            {
                score -= 20;
            }
            else if (foirBreach > 100)
            {
                score -= 10;
            }

            // Risk grade mapping
            string riskGrade = score switch
            {
                >= 90 => "A+",
                >= 80 => "A",
                >= 70 => "B+",
                >= 60 => "B",
                _ => "C"
            };

            // Rate calculation: base + risk adjustment
            decimal rateAdj = riskGrade switch
            {
                "A+" => 0.00m,
                "A" => 0.25m,
                "B+" => 0.50m,
                "B" => 1.00m,
                "C" => 2.00m,
                _ => 2.50m
            };

            var rate = Math.Min(baseRate + rateAdj, maxRate);

            return (riskGrade, Math.Max(0, score), rate);
        }
    }

    /// <summary>Interface for loan product repository (to be implemented in existing codebase)</summary>
    public interface ILoanProductRepository
    {
        Task<LoanProduct?> GetByProductCodeAsync(string productCode);
    }
}
