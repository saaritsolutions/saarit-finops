using Microsoft.EntityFrameworkCore;

namespace NotificationService.Models
{
    public class Notification
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public string Type { get; set; } = string.Empty; // e.g., SMS, Email, Push
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsRead { get; set; } = false;
    }

    public class NotificationDbContext : DbContext
    {
        public NotificationDbContext(DbContextOptions<NotificationDbContext> options) : base(options) { }

        public DbSet<Notification> Notifications { get; set; }
    }
}
