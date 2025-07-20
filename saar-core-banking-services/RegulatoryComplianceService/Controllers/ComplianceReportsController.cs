using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RegulatoryComplianceService.Data;
using RegulatoryComplianceService.Models;

namespace RegulatoryComplianceService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ComplianceReportsController : ControllerBase
    {
        private readonly RegulatoryComplianceDbContext _context;
        public ComplianceReportsController(RegulatoryComplianceDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ComplianceReport>>> GetAll()
        {
            return await _context.ComplianceReports.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ComplianceReport>> Get(int id)
        {
            var report = await _context.ComplianceReports.FindAsync(id);
            if (report == null) return NotFound();
            return report;
        }

        [HttpPost]
        public async Task<ActionResult<ComplianceReport>> Create(ComplianceReport report)
        {
            report.ReportDate = DateTime.UtcNow;
            _context.ComplianceReports.Add(report);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = report.Id }, report);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, ComplianceReport report)
        {
            if (id != report.Id) return BadRequest();
            _context.Entry(report).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var report = await _context.ComplianceReports.FindAsync(id);
            if (report == null) return NotFound();
            _context.ComplianceReports.Remove(report);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
