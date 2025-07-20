using NUnit.Framework;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InterestFeeService.Controllers;
using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Services;
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

        private InterestFeesController GetController(InterestFeeDbContext context)
        {
            return new InterestFeesController(context, new StubAccountServiceClient());
        }

        [SetUp]
        public void SetUp()
        {
            StubAccountServiceClient.ClearAccounts();
        }

        [Test]
        public async Task AccrueInterest_AddsDailyInterest()
        {
            var context = GetDbContext(nameof(AccrueInterest_AddsDailyInterest));
            StubAccountServiceClient.AddOrUpdateAccount(new AccountInfo {
                AccountId = 1,
                Balance = 1000,
                IsTDSExempt = false,
                AccruedInterest = 0,
                AccruedTDS = 0,
                IsClosed = false
            });
            var controller = GetController(context);
            var result = await controller.AccrueInterest(1, 1); // AccountId=1, 1% p.a.
            var ok = result as OkObjectResult;
            Assert.That(ok, Is.Not.Null);
            Assert.That((decimal)ok.Value, Is.EqualTo(0.0273972602739726m).Within(0.0001m));
            Assert.That(context.InterestFees.Any(f => f.AccountId == 1 && f.CalculationType == "Interest"));
        }

        [Test]
        public async Task ApplyInterest_AppliesInterestAndDeductsTDS()
        {
            var context = GetDbContext(nameof(ApplyInterest_AppliesInterestAndDeductsTDS));
            context.InterestFees.Add(new InterestFee { AccountId = 1, InterestAmount = 100, CalculationType = "Interest", CalculationDate = DateTime.UtcNow });
            context.SaveChanges();
            StubAccountServiceClient.AddOrUpdateAccount(new AccountInfo {
                AccountId = 1,
                Balance = 1000,
                IsTDSExempt = false,
                AccruedInterest = 100,
                AccruedTDS = 0,
                IsClosed = false
            });
            var controller = GetController(context);
            var result = await controller.ApplyInterest(1, 10); // 10% TDS
            var ok = result as OkObjectResult;
            Assert.That(ok, Is.Not.Null);
            Console.WriteLine($"ApplyInterest result: {System.Text.Json.JsonSerializer.Serialize(ok.Value)}");
            var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(System.Text.Json.JsonSerializer.Serialize(ok.Value));
            Assert.That(data, Is.Not.Null);
            Assert.That(data["AppliedInterest"].GetDecimal(), Is.EqualTo(100));
            Assert.That(data["TDS"].GetDecimal(), Is.EqualTo(10));
            Assert.That(context.InterestFees.Any(f => f.AccountId == 1 && f.CalculationType == "TDS" && f.TdsAmount == 10));
        }

        [Test]
        public async Task GetInterestAndTDS_ReturnsCorrectValues()
        {
            var context = GetDbContext(nameof(GetInterestAndTDS_ReturnsCorrectValues));
            context.InterestFees.Add(new InterestFee { AccountId = 1, InterestAmount = 5, CalculationType = "Interest", CalculationDate = DateTime.UtcNow });
            context.InterestFees.Add(new InterestFee { AccountId = 1, TdsAmount = 2, CalculationType = "TDS", CalculationDate = DateTime.UtcNow });
            context.SaveChanges();
            StubAccountServiceClient.AddOrUpdateAccount(new AccountInfo {
                AccountId = 1,
                Balance = 1000,
                IsTDSExempt = false,
                AccruedInterest = 5,
                AccruedTDS = 2,
                IsClosed = false
            });
            var controller = GetController(context);
            var result = await controller.GetInterestAndTDS(1);
            var ok = result as OkObjectResult;
            Assert.That(ok, Is.Not.Null);
            Console.WriteLine($"GetInterestAndTDS result: {System.Text.Json.JsonSerializer.Serialize(ok.Value)}");
            var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(System.Text.Json.JsonSerializer.Serialize(ok.Value));
            Assert.That(data, Is.Not.Null);
            Assert.That(data["AccruedInterest"].GetDecimal(), Is.EqualTo(5));
            Assert.That(data["AccruedTDS"].GetDecimal(), Is.EqualTo(2));
        }
    }
}
