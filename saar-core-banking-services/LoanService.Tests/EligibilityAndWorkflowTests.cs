using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── Fake expression service (minimal stub) ────────────────────────────────────
file sealed class NoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

// ── Fake transaction service client (non-fatal no-op for tests) ───────────────
file sealed class NoOpTransactionService : ITransactionServiceClient
{
    public Task<DisbursalJournalResult> PostDisbursalJournalAsync(
        string applicationNumber, string productType, decimal amount,
        string glDebitAccount, string glCreditAccount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "Test stub"));

    public Task<DisbursalJournalResult> PostGoldLoanDisbursalJournalAsync(
        string applicationNumber, decimal amount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "Test stub"));

    public Task<DisbursalJournalResult> PostGoldLoanClosureJournalAsync(
        string applicationNumber, decimal principal, decimal interest, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "Test stub"));
}

// ── Fake workflow client (no-op) ───────────────────────────────────────────────
file sealed class NoOpWorkflowClient : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

// ── DB factory ────────────────────────────────────────────────────────────────
file static class DbFactory
{
    public static LoanDbContext Create(bool seedProducts = true)
    {
        var opts = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new LoanDbContext(opts);
        if (seedProducts) SeedProducts(db);
        return db;
    }

    public static void SeedProducts(LoanDbContext db)
    {
        db.LoanProducts.AddRange(
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000001"),
                ProductCode = "PERSONAL_LOAN", Name = "Personal Loan",
                Category = "UNSECURED", MinAmount = 50_000, MaxAmount = 40_00_000,
                MinTenureMonths = 12, MaxTenureMonths = 60,
                BaseRatePercent = 10.50m, MaxRatePercent = 18.00m,
                ProcessingFeePercent = 1.50m,
                MinMonthlyIncome = 20_000, MinCibilScore = 650,
                MaxFoirPercent = 0.50m, RequiresCollateral = false, IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000002"),
                ProductCode = "HOME_LOAN", Name = "Home Loan",
                Category = "SECURED", MinAmount = 5_00_000, MaxAmount = 5_00_00_000,
                MinTenureMonths = 60, MaxTenureMonths = 300,
                BaseRatePercent = 8.50m, MaxRatePercent = 12.50m,
                ProcessingFeePercent = 0.50m,
                MinMonthlyIncome = 50_000, MinCibilScore = 700,
                MaxFoirPercent = 0.50m, RequiresCollateral = true, MaxLtvPercent = 0.80m, IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000004"),
                ProductCode = "GOLD_LOAN", Name = "Gold Loan",
                Category = "SECURED", MinAmount = 10_000, MaxAmount = 50_00_000,
                MinTenureMonths = 3, MaxTenureMonths = 24,
                BaseRatePercent = 7.00m, MaxRatePercent = 10.00m,
                ProcessingFeePercent = 0.25m,
                MinMonthlyIncome = 10_000, MinCibilScore = 600,
                MaxFoirPercent = 0.60m, RequiresCollateral = true, MaxLtvPercent = 0.75m, IsActive = true,
            });
        db.SaveChanges();
    }

    public static LoanApplication CreateApp(string status = "SUBMITTED", string product = "PERSONAL_LOAN") =>
        new()
        {
            Id                = Guid.NewGuid(),
            ApplicationNumber = $"LAP-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType       = product,
            RequestedAmount   = 5_00_000,
            TenureMonths      = 36,
            Status            = status,
            ApplicantName     = "Test Applicant",
            GrossMonthlyIncome = 80_000,
            CibilScore        = 750,
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
        };

    public static IConfiguration NoFeatureFlags() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableExpressions"] = "false",
            })
            .Build();
}

// =============================================================================
// TC-01 — EMI Calculator
// =============================================================================
[TestFixture]
public class EmiCalculatorTests
{
    private LoanEligibilityController Sut() =>
        new(DbFactory.Create(), new NoOpExpressions(), DbFactory.NoFeatureFlags(),
            NullLogger<LoanEligibilityController>.Instance);

