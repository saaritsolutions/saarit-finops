namespace LoanService.Middleware
{
    public class TenantResolutionMiddleware
    {
        private readonly RequestDelegate _next;
        private static readonly HashSet<string> _knownTenants =
            new(StringComparer.OrdinalIgnoreCase) { "public", "ucb_demo", "nbfc_demo" };

        public TenantResolutionMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            var tenantId = "public";

            var claim = context.User.FindFirst("tenant_id");
            if (claim is not null && !string.IsNullOrWhiteSpace(claim.Value))
                tenantId = claim.Value;

            else if (context.Request.Headers.TryGetValue("X-Tenant-ID", out var headerVal)
                     && !string.IsNullOrWhiteSpace(headerVal))
                tenantId = headerVal.ToString();

            if (!_knownTenants.Contains(tenantId))
                tenantId = "public";

            context.Items["TenantId"] = tenantId;
            await _next(context);
        }
    }

    public static class TenantResolutionMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantResolution(this IApplicationBuilder app)
            => app.UseMiddleware<TenantResolutionMiddleware>();
    }
}
