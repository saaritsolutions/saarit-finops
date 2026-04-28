using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NUnit.Framework;
using CustomerService.Controllers;
using CustomerService.Data;
using CustomerService.Models;

namespace CustomerService.Tests;

// =============================================================================
// TC-CST-002 — CustomerController validation and KYC state-machine tests
// =============================================================================
[TestFixture]
public class CustomerValidationTests
{
    private static CustomerDbContext MakeDb() =>
        new CustomerDbContext(
            new DbContextOptionsBuilder<CustomerDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

    private static CustomerController BuildController(CustomerDbContext db) =>
        new CustomerController(db);

    // T-01: Duplicate PAN → 400
    [Test]
    public async Task CreateCustomer_DuplicatePAN_Returns400()
    {
        var db = MakeDb();
        db.Customers.Add(new Customer
        {
            FirstName = "Existing",
            PAN       = "ABCDE1234F",
            Mobile    = "9000000001",
        });
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.CreateCustomer(new Customer
        {
            FirstName = "NewCustomer",
            PAN       = "ABCDE1234F",   // same PAN
            Mobile    = "9000000002",
        });

        var bad = result.Result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400 for duplicate PAN");
    }

    // T-02: Duplicate UID → 400
    [Test]
    public async Task CreateCustomer_DuplicateUID_Returns400()
    {
        var db = MakeDb();
        db.Customers.Add(new Customer
        {
            FirstName = "Existing",
            UID       = "123456789012",
            Mobile    = "9000000003",
        });
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.CreateCustomer(new Customer
        {
            FirstName = "NewCustomer",
            UID       = "123456789012",  // same UID
            Mobile    = "9000000004",
        });

        var bad = result.Result as BadRequestObjectResult;
        Assert.That(bad, Is.Not.Null, "Expected 400 for duplicate UID");
    }

    // T-03: DateOfBirth stored as DateOnly — no timezone drift
    [Test]
    public async Task CreateCustomer_DateOfBirth_RoundTripsAsDateOnly()
    {
        var db          = MakeDb();
        var ctrl        = BuildController(db);
        var expectedDob = new DateOnly(1990, 5, 15);

        var result = await ctrl.CreateCustomer(new Customer
        {
            FirstName   = "DateOnly",
            LastName    = "Test",
            Mobile      = "9000000099",
            DateOfBirth = expectedDob,
        });

        var created = result.Result as CreatedAtActionResult;
        Assert.That(created, Is.Not.Null, "Expected 201 Created");

        var saved = (Customer)created!.Value!;
        Assert.That(saved.DateOfBirth, Is.EqualTo(expectedDob),
            "DateOfBirth should round-trip without any timezone shift");
    }

    // T-04: KYC transition — KycInitiate from NotStarted → valid (200)
    [Test]
    public async Task KycInitiate_FromNotStarted_Returns200()
    {
        var db = MakeDb();
        var customer = new Customer
        {
            FirstName = "KYC",
            LastName  = "Tester",
            Mobile    = "9111000001",
            KycStatus = KycStatus.NotStarted,
        };
        db.Customers.Add(customer);
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.KycInitiate(customer.CustomerId);

        var ok = result as OkObjectResult;
        Assert.That(ok, Is.Not.Null, "Expected 200 OK for valid KYC initiate");

        var updated = await db.Customers.FindAsync(customer.CustomerId);
        Assert.That(updated!.KycStatus, Is.EqualTo(KycStatus.InProgress));
    }

    // T-05: KYC transition — KycInitiate from InProgress (invalid) → 422
    [Test]
    public async Task KycInitiate_FromInProgress_Returns422()
    {
        var db = MakeDb();
        var customer = new Customer
        {
            FirstName = "KYC",
            LastName  = "InProgress",
            Mobile    = "9111000002",
            KycStatus = KycStatus.InProgress,
        };
        db.Customers.Add(customer);
        db.SaveChanges();

        var ctrl   = BuildController(db);
        var result = await ctrl.KycInitiate(customer.CustomerId);

        var unprocessable = result as UnprocessableEntityObjectResult;
        Assert.That(unprocessable, Is.Not.Null, "Expected 422 for invalid KYC state transition");
        Assert.That(customer.KycStatus, Is.EqualTo(KycStatus.InProgress), "Status should remain unchanged");
    }
}
