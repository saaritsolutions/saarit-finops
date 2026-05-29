using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── File-scoped stubs ─────────────────────────────────────────────────────────

file sealed class EcsProductRepository : ILoanProductRepository
{
    private readonly List<LoanProduct> _products;

    public EcsProductRepository()
    {
        _products = new List<LoanProduct>
        {
            new LoanProduct
            {
                Id = Guid.NewGuid(),
                ProductCode = "PERSONAL_LOAN",
                Name = "Personal Loan",
                Category = "UNSECURED",
                MinAmount = 50_000,
                MaxAmount = 40_00_000,
                MinTenureMonths = 12,
                MaxTenureMonths = 60,
                BaseRatePercent = 10.50m,
                MaxRatePercent = 18.00m,
                ProcessingFeePercent = 1.50m,
                MinMonthlyIncome = 20_000,
                MinCibilScore = 650,
                MaxFoirPercent = 0.50m,
                RequiresCollateral = false,
                IsActive = true,
            },
            new LoanProduct
            {
                Id = Guid.NewGuid(),
                ProductCode = "HOME_LOAN",
                Name = "Home Loan",
                Category = "SECURED",
                MinAmount = 5_00_000,
                MaxAmount = 5_00_00_000,
                MinTenureMonths = 60,
                MaxTenureMonths = 300,
                BaseRatePercent = 8.50m,
                MaxRatePercent = 12.50m,
                ProcessingFeePercent = 0.50m,
                MinMonthlyIncome = 50_000,
                MinCibilScore = 700,
                MaxFoirPercent = 0.50m,
                RequiresCollateral = true,
                MaxLtvPercent = 0.80m,
                IsActive = true,
            },
            new LoanProduct
            {
                Id = Guid.NewGuid(),
                ProductCode = "GOLD_LOAN",
                Name = "Gold Loan",
                Category = "SECURED",
                MinAmount = 10_000,
                MaxAmount = 50_00_000,
                MinTenureMonths = 3,
                MaxTenureMonths = 24,
                BaseRatePercent = 7.00m,
                MaxRatePercent = 10.00m,
                ProcessingFeePercent = 0.25m,
                MinMonthlyIncome = 10_000,
                MinCibilScore = 600,
                MaxFoirPercent = 0.60m,
                RequiresCollateral = true,
                MaxLtvPercent = 0.75m,
                IsActive = true,
            },
        };
    }

    public Task<LoanProduct?> GetByProductCodeAsync(string productCode)
    {
        var product = _products.FirstOrDefault(p => p.ProductCode == productCode && p.IsActive);
        return Task.FromResult(product);
    }
}

// ── Test Factory ──────────────────────────────────────────────────────────────

file static class EcsFactory
{
    public static IEligibilityCheckService CreateService() =>
        new EligibilityCheckService(
            NullLogger<EligibilityCheckService>.Instance,
            new EcsProductRepository());
}

// =============================================================================
// TC-EC — Eligibility Check Service (PHASE 1)
// =============================================================================

[TestFixture]
public class EligibilityCheckServiceTests
{
    private IEligibilityCheckService _sut = null!;

    [SetUp]
    public void Setup()
    {
        _sut = EcsFactory.CreateService();
    }

