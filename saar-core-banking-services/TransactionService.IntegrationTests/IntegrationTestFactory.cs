using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace TransactionService.IntegrationTests;

/// <summary>
/// WebApplicationFactory for TransactionService integration tests.
///
/// Uses TXN_USE_INMEMORY_DB=true so tests run without a real Postgres server
/// (CI-safe). To run against real Postgres, set the environment variable
/// INTEGRATION_REAL_DB=true and ensure ConnectionStrings__DefaultConnection
/// points to a writable Postgres instance.
/// </summary>
public class IntegrationTestFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Use InMemory EF provider unless caller explicitly requests real DB
        var useRealDb = Environment.GetEnvironmentVariable("INTEGRATION_REAL_DB");
        if (string.IsNullOrWhiteSpace(useRealDb) || useRealDb != "true")
        {
            builder.UseSetting("TXN_USE_INMEMORY_DB", "true");
            // Also set via environment so Program.cs env-var check picks it up
            Environment.SetEnvironmentVariable("TXN_USE_INMEMORY_DB", "true");
        }

        builder.UseEnvironment("IntegrationTest");

        builder.ConfigureAppConfiguration(cfg =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                // Disable JWT auth so tests can call APIs without tokens
                ["Authentication:JwtBearer:Enabled"] = "false",
                // Suppress LedgerSeedService startup noise
                ["SeedLedger"] = "false",
            });
        });
    }
}
