using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using LoanService.Controllers;
using LoanService.Data;
using LoanService.Services;
using System.Text.Json;
using System.IO;

namespace LoanService.Tests;

public class Tests
{
    [SetUp]
    public void Setup() { }

    [Test]
    public async Task PreValidate_and_Submit_work_with_feature_flags_disabled()
    {
        // Arrange in-memory db
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        // Fake services
        var expr = new FakeExpressions();
        var wf = new FakeWorkflow();
        var forms = new FakeForms();

        // Config with all flags disabled
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false"
            })
            .Build();

        var sut = new LoanOriginationController(db, expr, wf, forms, new NullLogger<LoanOriginationController>(), cfg);

        // Act: PreValidate (should use hardcoded path)
    var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "C1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 100000,
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

    var preOk = pre.Result as OkObjectResult;
    Assert.That(preOk, Is.Not.Null);
    var preBody = preOk!.Value as PreValidateResponse;
    Assert.That(preBody, Is.Not.Null);
    Assert.That(preBody!.Eligibility, Is.EqualTo("APPROVED"));
    Assert.That(preBody!.InterestRate, Is.GreaterThan(0));

        // Act: Submit (creates LoanApplication and pseudo workflow id)
    var submit = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "C1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 100000,
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var submitOk = submit.Result as OkObjectResult;
        Assert.That(submitOk, Is.Not.Null);
    var resp = submitOk!.Value as SubmitApplicationResponse;
        Assert.That(resp, Is.Not.Null);
        Assert.That(resp!.ApplicationId, Is.Not.EqualTo(Guid.Empty));
        Assert.That(resp!.WorkflowInstanceId, Is.EqualTo(resp!.ApplicationId));
        Assert.That(resp!.InterestRate, Is.GreaterThan(0));
    }

    [Test]
    public async Task PreValidate_with_dynamic_forms_returns_400_on_schema_violation()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-dyn-bad-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "true",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        var forms = new FakeFormsWithSchema(new List<DynamicField>
        {
            new DynamicField { Name = "loanAmount", Required = true, Min = 10000 },
            new DynamicField { Name = "tenureMonths", Required = true, Min = 6 },
            new DynamicField { Name = "creditScore", Required = true, Min = 300, Max = 900 },
        });

        var sut = new LoanOriginationController(db, new FakeExpressions(), new FakeWorkflow(), forms, new NullLogger<LoanOriginationController>(), cfg);

        // Act: loanAmount below min should trigger 400 with errors
        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "DYN1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 5000, // < 10000
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var bad = pre.Result as ObjectResult;
        Assert.That(bad, Is.Not.Null);
        Assert.That(bad!.StatusCode, Is.EqualTo(400));

        var json = JsonSerializer.Serialize(bad.Value);
        var env = JsonSerializer.Deserialize<ErrorsEnvelope>(json);
        Assert.That(env, Is.Not.Null);
        Assert.That(env!.errors, Is.Not.Null);
        Assert.That(env!.errors!.Any(e => e.Contains("loanAmount must be >=")), Is.True);
    }

    [Test]
    public async Task PreValidate_with_dynamic_forms_accepts_valid_input()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-dyn-good-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "true",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        var forms = new FakeFormsWithSchema(new List<DynamicField>
        {
            new DynamicField { Name = "loanAmount", Required = true, Min = 10000 },
            new DynamicField { Name = "tenureMonths", Required = true, Min = 6 },
            new DynamicField { Name = "creditScore", Required = true, Min = 300, Max = 900 },
        });

        var sut = new LoanOriginationController(db, new FakeExpressions(), new FakeWorkflow(), forms, new NullLogger<LoanOriginationController>(), cfg);

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "DYN2",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 20000, // valid
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Eligibility, Is.EqualTo("APPROVED")); // hardcoded path since expressions disabled
        Assert.That(body!.InterestRate, Is.GreaterThan(0));
    }

    [Test]
    public async Task PreValidate_dynamic_forms_fallbacks_to_static_schema_when_service_fails()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-dyn-fallback-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "true",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        // Ensure static schema exists in AppContext.BaseDirectory for TEST_LOAN
        var baseDir = AppContext.BaseDirectory;
        var staticDir = Path.Combine(baseDir, "Static");
        Directory.CreateDirectory(staticDir);
        var staticPath = Path.Combine(staticDir, "loan_form_TEST_LOAN.json");
        var staticJson = """
        {
          "productType": "TEST_LOAN",
          "title": "Test Loan Application",
          "fields": [
            { "name": "loanAmount", "label": "Loan Amount", "type": "number", "required": true, "min": 10000 }
          ]
        }
        """;
        await File.WriteAllTextAsync(staticPath, staticJson);

        var forms = new FakeFormsThrow();
        var sut = new LoanOriginationController(db, new FakeExpressions(), new FakeWorkflow(), forms, new NullLogger<LoanOriginationController>(), cfg);

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "DYN3",
            ProductType = "TEST_LOAN",
            LoanAmount = 5000, // violates static min 10000
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var bad = pre.Result as ObjectResult;
        Assert.That(bad, Is.Not.Null);
        Assert.That(bad!.StatusCode, Is.EqualTo(400));
        var json = JsonSerializer.Serialize(bad.Value);
        var env = JsonSerializer.Deserialize<ErrorsEnvelope>(json);
        Assert.That(env, Is.Not.Null);
        Assert.That(env!.errors, Is.Not.Null);
        Assert.That(env!.errors!.Any(e => e.Contains("loanAmount must be >=")), Is.True);
    }

    [Test]
    public async Task Submit_with_dynamic_forms_returns_400_on_schema_violation()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-dyn-submit-bad-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "true",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        var forms = new FakeFormsWithSchema(new List<DynamicField>
        {
            new DynamicField { Name = "loanAmount", Required = true, Min = 10000 },
        });

        var sut = new LoanOriginationController(db, new FakeExpressions(), new FakeWorkflow(), forms, new NullLogger<LoanOriginationController>(), cfg);

        var submit = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "DYN4",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 9999, // invalid per schema
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var bad = submit.Result as ObjectResult;
        Assert.That(bad, Is.Not.Null);
        Assert.That(bad!.StatusCode, Is.EqualTo(400));
        var json = JsonSerializer.Serialize(bad.Value);
        var env = JsonSerializer.Deserialize<ErrorsEnvelope>(json);
        Assert.That(env, Is.Not.Null);
        Assert.That(env!.errors, Is.Not.Null);
        Assert.That(env!.errors!.Any(e => e.Contains("loanAmount must be >=")), Is.True);
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(0));
    }

    [Test]
    public async Task PreValidate_with_expressions_enabled_APPROVED_returns_rate_from_engine()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-expr-pre-approve-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "true"
        }).Build();

        var expr = new FakeExpressionsPhase4("APPROVED", 7.77m);
        var sut = new LoanOriginationController(db, expr, new FakeWorkflow(), new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "E1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 200000,
            TenureMonths = 24,
            MonthlyIncome = 30000,
            CreditScore = 710,
            DebtToIncomeRatio = 0.2m
        });

        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Eligibility, Is.EqualTo("APPROVED"));
        Assert.That(body!.InterestRate, Is.EqualTo(7.77m));
    }

    [Test]
    public async Task PreValidate_with_expressions_enabled_MANUAL_REVIEW_returns_null_rate()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-expr-pre-manual-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "true"
        }).Build();

        var expr = new FakeExpressionsPhase4("MANUAL_REVIEW", 8.88m);
        var sut = new LoanOriginationController(db, expr, new FakeWorkflow(), new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "E2",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 100000,
            TenureMonths = 12,
            MonthlyIncome = 10000,
            CreditScore = 650,
            DebtToIncomeRatio = 0.4m
        });

        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Eligibility, Is.EqualTo("MANUAL_REVIEW"));
        Assert.That(body!.InterestRate, Is.Null);
    }

    [Test]
    public async Task Submit_with_expressions_enabled_REJECTED_does_not_persist()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-expr-submit-reject-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "true"
        }).Build();

        var expr = new FakeExpressionsPhase4("REJECTED", 9.99m);
        var sut = new LoanOriginationController(db, expr, new FakeWorkflow(), new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "E3",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 50000,
            TenureMonths = 12,
            MonthlyIncome = 9000,
            CreditScore = 580,
            DebtToIncomeRatio = 0.6m
        });

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Status, Is.EqualTo("REJECTED"));
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(0));
    }

    [Test]
    public async Task Submit_with_expressions_enabled_APPROVED_sets_rate_from_engine()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-expr-submit-approve-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "false",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "true"
        }).Build();

        var expr = new FakeExpressionsPhase4("APPROVED", 6.5m);
        var sut = new LoanOriginationController(db, expr, new FakeWorkflow(), new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "E4",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 120000,
            TenureMonths = 24,
            MonthlyIncome = 30000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.25m
        });

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Status, Is.EqualTo("IN_REVIEW")); // pseudo-workflow when workflow disabled
        Assert.That(body!.InterestRate, Is.EqualTo(6.5m));
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(1));
    }

    [Test]
    public async Task Submit_with_workflow_enabled_returns_engine_status_and_id()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-wf-ok-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var wfOk = new FakeWorkflowEngineOk();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "true",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        var sut = new LoanOriginationController(db, new FakeExpressions(), wfOk, new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "CW1",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 100000,
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.WorkflowInstanceId, Is.EqualTo(FakeWorkflowEngineOk.InstanceId));
        Assert.That(body!.Status, Is.EqualTo("IN_REVIEW")); // Adopted from engine in fake
    }

    [Test]
    public async Task Submit_with_workflow_enabled_returns_503_on_engine_failure()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-wf-fail-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var wfFail = new FakeWorkflowEngineFail();
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FeatureFlags:EnableWorkflow"] = "true",
            ["FeatureFlags:EnableDynamicForms"] = "false",
            ["FeatureFlags:EnableExpressions"] = "false"
        }).Build();

        var sut = new LoanOriginationController(db, new FakeExpressions(), wfFail, new FakeForms(), new NullLogger<LoanOriginationController>(), cfg);

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "CW2",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 100000,
            TenureMonths = 12,
            MonthlyIncome = 20000,
            CreditScore = 720,
            DebtToIncomeRatio = 0.3m
        });

        var obj = result.Result as ObjectResult;
        Assert.That(obj, Is.Not.Null);
        Assert.That(obj!.StatusCode, Is.EqualTo(503));
        var body = obj.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Status, Is.EqualTo("ERROR"));
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(1)); // persisted before workflow call
    }

    [Test]
    public async Task PreValidate_returns_REJECTED_and_null_rate_when_low_score()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-reject-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var sut = new LoanOriginationController(
            db,
            new FakeExpressions(),
            new FakeWorkflow(),
            new FakeForms(),
            new NullLogger<LoanOriginationController>(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false"
            }).Build());

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "C2",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 50000,
            TenureMonths = 24,
            MonthlyIncome = 10000, // below threshold
            CreditScore = 600,      // < 650 means REJECTED
            DebtToIncomeRatio = 0.5m
        });

        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Eligibility, Is.EqualTo("REJECTED"));
        Assert.That(body!.InterestRate, Is.Null);
    }

    [Test]
    public async Task PreValidate_returns_MANUAL_REVIEW_and_null_rate_when_borderline()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-manual-pre-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var sut = new LoanOriginationController(
            db,
            new FakeExpressions(),
            new FakeWorkflow(),
            new FakeForms(),
            new NullLogger<LoanOriginationController>(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false"
            }).Build());

        var pre = await sut.PreValidate(new PreValidateRequest
        {
            CustomerId = "C3",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 75000,
            TenureMonths = 18,
            MonthlyIncome = 12000, // below 15000 so not APPROVED
            CreditScore = 660,      // >= 650 so MANUAL_REVIEW
            DebtToIncomeRatio = 0.3m
        });

        var ok = pre.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as PreValidateResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Eligibility, Is.EqualTo("MANUAL_REVIEW"));
        Assert.That(body!.InterestRate, Is.Null);
    }

    [Test]
    public async Task Submit_sets_MANUAL_REVIEW_status_and_persists_when_borderline()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-manual-submit-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var sut = new LoanOriginationController(
            db,
            new FakeExpressions(),
            new FakeWorkflow(),
            new FakeForms(),
            new NullLogger<LoanOriginationController>(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false"
            }).Build());

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "C4",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 75000,
            TenureMonths = 18,
            MonthlyIncome = 12000, // below 15000
            CreditScore = 660,      // >= 650
            DebtToIncomeRatio = 0.3m
        });

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Status, Is.EqualTo("MANUAL_REVIEW"));
        Assert.That(body!.ApplicationId, Is.Not.EqualTo(Guid.Empty));
        Assert.That(body!.WorkflowInstanceId, Is.EqualTo(body!.ApplicationId));
        Assert.That(body!.InterestRate, Is.GreaterThan(0));
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(1));
    }

    [Test]
    public async Task Submit_returns_REJECTED_and_does_not_persist()
    {
        var options = new DbContextOptionsBuilder<LoanDbContext>()
            .UseInMemoryDatabase(databaseName: $"loan-tests-reject-submit-{Guid.NewGuid()}")
            .Options;
        await using var db = new LoanDbContext(options);

        var sut = new LoanOriginationController(
            db,
            new FakeExpressions(),
            new FakeWorkflow(),
            new FakeForms(),
            new NullLogger<LoanOriginationController>(),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false"
            }).Build());

        var result = await sut.Submit(new SubmitApplicationRequest
        {
            CustomerId = "C5",
            ProductType = "PERSONAL_LOAN",
            LoanAmount = 50000,
            TenureMonths = 12,
            MonthlyIncome = 9000,
            CreditScore = 600,
            DebtToIncomeRatio = 0.55m
        });

        var ok = result.Result as OkObjectResult;
        Assert.That(ok, Is.Not.Null);
        var body = ok!.Value as SubmitApplicationResponse;
        Assert.That(body, Is.Not.Null);
        Assert.That(body!.Status, Is.EqualTo("REJECTED"));
        Assert.That(await db.LoanApplications.CountAsync(), Is.EqualTo(0));
    }
}

