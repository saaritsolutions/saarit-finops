using Microsoft.EntityFrameworkCore;
using AccountService.Services;

namespace AccountService.Data
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
            var baseOptions = services.GetRequiredService<DbContextOptions<AccountDbContext>>();

            // Build a tenant-specific connection string with search_path set.
            // This ensures unqualified table names in migration SQL resolve to the tenant schema.
            string tenantConnStr;
            using (var tmp = new AccountDbContext(baseOptions, new StaticTenantService(tenantId)))
                tenantConnStr = new Npgsql.NpgsqlConnectionStringBuilder(tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var tenantOptsBuilder = new DbContextOptionsBuilder<AccountDbContext>().UseNpgsql(tenantConnStr);
            using var context = new AccountDbContext(tenantOptsBuilder.Options, new StaticTenantService(tenantId));

            // 1. Create the PostgreSQL schema if it does not exist
            var conn = context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{tenantId}\"";
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            // 2. Apply all pending EF migrations (search_path routes table creation to tenant schema)
            await context.Database.MigrateAsync();

            // 3. Seed product types (idempotent)
            await SeedProductTypesAsync(context);

            Console.WriteLine("[AccountService] Provisioned schema '{0}'", tenantId);
        }

        private static async Task SeedProductTypesAsync(AccountDbContext db)
        {
            if (db.AccountProductTypes.Any()) return;
            db.AccountProductTypes.AddRange(
                new Models.AccountProductType { Name = "Savings",  Description = "Standard savings account", MinimumOpeningAmount = 500,   IsActive = true },
                new Models.AccountProductType { Name = "Current",  Description = "Current/OD account",        MinimumOpeningAmount = 5000,  IsActive = true },
                new Models.AccountProductType { Name = "FD",       Description = "Fixed deposit",              MinimumOpeningAmount = 1000,  IsActive = true },
                new Models.AccountProductType { Name = "RD",       Description = "Recurring deposit",          MinimumOpeningAmount = 500,   IsActive = true },
                new Models.AccountProductType { Name = "NRE",      Description = "Non-resident external",      MinimumOpeningAmount = 10000, IsActive = true },
                new Models.AccountProductType { Name = "NRO",      Description = "Non-resident ordinary",      MinimumOpeningAmount = 10000, IsActive = true }
            );
            await db.SaveChangesAsync();
        }
    }

    /// <summary>Startup-only stub — returns a fixed tenant ID when no HttpContext is available.</summary>
    internal class StaticTenantService : ITenantService
    {
        public StaticTenantService(string tenantId) => TenantId = tenantId;
        public string TenantId { get; }
    }
}
