using Microsoft.EntityFrameworkCore;
using TransactionService.Services;

namespace TransactionService.Data
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
            var baseOptions = services.GetRequiredService<DbContextOptions<TransactionDbContext>>();

            string tenantConnStr;
            using (var tmp = new TransactionDbContext(baseOptions, new StaticTenantService(tenantId)))
                tenantConnStr = new Npgsql.NpgsqlConnectionStringBuilder(tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var tenantOptsBuilder = new DbContextOptionsBuilder<TransactionDbContext>().UseNpgsql(tenantConnStr);
            using var context = new TransactionDbContext(tenantOptsBuilder.Options, new StaticTenantService(tenantId));

            var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{tenantId}\"";
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            await context.Database.MigrateAsync();
            Console.WriteLine("[TransactionService] Provisioned schema '{0}'", tenantId);
        }
    }

    internal class StaticTenantService : ITenantService
    {
        public StaticTenantService(string tenantId) => TenantId = tenantId;
        public string TenantId { get; }
    }
}