    [Test]
    public void StandardEmi_ReturnsPositiveValues()
    {
        var result = Sut().CalculateEMI(500_000, 36, 10.5m);
        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var r = ok!.Value as EmiResult;
        Assert.That(r, Is.Not.Null);
        Assert.That(r!.MonthlyEMI,    Is.InRange(15_000m, 18_000m), "EMI should be ~₹16,246");
        Assert.That(r.TotalInterest,  Is.GreaterThan(0));
        Assert.That(r.TotalPayment,   Is.EqualTo(r.MonthlyEMI * 36).Within(20m));
        Assert.That(r.TotalPayment,   Is.GreaterThan(500_000m));
    }

    [Test]
    public void LongTenureHomeLoan_InterestExceedsPrincipal()
    {
        var result = Sut().CalculateEMI(50_00_000, 240, 8.5m);
        var r = (result.Result as OkObjectResult)!.Value as EmiResult;
        Assert.That(r!.TotalInterest, Is.GreaterThan(r.Principal),
            "Over 20 years, interest should exceed principal");
    }

    [Test]
    public void SingleMonthEmi_ApproxPrincipalPlusOneMonthInterest()
    {
        var result = Sut().CalculateEMI(10_000, 1, 12m);
        var r = (result.Result as OkObjectResult)!.Value as EmiResult;
        // 1% of 10000 = 100 interest → total ≈ 10,100
        Assert.That(r!.MonthlyEMI, Is.InRange(10_000m, 10_200m));
    }

