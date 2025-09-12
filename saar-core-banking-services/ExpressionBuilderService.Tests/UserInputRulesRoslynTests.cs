using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ExpressionBuilderService.Engine;
using ExpressionBuilderService.Functions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ExpressionBuilderService.Tests
{
    public class UserInputRulesRoslynTests
    {
        private static RoslynExpressionEngine CreateEngine()
        {
            var banking = new BankingFunctionLibrary();
            var validator = new ExpressionBuilderService.Security.ExpressionSecurityValidator(NullLogger<ExpressionBuilderService.Security.ExpressionSecurityValidator>.Instance);
            return new RoslynExpressionEngine(banking, validator, NullLogger<RoslynExpressionEngine>.Instance);
        }

    private record RuleCase(string Name, string ContextType, string Expression, Dictionary<string, object> Vars);

        private static IEnumerable<RuleCase> Cases()
        {
            // Customer context variables
            var custVars = new Dictionary<string, object>
            {
                {"age", 30},
                {"monthlyIncome", 60000m},
                {"debtToIncomeRatio", 0.30m},
                {"creditScore", 760},
                {"hasDefaultHistory", false}
            };

            // Customer rules (10)
            yield return new RuleCase("Customer: age 21-65", "Customer", "customer.age >= 21 && customer.age <= 65", custVars);
            yield return new RuleCase("Customer: income threshold", "Customer", "customer.monthlyIncome >= 25000m", custVars);
            yield return new RuleCase("Customer: credit score", "Customer", "customer.creditScore >= 700", custVars);
            yield return new RuleCase("Customer: DTI", "Customer", "customer.debtToIncomeRatio <= 0.4m", custVars);
            yield return new RuleCase("Customer: ternary fallback", "Customer", "(customer.creditScore >= 750) ? true : (customer.monthlyIncome >= 50000m && customer.debtToIncomeRatio <= 0.35m)", custVars);
            yield return new RuleCase("Customer: no default history", "Customer", "customer.HasDefaultHistory == false", custVars);
            yield return new RuleCase("Customer: income OR score", "Customer", "(customer.monthlyIncome >= 50000m) || (customer.creditScore >= 780)", custVars);
            yield return new RuleCase("Customer: age+score", "Customer", "customer.age >= 21 && customer.creditScore >= 600 && customer.debtToIncomeRatio < 0.5m", custVars);
            yield return new RuleCase("Customer: age<60 or high score", "Customer", "customer.age < 60 || customer.creditScore >= 800", custVars);
            yield return new RuleCase("Customer: DTI and income positive", "Customer", "customer.debtToIncomeRatio <= 0.5m && customer.monthlyIncome > 0m", custVars);

            // Loan context variables
            var loanVars = new Dictionary<string, object>
            {
                {"loanAmount", 800000m},
                {"tenureMonths", 120},
                {"interestRate", 9.5m},
                {"debtToIncomeRatio", 0.30m},
                {"loanType", "PERSONAL"}
            };

            // Loan rules (10)
            yield return new RuleCase("Loan: amount > 0", "Loan", "loan.RequestedAmount > 0m", loanVars);
            yield return new RuleCase("Loan: tenure range", "Loan", "loan.TenureMonths >= 6 && loan.TenureMonths <= 360", loanVars);
            yield return new RuleCase("Loan: interest range", "Loan", "loan.InterestRate >= 0m && loan.InterestRate <= 50m", loanVars);
            yield return new RuleCase("Loan: DTI <= 0.5", "Loan", "loan.DebtToIncomeRatio <= 0.5m", loanVars);
            yield return new RuleCase("Loan: type allowed", "Loan", "loan.LoanType == \"PERSONAL\" || loan.LoanType == \"HOME\"", loanVars);
            yield return new RuleCase("Loan: EMI cap", "Loan", "CalculateEMI(loan.RequestedAmount, 12m, loan.TenureMonths) <= 100000m", loanVars);
            yield return new RuleCase("Loan: % sanity", "Loan", "Percentage(loan.RequestedAmount, 10m) <= loan.RequestedAmount", loanVars);
            yield return new RuleCase("Loan: LTV <= 80", "Loan", "CalculateLTV(loan.RequestedAmount, 1200000m) <= 80m", loanVars);
            yield return new RuleCase("Loan: tenure multiple of 6", "Loan", "(loan.TenureMonths % 6) == 0", loanVars);
            yield return new RuleCase("Loan: zero-interest fallback", "Loan", "(loan.InterestRate == 0m) ? (loan.RequestedAmount / loan.TenureMonths) > 0m : (loan.InterestRate > 0m)", loanVars);
        }

        [Fact]
        public async Task All_Rules_Should_Compile_And_Execute_True()
        {
            var engine = CreateEngine();
            foreach (var c in Cases())
            {
                // Compile for boolean return
                var comp = await engine.CompileExpressionAsync(c.Expression, contextType: c.ContextType, returnType: "boolean");
                Assert.True(comp.Success, $"Compilation failed for '{c.Name}': {string.Join("; ", comp.Errors)}");

                // Validate
                var val = await engine.ValidateExpressionAsync(c.Expression, contextType: c.ContextType, returnType: "boolean", variables: c.Vars);
                Assert.True(val.IsValid, $"Validation failed for '{c.Name}': {string.Join("; ", val.Errors)}");

                // Execute
                var exec = await engine.ExecuteExpressionAsync(c.Expression, contextType: c.ContextType, variables: c.Vars);
                Assert.True(exec.Success, $"Execution failed for '{c.Name}': {exec.ErrorMessage}");
                Assert.IsType<bool>(exec.Result);
                Assert.True((bool)exec.Result!, $"Rule evaluated to false for '{c.Name}'");
            }
        }
    }
}
