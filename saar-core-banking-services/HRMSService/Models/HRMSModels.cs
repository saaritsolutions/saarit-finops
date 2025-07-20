using Microsoft.EntityFrameworkCore;

namespace HRMSService.Models
{
    public class Employee
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public DateTime DateOfJoining { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class HRMSDbContext : DbContext
    {
        public HRMSDbContext(DbContextOptions<HRMSDbContext> options) : base(options) { }
        public DbSet<Employee> Employees { get; set; }
    }
}
