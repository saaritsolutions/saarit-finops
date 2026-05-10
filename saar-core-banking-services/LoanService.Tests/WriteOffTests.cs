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

file sealed class WoNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class WoNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class WoNoOpTransaction : ITransactionServiceClient
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

file static class WoDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-WO — NPA Loan Write-Off (SAAR-NPA-002)
// =============================================================================
[TestFixture]
public class WriteOffTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new WoNoOpWorkflow(),
            new WoNoOpExpressions(),
            new WoNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    /// <summary>Creates a DISBURSED loan overdue by the given number of days.</summary>
    private static LoanApplication MakeDisbursed(int overdueDays, decimal outstanding = 150_000m)
    {
        return new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"WOTEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = outstanding,
            SanctionedAmount     = outstanding,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "Write-Off Test Borrower",
            GrossMonthlyIncome   = 50_000,
            CibilScore           = 700,
            OutstandingPrincipal = outstanding,
            InterestRate         = 12m,
            NextDueDate          = DateTime.UtcNow.Date.AddDays(-overdueDays),
            DisbursedAt          = DateTime.UtcNow.AddDays(-overdueDays - 30),
            CreatedAt            = DateTime.UtcNow.AddDays(-overdueDays - 60),
            UpdatedAt            = DateTime.UtcNow,
        };
    }

    // T-01: DOUBTFUL_3 loan (≥1096 DPD) → write-off succeeds, status=WRITTEN_OFF, journal set
    [Test]
    public async Task WriteOff_Doubtful3_Returns200AndStatusWrittenOff()
    {
        var db  = WoDbFactory.Create();
        var app = MakeDisbursed(overdueDays: 1200, outstanding: 150_000m);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.WriteOffLoan(
            app.Id,
            new WriteOffRequest { Reason = "Borrower deceased", AuthorizedBy = "mgr@bank.com" });

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        // Verify the loan was updated in DB
        var updated = await db.LoanApplications.FindAsync(app.Id);
        Assert.That(updated!.Status,             Is.EqualTo("WRITTEN_OFF"));
        Assert.That(updated.WriteOffDate,         Is.Not.Null);
        Assert.That(updated.WriteOffReason,       Is.EqualTo("Borrower deceased"));
        Assert.That(updated.WriteOffAuthorizedBy, Is.EqualTo("mgr@bank.com"));
        Assert.That(updated.WriteOffJournalNumber, Is.EqualTo("JNL-WRITEOFF-001"));
    }

    // T-02: SUB_STANDARD loan (< 366 DPD) → 400, not eligible
    [Test]
    public async Task WriteOff_SubStandardLoan_Returns400NotEligible()
    {
        var db  = WoDbFactory.Create();
        var app = MakeDisbursed(overdueDays: 95);   // SUB_STANDARD
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.WriteOffLoan(
            app.Id,
            new WriteOffRequest { Reason = "test", AuthorizedBy = "test" });

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>());
    }

    // T-03: Already WRITTEN_OFF → 400, idempotent guard
    [Test]
    public async Task WriteOff_AlreadyWrittenOff_Returns400Idempotent()
    {
        var db  = WoDbFactory.Create();
        var app = MakeDisbursed(overdueDays: 1200);
        app.Status       = "WRITTEN_OFF";
        app.WriteOffDate = DateTime.UtcNow.AddDays(-1);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.WriteOffLoan(
            app.Id,
            new WriteOffRequest { Reason = "retry", AuthorizedBy = "test" });

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>());
    }
}
