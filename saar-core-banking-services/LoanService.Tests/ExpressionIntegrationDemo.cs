using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Services;

namespace LoanService.Tests;

public class ExpressionIntegrationDemo
{
    [Test]
    public async Task PreValidate_calls_expression_service_and_applies_credit_rule_demo()
    {
        // Arrange: stubbed HTTP handler to simulate ExpressionBuilderService
        var handler = new StubHttpMessageHandler();
        var client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost:5004") };
        var exprService = new ExpressionEvaluationService(client, new NullLogger<ExpressionEvaluationService>());

        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-demo-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new System.Collections.Generic.Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "true"
        }).Build();

        var sut = new LoanOriginationController(db, exprService, new FakeWorkflow(), new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        // Demo 1: borderline -> MANUAL_REVIEW
        var req = new PreValidateRequest
        {
            CustomerId = "DEMO1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 50000,
            TenureMonths = 12,
            MonthlyIncome = 14000, // below income threshold for auto-approval
            CreditScore = 690,
            DebtToIncomeRatio = 0.3m
        };

        var pre = await sut.PreValidate(req);
        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Console.WriteLine($"Demo1 -> CreditScore={req.CreditScore}, MonthlyIncome={req.MonthlyIncome} => Eligibility={body!.Eligibility}, InterestRate={body.InterestRate}");
        Assert.That(body!.Eligibility, Is.EqualTo("MANUAL_REVIEW"));

        // Demo 2: approved case
        req.CreditScore = 720;
        req.MonthlyIncome = 20000;

        pre = await sut.PreValidate(req);
        ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Console.WriteLine($"Demo2 -> CreditScore={req.CreditScore}, MonthlyIncome={req.MonthlyIncome} => Eligibility={body!.Eligibility}, InterestRate={body.InterestRate}");
        Assert.That(body!.Eligibility, Is.EqualTo("APPROVED"));
    }
}

// Simple stub handler that simulates ExpressionBuilder list and execute endpoints
internal class StubHttpMessageHandler : HttpMessageHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var path = request.RequestUri?.AbsolutePath ?? string.Empty;

        // GET /api/expressions -> return a single active validation expression id
        if (request.Method == HttpMethod.Get && path.IndexOf("/api/expressions", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            var json = "{\"expressions\":[{\"expressionId\":\"EXPR_CREDIT_CHECK\"}], \"pagination\":{}}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }

        // POST /api/Expressions/execute or /api/expressions/execute -> simulate execution using Variables
        if (request.Method == HttpMethod.Post && (path.IndexOf("/api/Expressions/execute", StringComparison.OrdinalIgnoreCase) >= 0 || path.IndexOf("/api/expressions/execute", StringComparison.OrdinalIgnoreCase) >= 0))
        {
            var body = await request.Content.ReadAsStringAsync(cancellationToken);
            int creditScore = 0;
            decimal monthlyIncome = 0m;

            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("Variables", out var vars))
                {
                    if (vars.TryGetProperty("creditScore", out var cs)) creditScore = cs.GetInt32();
                    else if (vars.TryGetProperty("customer.creditScore", out var cs2)) creditScore = cs2.GetInt32();

                    if (vars.TryGetProperty("monthlyIncome", out var mi)) monthlyIncome = mi.GetDecimal();
                    else if (vars.TryGetProperty("customer.monthlyIncome", out var mi2)) monthlyIncome = mi2.GetDecimal();
                }
            }
            catch { /* ignore parse errors - keep defaults */ }

            string outcome = "REJECTED";
            if (creditScore >= 700 && monthlyIncome >= 15000m) outcome = "APPROVED";
            else if (creditScore >= 650) outcome = "MANUAL_REVIEW";

            var resp = new
            {
                Success = true,
                Result = outcome,
                ResultType = "string",
                ExecutionTimeMs = 5,
                ErrorMessage = (string?)null,
                ExecutedAt = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(resp);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }
}
