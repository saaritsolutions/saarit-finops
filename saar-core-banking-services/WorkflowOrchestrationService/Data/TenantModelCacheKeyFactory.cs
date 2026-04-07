using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace WorkflowOrchestrationService.Data
{
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime)
            => context is WorkflowDbContext tc
                ? (context.GetType(), tc.TenantSchema, designTime)
                : (context.GetType(), "public", designTime);
    }
}
