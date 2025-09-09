using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using ExpressionBuilderService;
using Xunit;
using System.Linq;
using System.Net.Http;
using System;

namespace ExpressionBuilderService.Tests
{
    public class AIWorkflowControllerTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;

        public AIWorkflowControllerTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task Chat_AddsKycRequiredAction()
        {
            var client = _factory.CreateClient();

            var current = new
            {
                workflowType = "LOAN_ORIGINATION",
                startStep = "KYC",
                steps = new object[]
                {
                    new { name = "KYC", next = "CREDIT_CHECK" },
                    new { name = "CREDIT_CHECK", next = "APPROVAL" },
                    new { name = "APPROVAL", next = "COMPLETED" }
                }
            };

            var payload = new
            {
                message = "Add required action KYC_VERIFY to KYC",
                currentWorkflowJson = JsonSerializer.Serialize(current),
                workflowType = "LOAN_ORIGINATION"
            };

            var jsonBody = JsonSerializer.Serialize(payload);
            var res = await client.PostAsync("/api/AIWorkflow/chat", new StringContent(jsonBody, Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();

            var text = await res.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(text);
            var steps = doc.RootElement.GetProperty("steps");
            var kyc = steps.EnumerateArray().First(e => e.GetProperty("name").GetString()!.Equals("KYC", StringComparison.OrdinalIgnoreCase));
            var actions = kyc.GetProperty("requiredActions").EnumerateArray().Select(x => x.GetString()).ToList();
            Assert.Contains("KYC_VERIFY", actions);
        }
    }
}
