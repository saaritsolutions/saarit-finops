using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using LoanService.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NUnit.Framework;

namespace LoanService.Tests
{
    [TestFixture]
    public class RequiredActionsTests
    {
        private static string StaticDir => Path.Combine(AppContext.BaseDirectory, "Static");
        private static string WorkflowFile => Path.Combine(StaticDir, "workflow_config_LOAN_ORIGINATION.json");

        private static void EnsureWorkflowFile()
        {
            Directory.CreateDirectory(StaticDir);
            var def = new
            {
                workflowType = "LOAN_ORIGINATION",
                startStep = "KYC",
                steps = new object[]
                {
                    new { name = "KYC", requiredActions = new [] { "KYC_VERIFY" }, next = "CREDIT_CHECK" },
                    new { name = "CREDIT_CHECK", conditionExpressionId = "EXPR_IS_HIGH_RISK", next = "UNDERWRITER_REVIEW", elseNext = "APPROVAL" },
                    new { name = "UNDERWRITER_REVIEW", next = "APPROVAL" },
                    new { name = "APPROVAL", next = "COMPLETED" }
                }
            };
            var json = JsonSerializer.Serialize(def, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(WorkflowFile, json);
        }

        private static FileWorkflowOrchestrator CreateOrchestrator()
        {
            var services = new ServiceCollection();
            // No expression service registered for this test; routing uses Next directly
            var sp = services.BuildServiceProvider();
            var loggerFactory = LoggerFactory.Create(builder => builder.AddFilter("*", LogLevel.Warning));
            var logger = loggerFactory.CreateLogger<FileWorkflowOrchestrator>();
            return new FileWorkflowOrchestrator(logger, sp);
        }

        [Test]
        public async Task GetDefinition_ShouldIncludeRequiredActions()
        {
            EnsureWorkflowFile();
            var orch = CreateOrchestrator();
            var def = await orch.GetDefinitionAsync("LOAN_ORIGINATION");
            Assert.IsNotNull(def);
            Assert.IsNotEmpty(def.Steps);
            var kyc = def.Steps.Find(s => string.Equals(s.Name, "KYC", StringComparison.OrdinalIgnoreCase));
            Assert.IsNotNull(kyc, "KYC step not found in definition");
            Assert.IsNotNull(kyc!.RequiredActions, "RequiredActions should not be null for KYC step");
            CollectionAssert.Contains(kyc.RequiredActions!, "KYC_VERIFY");
        }

        [Test]
        public async Task ProcessStep_ShouldReturnRequiredActionsFromCurrentStep()
        {
            EnsureWorkflowFile();
            var orch = CreateOrchestrator();
            var context = new Dictionary<string, object>
            {
                ["workflow.currentStep"] = "KYC"
            };
            var res = await orch.ProcessStepAsync(Guid.NewGuid(), action: "CONTINUE", context, workflowType: "LOAN_ORIGINATION");
            Assert.IsTrue(res.Success);
            Assert.AreEqual("KYC", res.CurrentStep);
            Assert.IsNotNull(res.RequiredActions);
            CollectionAssert.Contains(res.RequiredActions!, "KYC_VERIFY");
        }
    }
}
