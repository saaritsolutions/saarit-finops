// CustomerControllerTests migrated from SaaRCoreBanking.NUnitTests
// Adapted for CustomerService microservice context
using System;
using NUnit.Framework;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CustomerService.Controllers;
using CustomerService.Data;
using CustomerService.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CustomerService.Tests
{
    [TestFixture]
    public class CustomerControllerTests
    {
        private CustomerDbContext GetDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<CustomerDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;
            return new CustomerDbContext(options);
        }

        private CustomerController GetController(CustomerDbContext context)
        {
            return new CustomerController(context);
        }

        [Test]
        public async Task GetCustomers_ReturnsAllCustomers()
        {
            var context = GetDbContext(nameof(GetCustomers_ReturnsAllCustomers));
            context.Customers.AddRange(new List<Customer>
            {
                new Customer { FirstName = "John", LastName = "Doe" },
                new Customer { FirstName = "Jane", LastName = "Smith" }
            });
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetCustomers();
            var customers = result.Value as List<Customer>;
            Assert.That(customers, Is.Not.Null);
            Assert.That(customers.Count, Is.EqualTo(2));
        }

        [Test]
        public async Task GetCustomer_ReturnsCustomer_WhenFound()
        {
            var context = GetDbContext(nameof(GetCustomer_ReturnsCustomer_WhenFound));
            var customer = new Customer { FirstName = "John", LastName = "Doe" };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetCustomer(customer.CustomerId);
            var found = result.Value as Customer;
            Assert.That(found, Is.Not.Null);
            Assert.That(found.FirstName, Is.EqualTo("John"));
        }

        [Test]
        public async Task GetCustomer_ReturnsNotFound_WhenNotFound()
        {
            var context = GetDbContext(nameof(GetCustomer_ReturnsNotFound_WhenNotFound));
            var controller = GetController(context);

            var result = await controller.GetCustomer(999);
            Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
        }

        [Test]
        public async Task CreateCustomer_AddsCustomer()
        {
            var context = GetDbContext(nameof(CreateCustomer_AddsCustomer));
            var controller = GetController(context);
            var customer = new Customer { FirstName = "Alice", LastName = "Wonder" };

            var result = await controller.CreateCustomer(customer);
            var created = result.Result as CreatedAtActionResult;
            var returned = created.Value as Customer;
            Assert.That(returned, Is.Not.Null);
            Assert.That(returned.FirstName, Is.EqualTo("Alice"));
            Assert.That(context.Customers.Count(), Is.EqualTo(1));
        }

        [Test]
        public async Task CreateCustomer_RejectsDuplicatePAN()
        {
            var context = GetDbContext(nameof(CreateCustomer_RejectsDuplicatePAN));
            var controller = GetController(context);
            var customer1 = new Customer { FirstName = "A", PAN = "PAN123" };
            var customer2 = new Customer { FirstName = "B", PAN = "PAN123" };
            await controller.CreateCustomer(customer1);
            var result = await controller.CreateCustomer(customer2);
            Assert.That(result.Result, Is.TypeOf<BadRequestObjectResult>());
        }

        [Test]
        public async Task CreateCustomer_RejectsDuplicateUID()
        {
            var context = GetDbContext(nameof(CreateCustomer_RejectsDuplicateUID));
            var controller = GetController(context);
            var customer1 = new Customer { FirstName = "A", UID = "UID123" };
            var customer2 = new Customer { FirstName = "B", UID = "UID123" };
            await controller.CreateCustomer(customer1);
            var result = await controller.CreateCustomer(customer2);
            Assert.That(result.Result, Is.TypeOf<BadRequestObjectResult>());
        }

        [Test]
        public async Task DeleteCustomer_Deletes_WhenFound()
        {
            var context = GetDbContext(nameof(DeleteCustomer_Deletes_WhenFound));
            var customer = new Customer { FirstName = "Delete", LastName = "Me" };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.DeleteCustomer(customer.CustomerId);
            Assert.That(result, Is.InstanceOf<NoContentResult>());
            Assert.That(context.Customers.Count(), Is.EqualTo(0));
        }

        [Test]
        public async Task DeleteCustomer_ReturnsNotFound_WhenNotFound()
        {
            var context = GetDbContext(nameof(DeleteCustomer_ReturnsNotFound_WhenNotFound));
            var controller = GetController(context);

            var result = await controller.DeleteCustomer(999);
            Assert.That(result, Is.InstanceOf<NotFoundResult>());
        }

        [Test]
        public async Task UpdateCustomer_Updates_WhenValid()
        {
            var context = GetDbContext(nameof(UpdateCustomer_Updates_WhenValid));
            var customer = new Customer { FirstName = "Bob", LastName = "Builder" };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);
            customer.LastName = "Updated";

            var result = await controller.UpdateCustomer(customer.CustomerId, customer);
            Assert.That(result, Is.InstanceOf<NoContentResult>());
            var updated = context.Customers.First();
            Assert.That(updated.LastName, Is.EqualTo("Updated"));
        }

        [Test]
        public async Task UpdateCustomer_ReturnsBadRequest_WhenIdMismatch()
        {
            var context = GetDbContext(nameof(UpdateCustomer_ReturnsBadRequest_WhenIdMismatch));
            var controller = GetController(context);
            var customer = new Customer { CustomerId = 1, FirstName = "Mismatch" };

            var result = await controller.UpdateCustomer(2, customer);
            Assert.That(result, Is.InstanceOf<BadRequestResult>());
        }

        [Test]
        public async Task UpdateCustomer_ReturnsNotFound_WhenNotFound()
        {
            var context = GetDbContext(nameof(UpdateCustomer_ReturnsNotFound_WhenNotFound));
            var controller = GetController(context);
            var customer = new Customer { CustomerId = 999, FirstName = "Ghost" };

            var result = await controller.UpdateCustomer(999, customer);
            Assert.That(result, Is.InstanceOf<NotFoundResult>());
        }
        // ... (all other test methods, adapted for CustomerService context) ...
    }
}