    // T-01: FOIR Calculation for Salaried Employees
    [Test]
    public async Task PerformEligibilityCheck_SalariedFoirWithinLimit_ReturnsApproved()
    {
        // Salaried employee with FOIR = 35% (within 50% limit)
        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Raj Kumar",
            panNumber: "ABCDE1234F",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: 10_000m,
            monthlyObligations: 25_000m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.Status, Is.EqualTo("APPROVED"));
        Assert.That(result.FOIRPercent, Is.EqualTo(35.00m));
        Assert.That(result.FOIRLimit, Is.EqualTo(50m));
        Assert.That(result.FOIRBreach, Is.False);
        Assert.That(result.RiskGrade, Is.EqualTo("A+"));
        Assert.That(result.EligibilityScore, Is.GreaterThanOrEqualTo(90));
    }

    // T-02: FOIR Breach Detection for Self-Employed
    [Test]
    public async Task PerformEligibilityCheck_SelfEmployedFoirBreach_ReturnsDeclined()
    {
        // Self-employed with FOIR = 45% (within 40% limit = BREACH)
        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Priya Singh",
            panNumber: "XYZAB5678G",
            dateOfBirth: DateTime.UtcNow.AddYears(-40),
            productType: "PERSONAL_LOAN",
            employmentType: "SELF_EMPLOYED",
            grossMonthlyIncome: 80_000m,
            existingMonthlyEmi: 15_000m,
            monthlyObligations: 21_000m,
            otherMonthlyIncome: 5_000m,
            cibilScore: 720,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.Status, Is.EqualTo("DECLINED"));
        Assert.That(result.FOIRPercent, Is.GreaterThan(40m)); // 36000/80000 = 45%
        Assert.That(result.FOIRBreach, Is.True);
        Assert.That(result.RejectionReasonsJson, Does.Contain("FOIR"));
        Assert.That(result.EligibilityScore, Is.EqualTo(0));
    }

    // T-03: CIBIL Band Mapping (EXCELLENT → POOR)
    [Test]
    [TestCase(750, "EXCELLENT")]
    [TestCase(700, "GOOD")]
    [TestCase(650, "FAIR")]
    [TestCase(600, "POOR")]
    [TestCase(500, "POOR")]
    public async Task PerformEligibilityCheck_CibilScores_ReturnCorrectBands(int cibilScore, string expectedBand)
    {
        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Test Applicant",
            panNumber: "TEST1234567",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: 5_000m,
            monthlyObligations: 10_000m,
            otherMonthlyIncome: 0m,
            cibilScore: cibilScore,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.CibilBand, Is.EqualTo(expectedBand));
    }

    // T-04: Age Validation (21-60 for Salaried, 21-70 for Retired)
    [Test]
    [TestCase(20, "SALARIED", true)] // Below minimum
    [TestCase(21, "SALARIED", false)] // At minimum
    [TestCase(45, "SALARIED", false)] // Valid
    [TestCase(60, "SALARIED", false)] // At maximum
    [TestCase(61, "SALARIED", true)] // Above maximum
    [TestCase(70, "RETIRED", false)] // Valid for retired
    [TestCase(71, "RETIRED", true)] // Above max for retired
    public async Task PerformEligibilityCheck_AgeValidation_EnforcesAgeLimits(
        int age, string employmentType, bool shouldBeDeclined)
    {
        var dob = DateTime.UtcNow.AddYears(-age);

        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Age Test Applicant",
            panNumber: "AGE12345678",
            dateOfBirth: dob,
            productType: "PERSONAL_LOAN",
            employmentType: employmentType,
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: 5_000m,
            monthlyObligations: 10_000m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: null,
            collateralValue: null);

        if (shouldBeDeclined)
        {
            Assert.That(result.Status, Is.EqualTo("DECLINED"));
            Assert.That(result.RejectionReasonsJson, Does.Contain("Age"));
        }
        else
        {
            Assert.That(result.Status, Is.Not.EqualTo("DECLINED"));
        }
    }

    // T-05: Risk Grade Calculation (A+ to C) - Parameterized
    [Test]
    [TestCase(750, 30, "A+", 90)] // Excellent CIBIL, Low FOIR
    [TestCase(720, 35, "A", 80)]  // Good CIBIL, Low FOIR
    [TestCase(700, 45, "B+", 70)] // Good CIBIL, Moderate FOIR
    [TestCase(680, 48, "B", 60)]  // Fair CIBIL, High FOIR
    [TestCase(600, 48, "C", 50)]  // Poor CIBIL, High FOIR
    public async Task PerformEligibilityCheck_RiskGradeCalculation_ReturnCorrectGrades(
        int cibilScore, int foirPercentInt, string expectedGrade, int minExpectedScore)
    {
        // Calculate income to achieve desired FOIR
        var foirPercent = (decimal)foirPercentInt;
        var totalObligations = 100_000m * (foirPercent / 100m);
        var emi = totalObligations / 2;
        var obligations = totalObligations - emi;

        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Risk Test Applicant",
            panNumber: "RISK1234567",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: emi,
            monthlyObligations: obligations,
            otherMonthlyIncome: 0m,
            cibilScore: cibilScore,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.RiskGrade, Is.EqualTo(expectedGrade));
        Assert.That(result.EligibilityScore, Is.GreaterThanOrEqualTo(minExpectedScore));
    }

    // T-06: Max Eligible Amount Calculation
    [Test]
    public async Task PerformEligibilityCheck_MaxEligibleAmount_ReturnsSmallestOfAllLimits()
    {
        // Test data:
        // - Gross Income: 200,000
        // - FOIR 50% limit: 200,000 * 50% - 40,000 = 60,000
        // - Product max: 4,000,000
        // - Income based: (20,000 / 200,000) * 4,000,000 = 400,000
        // Expected: Min(60,000, 4,000,000, 400,000) = 60,000

        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Max Amount Test",
            panNumber: "MAXL1234567",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 200_000m,
            existingMonthlyEmi: 40_000m,
            monthlyObligations: 0m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.MaxEligibleAmount, Is.GreaterThan(0));
        // FOIR-based limit should be the constraining factor here
        Assert.That(result.MaxEligibleAmount, Is.LessThanOrEqualTo(60_000m));
    }

    // T-07: LTV Calculation for Secured Products
    [Test]
    public async Task PerformEligibilityCheck_SecuredProduct_CalculatesLtv()
    {
        // Home Loan: MaxLtvPercent = 80%, Collateral = 25,00,000
        // Max eligible from LTV = 25,00,000 * 0.80 = 20,00,000

        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "LTV Test Applicant",
            panNumber: "LTV01234567",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "HOME_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 200_000m,
            existingMonthlyEmi: 0m,
            monthlyObligations: 0m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: "PROPERTY",
            collateralValue: 25_00_000m);

        Assert.That(result.LTVLimit, Is.EqualTo(80m)); // 80% from MaxLtvPercent
        Assert.That(result.MaxEligibleAmount, Is.GreaterThan(0));
        // Should be limited by LTV: 25,00,000 * 0.80 = 20,00,000
        Assert.That(result.MaxEligibleAmount, Is.LessThanOrEqualTo(20_00_000m));
    }

    // T-08: 24-Hour Pre-Approval Validity
    [Test]
    public async Task PerformEligibilityCheck_SetExpiry_24HoursFromNow()
    {
        var beforeCheck = DateTime.UtcNow;

        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Validity Test",
            panNumber: "VLD01234567",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: 0m,
            monthlyObligations: 0m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: null,
            collateralValue: null);

        var afterCheck = DateTime.UtcNow;

        // Verify CheckedAt is set to now
        Assert.That(result.CheckedAt, Is.GreaterThanOrEqualTo(beforeCheck));
        Assert.That(result.CheckedAt, Is.LessThanOrEqualTo(afterCheck));

        // Verify ExpiresAt is approximately 24 hours from now
        var expectedExpiry = DateTime.UtcNow.AddHours(24);
        Assert.That(result.ExpiresAt, Is.GreaterThan(DateTime.UtcNow.AddHours(23.99)));
        Assert.That(result.ExpiresAt, Is.LessThan(DateTime.UtcNow.AddHours(24.01)));
    }

    // Additional Edge Case Tests

    [Test]
    public async Task PerformEligibilityCheck_BelowProductMinIncome_ReturnsDeclined()
    {
        // PERSONAL_LOAN requires 20,000 min income, provide 10,000
        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Low Income Test",
            panNumber: "LOWINC12345",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 10_000m, // Below minimum
            existingMonthlyEmi: 0m,
            monthlyObligations: 0m,
            otherMonthlyIncome: 0m,
            cibilScore: 750,
            collateralType: null,
            collateralValue: null);

        Assert.That(result.Status, Is.EqualTo("DECLINED"));
        Assert.That(result.RejectionReasonsJson, Does.Contain("income"));
    }

    [Test]
    public async Task PerformEligibilityCheck_BelowProductMinCibil_ReturnsDeclined()
    {
        // PERSONAL_LOAN requires 650 min CIBIL, provide 600
        var result = await _sut.PerformEligibilityCheckAsync(
            applicantName: "Low CIBIL Test",
            panNumber: "LOWCIBIL123",
            dateOfBirth: DateTime.UtcNow.AddYears(-35),
            productType: "PERSONAL_LOAN",
            employmentType: "SALARIED",
            grossMonthlyIncome: 100_000m,
            existingMonthlyEmi: 0m,
            monthlyObligations: 0m,
            otherMonthlyIncome: 0m,
            cibilScore: 600, // Below minimum
            collateralType: null,
            collateralValue: null);

        Assert.That(result.Status, Is.EqualTo("DECLINED"));
        Assert.That(result.RejectionReasonsJson, Does.Contain("CIBIL"));
    }

    [Test]
    public async Task PerformEligibilityCheck_InvalidProduct_ThrowsException()
    {
        var ex = Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await _sut.PerformEligibilityCheckAsync(
                applicantName: "Invalid Product Test",
                panNumber: "INVALID12345",
                dateOfBirth: DateTime.UtcNow.AddYears(-35),
                productType: "NONEXISTENT_PRODUCT",
                employmentType: "SALARIED",
                grossMonthlyIncome: 100_000m,
                existingMonthlyEmi: 0m,
                monthlyObligations: 0m,
                otherMonthlyIncome: 0m,
                cibilScore: 750,
                collateralType: null,
                collateralValue: null);
        });

        Assert.That(ex!.Message, Does.Contain("not found"));
    }
}
