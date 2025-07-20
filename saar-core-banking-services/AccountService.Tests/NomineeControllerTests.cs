using NUnit.Framework;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AccountService.Controllers;
using AccountService.Data;
using AccountService.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AccountService.Tests
{
    [TestFixture]
    public class NomineeControllerTests
    {
        private AccountDbContext GetDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AccountDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;
            return new AccountDbContext(options);
        }

        private AccountController GetController(AccountDbContext context)
        {
            return new AccountController(context);
        }

        [Test]
        public async Task AddNominee_AddsNomineeToAccount()
        {
            var context = GetDbContext(nameof(AddNominee_AddsNomineeToAccount));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var nominee = new Nominee { Name = "Nominee1", PercentageShare = 100 };
            var result = await controller.AddNominee(account.AccountId, nominee);
            var okResult = result as OkObjectResult;
            Assert.That(okResult, Is.Not.Null);
            var returned = okResult.Value as Nominee;
            Assert.That(returned, Is.Not.Null);
            Assert.That(returned.Name, Is.EqualTo("Nominee1"));
            Assert.That(returned.PercentageShare, Is.EqualTo(100));
            Assert.That(context.Nominees.Count(), Is.EqualTo(1));
        }

        [Test]
        public async Task GetNominees_ReturnsNomineesForAccount()
        {
            var context = GetDbContext(nameof(GetNominees_ReturnsNomineesForAccount));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var nominee = new Nominee { Name = "Nominee1", AccountId = account.AccountId, PercentageShare = 100 };
            context.Nominees.Add(nominee);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.GetNominees(account.AccountId);
            var okResult = result.Result as OkObjectResult;
            var nominees = okResult.Value as IEnumerable<Nominee>;
            Assert.That(nominees.Count(), Is.EqualTo(1));
            Assert.That(nominees.First().Name, Is.EqualTo("Nominee1"));
        }

        [Test]
        public async Task UpdateNominee_UpdatesNominee()
        {
            var context = GetDbContext(nameof(UpdateNominee_UpdatesNominee));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var nominee = new Nominee { Name = "Nominee1", AccountId = account.AccountId, PercentageShare = 50 };
            context.Nominees.Add(nominee);
            context.SaveChanges();
            var controller = GetController(context);
            var updated = new Nominee { NomineeId = nominee.NomineeId, AccountId = account.AccountId, Name = "Updated", PercentageShare = 75 };
            var result = await controller.UpdateNominee(account.AccountId, nominee.NomineeId, updated);
            var okResult = result as OkObjectResult;
            var returned = okResult.Value as Nominee;
            Assert.That(returned.Name, Is.EqualTo("Updated"));
            Assert.That(returned.PercentageShare, Is.EqualTo(75));
        }

        [Test]
        public async Task RemoveNominee_RemovesNominee()
        {
            var context = GetDbContext(nameof(RemoveNominee_RemovesNominee));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var nominee = new Nominee { Name = "Nominee1", AccountId = account.AccountId, PercentageShare = 100 };
            context.Nominees.Add(nominee);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.RemoveNominee(account.AccountId, nominee.NomineeId);
            Assert.That(result, Is.TypeOf<NoContentResult>());
            Assert.That(context.Nominees.Count(), Is.EqualTo(0));
        }

        [Test]
        public async Task UpdateNominee_ReturnsBadRequest_OnIdMismatch()
        {
            var context = GetDbContext(nameof(UpdateNominee_ReturnsBadRequest_OnIdMismatch));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var nominee = new Nominee { Name = "Nominee1", AccountId = account.AccountId, PercentageShare = 50 };
            context.Nominees.Add(nominee);
            context.SaveChanges();
            var controller = GetController(context);
            var updated = new Nominee { NomineeId = nominee.NomineeId + 1, AccountId = account.AccountId, Name = "Updated", PercentageShare = 75 };
            var result = await controller.UpdateNominee(account.AccountId, nominee.NomineeId, updated);
            Assert.That(result, Is.TypeOf<BadRequestResult>());
        }
    }
}
