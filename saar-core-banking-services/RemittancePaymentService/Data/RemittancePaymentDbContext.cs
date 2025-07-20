using Microsoft.EntityFrameworkCore;
using RemittancePaymentService.Models;

namespace RemittancePaymentService.Data
{
    public class RemittancePaymentDbContext : DbContext
    {
        public RemittancePaymentDbContext(DbContextOptions<RemittancePaymentDbContext> options) : base(options) { }

        public DbSet<Remittance> Remittances { get; set; }
    }
}
