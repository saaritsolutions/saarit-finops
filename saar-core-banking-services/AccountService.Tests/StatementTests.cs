using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using AccountService.Controllers;
using AccountService.Data;
using AccountService.Models;
using AccountService.Services;

namespace AccountService.Tests;

// ── File-scoped stubs ─────────────────────────────────────────────────────────

file sealed class StNoOpExpressions : IExpressionEvaluationService
{
    public Task<T> EvaluateExpressionAsync<T>(string id, Dictionary<string, object> ctx)
        => throw new NotImplementedException();

    public Task<decimal?> CalculateDepositInterestRateAsync(
        string accountType, decimal amount, int termMonths)
        => Task.FromResult<decimal?>(null);

    public Task<decimal> CalculateMaintenanceFeeAsync(
        decimal avgBalance, string accountType, int ageMonths,
        string customerSegment, decimal minimumBalance)
        => Task.FromResult(0m);
}

file sealed class StNoOpWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance> StartAccountOpeningAsync(
        Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowInstance());

    public Task<WorkflowStepResult> ProcessStepAsync(
        Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowStepResult());
}

file sealed class StNoOpForms : IDynamicFormsClient
{
    public Task<List<AccountDynamicField>> GetAccountFormSchemaAsync(string accountType)
        => Task.FromResult(new List<AccountDynamicField>());
}

/// <summary>Simulates TransactionService being unreachable — always returns a warning.</summary>
file sealed class StFailOpenTransactions : ITransactionServiceClient
{
    public Task<DepositJournalResult> PostMaturityPayoutAsync(
        string accountNumber, string accountType, decimal principal, decimal interest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<DepositJournalResult> PostPrematureClosureAsync(
        string accountNumber, string accountType, decimal principal, decimal reducedInterest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<DepositJournalResult> PostMaintenanceFeeAsync(
        string accountNumber, decimal fee, string postedBy,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<StatementResult> GetStatementAsync(
        string referenceId, DateTime from, DateTime to,
        int page = 1, int pageSize = 50, CancellationToken ct = default)
        => Task.FromResult(new StatementResult { Warning = "Transaction service unavailable" });
}

/// <summary>Returns a real statement with two entries.</summary>
file sealed class StRealTransactions : ITransactionServiceClient
{
    public Task<DepositJournalResult> PostMaturityPayoutAsync(
        string accountNumber, string accountType, decimal principal, decimal interest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<DepositJournalResult> PostPrematureClosureAsync(
        string accountNumber, string accountType, decimal principal, decimal reducedInterest,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<DepositJournalResult> PostMaintenanceFeeAsync(
        string accountNumber, decimal fee, string postedBy,
        CancellationToken ct = default)
        => Task.FromResult(new DepositJournalResult(true, "JNL-STUB", null));

    public Task<StatementResult> GetStatementAsync(
        string referenceId, DateTime from, DateTime to,
        int page = 1, int pageSize = 50, CancellationToken ct = default)
        => Task.FromResult(new StatementResult
        {
            Total    = 2,
            Page     = 1,
            PageSize = 50,
            Items    = new()
            {
                new StatementEntry
                {
                    JournalId     = 1,
                    JournalNumber = "JNL-20260428-000001",
                    PostedAt      = DateTime.UtcNow.AddDays(-3),
                    Description   = "FD Maturity Payout",
                    Debit         = 100_000m,
                    Credit        = 0m,
                },
                new StatementEntry
                {
                    JournalId     = 2,
                    JournalNumber = "JNL-20260428-000002",
                    PostedAt      = DateTime.UtcNow.AddDays(-1),
                    Description   = "Account Maintenance Fee",
                    Debit         = 0m,
                    Credit        = 150m,
                },
            }
        });
}

file static class StDbFactory
{
    public static AccountDbContext Create() =>
        new AccountDbContext(
            new DbContextOptionsBuilder<AccountDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

// =============================================================================
// TC-ACC-STMT — Account Statement (SAAR-STMT-001)
// =============================================================================
[TestFixture]
public class StatementTests
{
    private static AccountController BuildController(
        AccountDbContext db, ITransactionServiceClient? txn = null) =>
        new AccountController(
            db,
            new StNoOpExpressions(),
            new StNoOpWorkflow(),
            new StNoOpForms(),
            txn ?? new StFailOpenTransactions(),
            NullLogger<AccountController>.Instance);

    // T-03: CreateAccount auto-assigns AccountNumber = "ACC{id:D8}" when none provided
    [Test]
    public async Task CreateAccount_AutoGeneratesAccountNumber_WhenNotProvided()
    {
        var db   = StDbFactory.Create();
        var pt   = new AccountProductType { Name = "Savings", IsActive = true };
        db.AccountProductTypes.Add(pt);
        await db.SaveChangesAsync();

        var ctrl    = BuildController(db);
        var request = new Account
        {
            CustomerId    = 1,
            ProductTypeId = pt.AccountProductTypeId,
            Balance       = 5_000m,
            DateOpened    = DateTime.UtcNow,
            // AccountNumber intentionally NOT set
        };

        var result = await ctrl.CreateAccount(request);

        var created = result.Result as CreatedAtActionResult;
        Assert.That(created, Is.Not.Null, "Expected 201 Created");

        var saved = (Account)created!.Value!;
        Assert.That(saved.AccountNumber, Is.Not.Null.And.Not.Empty,
            "AccountNumber should be auto-generated");
        Assert.That(saved.AccountNumber, Does.StartWith("ACC"),
            "Auto-generated AccountNumber should start with 'ACC'");
        Assert.That(saved.AccountId, Is.GreaterThan(0));
    }

    // T-04: GetStatement when TransactionService is down → 200 with empty entries + warning
    [Test]
    public async Task GetStatement_TransactionServiceDown_ReturnsFailOpenWithWarning()
    {
        var db  = StDbFactory.Create();
        var pt  = new AccountProductType { Name = "Savings", IsActive = true };
        db.AccountProductTypes.Add(pt);
        var acc = new Account
        {
            AccountNumber = "ACC00000042",
            CustomerId    = 1,
            ProductTypeId = pt.AccountProductTypeId,
            Balance       = 10_000m,
            DateOpened    = DateTime.UtcNow,
            Status        = "Active",
        };
        db.Accounts.Add(acc);
        await db.SaveChangesAsync();

        var ctrl   = BuildController(db, new StFailOpenTransactions());
        var result = await ctrl.GetStatement(acc.AccountId);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK even when TransactionService is down");

        // Verify warning is present via anonymous object dynamic access
        var json = System.Text.Json.JsonSerializer.Serialize(ok!.Value);
        Assert.That(json, Does.Contain("warning"), "Response should include a warning field");
        Assert.That(json, Does.Contain("unavailable").Or.Contain("Transaction service"),
            "Warning should mention TransactionService");
    }

    // T-05: GetStatement for non-existent account → 404
    [Test]
    public async Task GetStatement_AccountNotFound_Returns404()
    {
        var db   = StDbFactory.Create();
        var ctrl = BuildController(db);

        var result = await ctrl.GetStatement(99999);

        Assert.That(result, Is.InstanceOf<NotFoundObjectResult>(),
            "Expected 404 for non-existent account");
    }
}
