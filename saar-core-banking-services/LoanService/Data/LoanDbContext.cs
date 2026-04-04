using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using LoanService.Models;
using LoanService.Services;

namespace LoanService.Data
{
    public class LoanDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime)
        public LoanDbContext(DbContextOptions<LoanDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling)
        public LoanDbContext(DbContextOptions<LoanDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        public DbSet<LoanAccount> LoanAccounts { get; set; }
        public DbSet<LoanApplication> LoanApplications { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema(TenantSchema);
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
        }
    }
}
