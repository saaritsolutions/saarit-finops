using Microsoft.EntityFrameworkCore;
using TransactionService.Models;

namespace TransactionService.Data
{
    public class TransactionDbContext : DbContext
    {
        public TransactionDbContext(DbContextOptions<TransactionDbContext> options) : base(options) { }

        public DbSet<Receipt> Receipts { get; set; }
        public DbSet<AccountHistory> AccountHistories { get; set; }
        // Add DbSet for other transaction-related models as needed
    }
}
