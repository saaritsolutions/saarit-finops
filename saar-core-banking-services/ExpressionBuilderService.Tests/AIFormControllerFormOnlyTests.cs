using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ExpressionBuilderService.AI;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ExpressionBuilderService.Tests
{
    // Custom factory to replace IGeminiAIService with a deterministic fake for tests
    public class FormOnlyWebAppFactory : WebApplicationFactory<ExpressionBuilderService.Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                // Remove existing IGeminiAIService registrations
                var descriptors = services.Where(d => d.ServiceType == typeof(IGeminiAIService)).ToList();
                foreach (var d in descriptors)
                {
                    services.Remove(d);
                }

                // Register fake
                services.AddSingleton<IGeminiAIService, FakeGeminiAIService>();
            });
        }
    }

    // Minimal schema model for manipulation in fake service
    internal class TestField
    {
        public string name { get; set; } = string.Empty;
        public string label { get; set; } = string.Empty;
        public string type { get; set; } = "text";
        public bool required { get; set; }
        public string? validationRegex { get; set; }
        public int? maxLength { get; set; }
    }

    internal class TestSchema
    {
        public string entityName { get; set; } = "GeneratedForm";
        public string title { get; set; } = "Generated Form";
        public List<TestField> fields { get; set; } = new();
    }

    internal class FakeGeminiAIService : IGeminiAIService
    {
        public Task<AIExpressionResponse> GenerateExpressionAsync(AIExpressionRequest request)
            => Task.FromResult(new AIExpressionResponse { Explanation = "fake", SuggestedExpression = "true" });

        public Task<string> ExplainExpressionAsync(string expression)
            => Task.FromResult("fake");

        public Task<List<string>> SuggestImprovementsAsync(string expression, string context)
            => Task.FromResult(new List<string> { "fake" });

        public Task<string?> GenerateFormSchemaAsync(AIExpressionRequest request, string? currentSchemaJson = null)
        {
            var schema = string.IsNullOrWhiteSpace(currentSchemaJson)
                ? new TestSchema()
                : JsonSerializer.Deserialize<TestSchema>(currentSchemaJson!) ?? new TestSchema();

            var prompt = (request.UserPrompt ?? string.Empty).ToLowerInvariant();

            // Add fields: capture patterns like name (type[, required])
            if (prompt.Contains("add"))
            {
                foreach (Match m in Regex.Matches(request.UserPrompt, @"(\w+)\s*\(([^)]*)\)", RegexOptions.IgnoreCase))
                {
                    var name = m.Groups[1].Value.Trim();
                    var attrs = m.Groups[2].Value.Trim();
                    var type = "text";
                    var required = false;
                    var maxLength = (int?)null;

                    // very small attribute parser: "text, required", "number", "text, maxLength=12"
                    var parts = attrs.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    foreach (var p in parts)
                    {
                        if (p.Equals("required", StringComparison.OrdinalIgnoreCase)) required = true;
                        else if (p.StartsWith("maxlength", StringComparison.OrdinalIgnoreCase))
                        {
                            var eq = p.IndexOf('=');
                            if (eq > 0 && int.TryParse(p[(eq + 1)..], out var ml)) maxLength = ml;
                        }
                        else type = p.ToLowerInvariant();
                    }

                    // upsert by name
                    var existing = schema.fields.FirstOrDefault(f => f.name.Equals(name, StringComparison.OrdinalIgnoreCase));
                    if (existing == null)
                    {
                        schema.fields.Add(new TestField
                        {
                            name = name,
                            label = System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(name),
                            type = type,
                            required = required,
                            maxLength = maxLength
                        });
                    }
                    else
                    {
                        existing.type = type;
                        existing.required = existing.required || required;
                        existing.maxLength = existing.maxLength ?? maxLength;
                    }
                }
            }

            // Delete/remove fields: e.g., "remove middleName, email"
            if (prompt.Contains("remove") || prompt.Contains("delete"))
            {
                var names = new List<string>();
                var delMatch = Regex.Match(request.UserPrompt, @"(?:remove|delete)\s+([\w,\s]+)", RegexOptions.IgnoreCase);
                if (delMatch.Success)
                {
                    names = delMatch.Groups[1].Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                }
                if (names.Count > 0)
                {
                    schema.fields = schema.fields.Where(f => !names.Any(n => n.Equals(f.name, StringComparison.OrdinalIgnoreCase))).ToList();
                }
            }

            // Modify: "make age required", "set age maxlength 3"
            if (prompt.Contains("make") && prompt.Contains("required"))
            {
                var mm = Regex.Match(request.UserPrompt, @"make\s+(\w+)\s+required", RegexOptions.IgnoreCase);
                if (mm.Success)
                {
                    var name = mm.Groups[1].Value;
                    var f = schema.fields.FirstOrDefault(x => x.name.Equals(name, StringComparison.OrdinalIgnoreCase));
                    if (f != null) f.required = true;
                }
            }
            if (prompt.Contains("maxlength"))
            {
                var mm = Regex.Match(request.UserPrompt, @"(\w+)\s*.*maxlength\s*(?:=|to)?\s*(\d+)", RegexOptions.IgnoreCase);
                if (mm.Success)
                {
                    var name = mm.Groups[1].Value;
                    if (int.TryParse(mm.Groups[2].Value, out var ml))
                    {
                        var f = schema.fields.FirstOrDefault(x => x.name.Equals(name, StringComparison.OrdinalIgnoreCase));
                        if (f != null) f.maxLength = ml;
                    }
                }
            }

            var result = JsonSerializer.Serialize(schema, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            return Task.FromResult<string?>(result);
        }
    }

    public class AIFormControllerFormOnlyTests : IClassFixture<FormOnlyWebAppFactory>
    {
        private readonly HttpClient _client;

        public AIFormControllerFormOnlyTests(FormOnlyWebAppFactory factory)
        {
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task FormOnly_AddTwoFields_ReturnsSchemaWithTwoNewFields()
        {
            var current = new
            {
                entityName = "Customer",
                title = "Customer Onboarding",
                fields = new object[] { new { name = "firstName", label = "First Name", type = "text", required = true } }
            };

            var payload = new
            {
                Message = "Add fields mobileNumber (text, required), dateOfBirth (date)",
                CurrentSchemaJson = JsonSerializer.Serialize(current),
                Category = "form",
                FormOnly = true
            };

            var res = await _client.PostAsync("/api/AIForm/chat", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(body);
            var fields = doc.RootElement.GetProperty("fields");
            var names = fields.EnumerateArray().Select(f => f.GetProperty("name").GetString()).ToList();
            Assert.Contains("mobileNumber", names);
            Assert.Contains("dateOfBirth", names);
        }

        [Fact]
        public async Task FormOnly_AddThreeFields_ReturnsAll()
        {
            var payload = new
            {
                Message = "Add fields panNumber (text, required), income (number), email (text)",
                CurrentSchemaJson = JsonSerializer.Serialize(new { entityName = "KYC", title = "KYC", fields = new object[0] }),
                Category = "form",
                FormOnly = true
            };

            var res = await _client.PostAsync("/api/AIForm/chat", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var names = doc.RootElement.GetProperty("fields").EnumerateArray().Select(f => f.GetProperty("name").GetString()).ToList();
            Assert.Contains("panNumber", names);
            Assert.Contains("income", names);
            Assert.Contains("email", names);
        }

        [Fact]
        public async Task FormOnly_Modify_MakeAgeRequired()
        {
            var current = new
            {
                entityName = "Customer",
                title = "Customer",
                fields = new object[] { new { name = "age", label = "Age", type = "number", required = false } }
            };

            var payload = new
            {
                Message = "Make age required",
                CurrentSchemaJson = JsonSerializer.Serialize(current),
                Category = "form",
                FormOnly = true
            };

            var res = await _client.PostAsync("/api/AIForm/chat", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var age = doc.RootElement.GetProperty("fields").EnumerateArray().First(el => el.GetProperty("name").GetString() == "age");
            Assert.True(age.GetProperty("required").GetBoolean());
        }

        [Fact]
        public async Task FormOnly_DeleteField_RemovesIt()
        {
            var current = new
            {
                entityName = "Customer",
                title = "Customer",
                fields = new object[] { new { name = "firstName", label = "First Name", type = "text", required = true }, new { name = "middleName", label = "Middle Name", type = "text", required = false } }
            };

            var payload = new
            {
                Message = "Remove middleName",
                CurrentSchemaJson = JsonSerializer.Serialize(current),
                Category = "form",
                FormOnly = true
            };

            var res = await _client.PostAsync("/api/AIForm/chat", new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(body);
            var names = doc.RootElement.GetProperty("fields").EnumerateArray().Select(f => f.GetProperty("name").GetString()).ToList();
            Assert.DoesNotContain("middleName", names);
            Assert.Contains("firstName", names);
        }
    }
}