    [Test]
    public void ZeroRate_ReturnsBadRequest()
    {
        var result = Sut().CalculateEMI(500_000, 36, 0m);
        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public void ZeroTenure_ReturnsBadRequest()
    {
        var result = Sut().CalculateEMI(500_000, 0, 10m);
        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public void ZeroPrincipal_ReturnsBadRequest()
    {
        var result = Sut().CalculateEMI(0, 36, 10m);
        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public void TotalPayment_EqualsEmiTimesMonths()
    {
        var result = Sut().CalculateEMI(3_00_000, 24, 12m);
        var r = (result.Result as OkObjectResult)!.Value as EmiResult;
        Assert.That(r!.TotalPayment, Is.EqualTo(r.MonthlyEMI * 24).Within(5m));
    }

    [Test]
    public void TotalInterest_EqualsTotalPaymentMinusPrincipal()
    {
        var result = Sut().CalculateEMI(5_00_000, 48, 10m);
        var r = (result.Result as OkObjectResult)!.Value as EmiResult;
        Assert.That(r!.TotalInterest, Is.EqualTo(r.TotalPayment - r.Principal));
    }
}

// =============================================================================
// TC-02 — FOIR Calculator
// =============================================================================
[TestFixture]
public class FoirCalculatorTests
{
    private LoanEligibilityController Sut() =>
        new(DbFactory.Create(), new NoOpExpressions(), DbFactory.NoFeatureFlags(),
            NullLogger<LoanEligibilityController>.Instance);

    [Test]
    public void WithinLimit_ReturnsTrueAt40Percent()
    {
        var result = Sut().CalculateFoir(1_00_000, 0, 40_000);
        var r = (result.Result as OkObjectResult)!.Value as FoirResult;
        Assert.That(r!.FOIRPercent,    Is.EqualTo(40.00m));
        Assert.That(r.IsWithinLimit,   Is.True);
        Assert.That(r.DisposableIncome, Is.EqualTo(60_000m));
    }

    [Test]
    public void AtExactBoundary50Percent_IsWithinLimit()
    {
        var result = Sut().CalculateFoir(1_00_000, 20_000, 30_000);
        var r = (result.Result as OkObjectResult)!.Value as FoirResult;
        Assert.That(r!.FOIRPercent,  Is.EqualTo(50.00m));
        Assert.That(r.IsWithinLimit, Is.True);
    }

    [Test]
    public void Exceeds50Percent_IsNotWithinLimit()
    {
        var result = Sut().CalculateFoir(1_00_000, 30_000, 25_000);
        var r = (result.Result as OkObjectResult)!.Value as FoirResult;
        Assert.That(r!.FOIRPercent,  Is.EqualTo(55.00m));
        Assert.That(r.IsWithinLimit, Is.False);
    }

    [Test]
    public void DisposableIncome_CalculatedCorrectly()
    {
        var result = Sut().CalculateFoir(80_000, 10_000, 20_000);
        var r = (result.Result as OkObjectResult)!.Value as FoirResult;
        Assert.That(r!.DisposableIncome, Is.EqualTo(50_000m));
        Assert.That(r.TotalObligation,   Is.EqualTo(30_000m));
    }

    [Test]
    public void ZeroIncome_ReturnsBadRequest()
    {
        var result = Sut().CalculateFoir(0, 0, 10_000);
        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public void ZeroObligations_ReturnsFoirZero()
    {
        var result = Sut().CalculateFoir(1_00_000, 0, 0);
        var r = (result.Result as OkObjectResult)!.Value as FoirResult;
        Assert.That(r!.FOIRPercent, Is.EqualTo(0.00m));
        Assert.That(r.IsWithinLimit, Is.True);
    }
}

// =============================================================================
// TC-03 — LTV Calculator
// =============================================================================
[TestFixture]
public class LtvCalculatorTests
{
    private LoanEligibilityController Sut() =>
        new(DbFactory.Create(), new NoOpExpressions(), DbFactory.NoFeatureFlags(),
            NullLogger<LoanEligibilityController>.Instance);

    [Test]
    public void HomeLoan_75Percent_WithinLimit()
    {
        var result = Sut().CalculateLtv(60_00_000, 45_00_000, "HOME_LOAN");
        var r = (result.Result as OkObjectResult)!.Value as LtvResult;
        Assert.That(r!.LTVPercent,    Is.EqualTo(75.00m));
        Assert.That(r.IsWithinLimit,  Is.True);
        Assert.That(r.LimitPercent,   Is.EqualTo(80m));
    }

    [Test]
    public void HomeLoan_85Percent_ExceedsLimit()
    {
        var result = Sut().CalculateLtv(60_00_000, 51_00_000, "HOME_LOAN");
        var r = (result.Result as OkObjectResult)!.Value as LtvResult;
        Assert.That(r!.LTVPercent,   Is.EqualTo(85.00m));
        Assert.That(r.IsWithinLimit, Is.False);
    }

    [Test]
    public void GoldLoan_Within75Limit()
    {
        var result = Sut().CalculateLtv(3_00_000, 2_00_000, "GOLD_LOAN");
        var r = (result.Result as OkObjectResult)!.Value as LtvResult;
        Assert.That(r!.LTVPercent,   Is.InRange(66.00m, 67.00m)); // 66.67%
        Assert.That(r.IsWithinLimit, Is.True);
        Assert.That(r.LimitPercent,  Is.EqualTo(75m));
    }

    [Test]
    public void GoldLoan_90Percent_ExceedsLimit()
    {
        var result = Sut().CalculateLtv(2_00_000, 1_80_000, "GOLD_LOAN");
        var r = (result.Result as OkObjectResult)!.Value as LtvResult;
        Assert.That(r!.LTVPercent,   Is.EqualTo(90.00m));
        Assert.That(r.IsWithinLimit, Is.False);
    }

    [Test]
    public void MaxLoanAmount_RoundedToNearest1000()
    {
        var result = Sut().CalculateLtv(80_00_000, 0, "HOME_LOAN");
        var r = (result.Result as OkObjectResult)!.Value as LtvResult;
        // 80,00,000 × 0.80 = 64,00,000 — already a multiple of 1000
        Assert.That(r!.MaxLoanAmount, Is.EqualTo(64_00_000m));
    }

    [Test]
    public void ZeroPropertyValue_ReturnsBadRequest()
    {
        var result = Sut().CalculateLtv(0, 10_000, "HOME_LOAN");
        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }
}

// =============================================================================
// TC-04 — Full Eligibility Check
// =============================================================================
[TestFixture]
public class CheckEligibilityTests
{
    private LoanEligibilityController Sut() =>
        new(DbFactory.Create(), new NoOpExpressions(), DbFactory.NoFeatureFlags(),
            NullLogger<LoanEligibilityController>.Instance);

    [Test]
    public async Task EligibleApplicant_HappyPath()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 4_00_000,
            TenureMonths      = 36,
            GrossMonthlyIncome = 80_000,
            ExistingMonthlyEMI = 5_000,
            CibilScore        = 780,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.True);
        Assert.That(r.RejectionReasons, Is.Empty);
        Assert.That(r.CibilBand,        Is.EqualTo("GOOD"));
        Assert.That(r.RecommendedRatePercent, Is.EqualTo(11.00m)); // base 10.5 + 0.5 for CIBIL 750-800
    }

    [Test]
    public async Task RejectWhenFoirExceeds50()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 5_00_000,
            TenureMonths      = 36,
            GrossMonthlyIncome = 40_000,
            ExistingMonthlyEMI = 15_000, // proposed EMI ~16K → total 31K → FOIR ~77%
            CibilScore        = 720,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.False);
        Assert.That(r.RejectionReasons, Has.Some.Contains("FOIR"));
    }

