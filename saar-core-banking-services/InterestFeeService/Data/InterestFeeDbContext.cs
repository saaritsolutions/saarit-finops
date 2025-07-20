using Microsoft.EntityFrameworkCore;
using InterestFeeService.Models;

namespace InterestFeeService.Data
{
    public class InterestFeeDbContext : DbContext
    {
        public InterestFeeDbContext(DbContextOptions<InterestFeeDbContext> options) : base(options) { }

        public DbSet<InterestFee> InterestFees { get; set; }
    }
}
