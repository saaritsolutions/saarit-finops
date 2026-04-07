namespace WorkflowOrchestrationService.Services
{
    public interface ITenantService
    {
        string TenantId { get; }
    }

    /// <summary>Fixed-tenant implementation used by background seeders.</summary>
    public class FixedTenantService : ITenantService
    {
        public FixedTenantService(string tenantId) => TenantId = tenantId;
        public string TenantId { get; }
    }

    public class HttpContextTenantService : ITenantService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public HttpContextTenantService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public string TenantId =>
            _httpContextAccessor.HttpContext?.Items["TenantId"] as string ?? "public";
    }
}
