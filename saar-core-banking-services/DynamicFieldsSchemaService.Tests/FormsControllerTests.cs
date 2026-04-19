// SAAR-DFS-001: Unit tests for FormsController + FormSchemaSeedService
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using DynamicFieldsSchemaService.Controllers;
using DynamicFieldsSchemaService.Data;
using DynamicFieldsSchemaService.Models;
using DynamicFieldsSchemaService.Services;

namespace DynamicFieldsSchemaService.Tests;

/// <summary>
/// Unit tests for FormsController.
/// Uses EF Core InMemory database — each test gets its own isolated database.
/// </summary>
[TestFixture]
public class FormsControllerTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static DynamicFormsDbContext MakeDb(string name)
    {
        var opts = new DbContextOptionsBuilder<DynamicFormsDbContext>()
            .UseInMemoryDatabase(name)
            .Options;
        return new DynamicFormsDbContext(opts);
    }

    private static FormsController MakeController(DynamicFormsDbContext db, string tenantId = "public")
    {
        var tenant = new StaticTenantServiceForTests(tenantId);
        return new FormsController(db, tenant, NullLogger<FormsController>.Instance);
    }

    private static FormSchema SeedSchema(DynamicFormsDbContext db, string formType,
        string tenantId = "public", string schemaJson = """{"title":"Test"}""",
        bool isDefault = true)
    {
        var schema = new FormSchema
        {
            FormType  = formType,
            TenantId  = tenantId,
            Version   = 1,
            SchemaJson = schemaJson,
            IsActive  = true,
            IsDefault = isDefault,
            CreatedBy = "seed"
        };
        db.FormSchemas.Add(schema);
        db.SaveChanges();
        return schema;
    }

    private static string ValidPersonalLoanSchema => """
        {
          "title": "Personal Loan",
          "fields": [
            { "name": "fullName",     "label": "Full Name",     "type": "text",   "required": true, "maxLength": 100 },
            { "name": "loanAmount",   "label": "Loan Amount",   "type": "number", "required": true, "min": 50000, "max": 5000000 },
            { "name": "panNumber",    "label": "PAN Number",    "type": "text",   "required": true, "validationRegex": "^[A-Z]{5}[0-9]{4}[A-Z]$" }
          ]
        }
        """;

    // ── Tests ─────────────────────────────────────────────────────────────────

    [Test]
    public async Task GetSchema_ReturnsTenantSchema_WhenTenantOverrideExists()
    {
        using var db = MakeDb(nameof(GetSchema_ReturnsTenantSchema_WhenTenantOverrideExists));
        SeedSchema(db, "PERSONAL_LOAN", "public",   """{"title":"Default"}""");
        SeedSchema(db, "PERSONAL_LOAN", "ucb_demo", """{"title":"UCB Override"}""", isDefault: false);

        var ctrl   = MakeController(db, "ucb_demo");
        var result = await ctrl.GetSchema("PERSONAL_LOAN");
        var ok     = result.Result as OkObjectResult;

        Assert.That(ok, Is.Not.Null);
        var response = ok!.Value as FormSchemaResponse;
        Assert.That(response!.Schema, Does.Contain("UCB Override"));
        Assert.That(response.TenantId, Is.EqualTo("ucb_demo"));
    }

    [Test]
    public async Task GetSchema_FallsBackToPublicDefault_WhenNoTenantOverride()
    {
        using var db = MakeDb(nameof(GetSchema_FallsBackToPublicDefault_WhenNoTenantOverride));
        SeedSchema(db, "PERSONAL_LOAN", "public", """{"title":"Public Default"}""");

        var ctrl   = MakeController(db, "ucb_demo"); // ucb_demo has NO override
        var result = await ctrl.GetSchema("PERSONAL_LOAN");
        var ok     = result.Result as OkObjectResult;

        Assert.That(ok, Is.Not.Null);
        var response = ok!.Value as FormSchemaResponse;
        Assert.That(response!.Schema, Does.Contain("Public Default"));
        Assert.That(response.TenantId, Is.EqualTo("public")); // returned from public fallback
    }

    [Test]
    public async Task GetSchema_Returns404_WhenFormTypeUnknown()
    {
        using var db     = MakeDb(nameof(GetSchema_Returns404_WhenFormTypeUnknown));
        var ctrl         = MakeController(db, "public");
        var result       = await ctrl.GetSchema("NONEXISTENT_FORM");
        var notFound     = result.Result as NotFoundObjectResult;

        Assert.That(notFound, Is.Not.Null);
    }

    [Test]
    public async Task GetSchema_IsCaseInsensitive_ForFormType()
    {
        using var db = MakeDb(nameof(GetSchema_IsCaseInsensitive_ForFormType));
        SeedSchema(db, "PERSONAL_LOAN", "public", """{"title":"Loan"}""");

        var ctrl   = MakeController(db, "public");
        var result = await ctrl.GetSchema("personal_loan"); // lowercase input
        var ok     = result.Result as OkObjectResult;

        Assert.That(ok, Is.Not.Null);
    }

    [Test]
    public async Task SaveSchema_IncrementsVersion_WhenUpdated()
    {
        using var db = MakeDb(nameof(SaveSchema_IncrementsVersion_WhenUpdated));
        SeedSchema(db, "PERSONAL_LOAN", "ucb_demo", """{"title":"v1"}""", isDefault: false);

        var ctrl = MakeController(db, "ucb_demo");
        SetUser(ctrl, "admin@ucb-demo.com");

        var result = await ctrl.SaveSchema("PERSONAL_LOAN",
            new SaveSchemaRequest { Schema = """{"title":"v2 updated"}""", Notes = "Changed title" });
        var ok = result.Result as OkObjectResult;

        Assert.That(ok, Is.Not.Null);
        var response = ok!.Value as FormSchemaResponse;
        Assert.That(response!.Version, Is.EqualTo(2));
        Assert.That(response.Schema, Does.Contain("v2 updated"));
    }

    [Test]
    public async Task SaveSchema_DeactivatesPreviousVersion_OnUpdate()
    {
        using var db = MakeDb(nameof(SaveSchema_DeactivatesPreviousVersion_OnUpdate));
        var old = SeedSchema(db, "PERSONAL_LOAN", "ucb_demo", """{"title":"old"}""", isDefault: false);

        var ctrl = MakeController(db, "ucb_demo");
        SetUser(ctrl, "admin@ucb-demo.com");

        await ctrl.SaveSchema("PERSONAL_LOAN",
            new SaveSchemaRequest { Schema = """{"title":"new"}""" });

        // The old schema must be inactive
        db.Entry(old).Reload();
        Assert.That(old.IsActive, Is.False);

        // Exactly one active schema for this (FormType, TenantId)
        var activeCount = db.FormSchemas
            .Count(s => s.FormType == "PERSONAL_LOAN" && s.TenantId == "ucb_demo" && s.IsActive);
        Assert.That(activeCount, Is.EqualTo(1));
    }

    [Test]
    public async Task SaveSchema_AppendsToHistory_WhenUpdated()
    {
        using var db = MakeDb(nameof(SaveSchema_AppendsToHistory_WhenUpdated));
        SeedSchema(db, "PERSONAL_LOAN", "ucb_demo", """{"title":"v1"}""", isDefault: false);

        var ctrl = MakeController(db, "ucb_demo");
        SetUser(ctrl, "admin@ucb-demo.com");

        await ctrl.SaveSchema("PERSONAL_LOAN",
            new SaveSchemaRequest { Schema = """{"title":"v2"}""" });

        var historyCount = db.FormSchemaHistories
            .Count(h => h.FormType == "PERSONAL_LOAN" && h.TenantId == "ucb_demo");
        Assert.That(historyCount, Is.EqualTo(1)); // old version archived
    }

    [Test]
    public async Task ValidateForm_ReturnsValid_ForCompleteCorrectData()
    {
        using var db = MakeDb(nameof(ValidateForm_ReturnsValid_ForCompleteCorrectData));
        SeedSchema(db, "PERSONAL_LOAN", "public", ValidPersonalLoanSchema);

        var ctrl = MakeController(db, "public");
        var data = new Dictionary<string, JsonElement>
        {
            ["fullName"]  = ParseValue("\"Ramesh Kumar\""),
            ["loanAmount"]= ParseValue("100000"),
            ["panNumber"] = ParseValue("\"ABCDE1234F\"")
        };

        var result = await ctrl.ValidateForm(new ValidateFormRequest { FormType = "PERSONAL_LOAN", Data = data });
        var ok     = result.Result as OkObjectResult;
        var resp   = ok!.Value as ValidateFormResponse;

        Assert.That(resp!.IsValid, Is.True);
        Assert.That(resp.Errors, Is.Empty);
    }

    [Test]
    public async Task ValidateForm_ReturnsRequiredError_WhenFieldMissing()
    {
        using var db = MakeDb(nameof(ValidateForm_ReturnsRequiredError_WhenFieldMissing));
        SeedSchema(db, "PERSONAL_LOAN", "public", ValidPersonalLoanSchema);

        var ctrl = MakeController(db, "public");
        // panNumber is omitted — required field
        var data = new Dictionary<string, JsonElement>
        {
            ["fullName"]  = ParseValue("\"Ramesh Kumar\""),
            ["loanAmount"]= ParseValue("100000")
        };

        var result = await ctrl.ValidateForm(new ValidateFormRequest { FormType = "PERSONAL_LOAN", Data = data });
        var ok     = result.Result as OkObjectResult;
        var resp   = ok!.Value as ValidateFormResponse;

        Assert.That(resp!.IsValid, Is.False);
        Assert.That(resp.Errors.Any(e => e.Field == "panNumber"), Is.True);
    }

    [Test]
    public async Task ValidateForm_ReturnsRangeError_WhenBelowMin()
    {
        using var db = MakeDb(nameof(ValidateForm_ReturnsRangeError_WhenBelowMin));
        SeedSchema(db, "PERSONAL_LOAN", "public", ValidPersonalLoanSchema);

        var ctrl = MakeController(db, "public");
        var data = new Dictionary<string, JsonElement>
        {
            ["fullName"]  = ParseValue("\"Ramesh Kumar\""),
            ["loanAmount"]= ParseValue("1000"),  // below min 50000
            ["panNumber"] = ParseValue("\"ABCDE1234F\"")
        };

        var result = await ctrl.ValidateForm(new ValidateFormRequest { FormType = "PERSONAL_LOAN", Data = data });
        var ok     = result.Result as OkObjectResult;
        var resp   = ok!.Value as ValidateFormResponse;

        Assert.That(resp!.IsValid, Is.False);
        Assert.That(resp.Errors.Any(e => e.Field == "loanAmount" && e.Message.Contains("at least")), Is.True);
    }

    [Test]
    public async Task ValidateForm_ReturnsRegexError_WhenPanFormatInvalid()
    {
        using var db = MakeDb(nameof(ValidateForm_ReturnsRegexError_WhenPanFormatInvalid));
        SeedSchema(db, "PERSONAL_LOAN", "public", ValidPersonalLoanSchema);

        var ctrl = MakeController(db, "public");
        var data = new Dictionary<string, JsonElement>
        {
            ["fullName"]  = ParseValue("\"Ramesh Kumar\""),
            ["loanAmount"]= ParseValue("100000"),
            ["panNumber"] = ParseValue("\"INVALID-PAN\"") // fails PAN regex
        };

        var result = await ctrl.ValidateForm(new ValidateFormRequest { FormType = "PERSONAL_LOAN", Data = data });
        var ok     = result.Result as OkObjectResult;
        var resp   = ok!.Value as ValidateFormResponse;

        Assert.That(resp!.IsValid, Is.False);
        Assert.That(resp.Errors.Any(e => e.Field == "panNumber" && e.Message.Contains("invalid")), Is.True);
    }

    [Test]
    public async Task ValidateForm_ReturnsUnknownFieldWarning_ForExtraFields()
    {
        using var db = MakeDb(nameof(ValidateForm_ReturnsUnknownFieldWarning_ForExtraFields));
        SeedSchema(db, "PERSONAL_LOAN", "public", ValidPersonalLoanSchema);

        var ctrl = MakeController(db, "public");
        var data = new Dictionary<string, JsonElement>
        {
            ["fullName"]    = ParseValue("\"Ramesh Kumar\""),
            ["loanAmount"]  = ParseValue("100000"),
            ["panNumber"]   = ParseValue("\"ABCDE1234F\""),
            ["unknownField"]= ParseValue("\"mystery value\"") // unknown
        };

        var result = await ctrl.ValidateForm(new ValidateFormRequest { FormType = "PERSONAL_LOAN", Data = data });
        var ok     = result.Result as OkObjectResult;
        var resp   = ok!.Value as ValidateFormResponse;

        Assert.That(resp!.IsValid, Is.True); // warnings don't invalidate
        Assert.That(resp.Warnings.Any(w => w.Contains("unknownField")), Is.True);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static JsonElement ParseValue(string json)
        => JsonDocument.Parse(json).RootElement.Clone();

    private static void SetUser(ControllerBase ctrl, string name)
    {
        var identity = new System.Security.Claims.ClaimsIdentity(
            new[] { new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, name) },
            "test");
        ctrl.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new System.Security.Claims.ClaimsPrincipal(identity)
            }
        };
    }
}

/// <summary>Test-only tenant stub — returns a fixed tenant ID.</summary>
internal class StaticTenantServiceForTests : DynamicFieldsSchemaService.Services.ITenantService
{
    public StaticTenantServiceForTests(string tenantId) => TenantId = tenantId;
    public string TenantId { get; }
}
