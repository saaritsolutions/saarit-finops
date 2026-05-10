using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── File-scoped stubs ──────────────────────────────────────────────────────────

file sealed class RegNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class RegNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class RegNoOpTransaction : ITransactionServiceClient
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
    public Task<DisbursalJournalResult> PostRecoveryJournalAsync(
        string applicationNumber, decimal recoveredAmount, CancellationToken ct = default) =>
        Task.FromResult(new DisbursalJournalResult(true, "JNL-RECOVERY-001", null));
}

file static class RegDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// ── File-scoped DTO for test response deserialization ─────────────────────────

file class RegulatoryMetricsDto
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

// =============================================================================
// TC-REGRPT — Regulatory Metrics (SAAR-RPT-002)
// =============================================================================
[TestFixture]
public class RegulatoryMetricsTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new RegNoOpWorkflow(),
            new RegNoOpExpressions(),
            new RegNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    private static LoanApplication MakeDisbursed(
        string smaStatus = "STANDARD",
        decimal outstanding = 100_000m,
        bool isRestructured = false,
        bool isUpgraded = false) =>
        new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"REG-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = outstanding,
            SanctionedAmount     = outstanding,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "Regulatory Test Borrower",
            GrossMonthlyIncome   = 50_000,
            CibilScore           = 700,
            OutstandingPrincipal = outstanding,
            InterestRate         = 12m,
            // Set NextDueDate to produce the desired SmaStatus
            NextDueDate          = smaStatus switch
            {
                "STANDARD" => DateTime.UtcNow.Date.AddMonths(1),
                "SMA-0"    => DateTime.UtcNow.Date.AddDays(-30),    // 30 days overdue
                "SMA-1"    => DateTime.UtcNow.Date.AddDays(-65),    // 65 days overdue
                "SMA-2"    => DateTime.UtcNow.Date.AddDays(-180),   // 180 days overdue
                "NPA"      => DateTime.UtcNow.Date.AddDays(-400),   // 400 days overdue
                _          => DateTime.UtcNow.Date.AddMonths(1)
            },
            DisbursedAt          = DateTime.UtcNow.AddMonths(-6),
            CreatedAt            = DateTime.UtcNow.AddMonths(-12),
            IsRestructured       = isRestructured,
            IsUpgraded           = isUpgraded,
        };

    private static LoanApplication MakeWrittenOff(decimal outstanding = 50_000m) =>
        new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"WO-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            Status               = "WRITTEN_OFF",
            ApplicantName        = "Written Off Borrower",
            OutstandingPrincipal = outstanding,
            WriteOffDate         = DateTime.UtcNow.AddMonths(-3),
            WriteOffReason       = "DOUBTFUL_3",
        };

    // ── T-01: Mixed portfolio with STANDARD, SMA-1, NPA, restructured, upgraded ─
    [Test]
    [Description("T-01 — Regulatory metrics for mixed portfolio (STANDARD, SMA, NPA, restructured, upgraded, written-off)")]
    public async Task RegulatoryMetrics_MixedPortfolio_ReturnsCorrectRatios()
    {
        var db = RegDbFactory.Create();
        var ctl = BuildController(db);

        // 5 STANDARD loans @ 100K each = 500K
        for (int i = 0; i < 5; i++)
        {
            var app = MakeDisbursed("STANDARD", 100_000m);
            db.LoanApplications.Add(app);
        }

        // 2 SMA-1 loans @ 50K each = 100K
        for (int i = 0; i < 2; i++)
        {
            var app = MakeDisbursed("SMA-1", 50_000m);
            db.LoanApplications.Add(app);
        }

        // 1 NPA loan @ 100K (requires 25% provisioning = 25K)
        var npaApp = MakeDisbursed("NPA", 100_000m);
        db.LoanApplications.Add(npaApp);

        // 1 Restructured loan @ 75K
        var restrApp = MakeDisbursed("STANDARD", 75_000m, isRestructured: true);
        db.LoanApplications.Add(restrApp);

        // 1 Upgraded loan @ 50K
        var upgApp = MakeDisbursed("STANDARD", 50_000m, isUpgraded: true);
        db.LoanApplications.Add(upgApp);

        // 1 Written-off loan @ 50K
        var woApp = MakeWrittenOff(50_000m);
        db.LoanApplications.Add(woApp);

        await db.SaveChangesAsync();

        // Act
        var result = await ctl.GetRegulatorySummary(CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(200));

        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);
        var metrics = System.Text.Json.JsonSerializer.Deserialize<RegulatoryMetricsDto>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(metrics, Is.Not.Null, "Failed to deserialize regulatory metrics");

        // Total loan book (excluding written-off): 500 + 100 + 100 + 75 + 50 = 825K
        Assert.That(metrics!.TotalLoanBook,       Is.EqualTo(825_000m));

        // NPA: 1 loan @ 100K
        Assert.That(metrics.TotalNpaOutstanding, Is.EqualTo(100_000m));
        Assert.That(metrics.NpaRatio,            Is.EqualTo(Math.Round(100_000m / 825_000m * 100, 2)));

        // Restructured: 1 loan @ 75K
        Assert.That(metrics.RestructuredCount,    Is.EqualTo(1));
        Assert.That(metrics.RestructuredOutstanding, Is.EqualTo(75_000m));

        // Upgraded: 1 loan @ 50K
        Assert.That(metrics.UpgradedCount,        Is.EqualTo(1));
        Assert.That(metrics.UpgradedOutstanding,  Is.EqualTo(50_000m));

        // Written-off: 1 loan @ 50K
        Assert.That(metrics.WrittenOffCount,      Is.EqualTo(1));
        Assert.That(metrics.WrittenOffOutstanding, Is.EqualTo(50_000m));

        // SMA Watch: 2 SMA-1 @ 50K each
        Assert.That(metrics.SmaWatchCount,        Is.EqualTo(2));
        Assert.That(metrics.SmaWatchOutstanding,  Is.EqualTo(100_000m));

        // Standard: 5 STANDARD + 1 restructured + 1 upgraded = 7
        Assert.That(metrics.StandardCount,        Is.EqualTo(7));
        Assert.That(metrics.StandardOutstanding,  Is.EqualTo(625_000m)); // 500 + 75 + 50
    }

    // ── T-02: All STANDARD loans → NPA ratio = 0%, provision coverage = 100% ───
    [Test]
    [Description("T-02 — All STANDARD loans should have 0% NPA ratio and 100% provision coverage")]
    public async Task RegulatoryMetrics_AllStandard_ZeroNpaRatio()
    {
        var db = RegDbFactory.Create();
        var ctl = BuildController(db);

        // 10 STANDARD loans @ 50K each = 500K
        for (int i = 0; i < 10; i++)
        {
            var app = MakeDisbursed("STANDARD", 50_000m);
            db.LoanApplications.Add(app);
        }

        await db.SaveChangesAsync();

        // Act
        var result = await ctl.GetRegulatorySummary(CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(200));

        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);
        var metrics = System.Text.Json.JsonSerializer.Deserialize<RegulatoryMetricsDto>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(metrics, Is.Not.Null, "Failed to deserialize regulatory metrics");

        Assert.That(metrics!.TotalLoanBook,        Is.EqualTo(500_000m));
        Assert.That(metrics.TotalNpaOutstanding,  Is.EqualTo(0m));
        Assert.That(metrics.NpaRatio,             Is.EqualTo(0m));
        Assert.That(metrics.TotalRequiredProvisioning, Is.EqualTo(0m));
        Assert.That(metrics.ProvisionCoverage,    Is.EqualTo(100m)); // Default when no NPA
        Assert.That(metrics.StandardCount,        Is.EqualTo(10));
    }

    // ── T-03: Restructured + upgraded loans included in metrics ─────────────────
    [Test]
    [Description("T-03 — Restructured and upgraded loans are counted and included in outstanding totals")]
    public async Task RegulatoryMetrics_RestructuredUpgraded_CountsIncluded()
    {
        var db = RegDbFactory.Create();
        var ctl = BuildController(db);

        // 3 Restructured loans @ 50K each = 150K
        for (int i = 0; i < 3; i++)
        {
            var app = MakeDisbursed("STANDARD", 50_000m, isRestructured: true);
            db.LoanApplications.Add(app);
        }

        // 2 Upgraded loans @ 75K each = 150K
        for (int i = 0; i < 2; i++)
        {
            var app = MakeDisbursed("STANDARD", 75_000m, isUpgraded: true);
            db.LoanApplications.Add(app);
        }

        // 5 Standard loans @ 100K each = 500K
        for (int i = 0; i < 5; i++)
        {
            var app = MakeDisbursed("STANDARD", 100_000m);
            db.LoanApplications.Add(app);
        }

        await db.SaveChangesAsync();

        // Act
        var result = await ctl.GetRegulatorySummary(CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(200));

        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);
        var metrics = System.Text.Json.JsonSerializer.Deserialize<RegulatoryMetricsDto>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(metrics, Is.Not.Null, "Failed to deserialize regulatory metrics");

        // Total = 150 + 150 + 500 = 800K
        Assert.That(metrics!.TotalLoanBook, Is.EqualTo(800_000m));

        // Restructured count/outstanding
        Assert.That(metrics.RestructuredCount,      Is.EqualTo(3));
        Assert.That(metrics.RestructuredOutstanding, Is.EqualTo(150_000m));
        Assert.That(metrics.RestructuredRatio,      Is.EqualTo(Math.Round(150_000m / 800_000m * 100, 2)));

        // Upgraded count/outstanding
        Assert.That(metrics.UpgradedCount,          Is.EqualTo(2));
        Assert.That(metrics.UpgradedOutstanding,    Is.EqualTo(150_000m));

        // Standard count should include all non-NPA, non-restructured-only, non-SMA
        // (restructured and upgraded loans are still STANDARD in SMA status)
        Assert.That(metrics.StandardCount,          Is.EqualTo(10)); // 3 + 2 + 5
        Assert.That(metrics.StandardOutstanding,    Is.EqualTo(800_000m)); // all loans
    }
}
