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

file sealed class RecNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class RecNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class RecNoOpTransaction : ITransactionServiceClient
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

file static class RecDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// ── Test DTOs ──────────────────────────────────────────────────────────────────

file class WrittenOffLoanDto
{
    public Guid      Id                    { get; set; }
    public string    ApplicationNumber      { get; set; } = "";
    public string    ApplicantName          { get; set; } = "";
    public string    ProductType            { get; set; } = "";
    public decimal   OutstandingPrincipal   { get; set; }
    public DateTime? WriteOffDate           { get; set; }
    public string?   WriteOffReason         { get; set; }
    public string?   WriteOffJournalNumber  { get; set; }
    public decimal?  RecoveredAmount        { get; set; }
    public DateTime? LastRecoveryDate       { get; set; }
    public string?   RecoveryNotes          { get; set; }
    public string?   RecoveryJournalNumber  { get; set; }
    public string    RecoveryStatus         { get; set; } = "";
}

// =============================================================================
// TC-RECOVERY — NPA Recovery (SAAR-NPA-003)
// =============================================================================
[TestFixture]
public class RecoveryTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new RecNoOpWorkflow(),
            new RecNoOpExpressions(),
            new RecNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    private static LoanApplication MakeWrittenOff(decimal outstanding = 100_000m) =>
        new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"REC-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            Status               = "WRITTEN_OFF",
            ApplicantName        = "Recovery Test Borrower",
            OutstandingPrincipal = outstanding,
            WriteOffDate         = DateTime.UtcNow.AddMonths(-6),
            WriteOffReason       = "DOUBTFUL_3",
            WriteOffJournalNumber = "JNL-WRITEOFF-001",
        };

    // ── T-01: Record recovery for WRITTEN_OFF loan → 200 OK ──────────────────
    [Test]
    [Description("T-01 — Record recovery for WRITTEN_OFF loan → 200 OK with recovery amount set")]
    public async Task RecordRecovery_WrittenOffLoan_ReturnsOk()
    {
        var db = RecDbFactory.Create();
        var ctl = BuildController(db);

        // Create a WRITTEN_OFF loan with 100K outstanding
        var app = MakeWrittenOff(100_000m);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        // Act — record 30K recovery
        var result = await ctl.RecordRecovery(app.Id, new RecoveryRequest { Amount = 30_000m, Notes = "Partial recovery" }, CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(200));

        // Verify loan was updated
        var updated = await db.LoanApplications.FindAsync(app.Id);
        Assert.That(updated, Is.Not.Null);
        Assert.That(updated!.RecoveredAmount, Is.EqualTo(30_000m));
        Assert.That(updated.LastRecoveryDate, Is.Not.Null);
        Assert.That(updated.RecoveryNotes, Is.EqualTo("Partial recovery"));
        Assert.That(updated.RecoveryJournalNumber, Is.EqualTo("JNL-RECOVERY-001"));
    }

    // ── T-02: Record recovery for DISBURSED loan → 400 Bad Request ───────────
    [Test]
    [Description("T-02 — Record recovery for DISBURSED loan → 400 Bad Request")]
    public async Task RecordRecovery_DisbursedLoan_ReturnsBadRequest()
    {
        var db = RecDbFactory.Create();
        var ctl = BuildController(db);

        // Create a DISBURSED loan
        var app = new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = "DISBURSED-TEST",
            ProductType          = "PERSONAL_LOAN",
            Status               = "DISBURSED",
            ApplicantName        = "Test Borrower",
            OutstandingPrincipal = 100_000m,
        };
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        // Act — try to record recovery on DISBURSED loan
        var result = await ctl.RecordRecovery(app.Id, new RecoveryRequest { Amount = 10_000m, Notes = "Test" }, CancellationToken.None) as BadRequestObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(400));
    }

    // ── T-03: Get written-off loans list → correct data with RecoveryStatus ──
    [Test]
    [Description("T-03 — Get written-off loans list → returns correct data with RecoveryStatus")]
    public async Task GetWrittenOffLoans_ReturnsListWithRecoveryStatus()
    {
        var db = RecDbFactory.Create();
        var ctl = BuildController(db);

        // Create 3 written-off loans
        for (int i = 0; i < 3; i++)
        {
            var app = MakeWrittenOff(50_000m);
            db.LoanApplications.Add(app);
        }
        await db.SaveChangesAsync();

        // Act
        var result = await ctl.GetWrittenOffLoans(CancellationToken.None) as OkObjectResult;

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.StatusCode, Is.EqualTo(200));

        // Verify response has total and items
        var total = (int?)result.Value!.GetType().GetProperty("total")?.GetValue(result.Value);
        var items = result.Value!.GetType().GetProperty("items")?.GetValue(result.Value) as System.Collections.IList;

        Assert.That(total, Is.EqualTo(3), "Should have 3 written-off loans");
        Assert.That(items?.Count, Is.EqualTo(3), "Items list should contain 3 loans");
    }
}