    [Test]
    public async Task RejectWhenCibilBelowMinimum()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 2_00_000,
            TenureMonths      = 24,
            GrossMonthlyIncome = 60_000,
            CibilScore        = 620, // below min 650
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.False);
        Assert.That(r.RejectionReasons, Has.Some.Contains("620"));
    }

    [Test]
    public async Task RejectWhenAmountBelowMinimum()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 30_000, // below min ₹50,000
            TenureMonths      = 12,
            GrossMonthlyIncome = 40_000,
            CibilScore        = 720,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.False);
        Assert.That(r.RejectionReasons, Has.Some.Contains("minimum"));
    }

    [Test]
    public async Task RejectWhenAmountExceedsMaximum()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 50_00_000, // above max ₹40,00,000
            TenureMonths      = 60,
            GrossMonthlyIncome = 2_00_000,
            CibilScore        = 800,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.False);
        Assert.That(r.RejectionReasons, Has.Some.Contains("maximum").Or.Some.Contains("exceeds"));
    }

    [Test]
    public async Task MultipleRejections_AllReturned()
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 5_00_000,
            TenureMonths      = 36,
            GrossMonthlyIncome = 30_000,
            ExistingMonthlyEMI = 20_000, // high FOIR
            CibilScore        = 600,     // below min
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.IsEligible, Is.False);
        Assert.That(r.RejectionReasons.Count, Is.GreaterThanOrEqualTo(2));
    }

    [TestCase(820, "EXCELLENT")]
    [TestCase(775, "GOOD")]
    [TestCase(715, "FAIR")]
    [TestCase(660, "MARGINAL")]
    [TestCase(600, "POOR")]
    public async Task CibilBandAssignment_CorrectForAllRanges(int cibil, string expectedBand)
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 2_00_000,
            TenureMonths      = 24,
            GrossMonthlyIncome = 80_000,
            CibilScore        = cibil,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That(r!.CibilBand, Is.EqualTo(expectedBand));
    }

    [TestCase(820, 10.50)]  // base rate
    [TestCase(775, 11.00)]  // base + 0.50
    [TestCase(715, 11.50)]  // base + 1.00
    [TestCase(660, 12.50)]  // base + 2.00
    [TestCase(600, 18.00)]  // MaxRatePercent
    public async Task InterestRateTiering_ByPersonalLoanCibil(int cibil, double expectedRate)
    {
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 2_00_000,
            TenureMonths      = 24,
            GrossMonthlyIncome = 80_000,
            CibilScore        = cibil,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        Assert.That((double)r!.RecommendedRatePercent, Is.EqualTo(expectedRate).Within(0.01));
    }

    [Test]
    public async Task ProcessingFee_CalculatedAsPercentOfAmount()
    {
        // PERSONAL_LOAN processing fee = 1.50%
        var result = await Sut().CheckEligibility(new EligibilityRequest
        {
            ProductType       = "PERSONAL_LOAN",
            RequestedAmount   = 4_00_000,
            TenureMonths      = 36,
            GrossMonthlyIncome = 80_000,
            CibilScore        = 750,
        });
        var r = (result.Result as OkObjectResult)!.Value as EligibilityResult;
        // 1.5% of 4,00,000 = 6,000
        Assert.That(r!.ProcessingFee, Is.EqualTo(6_000m));
    }
}

