using GLAccountingService.Controllers;
using GLAccountingService.Data;
using GLAccountingService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GLAccountingService.Tests;

public class GeneralLedgerAccountsControllerTests
{
    private GLAccountingDbContext _context = null!;
    private GeneralLedgerAccountsController _controller = null!;

    [SetUp]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<GLAccountingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new GLAccountingDbContext(options);
        _controller = new GeneralLedgerAccountsController(_context);
    }

    [TearDown]
    public void TearDown()
    {
        _context.Dispose();
    }

    // T-01: Creating a GL account persists it and stamps CreatedAt server-side
    [Test]
    public async Task Create_ValidAccount_PersistsAndStampsCreatedAt()
    {
        var account = new GeneralLedgerAccount
        {
            AccountNumber = "1010",
            Name = "Cash in Hand",
            Type = "Asset",
            Balance = 0m
        };

        var result = await _controller.Create(account);

        var created = (result.Result as CreatedAtActionResult)?.Value as GeneralLedgerAccount;
        Assert.That(created, Is.Not.Null);
        Assert.That(created!.CreatedAt, Is.Not.EqualTo(default(DateTime)));
        Assert.That(await _context.GeneralLedgerAccounts.CountAsync(), Is.EqualTo(1));
    }

    // T-02: GetAll returns every seeded account
    [Test]
    public async Task GetAll_ReturnsAllAccounts()
    {
        _context.GeneralLedgerAccounts.AddRange(
            new GeneralLedgerAccount { AccountNumber = "1010", Name = "Cash", Type = "Asset", Balance = 100m, CreatedAt = DateTime.UtcNow },
            new GeneralLedgerAccount { AccountNumber = "4050", Name = "Interest Income", Type = "Income", Balance = 50m, CreatedAt = DateTime.UtcNow });
        await _context.SaveChangesAsync();

        var result = await _controller.GetAll();

        Assert.That(result.Value, Is.Not.Null);
        Assert.That(result.Value!.Count(), Is.EqualTo(2));
    }

    // T-03: Get by id returns 404 when the account doesn't exist
    [Test]
    public async Task Get_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Get(999);

        Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
    }

    // T-04: Get by id returns the matching account
    [Test]
    public async Task Get_KnownId_ReturnsAccount()
    {
        var account = new GeneralLedgerAccount { AccountNumber = "1030", Name = "Provision Against NPAs", Type = "Asset", Balance = 0m, CreatedAt = DateTime.UtcNow };
        _context.GeneralLedgerAccounts.Add(account);
        await _context.SaveChangesAsync();

        var result = await _controller.Get(account.Id);

        Assert.That(result.Value, Is.Not.Null);
        Assert.That(result.Value!.AccountNumber, Is.EqualTo("1030"));
    }

    // T-05: Delete removes the account
    [Test]
    public async Task Delete_KnownId_RemovesAccount()
    {
        var account = new GeneralLedgerAccount { AccountNumber = "5045", Name = "Restructuring Provision Reversal", Type = "Income", Balance = 0m, CreatedAt = DateTime.UtcNow };
        _context.GeneralLedgerAccounts.Add(account);
        await _context.SaveChangesAsync();

        var result = await _controller.Delete(account.Id);

        Assert.That(result, Is.TypeOf<NoContentResult>());
        Assert.That(await _context.GeneralLedgerAccounts.CountAsync(), Is.EqualTo(0));
    }

    // T-06: Delete on an unknown id returns 404 rather than throwing
    [Test]
    public async Task Delete_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Delete(999);

        Assert.That(result, Is.TypeOf<NotFoundResult>());
    }
}

public class JournalEntriesControllerTests
{
    private GLAccountingDbContext _context = null!;
    private JournalEntriesController _controller = null!;
    private GeneralLedgerAccount _seedAccount = null!;

    [SetUp]
    public async Task Setup()
    {
        var options = new DbContextOptionsBuilder<GLAccountingDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new GLAccountingDbContext(options);
        _controller = new JournalEntriesController(_context);

        _seedAccount = new GeneralLedgerAccount { AccountNumber = "1020", Name = "Loans & Advances", Type = "Asset", Balance = 0m, CreatedAt = DateTime.UtcNow };
        _context.GeneralLedgerAccounts.Add(_seedAccount);
        await _context.SaveChangesAsync();
    }

    [TearDown]
    public void TearDown()
    {
        _context.Dispose();
    }

    // T-07: Creating a journal entry persists it and stamps EntryDate server-side
    [Test]
    public async Task Create_ValidEntry_PersistsAndStampsEntryDate()
    {
        var entry = new JournalEntry
        {
            Description = "Loan disbursement DR 1020",
            Debit = 500000m,
            Credit = 0m,
            GLAccountId = _seedAccount.Id
        };

        var result = await _controller.Create(entry);

        var created = (result.Result as CreatedAtActionResult)?.Value as JournalEntry;
        Assert.That(created, Is.Not.Null);
        Assert.That(created!.EntryDate, Is.Not.EqualTo(default(DateTime)));
        Assert.That(await _context.JournalEntries.CountAsync(), Is.EqualTo(1));
    }

    // T-08: GetAll includes the related GL account (Include join)
    [Test]
    public async Task GetAll_IncludesRelatedGLAccount()
    {
        _context.JournalEntries.Add(new JournalEntry
        {
            Description = "Test entry",
            Debit = 1000m,
            Credit = 0m,
            GLAccountId = _seedAccount.Id,
            EntryDate = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        var result = await _controller.GetAll();

        Assert.That(result.Value, Is.Not.Null);
        var entry = result.Value!.Single();
        Assert.That(entry.GLAccount, Is.Not.Null);
        Assert.That(entry.GLAccount!.AccountNumber, Is.EqualTo("1020"));
    }

    // T-09: Get by id returns 404 when the entry doesn't exist
    [Test]
    public async Task Get_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Get(999);

        Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
    }

    // T-10: Delete removes the journal entry
    [Test]
    public async Task Delete_KnownId_RemovesEntry()
    {
        var entry = new JournalEntry
        {
            Description = "To be deleted",
            Debit = 200m,
            Credit = 0m,
            GLAccountId = _seedAccount.Id,
            EntryDate = DateTime.UtcNow
        };
        _context.JournalEntries.Add(entry);
        await _context.SaveChangesAsync();

        var result = await _controller.Delete(entry.Id);

        Assert.That(result, Is.TypeOf<NoContentResult>());
        Assert.That(await _context.JournalEntries.CountAsync(), Is.EqualTo(0));
    }
}
