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
    public class PassbookControllerTests
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
        public async Task IssuePassbook_CreatesPassbook()
        {
            var context = GetDbContext(nameof(IssuePassbook_CreatesPassbook));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.IssuePassbook(account.AccountId, "First issue");
            var ok = result as OkObjectResult;
            Assert.That(ok, Is.Not.Null);
            var passbook = ok.Value as Passbook;
            Assert.That(passbook, Is.Not.Null);
            Assert.That(passbook.AccountId, Is.EqualTo(account.AccountId));
            Assert.That(passbook.Remarks, Is.EqualTo("First issue"));
            Assert.That(context.Passbooks.Count(), Is.EqualTo(1));
        }

        [Test]
        public async Task GetPassbooks_ReturnsAllPassbooks()
        {
            var context = GetDbContext(nameof(GetPassbooks_ReturnsAllPassbooks));
            var account = new Account { CustomerId = 1, Balance = 1000 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var passbook1 = new Passbook { AccountId = account.AccountId, PassbookNumber = "PBK-1", IssuedDate = System.DateTime.UtcNow };
            var passbook2 = new Passbook { AccountId = account.AccountId, PassbookNumber = "PBK-2", IssuedDate = System.DateTime.UtcNow };
            context.Passbooks.AddRange(passbook1, passbook2);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.GetPassbooks(account.AccountId);
            var ok = result.Result as OkObjectResult;
            var passbooks = ok.Value as IEnumerable<Passbook>;
            Assert.That(passbooks.Count(), Is.EqualTo(2));
        }
    }
}
