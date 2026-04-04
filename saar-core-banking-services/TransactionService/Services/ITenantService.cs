namespace TransactionService.Services
{
    public interface ITenantService
    {
        string TenantId { get; }
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
