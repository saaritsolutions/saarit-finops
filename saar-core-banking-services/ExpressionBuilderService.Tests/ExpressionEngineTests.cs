using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;
using ExpressionBuilderService.Engine;
using Microsoft.Extensions.Logging.Abstractions;
using ExpressionBuilderService.Functions;

namespace ExpressionBuilderService.Tests
{
    public class ExpressionEngineTests
    {
        [Fact]
        public async Task AnalyzeExpression_ShouldDetectVariables()
        {
            var banking = new BankingFunctionLibrary();
            var validator = new ExpressionBuilderService.Security.ExpressionSecurityValidator(NullLogger<ExpressionBuilderService.Security.ExpressionSecurityValidator>.Instance);
            var engine = new RoslynExpressionEngine(banking, validator, NullLogger<RoslynExpressionEngine>.Instance);

            var expr = "creditScore > 700 && monthlyIncome > 50000 && debtToIncomeRatio < 0.4";
            var metadata = await engine.AnalyzeExpressionAsync(expr, "Loan");

            Assert.Contains("creditScore", metadata.UsedVariables);
            Assert.Contains("monthlyIncome", metadata.UsedVariables);
            Assert.Contains("debtToIncomeRatio", metadata.UsedVariables);
        }

        [Fact]
        public async Task CompileExpression_ShouldIncludeVariableDeclarations()
        {
            var banking = new BankingFunctionLibrary();
            var validator = new ExpressionBuilderService.Security.ExpressionSecurityValidator(NullLogger<ExpressionBuilderService.Security.ExpressionSecurityValidator>.Instance);
            var engine = new RoslynExpressionEngine(banking, validator, NullLogger<RoslynExpressionEngine>.Instance);

            var expr = "creditScore > 700 && monthlyIncome > 50000 && debtToIncomeRatio < 0.4";
            var compilation = await engine.CompileExpressionAsync(expr, "Loan", "boolean");

            Assert.True(compilation.Success, string.Join("; ", compilation.Errors));
            Assert.NotNull(compilation.GeneratedCode);
            var code = compilation.GeneratedCode ?? string.Empty;
            Assert.Contains("creditScore", code);
            Assert.Contains("monthlyIncome", code);
            Assert.Contains("debtToIncomeRatio", code);
        }
    }
}
