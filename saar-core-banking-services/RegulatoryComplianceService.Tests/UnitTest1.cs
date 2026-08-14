using RegulatoryComplianceService.Controllers;
using RegulatoryComplianceService.Data;
using RegulatoryComplianceService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace RegulatoryComplianceService.Tests;

public class ComplianceReportsControllerTests
{
    private RegulatoryComplianceDbContext _context = null!;
    private ComplianceReportsController _controller = null!;

    [SetUp]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<RegulatoryComplianceDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new RegulatoryComplianceDbContext(options);
        _controller = new ComplianceReportsController(_context);
    }

    [TearDown]
    public void TearDown()
    {
        _context.Dispose();
    }

    // T-01: Creating a compliance report persists it and stamps ReportDate server-side
    [Test]
    public async Task Create_ValidReport_PersistsAndStampsReportDate()
    {
        var report = new ComplianceReport
        {
            ReportType = "AML",
            Status = "Pending",
            Remarks = "Quarterly AML review"
        };

        var result = await _controller.Create(report);

        var created = (result.Result as CreatedAtActionResult)?.Value as ComplianceReport;
        Assert.That(created, Is.Not.Null);
        Assert.That(created!.ReportDate, Is.Not.EqualTo(default(DateTime)));
        Assert.That(await _context.ComplianceReports.CountAsync(), Is.EqualTo(1));
    }

    // T-02: GetAll returns every seeded report
    [Test]
    public async Task GetAll_ReturnsAllReports()
    {
        _context.ComplianceReports.AddRange(
            new ComplianceReport { ReportType = "AML", Status = "Submitted", ReportDate = DateTime.UtcNow, Remarks = "R1" },
            new ComplianceReport { ReportType = "CERSAI", Status = "Approved", ReportDate = DateTime.UtcNow, Remarks = "R2" });
        await _context.SaveChangesAsync();

        var result = await _controller.GetAll();

        Assert.That(result.Value, Is.Not.Null);
        Assert.That(result.Value!.Count(), Is.EqualTo(2));
    }

    // T-03: Get by id returns 404 when the report doesn't exist
    [Test]
    public async Task Get_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Get(999);

        Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
    }

    // T-04: Get by id returns the matching report
    [Test]
    public async Task Get_KnownId_ReturnsReport()
    {
        var report = new ComplianceReport { ReportType = "Statutory", Status = "Pending", ReportDate = DateTime.UtcNow, Remarks = "Annual statutory filing" };
        _context.ComplianceReports.Add(report);
        await _context.SaveChangesAsync();

        var result = await _controller.Get(report.Id);

        Assert.That(result.Value, Is.Not.Null);
        Assert.That(result.Value!.ReportType, Is.EqualTo("Statutory"));
    }

    // T-05: Delete removes an existing report
    [Test]
    public async Task Delete_KnownId_RemovesReport()
    {
        var report = new ComplianceReport { ReportType = "AML", Status = "Pending", ReportDate = DateTime.UtcNow, Remarks = "To delete" };
        _context.ComplianceReports.Add(report);
        await _context.SaveChangesAsync();

        var result = await _controller.Delete(report.Id);

        Assert.That(result, Is.TypeOf<NoContentResult>());
        Assert.That(await _context.ComplianceReports.CountAsync(), Is.EqualTo(0));
    }

    // T-06: Delete returns 404 when the report doesn't exist
    [Test]
    public async Task Delete_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Delete(999);

        Assert.That(result, Is.TypeOf<NotFoundResult>());
    }

    // T-07: Update with mismatched id in route vs body returns BadRequest
    [Test]
    public async Task Update_MismatchedId_ReturnsBadRequest()
    {
        var report = new ComplianceReport { Id = 5, ReportType = "AML", Status = "Pending", ReportDate = DateTime.UtcNow, Remarks = "x" };

        var result = await _controller.Update(1, report);

        Assert.That(result, Is.TypeOf<BadRequestResult>());
    }
}

public class RegulatoryFilingsControllerTests
{
    private RegulatoryComplianceDbContext _context = null!;
    private RegulatoryFilingsController _controller = null!;

    [SetUp]
    public void Setup()
    {
        var options = new DbContextOptionsBuilder<RegulatoryComplianceDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _context = new RegulatoryComplianceDbContext(options);
        _controller = new RegulatoryFilingsController(_context);
    }

    [TearDown]
    public void TearDown()
    {
        _context.Dispose();
    }

    // T-08: Creating a filing persists it and stamps FilingDate server-side
    [Test]
    public async Task Create_ValidFiling_PersistsAndStampsFilingDate()
    {
        var filing = new RegulatoryFiling
        {
            Regulation = "CRILC",
            Status = "Pending",
            Details = "Large exposure return"
        };

        var result = await _controller.Create(filing);

        var created = (result.Result as CreatedAtActionResult)?.Value as RegulatoryFiling;
        Assert.That(created, Is.Not.Null);
        Assert.That(created!.FilingDate, Is.Not.EqualTo(default(DateTime)));
        Assert.That(await _context.RegulatoryFilings.CountAsync(), Is.EqualTo(1));
    }

    // T-09: GetAll returns every seeded filing
    [Test]
    public async Task GetAll_ReturnsAllFilings()
    {
        _context.RegulatoryFilings.AddRange(
            new RegulatoryFiling { Regulation = "CRILC", Status = "Filed", FilingDate = DateTime.UtcNow, Details = "F1" },
            new RegulatoryFiling { Regulation = "DSB", Status = "Filed", FilingDate = DateTime.UtcNow, Details = "F2" });
        await _context.SaveChangesAsync();

        var result = await _controller.GetAll();

        Assert.That(result.Value, Is.Not.Null);
        Assert.That(result.Value!.Count(), Is.EqualTo(2));
    }

    // T-10: Get by id returns 404 when the filing doesn't exist
    [Test]
    public async Task Get_UnknownId_ReturnsNotFound()
    {
        var result = await _controller.Get(999);

        Assert.That(result.Result, Is.TypeOf<NotFoundResult>());
    }

    // T-11: Delete removes an existing filing
    [Test]
    public async Task Delete_KnownId_RemovesFiling()
    {
        var filing = new RegulatoryFiling { Regulation = "DSB", Status = "Pending", FilingDate = DateTime.UtcNow, Details = "To delete" };
        _context.RegulatoryFilings.Add(filing);
        await _context.SaveChangesAsync();

        var result = await _controller.Delete(filing.Id);

        Assert.That(result, Is.TypeOf<NoContentResult>());
        Assert.That(await _context.RegulatoryFilings.CountAsync(), Is.EqualTo(0));
    }
}
