using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers.Gold;
using LoanService.Data;
using LoanService.Models;
using LoanService.Models.Gold;
using LoanService.Services;
using LoanService.Services.Gold;

namespace LoanService.Tests;

// ── Stubs ─────────────────────────────────────────────────────────────────────

file sealed class StubGoldRateService : IGoldRateService
{
    private readonly GoldRateMaster? _rate;

    public StubGoldRateService(decimal ratePerGram = 7500m)
    {
        if (ratePerGram > 0)
        {
            _rate = new GoldRateMaster
            {
                Id              = Guid.NewGuid(),
                RateDate        = DateTime.UtcNow.Date,
                RatePerGramFor22K = ratePerGram,
                Source          = "TEST",
                EnteredBy       = "test",
                CreatedAt       = DateTime.UtcNow,
            };
        }
    }

    public Task<(GoldRateMaster? Rate, bool IsLatest)> GetTodayRateAsync(CancellationToken ct = default) =>
        Task.FromResult<(GoldRateMaster? Rate, bool IsLatest)>((_rate, true));

    public Task<List<GoldRateMaster>> GetHistoryAsync(int days = 30, CancellationToken ct = default) =>
        Task.FromResult(_rate != null ? new List<GoldRateMaster> { _rate } : new List<GoldRateMaster>());

    public Task<GoldRateMaster> CreateRateAsync(DateTime rateDate, decimal ratePerGram,
        string source, string enteredBy, CancellationToken ct = default)
    {
        var entry = new GoldRateMaster
        {
            Id                = Guid.NewGuid(),
            RateDate          = rateDate,
            RatePerGramFor22K = ratePerGram,
            Source            = source,
            EnteredBy         = enteredBy,
            CreatedAt         = DateTime.UtcNow,
        };
        return Task.FromResult(entry);
    }
}

file sealed class StubTransactionClient : ITransactionServiceClient
{
    private readonly bool _succeeds;
    public StubTransactionClient(bool succeeds = true) => _succeeds = succeeds;

    public Task<DisbursalJournalResult> PostDisbursalJournalAsync(
        string appNo, string productType, decimal amount,
        string debit, string credit, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(_succeeds, _succeeds ? "JNL-0001" : null, _succeeds ? null : "stub error"));

    public Task<DisbursalJournalResult> PostGoldLoanDisbursalJournalAsync(
        string appNo, decimal amount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(_succeeds, _succeeds ? "GL-JNL-0001" : null, _succeeds ? null : "stub error"));

    public Task<DisbursalJournalResult> PostGoldLoanClosureJournalAsync(
        string appNo, decimal principal, decimal interest, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(_succeeds, _succeeds ? "GL-JNL-0002" : null, _succeeds ? null : "stub error"));

    public Task<DisbursalJournalResult> PostEmiJournalAsync(
        string appNo, int installmentNumber, decimal principalAmount, decimal interestAmount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(_succeeds, _succeeds ? $"JNL-EMI-{installmentNumber:D3}" : null, _succeeds ? null : "stub error"));
    public Task<DisbursalJournalResult> PostWriteOffJournalAsync(
        string appNo, decimal outstanding, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(_succeeds, _succeeds ? "JNL-WRITEOFF-001" : null, _succeeds ? null : "stub error"));
}

// ── DB helper ─────────────────────────────────────────────────────────────────

