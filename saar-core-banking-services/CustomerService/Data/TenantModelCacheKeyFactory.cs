using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace CustomerService.Data
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => context is CustomerDbContext tc
                ? (context.GetType(), tc.TenantSchema, designTime)
                : (context.GetType(), "public", designTime);
    }
}
