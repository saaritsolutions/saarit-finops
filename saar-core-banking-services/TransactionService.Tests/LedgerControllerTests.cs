using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NUnit.Framework;
using TransactionService.Controllers;
using TransactionService.Data;
using TransactionService.Models;
using TransactionService.Services;

namespace TransactionService.Tests;

// =============================================================================
// TC-TX-003  — LedgerController tests
// =============================================================================
[TestFixture]
public class LedgerControllerTests
{
    private static TransactionDbContext MakeDb() =>
        new TransactionDbContext(
            new DbContextOptionsBuilder<TransactionDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

    private static LedgerController BuildController(TransactionDbContext db) =>
        new LedgerController(new LedgerService(db));

    private static void SeedCoaAndBalance(
        TransactionDbContext db,
        string code,
        string name,
        string type,
        string normalBal,
        decimal debit,
        decimal credit)
    {
        db.ChartOfAccounts.Add(new ChartOfAccount
        {
            AccountCode   = code,
            AccountName   = name,
            AccountType   = type,
            NormalBalance = normalBal,
            IsActive      = true
        });

        if (debit > 0 || credit > 0)
        {
            db.LedgerBalances.Add(new LedgerBalance
            {
                AccountCode   = code,
                DebitTotal    = debit,
                CreditTotal   = credit,
                LastUpdatedAt = DateTime.UtcNow
            });
        }

        db.SaveChanges();
    }

    // T-11: GET /api/ledger/balances — returns all active ChartOfAccount entries
    [Test]
    public async Task GetAllBalances_WithSeededAccounts_ReturnsAll()
    {
        var db = MakeDb();
        SeedCoaAndBalance(db, "1010", "Cash and Bank",     "Asset",     "Debit",  100_000m, 0m);
        SeedCoaAndBalance(db, "2010", "Customer Deposits", "Liability", "Credit", 0m, 100_000m);
        SeedCoaAndBalance(db, "5010", "Interest Expense",  "Expense",   "Debit",  5_000m, 0m);

        var ctrl   = BuildController(db);
        var result = await ctrl.GetAllBalances(CancellationToken.None);

        var ok   = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var list = ok!.Value as IReadOnlyList<LedgerBalanceDto>;
        Assert.That(list, Is.Not.Null);
        Assert.That(list!.Count, Is.EqualTo(3), "Should return 3 active accounts");
        Assert.That(list.Select(x => x.AccountCode), Is.EquivalentTo(new[] { "1010", "2010", "5010" }));
    }

    // T-12: GET /api/ledger/balance/{accountCode} — known account → 200 with correct balance
    [Test]
    public async Task GetBalance_KnownAccountCode_Returns200WithCorrectNetBalance()
    {
        var db = MakeDb();
        SeedCoaAndBalance(db, "1020", "Loans & Advances", "Asset", "Debit", 200_000m, 50_000m);

        var ctrl   = BuildController(db);
        var result = await ctrl.GetBalance("1020", CancellationToken.None);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var dto = ok!.Value as LedgerBalanceDto;
        Assert.That(dto, Is.Not.Null);
        Assert.That(dto!.AccountCode,  Is.EqualTo("1020"));
        Assert.That(dto.AccountName,   Is.EqualTo("Loans & Advances"));
        Assert.That(dto.DebitTotal,    Is.EqualTo(200_000m));
        Assert.That(dto.CreditTotal,   Is.EqualTo(50_000m));
        Assert.That(dto.Balance,       Is.EqualTo(150_000m), "Debit-normal: DebitTotal - CreditTotal");
    }

    // T-13: GET /api/ledger/balance/{accountCode} — unknown code → 404
    [Test]
    public async Task GetBalance_UnknownAccountCode_Returns404()
    {
        var db   = MakeDb();
        var ctrl = BuildController(db);

        var result = await ctrl.GetBalance("XXXX", CancellationToken.None);

        Assert.That(result, Is.InstanceOf<NotFoundObjectResult>(), "Unknown account code should return 404");
    }

    // Bonus: Credit-normal account (Liability) should compute balance as CreditTotal - DebitTotal
    [Test]
    public async Task GetBalance_CreditNormalAccount_ComputesBalanceCorrectly()
    {
        var db = MakeDb();
        SeedCoaAndBalance(db, "2010", "Customer Deposits", "Liability", "Credit", 10_000m, 90_000m);

        var ctrl   = BuildController(db);
        var result = await ctrl.GetBalance("2010", CancellationToken.None);

        var ok  = result as OkObjectResult;
        var dto = ok!.Value as LedgerBalanceDto;

        Assert.That(dto!.Balance, Is.EqualTo(80_000m), "Credit-normal: CreditTotal - DebitTotal");
    }
}
