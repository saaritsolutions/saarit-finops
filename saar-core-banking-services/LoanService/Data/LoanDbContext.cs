using Microsoft.EntityFrameworkCore;
using LoanService.Models;

namespace LoanService.Data
{
    public class LoanDbContext : DbContext
    {
        public LoanDbContext(DbContextOptions<LoanDbContext> options) : base(options) { }

        public DbSet<LoanAccount> LoanAccounts { get; set; }
    }
}
