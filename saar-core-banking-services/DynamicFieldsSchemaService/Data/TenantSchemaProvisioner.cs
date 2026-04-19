using Microsoft.EntityFrameworkCore;
using DynamicFieldsSchemaService.Services;

namespace DynamicFieldsSchemaService.Data
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
            var baseOptions = services.GetRequiredService<DbContextOptions<DynamicFormsDbContext>>();

            // Build tenant-specific connection string with SearchPath
            string tenantConnStr;
            using (var tmp = new DynamicFormsDbContext(baseOptions, new StaticTenantService(tenantId)))
                tenantConnStr = new Npgsql.NpgsqlConnectionStringBuilder(
                    tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var tenantOptsBuilder = new DbContextOptionsBuilder<DynamicFormsDbContext>()
                .UseNpgsql(tenantConnStr);
            using var context = new DynamicFormsDbContext(
                tenantOptsBuilder.Options, new StaticTenantService(tenantId));

            // 1. Create PostgreSQL schema (EF9 handles __EFMigrationsHistory automatically)
            var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"CREATE SCHEMA IF NOT EXISTS ""{tenantId}"";";
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            // 2. Apply pending EF migrations (SearchPath routes DDL to tenant schema)
            await context.Database.MigrateAsync();

            Console.WriteLine("[DynamicFieldsSchemaService] Provisioned schema '{0}'", tenantId);
        }
    }

    /// <summary>Startup-only stub for provisioning when no HttpContext is available.</summary>
    internal class StaticTenantService : ITenantService
    {
        public StaticTenantService(string tenantId) => TenantId = tenantId;
        public string TenantId { get; }
    }
}