// =============================================================================
// TC-06/07 — Loan Applications List & Detail
// =============================================================================
[TestFixture]
public class LoanApplicationsListTests
{
    private (LoanApplicationsController sut, LoanDbContext db) Setup()
    {
        var db  = DbFactory.Create(seedProducts: false);
        var sut = new LoanApplicationsController(
            db,
            new NoOpWorkflowClient(),
            new NoOpExpressions(),
            new NoOpTransactionService(),
            NullLogger<LoanApplicationsController>.Instance);
        return (sut, db);
    }

    private static void SeedApps(LoanDbContext db, int count = 5)
    {
        for (int i = 0; i < count; i++)
        {
            var status = i switch
            {
                0 => "SUBMITTED",
                1 => "IN_REVIEW",
                2 => "CREDIT_APPROVED",
                3 => "DISBURSED",
                _ => "REJECTED",
            };
            var app = DbFactory.CreateApp(status);
            app.ApplicantName = $"Applicant {i + 1} Kumar";
            app.ProductType   = i % 2 == 0 ? "PERSONAL_LOAN" : "HOME_LOAN";
            db.LoanApplications.Add(app);
        }
        db.SaveChanges();
    }

    [Test]
    public async Task GetApplications_ReturnsPaginatedList()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var result = await sut.GetApplications(null, null, null, 1, 20);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(r!.Total,          Is.EqualTo(5));
        Assert.That(r.Items.Count,     Is.EqualTo(5));
        Assert.That(r.Page,            Is.EqualTo(1));
        Assert.That(r.PageSize,        Is.EqualTo(20));
    }

    [Test]
    public async Task GetApplications_FilterByStatus()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var result = await sut.GetApplications("SUBMITTED", null, null, 1, 20);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(r!.Items, Is.All.Matches<ApplicationSummaryDto>(a => a.Status == "SUBMITTED"));
        Assert.That(r.Items.Count, Is.EqualTo(1));
    }

    [Test]
    public async Task GetApplications_FilterByProductType()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var result = await sut.GetApplications(null, null, "HOME_LOAN", 1, 20);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(r!.Items, Is.All.Matches<ApplicationSummaryDto>(a => a.ProductType == "HOME_LOAN"));
    }

    [Test]
    public async Task GetApplications_SearchByApplicantName_CaseInsensitive()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var result = await sut.GetApplications(null, "kumar", null, 1, 20);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(r!.Total, Is.EqualTo(5)); // all have "Kumar" in name
    }

    [Test]
    public async Task GetApplications_SearchNoMatch_ReturnsEmpty()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var result = await sut.GetApplications(null, "XYZNOTEXISTS", null, 1, 20);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(r!.Total,      Is.EqualTo(0));
        Assert.That(r.Items.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task GetApplications_Pagination_ReturnsCorrectPage()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5);

        var page1 = ((await sut.GetApplications(null, null, null, 1, 2)).Result as OkObjectResult)!.Value as ApplicationListResponse;
        var page2 = ((await sut.GetApplications(null, null, null, 2, 2)).Result as OkObjectResult)!.Value as ApplicationListResponse;

        Assert.That(page1!.Items.Count, Is.EqualTo(2));
        Assert.That(page2!.Items.Count, Is.EqualTo(2));
        // No overlap between pages
        var ids1 = page1.Items.Select(i => i.Id).ToHashSet();
        var ids2 = page2.Items.Select(i => i.Id).ToHashSet();
        Assert.That(ids1.Intersect(ids2), Is.Empty);
    }

    [Test]
    public async Task GetPendingApproval_ExcludesDisbursedAndRejected()
    {
        var (sut, db) = Setup();
        SeedApps(db, 5); // includes DISBURSED and REJECTED

        var result = await sut.GetPendingApproval();
        var items  = (result.Result as OkObjectResult)!.Value as IEnumerable<ApplicationSummaryDto>;

        var validStatuses = new[] { "SUBMITTED", "IN_REVIEW", "CREDIT_APPROVED" };
        Assert.That(items, Is.All.Matches<ApplicationSummaryDto>(a => validStatuses.Contains(a.Status)));
    }

    [Test]
    public async Task GetById_ReturnsApplicationWithDocsAndActions()
    {
        var (sut, db) = Setup();
        var app = DbFactory.CreateApp("SUBMITTED");
        db.LoanApplications.Add(app);
        db.LoanDocuments.Add(new LoanDocument
        {
            Id = Guid.NewGuid(), LoanApplicationId = app.Id,
            DocumentType = "PAN_CARD", IsMandatory = true,
        });
        db.LoanApprovalActions.Add(new LoanApprovalAction
        {
            Id = Guid.NewGuid(), LoanApplicationId = app.Id,
            Action = "SEND_TO_REVIEW", ActionBy = "admin",
            FromStatus = "SUBMITTED", ToStatus = "IN_REVIEW",
            ActionAt = DateTime.UtcNow,
        });
        db.SaveChanges();

        var result = await sut.GetById(app.Id);
        var r = (result.Result as OkObjectResult)!.Value as ApplicationDetailDto;

        Assert.That(r!.Application.Id,  Is.EqualTo(app.Id));
        Assert.That(r.Documents.Count,  Is.EqualTo(1));
        Assert.That(r.Actions.Count,    Is.EqualTo(1));
    }

    [Test]
    public async Task GetById_UnknownId_Returns404()
    {
        var (sut, _) = Setup();
        var result = await sut.GetById(Guid.NewGuid());
        Assert.That(result.Result, Is.InstanceOf<NotFoundResult>());
    }
}