// Minimal fakes to satisfy controller deps
file class FakeExpressions : IExpressionEvaluationService
{
    public Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext)
        => Task.FromResult(10m);
    public Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context)
        => Task.FromResult((T)(object)"APPROVED");
    public Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData)
        => Task.FromResult("APPROVED");
}

file class FakeWorkflow : IWorkflowClient
{
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowStepResult { InstanceId = instanceId, Success = true });
    public Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowInstance { Id = Guid.NewGuid(), EntityId = entityId, WorkflowType = "LOAN_ORIGINATION" });
}

file class FakeForms : IDynamicFormsClient
{
    public Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType)
        => Task.FromResult(new List<DynamicField> { new DynamicField { Id = 1, Name = "fullName" } });
}

file class FakeFormsWithSchema : IDynamicFormsClient
{
    private readonly List<DynamicField> _schema;
    public FakeFormsWithSchema(List<DynamicField> schema) { _schema = schema; }
    public Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType) => Task.FromResult(_schema);
}

file class FakeFormsThrow : IDynamicFormsClient
{
    public Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType) => throw new Exception("forms service down");
}

file class ErrorsEnvelope
{
    public List<string>? errors { get; set; }
}

file class FakeWorkflowEngineOk : IWorkflowClient
{
    public static readonly Guid InstanceId = Guid.NewGuid();
    public Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowInstance
        {
            Id = InstanceId,
            EntityId = entityId,
            WorkflowType = "LOAN_ORIGINATION",
            Status = "IN_REVIEW"
        });

    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => Task.FromResult(new WorkflowStepResult { InstanceId = instanceId, Success = true, WorkflowStatus = "IN_REVIEW" });
}

file class FakeWorkflowEngineFail : IWorkflowClient
{
    public Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        => throw new Exception("Engine unavailable");

    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        => throw new Exception("Engine unavailable");
}

file class FakeExpressionsPhase4 : IExpressionEvaluationService
{
    private readonly string _eligibility;
    private readonly decimal _rate;
    public FakeExpressionsPhase4(string eligibility, decimal rate) { _eligibility = eligibility; _rate = rate; }
    public Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context)
        => Task.FromResult(default(T)!);
    public Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData)
        => Task.FromResult(_eligibility);
    public Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext)
        => Task.FromResult(_rate);
}