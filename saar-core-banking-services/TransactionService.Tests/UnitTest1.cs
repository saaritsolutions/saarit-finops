using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using TransactionService.Data;
using TransactionService.Services;

namespace TransactionService.Tests;

/// <summary>
/// PostingEngine unit tests — all run against EF Core InMemory database.
/// Each test gets its own database instance (unique name) for isolation.
/// </summary>
public class PostingEngineTests
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private static TransactionDbContext MakeDb(string name)
    {
        var opts = new DbContextOptionsBuilder<TransactionDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new TransactionDbContext(opts);
    }

    private static PostingEngine MakeEngine(TransactionDbContext db) =>
        new PostingEngine(db, NullLogger<PostingEngine>.Instance);

    private static PostJournalRequest LoanDisbursement(string key = "KEY-001", decimal amount = 100_000m) =>
        new PostJournalRequest
        {
            IdempotencyKey = key,
            Description    = "Personal loan disbursement",
            ReferenceType  = "LoanDisbursement",
            ReferenceId    = "LOAN-0001",
            PostedBy       = "test-user",
            Entries        = new()
            {
                // Dr. Loans & Advances  Cr. Customer Deposits
                new() { AccountCode = "1020", DebitAmount  = amount, CreditAmount = 0m,     Narration = "Loan principal" },
                new() { AccountCode = "2010", DebitAmount  = 0m,     CreditAmount = amount, Narration = "Disbursed to account" },
            }
        };

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Test]
    public async Task PostAsync_BalancedJournal_ReturnsPostedJournal()
    {
        using var db = MakeDb(nameof(PostAsync_BalancedJournal_ReturnsPostedJournal));
        var engine = MakeEngine(db);

        var journal = await engine.PostAsync(LoanDisbursement());

        Assert.That(journal.JournalId,     Is.GreaterThan(0));
        Assert.That(journal.JournalNumber, Does.StartWith("JNL-"));
        Assert.That(journal.Status,        Is.EqualTo("Posted"));
        Assert.That(journal.Entries,       Has.Count.EqualTo(2));
    }

    [Test]
    public async Task PostAsync_JournalNumber_IsUniqueAcrossSequentialPosts()
    {
        using var db = MakeDb(nameof(PostAsync_JournalNumber_IsUniqueAcrossSequentialPosts));
        var engine = MakeEngine(db);

        var j1 = await engine.PostAsync(LoanDisbursement("KEY-A"));
        var j2 = await engine.PostAsync(LoanDisbursement("KEY-B"));

        Assert.That(j1.JournalNumber, Is.Not.EqualTo(j2.JournalNumber));
    }

    [Test]
    public void PostAsync_ImbalancedJournal_ThrowsInvalidOperation()
    {
        using var db = MakeDb(nameof(PostAsync_ImbalancedJournal_ThrowsInvalidOperation));
        var engine = MakeEngine(db);

        var request = new PostJournalRequest
        {
            IdempotencyKey = "KEY-IMB",
            Description    = "Bad journal",
            Entries        = new()
            {
                new() { AccountCode = "1020", DebitAmount = 500m, CreditAmount = 0m },
                new() { AccountCode = "2010", DebitAmount = 0m,   CreditAmount = 300m }, // 500 != 300
            }
        };

        Assert.ThrowsAsync<InvalidOperationException>(() => engine.PostAsync(request));
    }

    [Test]
    public void PostAsync_ZeroEntries_ThrowsInvalidOperation()
    {
        using var db = MakeDb(nameof(PostAsync_ZeroEntries_ThrowsInvalidOperation));
        var engine = MakeEngine(db);

        var request = new PostJournalRequest
        {
            IdempotencyKey = "KEY-ZERO",
            Entries        = new()
            {
                new() { AccountCode = "1020", DebitAmount = 0m, CreditAmount = 0m },
            }
        };

        Assert.ThrowsAsync<InvalidOperationException>(() => engine.PostAsync(request));
    }

    [Test]
    public void PostAsync_MissingIdempotencyKey_ThrowsArgumentException()
    {
        using var db = MakeDb(nameof(PostAsync_MissingIdempotencyKey_ThrowsArgumentException));
        var engine = MakeEngine(db);

        var request = new PostJournalRequest
        {
            IdempotencyKey = "",    // empty
            Entries        = new()
            {
                new() { AccountCode = "1020", DebitAmount = 1000m, CreditAmount = 0m },
                new() { AccountCode = "2010", DebitAmount = 0m,    CreditAmount = 1000m },
            }
        };

        Assert.ThrowsAsync<ArgumentException>(() => engine.PostAsync(request));
    }

    [Test]
    public async Task PostAsync_DuplicateIdempotencyKey_ReturnsExistingJournal()
    {
        using var db = MakeDb(nameof(PostAsync_DuplicateIdempotencyKey_ReturnsExistingJournal));
        var engine = MakeEngine(db);

        var first  = await engine.PostAsync(LoanDisbursement("KEY-DUP"));
        var second = await engine.PostAsync(LoanDisbursement("KEY-DUP")); // replay

        Assert.That(second.JournalId,     Is.EqualTo(first.JournalId));
        Assert.That(second.JournalNumber, Is.EqualTo(first.JournalNumber));

        // Only one row should exist
        var count = await db.Journals.CountAsync();
        Assert.That(count, Is.EqualTo(1));
    }

    [Test]
    public async Task PostAsync_UpdatesLedgerBalance_DebitAccount()
    {
        using var db = MakeDb(nameof(PostAsync_UpdatesLedgerBalance_DebitAccount));
        var engine = MakeEngine(db);

        await engine.PostAsync(LoanDisbursement("KEY-BAL1", 50_000m));
        await engine.PostAsync(LoanDisbursement("KEY-BAL2", 30_000m));

        var balance = await db.LedgerBalances.FirstAsync(b => b.AccountCode == "1020");

        Assert.That(balance.DebitTotal,  Is.EqualTo(80_000m));
        Assert.That(balance.CreditTotal, Is.EqualTo(0m));
    }

    [Test]
    public async Task PostAsync_UpdatesLedgerBalance_CreditAccount()
    {
        using var db = MakeDb(nameof(PostAsync_UpdatesLedgerBalance_CreditAccount));
        var engine = MakeEngine(db);

        await engine.PostAsync(LoanDisbursement("KEY-CBAL1", 75_000m));

        var balance = await db.LedgerBalances.FirstAsync(b => b.AccountCode == "2010");

        Assert.That(balance.CreditTotal, Is.EqualTo(75_000m));
        Assert.That(balance.DebitTotal,  Is.EqualTo(0m));
    }

    [Test]
    public async Task PostAsync_MultipleEntries_SameAccount_AccumulatesCorrectly()
    {
        using var db = MakeDb(nameof(PostAsync_MultipleEntries_SameAccount_AccumulatesCorrectly));
        var engine = MakeEngine(db);

        // Interest accrual: Dr. Interest Receivable  Cr. Interest Income
        var request = new PostJournalRequest
        {
            IdempotencyKey = "KEY-INTEREST",
            Description    = "Monthly interest accrual",
            ReferenceType  = "InterestAccrual",
            Entries        = new()
            {
                new() { AccountCode = "1030", DebitAmount  = 8_500m, CreditAmount = 0m,     Narration = "Interest receivable" },
                new() { AccountCode = "4010", DebitAmount  = 0m,     CreditAmount = 8_500m, Narration = "Interest income" },
            }
        };

        var journal = await engine.PostAsync(request);

        Assert.That(journal.Entries, Has.Count.EqualTo(2));
        Assert.That(journal.Entries.Sum(e => e.DebitAmount),  Is.EqualTo(8_500m));
        Assert.That(journal.Entries.Sum(e => e.CreditAmount), Is.EqualTo(8_500m));
    }

    [Test]
    public async Task GetByIdAsync_ReturnsJournalWithEntries()
    {
        using var db = MakeDb(nameof(GetByIdAsync_ReturnsJournalWithEntries));
        var engine = MakeEngine(db);

        var posted  = await engine.PostAsync(LoanDisbursement());
        var fetched = await engine.GetByIdAsync(posted.JournalId);

        Assert.That(fetched,              Is.Not.Null);
        Assert.That(fetched!.JournalId,   Is.EqualTo(posted.JournalId));
        Assert.That(fetched.Entries,      Has.Count.EqualTo(2));
    }

    [Test]
    public async Task GetByIdAsync_UnknownId_ReturnsNull()
    {
        using var db = MakeDb(nameof(GetByIdAsync_UnknownId_ReturnsNull));
        var engine = MakeEngine(db);

        var result = await engine.GetByIdAsync(99999L);

        Assert.That(result, Is.Null);
    }

    [Test]
    public async Task GetByIdempotencyKeyAsync_ReturnsCorrectJournal()
    {
        using var db = MakeDb(nameof(GetByIdempotencyKeyAsync_ReturnsCorrectJournal));
        var engine = MakeEngine(db);

        await engine.PostAsync(LoanDisbursement("KEY-FIND-ME"));
        var found = await engine.GetByIdempotencyKeyAsync("KEY-FIND-ME");

        Assert.That(found,                 Is.Not.Null);
        Assert.That(found!.IdempotencyKey, Is.EqualTo("KEY-FIND-ME"));
    }

    [Test]
    public async Task GetByIdempotencyKeyAsync_MissingKey_ReturnsNull()
    {
        using var db = MakeDb(nameof(GetByIdempotencyKeyAsync_MissingKey_ReturnsNull));
        var engine = MakeEngine(db);

        var result = await engine.GetByIdempotencyKeyAsync("NO-SUCH-KEY");

        Assert.That(result, Is.Null);
    }

    [Test]
    public async Task GetRecentAsync_ReturnsNewestFirst()
    {
        using var db = MakeDb(nameof(GetRecentAsync_ReturnsNewestFirst));
        var engine = MakeEngine(db);

        await engine.PostAsync(LoanDisbursement("KEY-R1"));
        await Task.Delay(5); // ensure distinct PostedAt values
        await engine.PostAsync(LoanDisbursement("KEY-R2"));

        var list = await engine.GetRecentAsync(1, 10);

        Assert.That(list, Has.Count.EqualTo(2));
        Assert.That(list[0].IdempotencyKey, Is.EqualTo("KEY-R2")); // newest first
    }

    [Test]
    public async Task PostAsync_ReferenceType_StoredCorrectly()
    {
        using var db = MakeDb(nameof(PostAsync_ReferenceType_StoredCorrectly));
        var engine = MakeEngine(db);

        var req = LoanDisbursement();
        req.ReferenceType = "LoanDisbursement";
        req.ReferenceId   = "LOAN-XYZ-999";

        var j = await engine.PostAsync(req);

        Assert.That(j.ReferenceType, Is.EqualTo("LoanDisbursement"));
        Assert.That(j.ReferenceId,   Is.EqualTo("LOAN-XYZ-999"));
    }

    [Test]
    public async Task PostAsync_ThreeLeggedEntry_BalancedAcrossThreeAccounts()
    {
        using var db = MakeDb(nameof(PostAsync_ThreeLeggedEntry_BalancedAcrossThreeAccounts));
        var engine = MakeEngine(db);

        // Loan fee: Dr. Customer Deposits  Cr. Loan Principal + Cr. Fee Income
        var request = new PostJournalRequest
        {
            IdempotencyKey = "KEY-3LEG",
            Description    = "Loan fee deduction on disbursement",
            ReferenceType  = "LoanFee",
            Entries        = new()
            {
                new() { AccountCode = "2010", DebitAmount  = 102_000m, CreditAmount = 0m,       Narration = "Debit customer deposit" },
                new() { AccountCode = "1020", DebitAmount  = 0m,       CreditAmount = 100_000m, Narration = "Loan principal disbursed" },
                new() { AccountCode = "4020", DebitAmount  = 0m,       CreditAmount =   2_000m, Narration = "Processing fee" },
            }
        };

        var journal = await engine.PostAsync(request);

        Assert.That(journal.Entries.Sum(e => e.DebitAmount),
                    Is.EqualTo(journal.Entries.Sum(e => e.CreditAmount)));
        Assert.That(journal.Entries, Has.Count.EqualTo(3));
    }
}
