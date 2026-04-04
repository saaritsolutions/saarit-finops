using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace TransactionService.Data
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => context is TransactionDbContext tc
                ? (context.GetType(), tc.TenantSchema, designTime)
                : (context.GetType(), "public", designTime);
    }
}
