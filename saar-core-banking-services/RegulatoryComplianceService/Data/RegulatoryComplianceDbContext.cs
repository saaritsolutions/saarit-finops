using Microsoft.EntityFrameworkCore;
using RegulatoryComplianceService.Models;

namespace RegulatoryComplianceService.Data
{
    public class RegulatoryComplianceDbContext : DbContext
    {
        public RegulatoryComplianceDbContext(DbContextOptions<RegulatoryComplianceDbContext> options) : base(options) { }

        public DbSet<ComplianceReport> ComplianceReports { get; set; }
        public DbSet<RegulatoryFiling> RegulatoryFilings { get; set; }
    }
}
