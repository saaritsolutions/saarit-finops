using Microsoft.EntityFrameworkCore;
using LockerService.Models;

namespace LockerService.Data
{
    public class LockerDbContext : DbContext
    {
        public LockerDbContext(DbContextOptions<LockerDbContext> options) : base(options) { }

        public DbSet<Locker> Lockers { get; set; }
    }
}
