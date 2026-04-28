using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using TransactionService.Controllers;
using TransactionService.Data;
using TransactionService.Models;
using TransactionService.Services;

namespace TransactionService.Tests;

// ── Helpers shared across controller-level tests ──────────────────────────

file static class CtrlDbFactory
{
    public static TransactionDbContext Create() =>
        new TransactionDbContext(
            new DbContextOptionsBuilder<TransactionDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
}

file static class CtrlEngineFactory
{
    public static PostingEngine MakeEngine(TransactionDbContext db) =>
        new PostingEngine(
            db,
            NullLogger<PostingEngine>.Instance,
            null!,
            new ConfigurationBuilder().Build(),
            null!);
}

// =============================================================================
// TC-TX-002  — JournalController additional coverage
// =============================================================================
[TestFixture]
public class JournalControllerTests
{
    private static JournalController BuildController(TransactionDbContext db) =>
        new JournalController(
            CtrlEngineFactory.MakeEngine(db),
            NullLogger<JournalController>.Instance);

    private static PostJournalRequest SimpleRequest(string key = "JC-KEY-001") =>
        new PostJournalRequest
        {
            IdempotencyKey = key,
            Description    = "Test entry",
            PostedBy       = "unit-test",
            Entries        = new()
            {
                new() { AccountCode = "1020", DebitAmount  = 50_000m, CreditAmount = 0m },
                new() { AccountCode = "2010", DebitAmount  = 0m,      CreditAmount = 50_000m },
            }
        };

    // T-STMT-01: GET /api/journal/by-reference/{referenceId} — matching journals → 200 paged result
    [Test]
    public async Task GetByReference_WithMatchingJournals_ReturnsPaged()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        // Post two journals with the same referenceId
        var engine = CtrlEngineFactory.MakeEngine(db);
        await engine.PostAsync(new PostJournalRequest
        {
            IdempotencyKey = "STMT-REF-001",
            Description    = "Maturity payout",
            ReferenceType  = "DepositMaturity",
            ReferenceId    = "ACC00000001",
            PostedBy       = "AccountService",
            Entries        = new()
            {
                new() { AccountCode = "2010", DebitAmount  = 100_000m, CreditAmount = 0m },
                new() { AccountCode = "1010", DebitAmount  = 0m,      CreditAmount = 100_000m },
            }
        });
        await engine.PostAsync(new PostJournalRequest
        {
            IdempotencyKey = "STMT-REF-002",
            Description    = "Maintenance fee",
            ReferenceType  = "MaintenanceFee",
            ReferenceId    = "ACC00000001",
            PostedBy       = "AccountService",
            Entries        = new()
            {
                new() { AccountCode = "1010", DebitAmount  = 100m, CreditAmount = 0m },
                new() { AccountCode = "4020", DebitAmount  = 0m,   CreditAmount = 100m },
            }
        });

        var from = DateTime.UtcNow.AddDays(-1);
        var to   = DateTime.UtcNow.AddDays(1);

        var result = await ctrl.GetByReference("ACC00000001", from, to, 1, 50);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var paged = ok!.Value as JournalPagedResult;
        Assert.That(paged, Is.Not.Null);
        Assert.That(paged!.Total,      Is.EqualTo(2));
        Assert.That(paged.Items.Count, Is.EqualTo(2));
        Assert.That(paged.Items.All(j => j.ReferenceId == "ACC00000001"), Is.True);
    }

    // T-STMT-02: GET /api/journal/by-reference/{referenceId} — no matches → 200 with empty list
    [Test]
    public async Task GetByReference_NoMatchingJournals_ReturnsEmptyList()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        var from = DateTime.UtcNow.AddDays(-1);
        var to   = DateTime.UtcNow.AddDays(1);

        var result = await ctrl.GetByReference("ACC99999999", from, to, 1, 50);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK (not 404)");

        var paged = ok!.Value as JournalPagedResult;
        Assert.That(paged,             Is.Not.Null);
        Assert.That(paged!.Total,      Is.EqualTo(0));
        Assert.That(paged.Items.Count, Is.EqualTo(0));
    }

    // T-08: GET /api/journal/by-number/{number} — found → 200, not-found → 404
    [Test]
    public async Task GetByNumber_PostedJournal_Returns200()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        // Post a journal first to get a real journal number
        var engine  = CtrlEngineFactory.MakeEngine(db);
        var journal = await engine.PostAsync(SimpleRequest("JC-NUM-001"));

        var result = await ctrl.GetByNumber(journal.JournalNumber, CancellationToken.None);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK");

        var returned = ok!.Value as Journal;
        Assert.That(returned, Is.Not.Null);
        Assert.That(returned!.JournalNumber, Is.EqualTo(journal.JournalNumber));
        Assert.That(returned.IdempotencyKey,  Is.EqualTo("JC-NUM-001"));
    }

    [Test]
    public async Task GetByNumber_UnknownNumber_Returns404()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        var result = await ctrl.GetByNumber("JNL-99999999-999999", CancellationToken.None);

        Assert.That(result, Is.InstanceOf<NotFoundResult>());
    }

    // T-10: GET /api/journal/daily-summary — date range > 366 days → 400
    [Test]
    public async Task DailySummary_DateRangeExceeds366Days_Returns400()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        var from = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to   = new DateTime(2026, 6, 30, 0, 0, 0, DateTimeKind.Utc);  // > 366 days gap

        var result = await ctrl.DailySummary(from, to);

        var bad = result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400 BadRequest for range > 366 days");
    }

    // Bonus: from > to → 400
    [Test]
    public async Task DailySummary_FromAfterTo_Returns400()
    {
        var db   = CtrlDbFactory.Create();
        var ctrl = BuildController(db);

        var from = DateTime.UtcNow.Date;
        var to   = from.AddDays(-1);

        var result = await ctrl.DailySummary(from, to);

        var bad = result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400 when from > to");
    }
}
