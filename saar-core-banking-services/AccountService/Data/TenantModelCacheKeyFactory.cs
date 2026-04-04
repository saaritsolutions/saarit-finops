using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace AccountService.Data
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => context is AccountDbContext tc
                ? (context.GetType(), tc.TenantSchema, designTime)
                : (context.GetType(), "public", designTime);
    }
}
