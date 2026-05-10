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

file sealed class RsNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class RsNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class RsNoOpTransaction : ITransactionServiceClient
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

file static class RsDbFactory
{
    public static LoanDbContext Create() =>
        new LoanDbContext(
            new DbContextOptionsBuilder<LoanDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-RS — Loan Restructuring (SAAR-LRP-003)
// =============================================================================
[TestFixture]
public class RestructuredLoanTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new RsNoOpWorkflow(),
            new RsNoOpExpressions(),
            new RsNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    private static LoanApplication MakeDisbursed(decimal outstanding = 200_000m)
    {
        return new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"RSTEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = outstanding,
            SanctionedAmount     = outstanding,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "Restructure Test Borrower",
            GrossMonthlyIncome   = 50_000,
            CibilScore           = 680,
            OutstandingPrincipal = outstanding,
            InterestRate         = 12m,
            NextDueDate          = DateTime.UtcNow.Date.AddDays(-45),
            DisbursedAt          = DateTime.UtcNow.AddMonths(-6),
            CreatedAt            = DateTime.UtcNow.AddMonths(-7),
            UpdatedAt            = DateTime.UtcNow,
        };
    }

    // T-01: Restructuring a DISBURSED loan succeeds and persists all revised terms
    [Test]
    public async Task Restructure_DisbursedLoan_Returns200AndSetsFields()
    {
        var db  = RsDbFactory.Create();
        var app = MakeDisbursed(200_000m);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.RestructureLoan(
            app.Id,
            new RestructureRequest
            {
                NewMonthlyEmi   = 4_500m,
                NewTenureMonths = 84,
                NewInterestRate = 9.5m,
                Reason          = "Income reduced — revised repayment plan agreed",
            });

        Assert.That(result, Is.InstanceOf<OkObjectResult>());

        var updated = await db.LoanApplications.FindAsync(app.Id);
        Assert.That(updated!.IsRestructured,              Is.True);
        Assert.That(updated.RestructuredDate,             Is.Not.Null);
        Assert.That(updated.RestructuredNewEmi,           Is.EqualTo(4_500m));
        Assert.That(updated.RestructuredNewTenureMonths,  Is.EqualTo(84));
        Assert.That(updated.RestructuredNewInterestRate,  Is.EqualTo(9.5m));
        Assert.That(updated.RestructuredReason,           Does.Contain("Income reduced"));
        Assert.That(updated.TenureMonths,                 Is.EqualTo(84));
        Assert.That(updated.NextDueDate!.Value.Date,      Is.GreaterThan(DateTime.UtcNow.Date));
    }

    // T-02: Restructuring an already-restructured loan returns 400
    [Test]
    public async Task Restructure_AlreadyRestructured_Returns400()
    {
        var db  = RsDbFactory.Create();
        var app = MakeDisbursed();
        app.IsRestructured    = true;
        app.RestructuredDate  = DateTime.UtcNow.AddDays(-30);
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.RestructureLoan(
            app.Id,
            new RestructureRequest { NewMonthlyEmi = 4_000m, NewTenureMonths = 96, NewInterestRate = 9m, Reason = "retry" });

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>());
    }

    // T-03: Restructuring a non-DISBURSED loan returns 400
    [Test]
    public async Task Restructure_NonDisbursed_Returns400()
    {
        var db  = RsDbFactory.Create();
        var app = MakeDisbursed();
        app.Status = "SANCTIONED";
        db.LoanApplications.Add(app);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db);
        var result = await ctrl.RestructureLoan(
            app.Id,
            new RestructureRequest { NewMonthlyEmi = 4_000m, NewTenureMonths = 72, NewInterestRate = 10m, Reason = "test" });

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>());
    }
}
