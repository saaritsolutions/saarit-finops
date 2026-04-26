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
            var ok = result.Result as Microsoft.AspNetCore.Mvc.OkObjectResult;
            var response = ok!.Value as CustomerListResponse;
            Assert.That(response, Is.Not.Null);
            Assert.That(response!.Items.Count, Is.EqualTo(2));
            Assert.That(response.Total, Is.EqualTo(2));
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
        // ── KYC Workflow Tests ─────────────────────────────────────────────────

        [Test]
        public async Task KycInitiate_TransitionsToInProgress()
        {
            var context = GetDbContext(nameof(KycInitiate_TransitionsToInProgress));
            var customer = new Customer { FirstName = "Test", KycStatus = KycStatus.NotStarted };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.KycInitiate(customer.CustomerId);
            Assert.That(result, Is.InstanceOf<OkObjectResult>());
            var updated = context.Customers.First();
            Assert.That(updated.KycStatus, Is.EqualTo(KycStatus.InProgress));
        }

        [Test]
        public async Task KycSubmitDocuments_TransitionsToDocumentsSubmitted()
        {
            var context = GetDbContext(nameof(KycSubmitDocuments_TransitionsToDocumentsSubmitted));
            var customer = new Customer { FirstName = "Test", KycStatus = KycStatus.InProgress };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.KycSubmitDocuments(customer.CustomerId);
            Assert.That(result, Is.InstanceOf<OkObjectResult>());
            var updated = context.Customers.First();
            Assert.That(updated.KycStatus, Is.EqualTo(KycStatus.DocumentsSubmitted));
        }

        [Test]
        public async Task KycVerify_TransitionsToVerified_WithAuditFields()
        {
            var context = GetDbContext(nameof(KycVerify_TransitionsToVerified_WithAuditFields));
            var customer = new Customer { FirstName = "Test", KycStatus = KycStatus.DocumentsSubmitted };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.KycVerify(customer.CustomerId, new KycVerifyRequest("Branch Manager"));
            Assert.That(result, Is.InstanceOf<OkObjectResult>());
            var updated = context.Customers.First();
            Assert.That(updated.KycStatus, Is.EqualTo(KycStatus.Verified));
            Assert.That(updated.KycVerifiedBy, Is.EqualTo("Branch Manager"));
            Assert.That(updated.KycVerifiedAt, Is.Not.Null);
        }

        [Test]
        public async Task KycReject_TransitionsToRejected_WithReason()
        {
            var context = GetDbContext(nameof(KycReject_TransitionsToRejected_WithReason));
            var customer = new Customer { FirstName = "Test", KycStatus = KycStatus.DocumentsSubmitted };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.KycReject(customer.CustomerId, new KycRejectRequest("Documents unclear"));
            Assert.That(result, Is.InstanceOf<OkObjectResult>());
            var updated = context.Customers.First();
            Assert.That(updated.KycStatus, Is.EqualTo(KycStatus.Rejected));
            Assert.That(updated.KycRejectionReason, Is.EqualTo("Documents unclear"));
        }

        [Test]
        public async Task KycInitiate_Returns404_WhenCustomerNotFound()
        {
            var context = GetDbContext(nameof(KycInitiate_Returns404_WhenCustomerNotFound));
            var controller = GetController(context);

            var result = await controller.KycInitiate(9999);
            Assert.That(result, Is.InstanceOf<NotFoundResult>());
        }

        [Test]
        public async Task KycVerify_Returns422_WhenInvalidTransition()
        {
            // Cannot verify from InProgress — must be DocumentsSubmitted first
            var context = GetDbContext(nameof(KycVerify_Returns422_WhenInvalidTransition));
            var customer = new Customer { FirstName = "Test", KycStatus = KycStatus.InProgress };
            context.Customers.Add(customer);
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.KycVerify(customer.CustomerId, new KycVerifyRequest("Officer"));
            Assert.That(result, Is.InstanceOf<UnprocessableEntityObjectResult>());
        }

        // ── Pagination + Search Tests ──────────────────────────────────────────

        [Test]
        public async Task GetCustomers_ReturnsAllWhenNoFilter()
        {
            var context = GetDbContext(nameof(GetCustomers_ReturnsAllWhenNoFilter));
            context.Customers.AddRange(new List<Customer>
            {
                new Customer { FirstName = "Alice", LastName = "Alpha" },
                new Customer { FirstName = "Bob",   LastName = "Beta" },
                new Customer { FirstName = "Carol",  LastName = "Gamma" },
            });
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetCustomers();
            var ok = result.Result as Microsoft.AspNetCore.Mvc.OkObjectResult;
            var response = ok!.Value as CustomerListResponse;
            Assert.That(response, Is.Not.Null);
            Assert.That(response!.Total, Is.EqualTo(3));
            Assert.That(response.Items.Count, Is.EqualTo(3));
        }

        [Test]
        public async Task GetCustomers_FiltersBy_Search_Name()
        {
            var context = GetDbContext(nameof(GetCustomers_FiltersBy_Search_Name));
            context.Customers.AddRange(new List<Customer>
            {
                new Customer { FirstName = "John",  LastName = "Doe"   },
                new Customer { FirstName = "Jane",  LastName = "Smith"  },
                new Customer { FirstName = "Johnny", LastName = "Walker" },
            });
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetCustomers(search: "john");
            var ok = result.Result as Microsoft.AspNetCore.Mvc.OkObjectResult;
            var response = ok!.Value as CustomerListResponse;
            Assert.That(response, Is.Not.Null);
            // "John" and "Johnny" match, "Jane" does not
            Assert.That(response!.Total, Is.EqualTo(2));
            Assert.That(response.Items.All(c => c.FirstName!.ToLower().Contains("john")), Is.True);
        }

        [Test]
        public async Task GetCustomers_FiltersBy_KycStatus()
        {
            var context = GetDbContext(nameof(GetCustomers_FiltersBy_KycStatus));
            context.Customers.AddRange(new List<Customer>
            {
                new Customer { FirstName = "Verified1", KycStatus = KycStatus.Verified   },
                new Customer { FirstName = "Verified2", KycStatus = KycStatus.Verified   },
                new Customer { FirstName = "Pending",   KycStatus = KycStatus.NotStarted },
            });
            context.SaveChanges();
            var controller = GetController(context);

            var result = await controller.GetCustomers(kycStatus: "3");  // Verified = 3
            var ok = result.Result as Microsoft.AspNetCore.Mvc.OkObjectResult;
            var response = ok!.Value as CustomerListResponse;
            Assert.That(response, Is.Not.Null);
            Assert.That(response!.Total, Is.EqualTo(2));
            Assert.That(response.Items.All(c => c.KycStatus == KycStatus.Verified), Is.True);
        }

        [Test]
        public async Task GetCustomers_ReturnsCorrectPage()
        {
            var context = GetDbContext(nameof(GetCustomers_ReturnsCorrectPage));
            // Add 5 customers with distinct CreatedAt so ordering is deterministic
            var anchor = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            for (int i = 1; i <= 5; i++)
                context.Customers.Add(new Customer
                {
                    FirstName = $"Customer{i}",
                    CreatedAt = anchor.AddDays(i),
                });
            context.SaveChanges();
            var controller = GetController(context);

            // Page 2 of pageSize=2 should return items 3 and 4 (by desc CreatedAt)
            var result = await controller.GetCustomers(page: 2, pageSize: 2);
            var ok = result.Result as Microsoft.AspNetCore.Mvc.OkObjectResult;
            var response = ok!.Value as CustomerListResponse;
            Assert.That(response, Is.Not.Null);
            Assert.That(response!.Total, Is.EqualTo(5));
            Assert.That(response.Items.Count, Is.EqualTo(2));
            Assert.That(response.Page, Is.EqualTo(2));
            Assert.That(response.PageSize, Is.EqualTo(2));
        }
        // ... (all other test methods, adapted for CustomerService context) ...
    }
}
