using Microsoft.EntityFrameworkCore;
using CustomerService.Services;

namespace CustomerService.Data
{
    public static class TenantSchemaProvisioner
    {
        private static readonly string[] KnownTenants = { "public", "ucb_demo", "nbfc_demo" };

        public static async Task ProvisionAllSchemasAsync(IServiceProvider services)
        {
            foreach (var tenantId in KnownTenants)
                await ProvisionSchemaAsync(services, tenantId);
        }

        private static async Task ProvisionSchemaAsync(IServiceProvider services, string tenantId)
        {
            var baseOptions = services.GetRequiredService<DbContextOptions<CustomerDbContext>>();

            string tenantConnStr;
            using (var tmp = new CustomerDbContext(baseOptions, new StaticTenantService(tenantId)))
                tenantConnStr = new Npgsql.NpgsqlConnectionStringBuilder(tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var tenantOptsBuilder = new DbContextOptionsBuilder<CustomerDbContext>().UseNpgsql(tenantConnStr);
            using var context = new CustomerDbContext(tenantOptsBuilder.Options, new StaticTenantService(tenantId));

            var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{tenantId}\"";
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            await context.Database.MigrateAsync();
            Console.WriteLine("[CustomerService] Provisioned schema '{0}'", tenantId);
        }
    }

    internal class StaticTenantService : ITenantService
    {
        public StaticTenantService(string tenantId) => TenantId = tenantId;
        public string TenantId { get; }
    }
}
