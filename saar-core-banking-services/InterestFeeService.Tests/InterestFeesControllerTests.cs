using NUnit.Framework;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using InterestFeeService.Controllers;
using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Services;
using InterestFeeService.Jobs;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System;
using System.Text.Json;

namespace InterestFeeService.Tests
{
    [TestFixture]
    public class InterestFeesControllerTests
    {
        private InterestFeeDbContext GetDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<InterestFeeDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;
            return new InterestFeeDbContext(options);
        }

        private DailyAccrualJob GetJob(InterestFeeDbContext db)
        {
            var services = new ServiceCollection();
            services.AddSingleton<InterestFeeDbContext>(db);
            services.AddSingleton<IAccountServiceClient, StubAccountServiceClient>();
            services.AddSingleton<ITransactionPostingClient>(new StubTransactionPostingClient());
            var sp = services.BuildServiceProvider();
            return new DailyAccrualJob(
                sp.GetRequiredService<IServiceScopeFactory>(),
                NullLogger<DailyAccrualJob>.Instance);
        }

        private InterestFeesController GetController(InterestFeeDbContext context)
        {
            return new InterestFeesController(
                context,
                new StubAccountServiceClient(),
                GetJob(context),
                NullLogger<InterestFeesController>.Instance);
        }

        [SetUp]
        public void SetUp() => StubAccountServiceClient.ClearAccounts();

        [Test]
        public async Task GetInterestAndTDS_ReturnsCorrectValues()
        {
            var context = GetDbContext(nameof(GetInterestAndTDS_ReturnsCorrectValues));
            context.InterestFees.Add(new InterestFee
            {
                AccountId = 1, InterestAmount = 5,
                CalculationType = "DailyAccrual", CalculationDate = DateTime.UtcNow
            });
            context.InterestFees.Add(new InterestFee
            {
                AccountId = 1, TdsAmount = 2,
                CalculationType = "MonthlyPosted", CalculationDate = DateTime.UtcNow
            });
            context.SaveChanges();

            StubAccountServiceClient.AddOrUpdateAccount(new AccountInfo
            {
                AccountId = 1, Balance = 1000, IsTDSExempt = false,
                AccruedInterest = 5, AccruedTDS = 2, IsClosed = false
            });

            var controller = GetController(context);
            var result     = await controller.GetInterestAndTDS(1);
            var ok         = result as OkObjectResult;
            Assert.That(ok, Is.Not.Null);

            var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                JsonSerializer.Serialize(ok!.Value));
            Assert.That(data!["AccruedInterest"].GetDecimal(), Is.EqualTo(5m));
            Assert.That(data!["AccruedTDS"].GetDecimal(),      Is.EqualTo(2m));
        }

        [Test]
        public async Task CreateInterestFee_StoresFeeInDb()
        {
            var context    = GetDbContext(nameof(CreateInterestFee_StoresFeeInDb));
            var controller = GetController(context);

            var fee = new InterestFee
            {
                AccountId       = 10,
                InterestAmount  = 25.50m,
                CalculationType = "DailyAccrual"
            };

            var result  = await controller.CreateInterestFee(fee);
            var created = result.Result as CreatedAtActionResult;
            Assert.That(created, Is.Not.Null);
            Assert.That(context.InterestFees.Count(), Is.EqualTo(1));
        }

        [Test]
        public async Task DeleteInterestFee_RemovesRecord()
        {
            var context = GetDbContext(nameof(DeleteInterestFee_RemovesRecord));
            context.InterestFees.Add(new InterestFee
            {
                InterestFeeId   = 99,
                AccountId       = 7,
                InterestAmount  = 10m,
                CalculationType = "DailyAccrual",
                CalculationDate = DateTime.UtcNow
            });
            context.SaveChanges();

            var controller = GetController(context);
            var result     = await controller.DeleteInterestFee(99);
            Assert.That(result, Is.InstanceOf<NoContentResult>());
            Assert.That(context.InterestFees.Count(), Is.EqualTo(0));
        }
    }

    // ── Stub for ITransactionPostingClient ────────────────────────────────────

    internal class StubTransactionPostingClient : ITransactionPostingClient
    {
        public Task<string?> PostMonthlyInterestAsync(
            int accountId, string accountNumber, string tenantId,
            decimal interestAmount, string period, CancellationToken ct = default)
            => Task.FromResult<string?>("JNL-STUB-001");

        public Task<string?> PostTdsDeductionAsync(
            int accountId, string accountNumber, string tenantId,
            decimal tdsAmount, string period, CancellationToken ct = default)
            => Task.FromResult<string?>("JNL-STUB-002");
    }
}
