using Microsoft.EntityFrameworkCore;
using WorkflowOrchestrationService.Services;

namespace WorkflowOrchestrationService.Data
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
            var baseOptions = services.GetRequiredService<DbContextOptions<WorkflowDbContext>>();

            string tenantConnStr;
            using (var tmp = new WorkflowDbContext(baseOptions, new FixedTenantService(tenantId)))
                tenantConnStr = new Npgsql.NpgsqlConnectionStringBuilder(tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var tenantOptsBuilder = new DbContextOptionsBuilder<WorkflowDbContext>().UseNpgsql(tenantConnStr);
            using var context = new WorkflowDbContext(tenantOptsBuilder.Options, new FixedTenantService(tenantId));

            var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{tenantId}\"";
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            await context.Database.MigrateAsync();
            Console.WriteLine("[WorkflowOrchestrationService] Provisioned schema '{0}'", tenantId);
        }
    }
}
