using Microsoft.EntityFrameworkCore;

namespace AccountService.Data
{
    public class AccountDbContext : DbContext
    {
        public AccountDbContext(DbContextOptions<AccountDbContext> options) : base(options) { }

        public DbSet<Models.Account> Accounts { get; set; }
        public DbSet<Models.AccountProductType> AccountProductTypes { get; set; }
        public DbSet<Models.AccountRestriction> AccountRestrictions { get; set; }
        public DbSet<Models.AccountHistory> AccountHistories { get; set; }
        public DbSet<Models.Nominee> Nominees { get; set; }
        public DbSet<Models.Passbook> Passbooks { get; set; }
        // Add other DbSets as needed
    }
}
