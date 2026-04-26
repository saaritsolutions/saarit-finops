using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using System.Net;
using System.Text;
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

    /// <summary>
    /// Creates a PostingEngine with EnableExpressions=false (default for unit tests).
    /// The httpClientFactory and scopeFactory are unused when expressions are disabled.
    /// </summary>
    private static PostingEngine MakeEngine(TransactionDbContext db) =>
        new PostingEngine(
            db,
            NullLogger<PostingEngine>.Instance,
            null!,   // httpClientFactory — not called when EnableExpressions=false
            new ConfigurationBuilder().Build(),  // all flags default to false
            null!);  // scopeFactory — not called when EnableExpressions=false

    /// <summary>
    /// Creates a PostingEngine with EnableExpressions=true and a supplied fake HttpClientFactory.
    /// </summary>
    private static PostingEngine MakeEngineWithExpressions(TransactionDbContext db, IHttpClientFactory factory) =>
        new PostingEngine(
            db,
            NullLogger<PostingEngine>.Instance,
            factory,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:EnableExpressions"] = "true" })
                .Build(),
            null!);  // scopeFactory — CTR check runs fire-and-forget; null is safe in tests

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

    // ── Daily Summary tests (SAAR-RPT-001) ────────────────────────────────────

    [Test]
    public async Task DailySummary_EmptyDatabase_ReturnsZeroCounts()
    {
        using var db = MakeDb(nameof(DailySummary_EmptyDatabase_ReturnsZeroCounts));
        var engine = MakeEngine(db);

        var today = DateTime.UtcNow.Date;
        var report = await engine.GetDailySummaryAsync(today.AddDays(-7), today);

        Assert.That(report.Days,            Is.Empty);
        Assert.That(report.GrandTotalCount, Is.EqualTo(0));
        Assert.That(report.GrandTotalDebit, Is.EqualTo(0m));
    }

    [Test]
    public async Task DailySummary_TwoDistinctDates_GroupsCorrectlyAndTotalsMatch()
    {
        using var db = MakeDb(nameof(DailySummary_TwoDistinctDates_GroupsCorrectlyAndTotalsMatch));

        // Insert journals directly at specific dates (bypassing PostAsync clock)
        var yesterday = DateTime.UtcNow.Date.AddDays(-1);
        var today     = DateTime.UtcNow.Date;

        var makeJournal = (string key, DateTime postedAt, decimal amount) =>
            new TransactionService.Models.Journal
            {
                IdempotencyKey = key,
                JournalNumber  = $"JNL-TEST-{key}",
                Description    = "Test journal",
                ReferenceType  = "Test",
                PostedBy       = "unit-test",
                PostedAt       = postedAt,
                Status         = "Posted",
                Entries        = new List<TransactionService.Models.JournalEntry>
                {
                    new() { AccountCode = "1020", DebitAmount  = amount, CreditAmount = 0m,     EntryDate = postedAt },
                    new() { AccountCode = "2010", DebitAmount  = 0m,     CreditAmount = amount, EntryDate = postedAt },
                }
            };

        db.Journals.AddRange(
            makeJournal("DS-Y1", yesterday, 50_000m),
            makeJournal("DS-Y2", yesterday, 30_000m),
            makeJournal("DS-T1", today,     20_000m)
        );
        await db.SaveChangesAsync();

        var engine = MakeEngine(db);
        var report = await engine.GetDailySummaryAsync(yesterday, today);

        Assert.That(report.GrandTotalCount, Is.EqualTo(3));
        Assert.That(report.Days,            Has.Count.EqualTo(2));

        var yd = report.Days.Single(d => d.Date.Date == yesterday);
        Assert.That(yd.JournalCount, Is.EqualTo(2));
        Assert.That(yd.TotalDebit,   Is.EqualTo(80_000m));

        var td = report.Days.Single(d => d.Date.Date == today);
        Assert.That(td.JournalCount, Is.EqualTo(1));
        Assert.That(td.TotalDebit,   Is.EqualTo(20_000m));
    }
}

// ── Expression trigger tests (SAAR-EXPR-001) ──────────────────────────────────

/// <summary>
/// Tests for PostingEngine expression evaluation (TP-TXN-001: daily limit check).
/// Uses a fake HttpMessageHandler to control ExpressionBuilderService responses.
/// </summary>
public class PostingEngineExpressionTests
{
    private static TransactionDbContext MakeDb(string name)
    {
        var opts = new DbContextOptionsBuilder<TransactionDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new TransactionDbContext(opts);
    }

