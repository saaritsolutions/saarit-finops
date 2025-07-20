// AccountControllerTests migrated from SaaRCoreBanking.NUnitTests
// Adapted for AccountService microservice context
using System;
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
    public class AccountControllerTests
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

        // --- Begin migrated tests ---
        [Test]
        public async Task GetAccounts_ReturnsAllAccounts()
        {
            var context = GetDbContext(nameof(GetAccounts_ReturnsAllAccounts));
            var productType = new AccountProductType { Name = "TestType", IsActive = true };
            context.AccountProductTypes.Add(productType);
            context.SaveChanges();
            context.Accounts.AddRange(new List<Account>
            {
                new Account { CustomerId = 1, ProductTypeId = productType.AccountProductTypeId, Balance = 100 },
                new Account { CustomerId = 1, ProductTypeId = productType.AccountProductTypeId, Balance = 200 }
            });
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetAccounts();
            var accounts = result.Value as List<Account>;
            Assert.That(accounts, Is.Not.Null);
            Assert.That(accounts.Count, Is.EqualTo(2));
        }

        [Test]
        public async Task GetAccount_ExistingId_ReturnsCorrectAccount()
        {
            var context = GetDbContext(nameof(GetAccount_ExistingId_ReturnsCorrectAccount));
            var productType = new AccountProductType { Name = "TestType", IsActive = true };
            context.AccountProductTypes.Add(productType);
            context.SaveChanges();
            var account = new Account { CustomerId = 1, ProductTypeId = productType.AccountProductTypeId, Balance = 100 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.GetAccount(account.AccountId);
            var returnedAccount = result.Value as Account;
            Assert.That(returnedAccount, Is.Not.Null);
            Assert.That(returnedAccount.AccountId, Is.EqualTo(account.AccountId));
        }

        [Test]
        public async Task GetAccount_NonExistingId_ReturnsNotFound()
        {
            var context = GetDbContext(nameof(GetAccount_NonExistingId_ReturnsNotFound));
            var controller = GetController(context);

            var result = await controller.GetAccount(999);
            Assert.That(result.Result, Is.InstanceOf<NotFoundResult>());
        }

        [Test]
        public async Task CreateAccount_ValidAccount_ReturnsCreatedAccount()
        {
            var context = GetDbContext(nameof(CreateAccount_ValidAccount_ReturnsCreatedAccount));
            var productType = new AccountProductType { Name = "TestType", IsActive = true };
            context.AccountProductTypes.Add(productType);
            context.SaveChanges();
            var controller = GetController(context);
            var newAccount = new Account { CustomerId = 1, ProductTypeId = productType.AccountProductTypeId, Balance = 100 };

            var result = await controller.CreateAccount(newAccount);
            var createdAccount = (result.Result as CreatedAtActionResult)?.Value as Account;
            Assert.That(createdAccount, Is.Not.Null);
            Assert.That(createdAccount.AccountId, Is.GreaterThan(0));
            Assert.That(createdAccount.Balance, Is.EqualTo(100));
        }

        [Test]
        public async Task UpdateAccount_ExistingId_UpdatesAccount()
        {
            var context = GetDbContext(nameof(UpdateAccount_ExistingId_UpdatesAccount));
            var account = new Account { CustomerId = 1, Balance = 100 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            account.Balance = 200;

            var result = await controller.UpdateAccount(account.AccountId, account);
            Assert.That(result, Is.InstanceOf<NoContentResult>());
            var updated = context.Accounts.First(a => a.AccountId == account.AccountId);
            Assert.That(updated.Balance, Is.EqualTo(200));
        }

        [Test]
        public async Task UpdateAccount_NonExistingId_ReturnsNotFound()
        {
            var context = GetDbContext(nameof(UpdateAccount_NonExistingId_ReturnsNotFound));
            var controller = GetController(context);
            var account = new Account { AccountId = 999, CustomerId = 1, Balance = 100 };

            var result = await controller.UpdateAccount(account.AccountId, account);
            Assert.That(result, Is.InstanceOf<NotFoundResult>());
        }

        [Test]
        public async Task DeleteAccount_ExistingId_RemovesAccount()
        {
            var context = GetDbContext(nameof(DeleteAccount_ExistingId_RemovesAccount));
            var account = new Account { CustomerId = 1, Balance = 100 };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.DeleteAccount(account.AccountId);
            Assert.That(result, Is.InstanceOf<NoContentResult>());
            Assert.That(context.Accounts.Find(account.AccountId), Is.Null);
        }

        [Test]
        public async Task DeleteAccount_NonExistingId_ReturnsNotFound()
        {
            var context = GetDbContext(nameof(DeleteAccount_NonExistingId_ReturnsNotFound));
            var controller = GetController(context);

            var result = await controller.DeleteAccount(999);
            Assert.That(result, Is.InstanceOf<NotFoundResult>());
        }
        // --- End migrated tests ---

        // --- Begin joint account tests ---
        [Test]
        public async Task AddJointHolder_AddsCustomerId()
        {
            var context = GetDbContext(nameof(AddJointHolder_AddsCustomerId));
            var account = new Account { CustomerId = 1, Balance = 1000, JointCustomers = new List<int>() };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.AddJointHolder(account.AccountId, 2);
            var okResult = result as OkObjectResult;
            Assert.That(okResult, Is.Not.Null);
            var holders = okResult.Value as IEnumerable<int>;
            Assert.That(holders, Is.Not.Null);
            Assert.That(holders.Contains(2));
        }

        [Test]
        public async Task AddJointHolder_RejectsDuplicate()
        {
            var context = GetDbContext(nameof(AddJointHolder_RejectsDuplicate));
            var account = new Account { CustomerId = 1, Balance = 1000, JointCustomers = new List<int> { 2 } };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.AddJointHolder(account.AccountId, 2);
            Assert.That(result, Is.TypeOf<BadRequestObjectResult>());
        }

        [Test]
        public async Task GetJointHolders_ReturnsAllJointHolderIds()
        {
            var context = GetDbContext(nameof(GetJointHolders_ReturnsAllJointHolderIds));
            var account = new Account { CustomerId = 1, Balance = 1000, JointCustomers = new List<int> { 2, 3 } };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.GetJointHolders(account.AccountId);
            var okResult = result.Result as OkObjectResult;
            var holders = okResult.Value as IEnumerable<int>;
            Assert.That(holders, Is.Not.Null);
            Assert.That(holders.Count(), Is.EqualTo(2));
        }

        [Test]
        public async Task RemoveJointHolder_RemovesCustomerId()
        {
            var context = GetDbContext(nameof(RemoveJointHolder_RemovesCustomerId));
            var account = new Account { CustomerId = 1, Balance = 1000, JointCustomers = new List<int> { 2 } };
            context.Accounts.Add(account);
            context.SaveChanges();
            var controller = GetController(context);
            var result = await controller.RemoveJointHolder(account.AccountId, 2);
            Assert.That(result, Is.TypeOf<NoContentResult>());
            var holders = (await controller.GetJointHolders(account.AccountId)).Value ?? new List<int>();
            Assert.That(holders.Contains(2), Is.False);
        }
        // --- End joint account tests ---
    }
}
