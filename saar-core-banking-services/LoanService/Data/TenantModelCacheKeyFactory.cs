using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace LoanService.Data
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => context is LoanDbContext tc
                ? (context.GetType(), tc.TenantSchema, designTime)
                : (context.GetType(), "public", designTime);
    }
}
