using GLAccountingService.Models;
using Microsoft.EntityFrameworkCore;

namespace GLAccountingService.Data
{
    public class GLAccountingDbContext : DbContext
    {
        public GLAccountingDbContext(DbContextOptions<GLAccountingDbContext> options) : base(options) { }

        public DbSet<GeneralLedgerAccount> GeneralLedgerAccounts { get; set; }
        public DbSet<JournalEntry> JournalEntries { get; set; }
    }
}