// =============================================================================
// TC-08 — Approval Workflow State Machine
// =============================================================================
[TestFixture]
public class LoanStateMachineTests
{
    private (LoanApplicationsController sut, LoanDbContext db) Setup()
    {
        var db  = DbFactory.Create(seedProducts: false);
        var sut = new LoanApplicationsController(
            db,
            new NoOpWorkflowClient(),
            new NoOpExpressions(),
            new NoOpTransactionService(),
            NullLogger<LoanApplicationsController>.Instance);
        return (sut, db);
    }

    private static Guid SeedApp(LoanDbContext db, string status)
    {
        var app = DbFactory.CreateApp(status);
        db.LoanApplications.Add(app);
        db.SaveChanges();
        return app.Id;
    }

    private static async Task<ApplicationDetailDto> Act(
        LoanApplicationsController sut, Guid id, string action, string? comments = null, decimal? sanctionedAmount = null)
    {
        var result = await sut.TakeAction(id, new LoanActionRequest
        {
            Action           = action,
            ActionBy         = "test_officer",
            Role             = "CREDIT_OFFICER",
            Comments         = comments,
            SanctionedAmount = sanctionedAmount,
        });
        return ((result.Result as OkObjectResult)!.Value as ApplicationDetailDto)!;
    }

    [Test]
    public async Task Submitted_SendToReview_BecomesInReview()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        var detail = await Act(sut, id, "SEND_TO_REVIEW");

