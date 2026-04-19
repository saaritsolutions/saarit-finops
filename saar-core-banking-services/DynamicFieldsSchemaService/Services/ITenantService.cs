namespace DynamicFieldsSchemaService.Services
{
    public interface ITenantService
    {
        string TenantId { get; }
    }

    public class HttpContextTenantService : ITenantService
    {
        private readonly IHttpContextAccessor _accessor;
        public HttpContextTenantService(IHttpContextAccessor accessor) => _accessor = accessor;
        public string TenantId =>
            _accessor.HttpContext?.Items["TenantId"] as string ?? "public";
    }
}
