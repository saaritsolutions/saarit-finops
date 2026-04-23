using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using System.Threading;
using LoanService.Data;
using LoanService.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Linq;

namespace LoanService.IntegrationTests;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
    builder.UseEnvironment("IntegrationTesting");
        builder.ConfigureAppConfiguration((ctx, config) =>
        {
            var dict = new Dictionary<string, string?>
            {
                ["FeatureFlags:EnableWorkflow"] = "false",
                ["FeatureFlags:EnableDynamicForms"] = "false",
                ["FeatureFlags:EnableExpressions"] = "false",
        // Connection string ignored in IntegrationTesting
        ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=ignored;Username=ignored;Password=ignored"
            };
            config.AddInMemoryCollection(dict);
        });

        builder.ConfigureServices(services =>
        {
        // No explicit DB replacement needed; Program.cs switches to InMemory in this environment
            // Optionally replace external clients with fakes using typed clients
            services.AddSingleton<IExpressionEvaluationService, NoopExpressions>();
            services.AddSingleton<IWorkflowClient, NoopWorkflow>();
            services.AddSingleton<IDynamicFormsClient, NoopForms>();
        });
    }
}

file class NoopExpressions : IExpressionEvaluationService
{
    public Task<T> EvaluateExpressionAsync<T>(string expressionId, Dictionary<string, object> context) => Task.FromResult(default(T)!);
    public Task<string> EvaluateLoanEligibilityAsync(string customerId, decimal loanAmount, Dictionary<string, object> customerData) => Task.FromResult("APPROVED");
    public Task<decimal> CalculateInterestRateAsync(string productId, Dictionary<string, object> loanContext) => Task.FromResult(9.5m);
}

file class NoopWorkflow : IWorkflowClient
{
    public Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default) => Task.FromResult(new WorkflowInstance { Id = Guid.NewGuid(), EntityId = entityId, WorkflowType = "LOAN_ORIGINATION", Status = "IN_REVIEW" });
    public Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default) => Task.FromResult(new WorkflowStepResult{ InstanceId = instanceId, Success = true, WorkflowStatus = "IN_REVIEW" });
    public Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default) => Task.CompletedTask;
    public Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default) => Task.FromResult<ApprovalChainDto?>(null);
    public Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default) => Task.CompletedTask;
}

file class NoopForms : IDynamicFormsClient
{
    public Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType) => Task.FromResult(new List<DynamicField>{ new DynamicField{ Id = 1, Name = "fullName" } });
    public Task<LoanService.Services.FormSchemaResponse?> GetFormSchemaAsync(string formType) => Task.FromResult<LoanService.Services.FormSchemaResponse?>(null);
}
