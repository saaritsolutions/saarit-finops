using LoanService.Data;
using LoanService.Models;
using Microsoft.EntityFrameworkCore;

namespace LoanService.Services
{
    /// <summary>
    /// Repository for loan product lookups used by eligibility service.
    /// </summary>
    public class LoanProductRepository : ILoanProductRepository
    {
        private readonly LoanDbContext _db;

        public LoanProductRepository(LoanDbContext db)
        {
            _db = db;
        }

        public async Task<LoanProduct?> GetByProductCodeAsync(string productCode)
        {
            return await _db.LoanProducts
                .FirstOrDefaultAsync(p => p.ProductCode == productCode && p.IsActive);
        }
    }
}
