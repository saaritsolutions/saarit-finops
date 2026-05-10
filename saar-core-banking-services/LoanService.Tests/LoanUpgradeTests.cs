using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── File-scoped stubs ─────────────────────────────────────────────────────────

file sealed class UpgNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class UpgNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class UpgNoOpTransaction : ITransactionServiceClient
{
    public Task<DisbursalJournalResult> PostDisbursalJournalAsync(
        string applicationNumber, string productType, decimal amount,
        string glDebitAccount, string glCreditAccount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "stub"));
    public Task<DisbursalJournalResult> PostGoldLoanDisbursalJournalAsync(
        string applicationNumber, decimal amount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "stub"));
    public Task<DisbursalJournalResult> PostGoldLoanClosureJournalAsync(
        string applicationNumber, decimal principal, decimal interest, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(false, null, "stub"));
    public Task<DisbursalJournalResult> PostEmiJournalAsync(
        string applicationNumber, int installmentNumber,
        decimal principalAmount, decimal interestAmount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(true, $"JNL-EMI-{installmentNumber:D3}", null));
    public Task<DisbursalJournalResult> PostWriteOffJournalAsync(
        string applicationNumber, decimal outstanding, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(true, "JNL-WRITEOFF-001", null));
    public Task<DisbursalJournalResult> PostLoanUpgradeJournalAsync(
        string applicationNumber, decimal outstanding, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(true, "JNL-UPGRADE-001", null));
}

file static class UpgDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-UPG — Loan Upgrade After Restructuring (SAAR-LRP-004)
// =============================================================================
[TestFixture]
public class LoanUpgradeTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new UpgNoOpWorkflow(),
            new UpgNoOpExpressions(),
            new UpgNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    /// <summary>Creates a restructured loan that is eligible for upgrade (1+ year, STANDARD SMA).</summary>
    private static LoanApplication MakeRestructuredAndEligible(decimal outstanding = 150_000m)
    {
        var restructuredDate = DateTime.UtcNow.AddDays(-380); // 380 days ago (> 365)
        return new LoanApplication
        {
            Id                          = Guid.NewGuid(),
            ApplicationNumber           = $"UPGTEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType                 = "PERSONAL_LOAN",
            RequestedAmount             = outstanding,
            SanctionedAmount            = outstanding,
            TenureMonths                = 48,
            Status                      = "DISBURSED",
            ApplicantName               = "Upgrade Eligible Borrower",
            GrossMonthlyIncome          = 50_000,
            CibilScore                  = 700,
            OutstandingPrincipal        = outstanding,
            InterestRate                = 9.5m,  // Restructured rate
            NextDueDate                 = DateTime.UtcNow.Date.AddMonths(1),
            DisbursedAt                 = restructuredDate.AddYears(-1),
            CreatedAt                   = restructuredDate.AddYears(-2),
            UpdatedAt                   = DateTime.UtcNow,

            // Restructure fields
            IsRestructured              = true,
            RestructuredDate            = restructuredDate,
            RestructuredNewEmi          = 3200m,
            RestructuredNewTenureMonths = 60,
            RestructuredNewInterestRate = 9.5m,
            RestructuredReason          = "Income loss — restructured",
            OriginalTenureMonths        = 48,
            OriginalInterestRate        = 12m,

        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T-01: Successful upgrade after 1-year satisfactory repayment
    // ─────────────────────────────────────────────────────────────────────────
    [Test]
    [Description("T-01 — Loan restructured 1+ years ago with STANDARD SMA should upgrade successfully")]
    public async Task UpgradeEligible_Succeeds()
    {
        var db  = UpgDbFactory.Create();
        var ctl = BuildController(db);

        // Arrange: DISBURSED + IsRestructured + 380 days elapsed + SMA=STANDARD
        var app = MakeRestructuredAndEligible();
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        // Act
        var reqType = typeof(LoanApplicationsController).Assembly.GetType("LoanService.Controllers.UpgradeRequest")!;
        var req = Activator.CreateInstance(reqType)!;
        reqType.GetProperty("Reason")!.SetValue(req, "1-year satisfactory repayment completed");
        var res = await ctl.UpgradeLoan(app.Id, (dynamic)req, CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(res, Is.Not.Null, "Expected 200 OK response");
        Assert.That(res!.StatusCode, Is.EqualTo(200));

        // Verify fields were updated
        var upgraded = await db.LoanApplications.FindAsync(app.Id);
        Assert.That(upgraded!.IsUpgraded, Is.True, "IsUpgraded should be true");
        Assert.That(upgraded!.UpgradedDate, Is.Not.Null);
        Assert.That(upgraded!.IsRestructured, Is.False, "IsRestructured should be cleared");
        Assert.That(upgraded!.UpgradeJournalNumber, Is.Not.Null.And.Not.Empty);

        // Verify original terms were restored
        Assert.That(upgraded!.TenureMonths, Is.EqualTo(48), "Should restore original tenure");
        Assert.That(upgraded!.InterestRate, Is.EqualTo(12m), "Should restore original rate");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T-02: Cannot upgrade if already upgraded
    // ─────────────────────────────────────────────────────────────────────────
    [Test]
    [Description("T-02 — Already-upgraded loan should be rejected")]
    public async Task UpgradeAlreadyUpgraded_Fails()
    {
        var db  = UpgDbFactory.Create();
        var ctl = BuildController(db);

        // Arrange: Loan that is already upgraded
        var app = MakeRestructuredAndEligible();
        app.IsUpgraded = true;
        app.UpgradedDate = DateTime.UtcNow.AddDays(-10);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        // Act
        dynamic req = new { reason = "Retry upgrade" };
        var res = await ctl.UpgradeLoan(app.Id, req, CancellationToken.None) as BadRequestObjectResult;

        // Assert
        Assert.That(res, Is.Not.Null, "Expected 400 Bad Request");
        Assert.That(res!.StatusCode, Is.EqualTo(400));
        Assert.That(res!.Value.ToString(), Contains.Substring("already been upgraded"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // T-03: Cannot upgrade if not restructured
    // ─────────────────────────────────────────────────────────────────────────
    [Test]
    [Description("T-03 — Non-restructured loan should be rejected")]
    public async Task UpgradeNonRestructured_Fails()
    {
        var db  = UpgDbFactory.Create();
        var ctl = BuildController(db);

        // Arrange: Normal (non-restructured) disbursed loan
        var app = new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = "UPGTEST-NONRST",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = 150_000m,
            SanctionedAmount     = 150_000m,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "Non-Restructured Borrower",
            GrossMonthlyIncome   = 50_000,
            CibilScore           = 700,
            OutstandingPrincipal = 150_000m,
            InterestRate         = 12m,
            NextDueDate          = DateTime.UtcNow.Date.AddMonths(1),
            DisbursedAt          = DateTime.UtcNow.AddMonths(-6),
            CreatedAt            = DateTime.UtcNow.AddMonths(-12),
            UpdatedAt            = DateTime.UtcNow,

            // NOT restructured
            IsRestructured       = false,
        };
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        // Act
        dynamic req = new { reason = "Attempting upgrade on non-restructured loan" };
        var res = await ctl.UpgradeLoan(app.Id, req, CancellationToken.None) as BadRequestObjectResult;

        // Assert
        Assert.That(res, Is.Not.Null, "Expected 400 Bad Request");
        Assert.That(res!.StatusCode, Is.EqualTo(400));
        Assert.That(res!.Value.ToString(), Contains.Substring("not restructured"));
    }
}
