using Microsoft.EntityFrameworkCore;

namespace AuditLoggingService.Models
{
    public class AuditLog
    {
        public int Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string PerformedBy { get; set; } = string.Empty;
        public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
        public string Entity { get; set; } = string.Empty;
        public string? Details { get; set; }
    }

    public class AuditLogDbContext : DbContext
    {
        public AuditLogDbContext(DbContextOptions<AuditLogDbContext> options) : base(options) { }
        public DbSet<AuditLog> AuditLogs { get; set; }
    }
}
