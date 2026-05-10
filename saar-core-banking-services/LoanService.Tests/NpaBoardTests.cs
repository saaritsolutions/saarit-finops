using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── File-scoped stubs (don't conflict with other test files) ─────────────────

file sealed class NpaNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class NpaNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class NpaNoOpTransaction : ITransactionServiceClient
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

file static class NpaDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-NPA — NPA Classification Board (SAAR-NPA-001)
// =============================================================================
[TestFixture]
public class NpaBoardTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new NpaNoOpWorkflow(),
            new NpaNoOpExpressions(),
            new NpaNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    private static LoanApplication MakeDisbursed(int overdueDays, decimal outstanding = 100_000m) =>
        new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"NPA-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = outstanding,
            SanctionedAmount     = outstanding,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "NPA Test Borrower",
            GrossMonthlyIncome   = 50_000,
            CibilScore           = 700,
            OutstandingPrincipal = outstanding,
            InterestRate         = 12m,
            // Set NextDueDate in the past by overdueDays
            NextDueDate          = DateTime.UtcNow.Date.AddDays(-overdueDays),
            DisbursedAt          = DateTime.UtcNow.AddDays(-overdueDays - 30),
            CreatedAt            = DateTime.UtcNow.AddDays(-overdueDays - 60),
            UpdatedAt            = DateTime.UtcNow,
        };

    // T-01: Empty DB → npaRatio=0, empty arrays
    [Test]
    public async Task NpaBoard_NoLoans_ReturnsZeroTotals()
    {
        var db   = NpaDbFactory.Create();
        var ctrl = BuildController(db);

        var result = await ctrl.GetNpaBoard();

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var json  = System.Text.Json.JsonSerializer.Serialize(ok!.Value);
        var board = System.Text.Json.JsonSerializer.Deserialize<NpaBoardResult>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(board, Is.Not.Null);
        Assert.That(board!.TotalNpaOutstanding,       Is.EqualTo(0m));
        Assert.That(board.TotalRequiredProvisioning,  Is.EqualTo(0m));
        Assert.That(board.NpaRatio,                   Is.EqualTo(0m));
        Assert.That(board.NpaLoans,                   Is.Empty);
        Assert.That(board.SmaWatchList,               Is.Empty);
    }

    // T-02: 95 days overdue → SUB_STANDARD, 15% provisioning
    [Test]
    public async Task NpaBoard_95DaysOverdue_ClassifiedAsSubStandard()
    {
        var db  = NpaDbFactory.Create();
        var app = MakeDisbursed(overdueDays: 95, outstanding: 100_000m);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl  = BuildController(db);
        var result = await ctrl.GetNpaBoard();

        var ok    = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var json  = System.Text.Json.JsonSerializer.Serialize(ok!.Value);
        var board = System.Text.Json.JsonSerializer.Deserialize<NpaBoardResult>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(board!.NpaLoans,              Has.Count.EqualTo(1));
        Assert.That(board.NpaLoans[0].NpaSubClassification, Is.EqualTo("SUB_STANDARD"));
        // 15% of 100,000 = 15,000
        Assert.That(board.NpaLoans[0].RequiredProvisioning, Is.EqualTo(15_000m));
        Assert.That(board.TotalNpaOutstanding,              Is.EqualTo(100_000m));
        Assert.That(board.TotalRequiredProvisioning,        Is.EqualTo(15_000m));
    }

    // T-03: 370 days overdue → DOUBTFUL_1, 25% provisioning
    [Test]
    public async Task NpaBoard_370DaysOverdue_ClassifiedAsDoubtful1()
    {
        var db  = NpaDbFactory.Create();
        var app = MakeDisbursed(overdueDays: 370, outstanding: 200_000m);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl  = BuildController(db);
        var result = await ctrl.GetNpaBoard();

        var ok    = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var json  = System.Text.Json.JsonSerializer.Serialize(ok!.Value);
        var board = System.Text.Json.JsonSerializer.Deserialize<NpaBoardResult>(
            json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.That(board!.NpaLoans,              Has.Count.EqualTo(1));
        Assert.That(board.NpaLoans[0].NpaSubClassification, Is.EqualTo("DOUBTFUL_1"));
        // 25% of 200,000 = 50,000
        Assert.That(board.NpaLoans[0].RequiredProvisioning, Is.EqualTo(50_000m));
    }
}

// ── Minimal DTO for JSON deserialization in tests ─────────────────────────────

file class NpaBoardResult
{
    public decimal        TotalNpaOutstanding       { get; set; }
    public decimal        NpaRatio                  { get; set; }
    public decimal        TotalRequiredProvisioning { get; set; }
    public int            SmaWatchCount             { get; set; }
    public List<NpaRow>   NpaLoans                  { get; set; } = new();
    public List<SmaRow>   SmaWatchList              { get; set; } = new();
}

file class NpaRow
{
    public string?  NpaSubClassification { get; set; }
    public decimal  RequiredProvisioning { get; set; }
    public decimal  OutstandingPrincipal { get; set; }
}

file class SmaRow
{
    public string SmaStatus { get; set; } = "";
}
