using Microsoft.EntityFrameworkCore;
using WorkflowOrchestrationService.Models;
using WorkflowOrchestrationService.Services;

namespace WorkflowOrchestrationService.Data
{
    /// <summary>
    /// Seeds standard UCB approval levels for LOAN_ORIGINATION at startup.
    /// Idempotent — skips if levels already exist for the workflow type.
    /// Runs for all known tenant schemas (public, ucb_demo, nbfc_demo).
    /// </summary>
    public class ApprovalLevelSeedService : IHostedService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<ApprovalLevelSeedService> _logger;

        private static readonly string[] KnownTenants = { "public", "ucb_demo", "nbfc_demo" };

        private static readonly List<ApprovalLevel> SeedLevels = new()
        {
            new ApprovalLevel
            {
                WorkflowType = "LOAN_ORIGINATION",
                AmountMin    = 0m,
                AmountMax    = decimal.MaxValue,
                Sequence     = 1,
                Label        = "Branch Manager",
                RequiredRole = "CHECKER",
                TimeoutHours = 48
            },
            new ApprovalLevel
            {
                WorkflowType = "LOAN_ORIGINATION",
                AmountMin    = 500_000m,
                AmountMax    = decimal.MaxValue,
                Sequence     = 2,
                Label        = "Credit Committee",
                RequiredRole = "MANAGER",
                TimeoutHours = 72
            },
            new ApprovalLevel
            {
                WorkflowType = "LOAN_ORIGINATION",
                AmountMin    = 2_500_000m,
                AmountMax    = decimal.MaxValue,
                Sequence     = 3,
                Label        = "Board Approval",
                RequiredRole = "BOARD",
                TimeoutHours = 168
            }
        };

        public ApprovalLevelSeedService(IServiceProvider services, ILogger<ApprovalLevelSeedService> logger)
        {
            _services = services;
            _logger   = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            foreach (var tenant in KnownTenants)
            {
                try
                {
                    await SeedForTenantAsync(tenant, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "ApprovalLevelSeedService failed for tenant {Tenant}", tenant);
                }
            }
        }

        private async Task SeedForTenantAsync(string tenantId, CancellationToken ct)
        {
            using var scope = _services.CreateScope();

            // Use a fixed-tenant service so DbContext targets the right schema
            var tenantService = new FixedTenantService(tenantId);

            var optionsMonitor = scope.ServiceProvider.GetRequiredService<
                Microsoft.Extensions.Options.IOptions<Microsoft.EntityFrameworkCore.DbContextOptions<WorkflowDbContext>>>();

            var optionsBuilder = new DbContextOptionsBuilder<WorkflowDbContext>();
            var npgsqlConn = scope.ServiceProvider
                .GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>()
                .GetConnectionString("DefaultConnection");

            if (string.IsNullOrWhiteSpace(npgsqlConn))
            {
                _logger.LogWarning("No DefaultConnection string — skipping ApprovalLevel seed for {Tenant}", tenantId);
                return;
            }

            optionsBuilder.UseNpgsql(npgsqlConn);

            await using var db = new WorkflowDbContext(optionsBuilder.Options, tenantService);

            var existing = await db.ApprovalLevels
                .Where(l => l.WorkflowType == "LOAN_ORIGINATION")
                .AnyAsync(ct);

            if (existing)
            {
                _logger.LogDebug("ApprovalLevels already seeded for tenant {Tenant}", tenantId);
                return;
            }

            db.ApprovalLevels.AddRange(SeedLevels.Select(l => new ApprovalLevel
            {
                WorkflowType = l.WorkflowType,
                AmountMin    = l.AmountMin,
                AmountMax    = l.AmountMax,
                Sequence     = l.Sequence,
                Label        = l.Label,
                RequiredRole = l.RequiredRole,
                TimeoutHours = l.TimeoutHours
            }));

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("ApprovalLevels seeded for tenant {Tenant} (3 levels)", tenantId);
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
