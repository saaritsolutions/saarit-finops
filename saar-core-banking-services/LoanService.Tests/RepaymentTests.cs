using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Tests;

// ── Local stubs (file-scoped so they don't conflict with EligibilityAndWorkflowTests) ────
file sealed class RepNoOpExpressions : IExpressionEvaluationService
{
    public Task<T>       EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx) =>
        Task.FromResult(default(T)!);
    public Task<string>  EvaluateLoanEligibilityAsync(string id, decimal amount, Dictionary<string, object> ctx) =>
        Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productType, Dictionary<string, object> ctx) =>
        Task.FromResult(0m);
}

file sealed class RepNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance>   StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowInstance());
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> ctx, CancellationToken ct = default) =>
        Task.FromResult(new WorkflowStepResult());
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file sealed class RepNoOpTransaction : ITransactionServiceClient
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

file static class RepDbFactory
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
// TC-LRP — Loan Repayment (SAAR-LRP-001)
// =============================================================================
[TestFixture]
public class RepaymentTests
{
    private static (LoanApplicationsController ctrl, Guid id) BuildDisbursedLoan(
        decimal outstanding = 100_000m,
        decimal? interestRate = 12m)
    {
        var db = RepDbFactory.Create();
        var app = new LoanApplication
        {
            Id                   = Guid.NewGuid(),
            ApplicationNumber    = $"LAP-RPT-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ProductType          = "PERSONAL_LOAN",
            RequestedAmount      = outstanding,
            SanctionedAmount     = outstanding,
            TenureMonths         = 60,
            Status               = "DISBURSED",
            ApplicantName        = "Repayment Tester",
            GrossMonthlyIncome   = 80_000,
            CibilScore           = 750,
            OutstandingPrincipal = outstanding,
            InterestRate         = interestRate,
            NextDueDate          = DateTime.UtcNow.Date.AddMonths(1),
            DisbursedAt          = DateTime.UtcNow,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
        };
        db.LoanApplications.Add(app);
        db.SaveChanges();

        var ctrl = new LoanApplicationsController(
            db,
            new RepNoOpWorkflow(),
            new RepNoOpExpressions(),
            new RepNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

        return (ctrl, app.Id);
    }

    // T-1: CollectEmi on a valid DISBURSED loan updates OutstandingPrincipal
    [Test]
    public async Task CollectEmi_ValidDisbursedLoan_UpdatesOutstandingPrincipal()
    {
        var (ctrl, id) = BuildDisbursedLoan(outstanding: 100_000m, interestRate: 12m);
        var req = new CollectEmiRequest { Amount = 10_000m, PaymentMode = "CASH" };

        var result = await ctrl.CollectEmi(id, req, CancellationToken.None);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        // interest = 100000 * 12/100/12 = 1000; principal = 10000 - 1000 = 9000
        var outstanding = (decimal?)ok!.Value!.GetType().GetProperty("outstandingPrincipal")?.GetValue(ok.Value);
        Assert.That(outstanding, Is.EqualTo(91_000m), "Expected 100000 - 9000 principal = 91000");
    }

    // T-2: CollectEmi on a non-DISBURSED loan returns 400
    [Test]
    public async Task CollectEmi_LoanNotDisbursed_Returns400()
    {
        var db = RepDbFactory.Create();
        var app = new LoanApplication
        {
            Id                 = Guid.NewGuid(),
            ApplicationNumber  = "LAP-RPT-SBMT",
            ProductType        = "PERSONAL_LOAN",
            RequestedAmount    = 5_00_000m,
            TenureMonths       = 36,
            Status             = "SUBMITTED",
            ApplicantName      = "Applicant B",
            GrossMonthlyIncome = 60_000,
            CreatedAt          = DateTime.UtcNow,
            UpdatedAt          = DateTime.UtcNow,
        };
        db.LoanApplications.Add(app);
        db.SaveChanges();

        var ctrl = new LoanApplicationsController(
            db,
            new RepNoOpWorkflow(),
            new RepNoOpExpressions(),
            new RepNoOpTransaction(),
            NullLogger<LoanApplicationsController>.Instance);

        var result = await ctrl.CollectEmi(app.Id, new CollectEmiRequest { Amount = 5_000m }, CancellationToken.None);

        Assert.That(result, Is.InstanceOf<BadRequestObjectResult>(), "Expected 400 for non-DISBURSED loan");
    }

    // T-3: CollectEmi computes correct interest split (₹1L @ 12% pa → monthly interest = ₹1,000)
    [Test]
    public async Task CollectEmi_ComputesCorrectInterestSplit()
    {
        var (ctrl, id) = BuildDisbursedLoan(outstanding: 1_00_000m, interestRate: 12m);
        var req = new CollectEmiRequest { Amount = 10_000m, PaymentMode = "NEFT" };

        var result = await ctrl.CollectEmi(id, req, CancellationToken.None);
        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);

        var repayment = ok!.Value!.GetType().GetProperty("repayment")?.GetValue(ok.Value) as LoanRepayment;
        Assert.That(repayment, Is.Not.Null, "Repayment object should be returned");
        Assert.That(repayment!.InterestComponent, Is.EqualTo(1_000m),  "Monthly interest on ₹1L @ 12% pa = ₹1,000");
        Assert.That(repayment.PrincipalComponent, Is.EqualTo(9_000m),  "Principal = 10000 - 1000 = 9000");
        Assert.That(repayment.TotalAmount,        Is.EqualTo(10_000m), "Total = full EMI amount");
    }

    // T-4: GetRepaymentHistory after 2 collections returns both repayments + reduced outstanding
    [Test]
    public async Task GetRepaymentHistory_After2Collections_ReturnsBoth()
    {
        var (ctrl, id) = BuildDisbursedLoan(outstanding: 1_00_000m, interestRate: 12m);
        var req = new CollectEmiRequest { Amount = 10_000m, PaymentMode = "CASH" };

        await ctrl.CollectEmi(id, req, CancellationToken.None);
        await ctrl.CollectEmi(id, req, CancellationToken.None);

        var result = await ctrl.GetRepaymentHistory(id, CancellationToken.None);
        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var repayments = ok!.Value!.GetType().GetProperty("repayments")?.GetValue(ok.Value)
            as System.Linq.IOrderedEnumerable<LoanRepayment>;
        Assert.That(repayments, Is.Not.Null);
        Assert.That(repayments!.Count(), Is.EqualTo(2), "Should have 2 repayment records");

        var outstanding = (decimal?)ok.Value!.GetType().GetProperty("outstandingPrincipal")?.GetValue(ok.Value);
        Assert.That(outstanding, Is.LessThan(1_00_000m), "Outstanding should be reduced after 2 EMIs");
    }
}
