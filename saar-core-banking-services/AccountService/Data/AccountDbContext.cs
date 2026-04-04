using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using AccountService.Services;

namespace AccountService.Data
{
    public class AccountDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime — ITenantService is request-scoped)
        public AccountDbContext(DbContextOptions<AccountDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling — defaults to "public" schema)
        public AccountDbContext(DbContextOptions<AccountDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        public DbSet<Models.Account> Accounts { get; set; }
        public DbSet<Models.AccountProductType> AccountProductTypes { get; set; }
        public DbSet<Models.AccountRestriction> AccountRestrictions { get; set; }
        public DbSet<Models.AccountHistory> AccountHistories { get; set; }
        public DbSet<Models.Nominee> Nominees { get; set; }
        public DbSet<Models.Passbook> Passbooks { get; set; }

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
