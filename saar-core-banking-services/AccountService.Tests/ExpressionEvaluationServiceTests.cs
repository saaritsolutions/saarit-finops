// SAAR-EXPR-001: Unit tests for ExpressionEvaluationService.CalculateMaintenanceFeeAsync
using System.Net;
using System.Text;
using AccountService.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace AccountService.Tests;

/// <summary>
/// Tests for CalculateMaintenanceFeeAsync — verifies expression evaluation and hard-coded fallbacks.
/// Uses a fake HttpMessageHandler to simulate ExpressionBuilderService responses.
/// </summary>
[TestFixture]
public class ExpressionEvaluationServiceTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds an ExpressionEvaluationService whose HttpClient returns the given
    /// list-response JSON for the first call, and the given execute-response JSON for the second.
    /// </summary>
    private static ExpressionEvaluationService MakeService(
        string listResponseJson, string executeResponseJson)
    {
        var handler = new SequentialHttpHandler(listResponseJson, executeResponseJson);
        var client  = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5004/") };
        return new ExpressionEvaluationService(client, NullLogger<ExpressionEvaluationService>.Instance);
    }

    /// <summary>Builds a service whose HttpClient always throws (simulates service-down scenario).</summary>
    private static ExpressionEvaluationService MakeThrowingService()
    {
        var client = new HttpClient(new ThrowingHttpHandler()) { BaseAddress = new Uri("http://localhost:5004/") };
        return new ExpressionEvaluationService(client, NullLogger<ExpressionEvaluationService>.Instance);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Test]
    public async Task CalculateMaintenanceFeeAsync_ReturnsZero_ForSeniorCitizen()
    {
        // Expression engine returns 0m for SENIOR_CITIZEN segment
        var listJson    = """{"expressions":[{"expressionId":"EXPR_AMC_FEE_UCB","returnType":"decimal","updatedAt":"2026-01-01T00:00:00"}]}""";
        var executeJson = """{"success":true,"result":0.0,"resultType":"decimal","executionTimeMs":1,"executedAt":"2026-01-01T00:00:00"}""";

        var svc = MakeService(listJson, executeJson);
        var fee = await svc.CalculateMaintenanceFeeAsync(
            averageMonthlyBalance:  5000m,
            accountType:            "SAVINGS",
            accountAgeMonths:       12,
            customerSegment:        "SENIOR_CITIZEN",
            minimumBalanceRequired: 10000m);

        Assert.That(fee, Is.EqualTo(0m));
    }

    [Test]
    public async Task CalculateMaintenanceFeeAsync_Returns50_ForRegularSavingsBelowMinBalance()
    {
        // Expression engine returns 50m for REGULAR savings below minimum balance
        var listJson    = """{"expressions":[{"expressionId":"EXPR_AMC_FEE_UCB","returnType":"decimal","updatedAt":"2026-01-01T00:00:00"}]}""";
        var executeJson = """{"success":true,"result":50.0,"resultType":"decimal","executionTimeMs":1,"executedAt":"2026-01-01T00:00:00"}""";

        var svc = MakeService(listJson, executeJson);
        var fee = await svc.CalculateMaintenanceFeeAsync(
            averageMonthlyBalance:  3000m,
            accountType:            "SAVINGS",
            accountAgeMonths:       6,
            customerSegment:        "REGULAR",
            minimumBalanceRequired: 5000m);

        Assert.That(fee, Is.EqualTo(50m));
    }

    [Test]
    public async Task CalculateMaintenanceFeeAsync_FallsBackTo50_WhenNoActiveExpression()
    {
        // List returns empty → no active FeeCalculation expression → fallback
        var listJson    = """{"expressions":[]}""";
        var executeJson = "";   // never called

        var svc = MakeService(listJson, executeJson);
        var fee = await svc.CalculateMaintenanceFeeAsync(
            averageMonthlyBalance:  1000m,
            accountType:            "SAVINGS",
            accountAgeMonths:       3,
            customerSegment:        "REGULAR",
            minimumBalanceRequired: 5000m);

        Assert.That(fee, Is.EqualTo(50m));
    }

    [Test]
    public async Task CalculateMaintenanceFeeAsync_FallsBackTo100_ForCurrentAccountWhenServiceDown()
    {
        // Service throws → fallback to hard-coded ₹100 for CURRENT account
        var svc = MakeThrowingService();
        var fee = await svc.CalculateMaintenanceFeeAsync(
            averageMonthlyBalance:  2000m,
            accountType:            "CURRENT",
            accountAgeMonths:       8,
            customerSegment:        "REGULAR",
            minimumBalanceRequired: 10000m);

        Assert.That(fee, Is.EqualTo(100m));
    }

    [Test]
    public async Task CalculateMaintenanceFeeAsync_FallsBackTo50_ForSavingsAccountWhenServiceDown()
    {
        // Service throws → fallback to hard-coded ₹50 for SAVINGS account
        var svc = MakeThrowingService();
        var fee = await svc.CalculateMaintenanceFeeAsync(
            averageMonthlyBalance:  2000m,
            accountType:            "SAVINGS",
            accountAgeMonths:       8,
            customerSegment:        "REGULAR",
            minimumBalanceRequired: 10000m);

        Assert.That(fee, Is.EqualTo(50m));
    }

    // ── Fake HTTP helpers ─────────────────────────────────────────────────────

    /// <summary>
    /// Returns listJson for the first request (GET /api/expressions)
    /// and executeJson for the second request (POST /api/expression-engine/execute).
    /// </summary>
    private sealed class SequentialHttpHandler : HttpMessageHandler
    {
        private int _callCount;
        private readonly string _listJson;
        private readonly string _executeJson;

        public SequentialHttpHandler(string listJson, string executeJson)
            => (_listJson, _executeJson) = (listJson, executeJson);

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var json = Interlocked.Increment(ref _callCount) == 1 ? _listJson : _executeJson;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
               { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class ThrowingHttpHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
            => throw new HttpRequestException("Simulated connection refused");
    }
}
