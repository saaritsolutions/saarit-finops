using Microsoft.EntityFrameworkCore;
using ChequeClearingService.Models;

namespace ChequeClearingService.Data
{
    public class ChequeClearingDbContext : DbContext
    {
        public ChequeClearingDbContext(DbContextOptions<ChequeClearingDbContext> options) : base(options) { }

        public DbSet<Cheque> Cheques { get; set; }
        public DbSet<ClearingBatch> ClearingBatches { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ClearingBatch>()
                .HasMany(cb => cb.Cheques)
                .WithOne()
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