        Assert.That(detail.Application.Status, Is.EqualTo("IN_REVIEW"));
        Assert.That(detail.Actions.Last().FromStatus, Is.EqualTo("SUBMITTED"));
        Assert.That(detail.Actions.Last().ToStatus,   Is.EqualTo("IN_REVIEW"));
        Assert.That(detail.Actions.Last().ActionBy,   Is.EqualTo("test_officer"));
    }

    [Test]
    public async Task InReview_CreditApprove_BecomeCreditApproved()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "IN_REVIEW");

        var detail = await Act(sut, id, "CREDIT_APPROVE");

        Assert.That(detail.Application.Status, Is.EqualTo("CREDIT_APPROVED"));
    }

    [Test]
    public async Task CreditApproved_Sanction_BecomeApproved_WithSanctionFields()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "CREDIT_APPROVED");

        var detail = await Act(sut, id, "SANCTION", "Approved per credit policy", 4_80_000m);

        Assert.That(detail.Application.Status,          Is.EqualTo("APPROVED"));
        Assert.That(detail.Application.SanctionedAmount, Is.EqualTo(4_80_000m));
        Assert.That(detail.Application.SanctionRemarks,  Is.EqualTo("Approved per credit policy"));
    }

    [Test]
    public async Task Approved_Disburse_BecomeDisbursed_WithDisbursedAt()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "APPROVED");

        var before = DateTime.UtcNow.AddSeconds(-1);
        var detail = await Act(sut, id, "DISBURSE");

        Assert.That(detail.Application.Status,     Is.EqualTo("DISBURSED"));
        Assert.That(detail.Application.DisbursedAt, Is.GreaterThan(before));
    }

    [Test]
    public async Task Submitted_Reject_SetsRejectionReason()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        var detail = await Act(sut, id, "REJECT", "CIBIL score below threshold");

        Assert.That(detail.Application.Status,          Is.EqualTo("REJECTED"));
        Assert.That(detail.Application.RejectionReason, Is.EqualTo("CIBIL score below threshold"));
    }

    [Test]
    public async Task Submitted_RequestInfo_BecomesInfoRequested()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        var detail = await Act(sut, id, "REQUEST_INFO", "Please provide last 6 months salary slips");

        Assert.That(detail.Application.Status, Is.EqualTo("INFO_REQUESTED"));
    }

    [Test]
    public async Task Submitted_CreditApprove_BypassesReview_IsAllowed()
    {
        // Credit approve directly from SUBMITTED is valid (express track)
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        var detail = await Act(sut, id, "CREDIT_APPROVE");

        Assert.That(detail.Application.Status, Is.EqualTo("CREDIT_APPROVED"));
    }

    [Test]
    public async Task InvalidTransition_CreditApproveOnDisbursed_Returns400()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "DISBURSED");

        var result = await sut.TakeAction(id, new LoanActionRequest { Action = "CREDIT_APPROVE" });

        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task InvalidTransition_DisburseOnCreditApproved_Returns400()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "CREDIT_APPROVED");

        var result = await sut.TakeAction(id, new LoanActionRequest { Action = "DISBURSE" });

        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task InvalidTransition_SanctionOnInReview_Returns400()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "IN_REVIEW");

        var result = await sut.TakeAction(id, new LoanActionRequest { Action = "SANCTION" });

        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task UnknownAction_Returns400()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        var result = await sut.TakeAction(id, new LoanActionRequest { Action = "INVALID_ACTION" });

        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task ActionOnNonExistentApp_Returns404()
    {
        var (sut, _) = Setup();

        var result = await sut.TakeAction(Guid.NewGuid(), new LoanActionRequest { Action = "REJECT" });

        Assert.That(result.Result, Is.InstanceOf<NotFoundResult>());
    }

    [Test]
    public async Task FullLifecycle_DraftToDisbursed_AuditTrailComplete()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED"); // start at SUBMITTED (DRAFT has no action endpoint)

        await Act(sut, id, "SEND_TO_REVIEW");
        await Act(sut, id, "CREDIT_APPROVE");
        await Act(sut, id, "SANCTION", "All checks passed", 5_00_000m);
        var final = await Act(sut, id, "DISBURSE");

        Assert.That(final.Application.Status, Is.EqualTo("DISBURSED"));
        Assert.That(final.Actions.Count,      Is.EqualTo(4));
        // Verify full chain: SUBMITTED→IN_REVIEW→CREDIT_APPROVED→APPROVED→DISBURSED
        var statuses = final.Actions.Select(a => a.ToStatus).ToArray();
        Assert.That(statuses, Is.EqualTo(new[] { "IN_REVIEW", "CREDIT_APPROVED", "APPROVED", "DISBURSED" }));
    }

    [Test]
    public async Task AuditTrail_PreservesActionBy_AndRole()
    {
        var (sut, db) = Setup();
        var id = SeedApp(db, "SUBMITTED");

        await sut.TakeAction(id, new LoanActionRequest
        {
            Action   = "REJECT",
            ActionBy = "manager_001",
            Role     = "MANAGER",
            Comments = "Risk too high",
        });

        var detail = ((await sut.GetById(id)).Result as OkObjectResult)!.Value as ApplicationDetailDto;
        var action = detail!.Actions.First();
        Assert.That(action.ActionBy, Is.EqualTo("manager_001"));
        Assert.That(action.Role,     Is.EqualTo("MANAGER"));
    }
}