    /// <summary>Creates an IHttpClientFactory that always returns the given JSON body with the given status code.</summary>
    private static IHttpClientFactory MakeFactory(string responseJson, HttpStatusCode status = HttpStatusCode.OK)
    {
        var handler = new FakeHttpHandler(responseJson, status);
        var client  = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5004/") };
        return new SingletonHttpClientFactory(client);
    }

    private static PostJournalRequest SmallJournal(decimal amount = 10_000m) => new PostJournalRequest
    {
        IdempotencyKey = $"TEST-{Guid.NewGuid()}",
        Description    = "Test journal",
        ReferenceType  = "Test",
        PostedBy       = "unit-test",
        Entries        = new()
        {
            new() { AccountCode = "1020", DebitAmount  = amount, CreditAmount = 0m },
            new() { AccountCode = "2010", DebitAmount  = 0m,     CreditAmount = amount },
        }
    };

    [Test]
    public async Task PostAsync_BlocksTransaction_WhenExpressionReturnsFalse()
    {
        // Expression service returns { "success": true, "result": false } → block
        var json    = """{"success":true,"result":false}""";
        var factory = MakeFactory(json);
        using var db = MakeDb(nameof(PostAsync_BlocksTransaction_WhenExpressionReturnsFalse));
        var engine  = new PostingEngine(
            db,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<PostingEngine>.Instance,
            factory,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:EnableExpressions"] = "true" })
                .Build(),
            null!);

        var ex = Assert.ThrowsAsync<InvalidOperationException>(
            () => engine.PostAsync(SmallJournal(250_000m)));

        Assert.That(ex!.Message, Does.Contain("transaction limit"));
    }

    [Test]
    public async Task PostAsync_AllowsTransaction_WhenExpressionReturnsTrue()
    {
        // Expression service returns { "success": true, "result": true } → allow
        var json    = """{"success":true,"result":true}""";
        var factory = MakeFactory(json);
        using var db = MakeDb(nameof(PostAsync_AllowsTransaction_WhenExpressionReturnsTrue));
        var engine  = new PostingEngine(
            db,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<PostingEngine>.Instance,
            factory,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:EnableExpressions"] = "true" })
                .Build(),
            null!);

        var journal = await engine.PostAsync(SmallJournal(50_000m));

        Assert.That(journal.Status, Is.EqualTo("Posted"));
    }

    [Test]
    public async Task PostAsync_FailsOpen_WhenExpressionServiceUnreachable()
    {
        // Expression service throws — journal should still post (fail-open policy)
        var handler = new ThrowingHttpHandler();
        var client  = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5004/") };
        var factory = new SingletonHttpClientFactory(client);
        using var db = MakeDb(nameof(PostAsync_FailsOpen_WhenExpressionServiceUnreachable));
        var engine  = new PostingEngine(
            db,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<PostingEngine>.Instance,
            factory,
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:EnableExpressions"] = "true" })
                .Build(),
            null!);

        // Should NOT throw — fail-open policy
        var journal = await engine.PostAsync(SmallJournal());

        Assert.That(journal.Status, Is.EqualTo("Posted"));
    }

    [Test]
    public async Task PostAsync_ExpressionDisabled_NeverCallsExpressionService()
    {
        // Feature flag off → expression service should not be called
        var handler = new CountingHttpHandler();
        var client  = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5004/") };
        var factory = new SingletonHttpClientFactory(client);
        using var db = MakeDb(nameof(PostAsync_ExpressionDisabled_NeverCallsExpressionService));
        var engine  = new PostingEngine(
            db,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<PostingEngine>.Instance,
            factory,
            new ConfigurationBuilder().Build(), // EnableExpressions = false
            null!);

        await engine.PostAsync(SmallJournal());

        Assert.That(handler.CallCount, Is.EqualTo(0));
    }

    // ── Fake HTTP helpers ─────────────────────────────────────────────────────

    private sealed class FakeHttpHandler : HttpMessageHandler
    {
        private readonly string     _json;
        private readonly HttpStatusCode _status;
        public FakeHttpHandler(string json, HttpStatusCode status = HttpStatusCode.OK)
            => (_json, _status) = (json, status);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
            => Task.FromResult(new HttpResponseMessage(_status)
               { Content = new StringContent(_json, Encoding.UTF8, "application/json") });
    }

    private sealed class ThrowingHttpHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
            => throw new HttpRequestException("Simulated connection refused");
    }

    private sealed class CountingHttpHandler : HttpMessageHandler
    {
        public int CallCount { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            CallCount++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
               { Content = new StringContent("""{"success":true,"result":true}""", Encoding.UTF8, "application/json") });
        }
    }

    private sealed class SingletonHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;
        public SingletonHttpClientFactory(HttpClient client) => _client = client;
        public HttpClient CreateClient(string name) => _client;
    }
}
