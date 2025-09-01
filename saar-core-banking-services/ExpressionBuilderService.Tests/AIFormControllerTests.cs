using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using ExpressionBuilderService;
using Xunit;

namespace ExpressionBuilderService.Tests
{
    public class AIFormControllerTests : IClassFixture<WebApplicationFactory<ExpressionBuilderService.Program>>
    {
        private readonly WebApplicationFactory<ExpressionBuilderService.Program> _factory;

        public AIFormControllerTests(WebApplicationFactory<ExpressionBuilderService.Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task ChatForm_ShouldReturnAadharSuggestion()
        {
            var client = _factory.CreateClient();
            var payload = JsonSerializer.Serialize(new { Message = "Add Aadhar field" });
            var res = await client.PostAsync("/api/AIForm/chat", new StringContent(payload, Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();
            Assert.Contains("aadhar", body.ToLower());
        }

        [Fact]
        public async Task ApplySuggestion_WritesFile()
        {
            var client = _factory.CreateClient();
            var suggestion = new
            {
                Explanation = "test",
                SuggestedFields = new[] { new { Name = "aadharNumber", Label = "Aadhar Number", Type = "text", Required = true, ValidationRegex = "^[0-9]{12}$" } },
                SchemaJson = "{\"fields\":[]}",
                Confidence = "high",
                IsValid = true,
                Transcript = "Add Aadhar field"
            };

            var payload = JsonSerializer.Serialize(suggestion);
            var res = await client.PostAsync("/api/AIForm/apply", new StringContent(payload, Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadAsStringAsync();
            Assert.Contains("success", body.ToLower());
        }
    }
}
