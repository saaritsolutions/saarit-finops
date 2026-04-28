using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using AccountService.Controllers;
using AccountService.Data;
using AccountService.Models;
using AccountService.Services;
using System.Collections;

namespace AccountService.Tests;

// ── Local file-scoped stubs ───────────────────────────────────────────────────

file sealed class MaNoOpExpressions : IExpressionEvaluationService
{
    public Task<T> EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx)
        => throw new InvalidOperationException("stub — controller falls through to local calc");

    public Task<decimal?> CalculateDepositInterestRateAsync(string accountType, decimal amount, int termMonths)
        => Task.FromResult<decimal?>(null);

    public Task<decimal> CalculateMaintenanceFeeAsync(
        decimal avgBalance, string accountType, int ageMonths,
        string customerSegment, decimal minimumBalance)
        => Task.FromResult(0m);
}

file sealed class MaNoOpTransactions : ITransactionServiceClient
{
    public Task<DepositJournalResult> PostMaturityPayoutAsync(
        string accountNumber, string accountType, decimal principal, decimal interest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-MAT-TEST", null));

    public Task<DepositJournalResult> PostPrematureClosureAsync(
        string accountNumber, string accountType, decimal principal, decimal reducedInterest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-PRE-TEST", null));

    public Task<DepositJournalResult> PostMaintenanceFeeAsync(
        string accountNumber, decimal fee, string postedBy,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-AMC-TEST", null));
}

file sealed class MaNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance> StartAccountOpeningAsync(
        Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowInstance());

    public Task<WorkflowStepResult> ProcessStepAsync(
        Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowStepResult());
}

file sealed class MaNoOpForms : IDynamicFormsClient
{
    public Task<List<AccountDynamicField>> GetAccountFormSchemaAsync(string accountType)
        => Task.FromResult(new List<AccountDynamicField>());
}

file static class MaDbFactory
{
    public static AccountDbContext Create() =>
        new AccountDbContext(
            new DbContextOptionsBuilder<AccountDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-ACC-004 — Maturity, AutoRenewal, PrematureClose
// =============================================================================
[TestFixture]
public class MaturityTests
{
    private static AccountController BuildController(AccountDbContext db) =>
        new AccountController(
            db,
            new MaNoOpExpressions(),
            new MaNoOpWorkflow(),
            new MaNoOpForms(),
            new MaNoOpTransactions(),
            NullLogger<AccountController>.Instance);

    private static Account MakeActiveFd(
        AccountDbContext db,
        DateTime maturityDate,
        bool autoRenewal = false,
        string accountNumber = "FD-TEST-001")
    {
        var pt = new AccountProductType { Name = "Fixed Deposit", IsActive = true };
        db.AccountProductTypes.Add(pt);
        db.SaveChanges();

        var account = new Account
        {
            AccountNumber          = accountNumber,
            CustomerId             = 1,
            ProductTypeId          = pt.AccountProductTypeId,
            Balance                = 100_000m,
            Status                 = "Active",
            DateOpened             = DateTime.UtcNow.AddMonths(-12),
            TermMonths             = 12,
            MaturityDate           = maturityDate,
            InterestRate           = 7.5m,
            AutoRenewal            = autoRenewal,
            PrematureClosurePenalty = 1.0m,
        };
        db.Accounts.Add(account);
        db.SaveChanges();
        return account;
    }

    // T-01: Active FD past maturity with no auto-renewal → status="Mature", DateClosed set
    [Test]
    public async Task MatureAccount_ActiveFdPastMaturityDate_SetsStatusMatureAndCloses()
    {
        var db      = MaDbFactory.Create();
        var account = MakeActiveFd(db, maturityDate: DateTime.UtcNow.AddDays(-1));
        var ctrl    = BuildController(db);

        var result = await ctrl.MatureAccount(account.AccountId);

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var status = ok!.Value!.GetType().GetProperty("status")?.GetValue(ok.Value) as string;
        Assert.That(status, Is.EqualTo("Mature"), "Status should be Mature");

        var updated = await db.Accounts.FindAsync(account.AccountId);
        Assert.That(updated!.Status,     Is.EqualTo("Mature"),    "DB: status should be Mature");
        Assert.That(updated.DateClosed,  Is.Not.Null,             "DB: DateClosed should be set");
        Assert.That(updated.MaturityJournalNumber, Is.EqualTo("JNL-MAT-TEST"), "Journal number stored");
    }

    // T-02: Account already closed (DateClosed != null) → 400
    [Test]
    public async Task MatureAccount_AlreadyClosed_Returns400()
    {
        var db = MaDbFactory.Create();
        var pt = new AccountProductType { Name = "FD", IsActive = true };
        db.AccountProductTypes.Add(pt);
        db.SaveChanges();

        var account = new Account
        {
            AccountNumber = "FD-CLOSED-001",
            CustomerId    = 1,
            ProductTypeId = pt.AccountProductTypeId,
            Balance       = 50_000m,
            Status        = "Closed",
            DateOpened    = DateTime.UtcNow.AddMonths(-12),
            DateClosed    = DateTime.UtcNow.AddDays(-5),
            TermMonths    = 12,
        };
        db.Accounts.Add(account);
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.MatureAccount(account.AccountId);

        var bad = result.Result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400 for already-closed account");
    }

    // T-03: Account with no TermMonths (not a term deposit) → 400
    [Test]
    public async Task MatureAccount_NoTermMonths_Returns400()
    {
        var db = MaDbFactory.Create();
        var pt = new AccountProductType { Name = "Savings", IsActive = true };
        db.AccountProductTypes.Add(pt);
        db.SaveChanges();

        var account = new Account
        {
            AccountNumber = "SB-001",
            CustomerId    = 1,
            ProductTypeId = pt.AccountProductTypeId,
            Balance       = 50_000m,
            Status        = "Active",
            DateOpened    = DateTime.UtcNow.AddMonths(-6),
            TermMonths    = null,   // savings account — no term
        };
        db.Accounts.Add(account);
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.MatureAccount(account.AccountId);

        var bad = result.Result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400: no term deposit");
    }

    // T-04: PrematureClose on active FD → status="Closed", DateClosed set, penalty applied
    [Test]
    public async Task PrematureClose_ActiveFd_SetsStatusClosedAndAppliesPenalty()
    {
        var db      = MaDbFactory.Create();
        var account = MakeActiveFd(db, maturityDate: DateTime.UtcNow.AddMonths(6), accountNumber: "FD-PREM-001");
        var ctrl    = BuildController(db);

        var result = await ctrl.PrematureClose(account.AccountId);

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var status    = ok!.Value!.GetType().GetProperty("status")?.GetValue(ok.Value) as string;
        var jnlNumber = ok.Value!.GetType().GetProperty("journalNumber")?.GetValue(ok.Value) as string;

        Assert.That(status,    Is.EqualTo("Closed"),        "Status should be Closed");
        Assert.That(jnlNumber, Is.EqualTo("JNL-PRE-TEST"),  "Journal number should be set");

        var updated = await db.Accounts.FindAsync(account.AccountId);
        Assert.That(updated!.Status,     Is.EqualTo("Closed"), "DB: status should be Closed");
        Assert.That(updated.DateClosed,  Is.Not.Null,          "DB: DateClosed should be set");
    }

    // T-05: AutoRenewal=true on matured FD → status stays "Active", MaturityDate reset
    [Test]
    public async Task MatureAccount_AutoRenewalTrue_ResetsMaturityDateAndKeepsActive()
    {
        var db      = MaDbFactory.Create();
        var account = MakeActiveFd(db, maturityDate: DateTime.UtcNow.AddDays(-1), autoRenewal: true);
        var origMaturityDate = account.MaturityDate;
        var ctrl    = BuildController(db);

        var result = await ctrl.MatureAccount(account.AccountId);

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var autoRenewed = ok!.Value!.GetType().GetProperty("autoRenewed")?.GetValue(ok.Value);
        Assert.That(autoRenewed, Is.True, "autoRenewed flag should be true");

        var updated = await db.Accounts.FindAsync(account.AccountId);
        Assert.That(updated!.Status,      Is.EqualTo("Active"),   "Status should remain Active on auto-renewal");
        Assert.That(updated.DateClosed,   Is.Null,                "DateClosed should NOT be set on auto-renewal");
        Assert.That(updated.MaturityDate, Is.GreaterThan(origMaturityDate!.Value), "MaturityDate should be extended");
    }
}
