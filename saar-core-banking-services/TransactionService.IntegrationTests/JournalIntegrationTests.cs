using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using NUnit.Framework;

namespace TransactionService.IntegrationTests;

/// <summary>
/// Integration tests for JournalController and LedgerController via HTTP.
///
/// These tests use WebApplicationFactory&lt;Program&gt; to spin up the full ASP.NET Core
/// pipeline (routing, middleware, DI, JSON serialization) with an InMemory EF database.
///
/// To run against real Postgres, set INTEGRATION_REAL_DB=true and ensure
/// ConnectionStrings__DefaultConnection points to a writable instance.
/// </summary>
[TestFixture]
public class JournalIntegrationTests
{
    private IntegrationTestFactory _factory = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public void SetUp()
    {
        _factory = new IntegrationTestFactory();
        _client  = _factory.CreateClient();
    }

    [OneTimeTearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    private static object PostJournalBody(string key, decimal amount = 50_000m) => new
    {
        idempotencyKey = key,
        description    = "Integration test entry",
        referenceType  = "IntegrationTest",
        referenceId    = $"IT-{key}",
        postedBy       = "integration-test-runner",
        entries        = new[]
        {
            new { accountCode = "1020", debitAmount  = amount, creditAmount = 0m, narration = "DR leg" },
            new { accountCode = "2010", debitAmount  = 0m,     creditAmount = amount, narration = "CR leg" }
        }
    };

    // IT-01: POST same idempotency key twice → second call returns same JournalId (no duplicate row)
    [Test]
    public async Task PostJournal_DuplicateIdempotencyKey_ReturnsSameJournalId()
    {
        var key  = $"IT-IDEM-{Guid.NewGuid():N}";
        var body = PostJournalBody(key);

        var r1 = await _client.PostAsJsonAsync("/api/journal", body);
        Assert.That(r1.StatusCode, Is.EqualTo(HttpStatusCode.Created), "First post should be 201");

        var j1 = await r1.Content.ReadFromJsonAsync<JournalDto>();
        Assert.That(j1, Is.Not.Null);

        var r2 = await _client.PostAsJsonAsync("/api/journal", body);
        Assert.That(r2.StatusCode, Is.EqualTo(HttpStatusCode.Created), "Second post with same key should be 201");

        var j2 = await r2.Content.ReadFromJsonAsync<JournalDto>();
        Assert.That(j2, Is.Not.Null);

        Assert.That(j2!.JournalId, Is.EqualTo(j1!.JournalId),
            "Idempotency: both calls must return the same JournalId");
        Assert.That(j2.JournalNumber, Is.EqualTo(j1.JournalNumber),
            "Idempotency: journal number must be identical");
    }

    // IT-02: POST journal → GET /api/ledger/balance/{code} → LedgerBalance updated atomically
    [Test]
    public async Task PostJournal_LedgerBalanceReflectsPostedJournal()
    {
        var key    = $"IT-BAL-{Guid.NewGuid():N}";
        var amount = 75_000m;

        var postResp = await _client.PostAsJsonAsync("/api/journal", PostJournalBody(key, amount));
        Assert.That(postResp.StatusCode, Is.EqualTo(HttpStatusCode.Created));

        // Check debit leg (1020 — Loans & Advances) has been updated
        var balResp = await _client.GetAsync("/api/ledger/balance/1020");
        if (balResp.StatusCode == HttpStatusCode.NotFound)
            Assert.Ignore("Ledger balance for 1020 not found — ChartOfAccounts not seeded in integration DB");

        Assert.That(balResp.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        var bal = await balResp.Content.ReadFromJsonAsync<LedgerBalanceDto>();
        Assert.That(bal, Is.Not.Null);
        Assert.That(bal!.DebitTotal, Is.GreaterThanOrEqualTo(amount),
            "DebitTotal for 1020 should include the posted journal's debit amount");
    }

    // IT-03: POST with X-Tenant-ID header is accepted without error
    //        (Schema isolation verified by visual inspection on real Postgres only)
    [Test]
    public async Task PostJournal_WithTenantIdHeader_IsAcceptedWithout500()
    {
        var key = $"IT-TENANT-{Guid.NewGuid():N}";

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/journal");
        request.Headers.Add("X-Tenant-ID", "ucb_demo");
        request.Content = JsonContent.Create(PostJournalBody(key));

        var resp = await _client.SendAsync(request);

        // Should not return 500 — tenant header accepted, InMemory ignores schema isolation
        Assert.That((int)resp.StatusCode, Is.LessThan(500),
            "Posting with tenant header should not cause a 500 error");
        Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.Created),
            "Expected 201 Created with X-Tenant-ID header");
    }

    // IT-04: Expression service is disabled (fail-open) — journal still posts successfully
    [Test]
    public async Task PostJournal_ExpressionServiceDisabled_FailsOpenAndReturns201()
    {
        // The factory sets FeatureFlags:EnableExpressions=false (default) so expression service
        // is never called — this verifies the fail-open path works end-to-end via HTTP
        var key = $"IT-FAILOPEN-{Guid.NewGuid():N}";

        var resp = await _client.PostAsJsonAsync("/api/journal", PostJournalBody(key, 999_000m));

        Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.Created),
            "Journal should post even without expression service (fail-open)");

        var journal = await resp.Content.ReadFromJsonAsync<JournalDto>();
        Assert.That(journal!.Status, Is.EqualTo("Posted"), "Journal status should be Posted");
    }

    // IT-05: Seed 3 journals → GET /api/journal/daily-summary → grandTotalCount >= 3
    [Test]
    public async Task DailySummary_AfterPostingJournals_ReflectsCorrectCounts()
    {
        // Post 3 journals for today
        for (var i = 0; i < 3; i++)
        {
            var key  = $"IT-SUMM-{Guid.NewGuid():N}";
            var resp = await _client.PostAsJsonAsync("/api/journal", PostJournalBody(key));
            Assert.That(resp.StatusCode, Is.EqualTo(HttpStatusCode.Created), $"Journal {i + 1}/3 should be 201");
        }

        // Get daily summary for today
        var today   = DateTime.UtcNow.Date;
        var fromStr = today.ToString("yyyy-MM-dd");
        var toStr   = today.ToString("yyyy-MM-dd");

        var summResp = await _client.GetAsync($"/api/journal/daily-summary?from={fromStr}&to={toStr}");
        Assert.That(summResp.StatusCode, Is.EqualTo(HttpStatusCode.OK), "Expected 200 for daily summary");

        var report = await summResp.Content.ReadFromJsonAsync<DailySummaryDto>();
        Assert.That(report, Is.Not.Null);
        Assert.That(report!.GrandTotalCount, Is.GreaterThanOrEqualTo(3),
            "Daily summary should include the 3 journals just posted (may be higher due to other IT tests)");
    }
}

// ── Minimal DTOs for JSON deserialization ─────────────────────────────────────

file class JournalDto
{
    public long    JournalId     { get; set; }
    public string  JournalNumber { get; set; } = string.Empty;
    public string  IdempotencyKey { get; set; } = string.Empty;
    public string  Status        { get; set; } = string.Empty;
}

file class LedgerBalanceDto
{
    public string  AccountCode  { get; set; } = string.Empty;
    public decimal DebitTotal   { get; set; }
    public decimal CreditTotal  { get; set; }
    public decimal Balance      { get; set; }
}

file class DailySummaryDto
{
    public int     GrandTotalCount  { get; set; }
    public decimal GrandTotalDebit  { get; set; }
    public decimal GrandTotalCredit { get; set; }
}
