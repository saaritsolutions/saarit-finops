using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using FluentAssertions;
using NUnit.Framework;

namespace LoanService.IntegrationTests;

[TestFixture]
public class LoanOriginationIntegrationTests
{
    private CustomWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new CustomWebApplicationFactory();
        _client = _factory.CreateClient();
    }

    [TearDown]
    public void TearDown()
    {
        _client?.Dispose();
        _factory?.Dispose();
    }

    [Test]
    public async Task PreValidate_returns_approved_with_rate_when_flags_off_uses_fallback_rules()
    {
        var req = new {
            customerId = "I1",
            productType = "PERSONAL_LOAN",
            loanAmount = 100000,
            tenureMonths = 12,
            monthlyIncome = 20000,
            creditScore = 720,
            debtToIncomeRatio = 0.3
        };

        var resp = await _client.PostAsJsonAsync("/api/LoanOrigination/pre-validate", req);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<PreValidateDto>();
        body.Should().NotBeNull();
        body!.eligibility.Should().Be("APPROVED");
        body!.interestRate.Should().BeGreaterThan(0);
    }

    [Test]
    public async Task Submit_persists_and_returns_in_review_when_workflow_disabled()
    {
        var req = new {
            customerId = "I2",
            productType = "PERSONAL_LOAN",
            loanAmount = 100000,
            tenureMonths = 12,
            monthlyIncome = 20000,
            creditScore = 720,
            debtToIncomeRatio = 0.3
        };

        var resp = await _client.PostAsJsonAsync("/api/LoanOrigination/submit", req);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<SubmitDto>();
        body.Should().NotBeNull();
        body!.status.Should().Be("IN_REVIEW");
        body!.applicationId.Should().NotBeEmpty();
        body!.workflowInstanceId.Should().NotBeEmpty();
        body!.interestRate.Should().BeGreaterThan(0);
    }
}

file class PreValidateDto { public string eligibility { get; set; } = string.Empty; public decimal? interestRate { get; set; } }
file class SubmitDto { public string status { get; set; } = string.Empty; public Guid applicationId { get; set; } public Guid workflowInstanceId { get; set; } public decimal interestRate { get; set; } public string message { get; set; } = string.Empty; }