file static class GoldTestDb
{
    public static LoanDbContext Create()
    {
        var opts = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new LoanDbContext(opts);
    }

    /// <summary>Creates a DRAFT gold loan + GoldLoanDetails and saves to DB.</summary>
    public static async Task<(LoanApplication App, GoldLoanDetails Gold)> SeedDraftAsync(
        LoanDbContext db, int tenureMonths = 6)
    {
        var app = new LoanApplication
        {
            Id                = Guid.NewGuid(),
            ApplicationNumber = $"GL-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType       = "GOLD_LOAN",
            Status            = "DRAFT",
            RequestedAmount   = 75_000,
            TenureMonths      = tenureMonths,
            ApplicantName     = "Sita Devi",
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
        };
        var gold = new GoldLoanDetails
        {
            Id                  = Guid.NewGuid(),
            LoanApplicationId   = app.Id,
            LoanApplication     = app,
            GoldLoanStatus      = "DRAFT",
            RepaymentScheme     = "BULLET",
            TenureMonths        = tenureMonths,
            InterestRatePercent = 7.00m,
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
        };
        db.LoanApplications.Add(app);
        db.GoldLoanDetails.Add(gold);
        await db.SaveChangesAsync();
        return (app, gold);
    }

    public static GoldLoanController MakeController(
        LoanDbContext db,
        IGoldRateService? goldRateSvc = null,
        ITransactionServiceClient? txnSvc = null)
    {
        var ctrl = new GoldLoanController(
            db,
            goldRateSvc   ?? new StubGoldRateService(),
            txnSvc        ?? new StubTransactionClient(),
            NullLogger<GoldLoanController>.Instance);

        ctrl.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        return ctrl;
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

[TestFixture]
public class GoldLoanTests
{
    // ── Test 1: SANCTION correctly computes LTV ────────────────────────────────

    /// <summary>
    /// 22K necklace: 20g gross, 1g stone deduction = 19g net.
    /// PurityFactor = 22/24 ≈ 0.9167.
    /// ValuedAmount = 19 × 0.9167 × ₹7500 = ₹1,31,250.
    /// 75% of ₹1,31,250 = ₹98,437.50 → max sanctionable without breaching LTV.
    /// </summary>
    [Test]
    public async Task Sanction_ComputesLTV_Correctly()
    {
        var db = GoldTestDb.Create();
        var (app, gold) = await GoldTestDb.SeedDraftAsync(db);

        // Add a pledge item (already appraised values set manually)
        var item = new GoldPledgeItem
        {
            Id                  = Guid.NewGuid(),
            GoldLoanDetailsId   = gold.Id,
            ItemType            = "NECKLACE",
            GrossWeightGrams    = 20m,
            StoneDeductionGrams = 1m,
            NetWeightGrams      = 19m,
            PurityCarats        = 22,
            PurityFactor        = 0.9167m,
            GoldRatePerGram     = 7500m,
            ValuedAmount        = 131_250m,
            CreatedAt           = DateTime.UtcNow,
        };
        db.GoldPledgeItems.Add(item);
        gold.GoldLoanStatus    = "APPRAISED";
        gold.TotalValuedAmount = 131_250m;
        gold.TotalNetWeightGrams = 19m;
        gold.GoldRateAtAppraisal = 7500m;
        gold.UpdatedAt         = DateTime.UtcNow;
        app.Status             = "APPRAISED";
        await db.SaveChangesAsync();

        var ctrl = GoldTestDb.MakeController(db);
        var result = await ctrl.TakeAction(
            app.Id,
            new GoldLoanController.GoldLoanActionRequest(
                Action:                    "SANCTION",
                AppraiserName:             null,
                AppraiserEmployeeId:       null,
                VaultLocation:             null,
                SanctionedAmount:          98_437m,
                Comments:                  null,
                DisbursementAccountNumber: null,
                PrincipalRepaid:           null,
                InterestPaid:              null),
            CancellationToken.None) as OkObjectResult;

        Assert.That(result, Is.Not.Null);
        var refreshed = await db.GoldLoanDetails.FirstAsync(g => g.Id == gold.Id);
        Assert.That(refreshed.LtvPercent, Is.LessThanOrEqualTo(75m));
        Assert.That(refreshed.SanctionedAmount, Is.EqualTo(98_437m));
        Assert.That(refreshed.PledgeReceiptNumber, Does.StartWith("PR-"));
    }

    // ── Test 2: SANCTION rejects when LTV > 75% ────────────────────────────────

    [Test]
    public async Task Sanction_Rejects_WhenLTV_Exceeds75()
    {
        var db = GoldTestDb.Create();
        var (app, gold) = await GoldTestDb.SeedDraftAsync(db);

        var item = new GoldPledgeItem
        {
            Id                  = Guid.NewGuid(),
            GoldLoanDetailsId   = gold.Id,
            ItemType            = "NECKLACE",
            GrossWeightGrams    = 20m,
            StoneDeductionGrams = 1m,
            NetWeightGrams      = 19m,
            PurityCarats        = 22,
            PurityFactor        = 0.9167m,
            GoldRatePerGram     = 7500m,
            ValuedAmount        = 131_250m,
            CreatedAt           = DateTime.UtcNow,
        };
        db.GoldPledgeItems.Add(item);
        gold.GoldLoanStatus    = "APPRAISED";
        gold.TotalValuedAmount = 130_000m;  // slightly lower than above
        gold.UpdatedAt         = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var ctrl = GoldTestDb.MakeController(db);
        // 100_000 / 130_000 = 76.9% → exceeds 75%
        var result = await ctrl.TakeAction(
            app.Id,
            new GoldLoanController.GoldLoanActionRequest(
                Action:                    "SANCTION",
                AppraiserName:             null,
                AppraiserEmployeeId:       null,
                VaultLocation:             null,
                SanctionedAmount:          100_000m,
                Comments:                  null,
                DisbursementAccountNumber: null,
                PrincipalRepaid:           null,
                InterestPaid:              null),
            CancellationToken.None);

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>(),
            "Should reject sanction when LTV exceeds 75%.");
    }

    // ── Test 3: SUBMIT rejects when no pledge items ────────────────────────────

    [Test]
    public async Task Submit_ReturnsBadRequest_WhenNoPledgeItems()
    {
        var db = GoldTestDb.Create();
        var (app, gold) = await GoldTestDb.SeedDraftAsync(db);
        // No pledge items added

        var ctrl = GoldTestDb.MakeController(db);
        var result = await ctrl.TakeAction(
            app.Id,
            new GoldLoanController.GoldLoanActionRequest(
                Action:                    "SUBMIT",
                AppraiserName:             null,
                AppraiserEmployeeId:       null,
                VaultLocation:             null,
                SanctionedAmount:          null,
                Comments:                  null,
                DisbursementAccountNumber: null,
                PrincipalRepaid:           null,
                InterestPaid:              null),
            CancellationToken.None);

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>(),
            "Should reject SUBMIT when application has no pledge items.");
    }

    // ── Test 5: CustomFieldsJson is stored in FormDataJson and round-trips ─────

    [Test]
    public async Task CustomFieldsJson_IsStoredAndRoundTrips()
    {
        var db   = GoldTestDb.Create();
        var ctrl = GoldTestDb.MakeController(db);

        const string customJson = "{\"loanScheme\":\"EMI\",\"goldPurity\":\"22K\"}";

        // Create a gold loan application with custom fields
        var createResult = await ctrl.Create(
            new GoldLoanController.CreateGoldLoanRequest(
                ApplicantName:      "Test Applicant",
                MobileNumber:       "9876543210",
                Email:              null,
                PanNumber:          null,
                AadhaarLast4:       null,
                AddressLine1:       null,
                City:               null,
                State:              null,
                PinCode:            null,
                PurposeOfLoan:      null,
                RequestedAmount:    50_000m,
                TenureMonths:       6,
                InterestRatePercent: 7.00m,
                CustomFieldsJson:   customJson),
            CancellationToken.None) as CreatedAtActionResult;

        Assert.That(createResult, Is.Not.Null, "Create should return CreatedAtActionResult.");

        // Extract the created application ID
        var createdBody = createResult!.Value;
        Assert.That(createdBody, Is.Not.Null);
        var idProp = createdBody!.GetType().GetProperty("Id");
        Assert.That(idProp, Is.Not.Null, "Response body should have Id property.");
        var appId = (Guid)idProp!.GetValue(createdBody)!;

        // GET detail
        var getResult = await ctrl.GetById(appId, CancellationToken.None) as OkObjectResult;
        Assert.That(getResult, Is.Not.Null, "GetById should return OkObjectResult.");

        var body = getResult!.Value;
        Assert.That(body, Is.Not.Null);
        var fdProp = body!.GetType().GetProperty("FormDataJson");
        Assert.That(fdProp, Is.Not.Null, "GET response body should have FormDataJson property.");
        var formDataJson = fdProp!.GetValue(body) as string;

        Assert.That(formDataJson, Is.Not.Null.And.Not.Empty,
            "FormDataJson should be present in the GET detail response.");
        Assert.That(formDataJson, Does.Contain("loanScheme"),
            "FormDataJson should contain the submitted custom fields.");
        Assert.That(formDataJson, Does.Contain("EMI"),
            "FormDataJson should round-trip the loanScheme value.");
    }

    // ── Test 4: GoldRateService returns latest rate when no today entry ────────

    [Test]
    public async Task GoldRateService_GetTodayRate_ReturnsLatest_WhenNoTodayEntry()
    {
        var opts = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new LoanDbContext(opts);

        // Seed a rate for yesterday
        var yesterday = DateTime.UtcNow.Date.AddDays(-1);
        db.GoldRateMasters.Add(new GoldRateMaster
        {
            Id                = Guid.NewGuid(),
            RateDate          = yesterday,
            RatePerGramFor22K = 7400m,
            Source            = "MANUAL",
            EnteredBy         = "test",
            CreatedAt         = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var svc = new GoldRateService(db);
        var (rate, isLatest) = await svc.GetTodayRateAsync();

        Assert.That(rate, Is.Not.Null, "Should return yesterday's rate as fallback.");
        Assert.That(rate!.RateDate.Date, Is.EqualTo(yesterday));
        Assert.That(isLatest, Is.False, "isLatest should be false when using fallback rate.");
    }
}
