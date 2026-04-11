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
        var path  = request.RequestUri?.AbsolutePath ?? string.Empty;
        var query = request.RequestUri?.Query        ?? string.Empty;

        // GET /api/expressions -> return active expression(s)
        // Differentiate Validation (eligibility) vs Interest (rate) by query category
        if (request.Method == HttpMethod.Get && path.IndexOf("/api/expressions", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            string json;
            if (query.IndexOf("Interest", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                // Interest-rate expression — returnType=number so decimal deserialization works
                json = "{\"expressions\":[{\"expressionId\":\"EXPR_INTEREST_RATE\",\"returnType\":\"number\",\"updatedAt\":\"2026-04-01T00:00:00Z\"}], \"pagination\":{}}";
            }
            else
            {
                // Eligibility/validation expression — must have updatedAt so the service keeps it
                json = "{\"expressions\":[{\"expressionId\":\"EXPR_CREDIT_CHECK\",\"returnType\":\"string\",\"updatedAt\":\"2026-04-01T00:00:00Z\"}], \"pagination\":{}}";
            }
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }

        // POST to any expression execute endpoint (supports both legacy /api/expressions/execute
        // and the current /api/expression-engine/execute used by ExpressionEvaluationService)
        if (request.Method == HttpMethod.Post && (
            path.IndexOf("/api/Expressions/execute",       StringComparison.OrdinalIgnoreCase) >= 0 ||
            path.IndexOf("/api/expressions/execute",       StringComparison.OrdinalIgnoreCase) >= 0 ||
            path.IndexOf("/api/expression-engine/execute", StringComparison.OrdinalIgnoreCase) >= 0))
        {
            var body = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : string.Empty;

            string  expressionId  = string.Empty;
            int     creditScore   = 0;
            decimal monthlyIncome = 0m;

            try
            {
                using var doc = JsonDocument.Parse(body);

                // Parse ExpressionId (sent by EvaluateExpressionAsync)
                if (doc.RootElement.TryGetProperty("ExpressionId", out var exprIdElem) ||
                    doc.RootElement.TryGetProperty("expressionId", out exprIdElem))
                    expressionId = exprIdElem.GetString() ?? string.Empty;

                // Handle both camelCase and PascalCase variable keys
                if (doc.RootElement.TryGetProperty("Variables", out var vars) ||
                    doc.RootElement.TryGetProperty("variables", out vars))
                {
                    if (vars.TryGetProperty("creditScore", out var cs))               creditScore   = cs.GetInt32();
                    else if (vars.TryGetProperty("customer.creditScore", out var cs2)) creditScore   = cs2.GetInt32();

                    if (vars.TryGetProperty("monthlyIncome", out var mi))              monthlyIncome = mi.GetDecimal();
                    else if (vars.TryGetProperty("customer.monthlyIncome", out var mi2)) monthlyIncome = mi2.GetDecimal();
                }
            }
            catch { /* ignore parse errors - keep defaults */ }

            // Interest-rate expressions return a decimal value; all others return the eligibility string
            if (expressionId.IndexOf("INTEREST", StringComparison.OrdinalIgnoreCase) >= 0 ||
                expressionId.IndexOf("RATE",     StringComparison.OrdinalIgnoreCase) >= 0)
            {
                var rateResp = new
                {
                    Success         = true,
                    Result          = 10.5,   // fixed stub rate — tests only assert on Eligibility, not rate
                    ResultType      = "number",
                    ExecutionTimeMs = 3,
                    ErrorMessage    = (string?)null,
                    ExecutedAt      = DateTime.UtcNow
                };
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(JsonSerializer.Serialize(rateResp), Encoding.UTF8, "application/json")
                };
            }

            string outcome = "REJECTED";
            if (creditScore >= 700 && monthlyIncome >= 15000m) outcome = "APPROVED";
            else if (creditScore >= 650)                        outcome = "MANUAL_REVIEW";

            var resp = new
            {
                Success         = true,
                Result          = outcome,
                ResultType      = "string",
                ExecutionTimeMs = 5,
                ErrorMessage    = (string?)null,
                ExecutedAt      = DateTime.UtcNow
            };

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(resp), Encoding.UTF8, "application/json")
            };
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }
}

// Local minimal fakes for this test file to avoid cross-file coupling
file class FakeWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowInstance { Id = Guid.NewGuid(), EntityId = entityId, WorkflowType = "LOAN_ORIGINATION", Status = "IN_REVIEW" });
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowStepResult { InstanceId = instanceId, Success = true, WorkflowStatus = "IN_REVIEW" });
}

file class FakeForms : IDynamicFormsClient
{
    public Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType)
        => Task.FromResult(new List<DynamicField> { new DynamicField { Id = 1, Name = "fullName" } });
}
