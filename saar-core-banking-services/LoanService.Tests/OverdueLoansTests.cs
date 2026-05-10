using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using System.Collections;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── Local stubs ─────────────────────────────────────────────────────────────
file sealed class OvNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class OvNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class OvNoOpTransaction : ITransactionServiceClient
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

file static class OvDbFactory
{
    public static LoanDbContext Create()
    {
        var opts = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new LoanDbContext(opts);
    }
}

// =============================================================================
// TC-LRP-002 — Overdue Loans Report
// =============================================================================
[TestFixture]
public class OverdueLoansTests
{
    private static LoanApplicationsController BuildController(LoanDbContext db) =>
        new LoanApplicationsController(
            db,
            new OvNoOpWorkflow(),
            new OvNoOpExpressions(),
            new OvNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

    private static LoanApplication MakeDisbursedLoan(DateTime nextDueDate, string appNo = "") => new LoanApplication
    {
        Id                   = Guid.NewGuid(),
        ApplicationNumber    = string.IsNullOrEmpty(appNo) ? $"LAP-OVD-{Guid.NewGuid().ToString()[..6].ToUpper()}" : appNo,
        ProductType          = "PERSONAL_LOAN",
        RequestedAmount      = 100_000m,
        SanctionedAmount     = 100_000m,
        TenureMonths         = 60,
        Status               = "DISBURSED",
        ApplicantName        = "Overdue Tester",
        GrossMonthlyIncome   = 50_000m,
        CibilScore           = 720,
        OutstandingPrincipal = 80_000m,
        InterestRate         = 12m,
        NextDueDate          = nextDueDate,
        DisbursedAt          = DateTime.UtcNow.AddDays(-90),
        CreatedAt            = DateTime.UtcNow,
        UpdatedAt            = DateTime.UtcNow,
    };

    // T-1: No disbursed loans → total=0, items empty
    [Test]
    public async Task GetOverdueLoans_NoDisbursedLoans_ReturnsEmpty()
    {
        var db   = OvDbFactory.Create();
        var ctrl = BuildController(db);

        var result = await ctrl.GetOverdueLoans();

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var total = (int?)ok!.Value!.GetType().GetProperty("total")?.GetValue(ok.Value);
        var items = ok!.Value!.GetType().GetProperty("items")?.GetValue(ok.Value) as IList;

        Assert.That(total, Is.EqualTo(0), "total should be 0");
        Assert.That(items?.Count ?? 0, Is.EqualTo(0), "items should be empty");
    }

    // T-2: DISBURSED loan with NextDueDate 15 days ago → overdueDays=15, SmaStatus=SMA-0
    [Test]
    public async Task GetOverdueLoans_WithPastDueDate_ReturnsLoan()
    {
        var db  = OvDbFactory.Create();
        var due = DateTime.UtcNow.Date.AddDays(-15);
        db.LoanApplications.Add(MakeDisbursedLoan(due));
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.GetOverdueLoans();

        var ok    = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var total = (int?)ok!.Value!.GetType().GetProperty("total")?.GetValue(ok.Value);
        Assert.That(total, Is.EqualTo(1), "total should be 1");

        var items     = ok!.Value!.GetType().GetProperty("items")?.GetValue(ok.Value) as IList;
        Assert.That(items?.Count, Is.EqualTo(1), "items should contain 1 loan");

        var item          = items![0]!;
        var overdueDays   = (int?)item.GetType().GetProperty("OverdueDays")?.GetValue(item);
        var smaStatus     = (string?)item.GetType().GetProperty("SmaStatus")?.GetValue(item);

        Assert.That(overdueDays, Is.EqualTo(15), "OverdueDays should be 15");
        Assert.That(smaStatus,   Is.EqualTo("SMA-0"), "15-day overdue → SMA-0");
    }

    // T-3: 2 loans (SMA-0 @ 20d + SMA-2 @ 65d); filter smaStatus=SMA-0 → 1 returned
    [Test]
    public async Task GetOverdueLoans_SmaStatusFilter_FiltersCorrectly()
    {
        var db = OvDbFactory.Create();
        db.LoanApplications.Add(MakeDisbursedLoan(DateTime.UtcNow.Date.AddDays(-20), "LAP-OVD-SMA0"));  // SMA-0
        db.LoanApplications.Add(MakeDisbursedLoan(DateTime.UtcNow.Date.AddDays(-65), "LAP-OVD-SMA2"));  // SMA-2
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.GetOverdueLoans(smaStatus: "SMA-0");

        var ok    = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var items = ok!.Value!.GetType().GetProperty("items")?.GetValue(ok.Value) as IList;
        Assert.That(items?.Count, Is.EqualTo(1), "Only 1 SMA-0 loan should be returned");

        var item      = items![0]!;
        var smaStatus = (string?)item.GetType().GetProperty("SmaStatus")?.GetValue(item);
        var appNo     = (string?)item.GetType().GetProperty("ApplicationNumber")?.GetValue(item);

        Assert.That(smaStatus, Is.EqualTo("SMA-0"),       "Returned loan should be SMA-0");
        Assert.That(appNo,     Is.EqualTo("LAP-OVD-SMA0"), "Should be the 20-day overdue loan");
    }
}
