using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using WorkflowOrchestrationService.Models;
using WorkflowOrchestrationService.Services;

namespace WorkflowOrchestrationService.Data
{
    public class WorkflowDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime)
        public WorkflowDbContext(DbContextOptions<WorkflowDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling)
        public WorkflowDbContext(DbContextOptions<WorkflowDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        public DbSet<WorkflowInstanceEntity> WorkflowInstances  { get; set; }
        public DbSet<ApprovalLevel>          ApprovalLevels     { get; set; }
        public DbSet<ApprovalChainStep>      ApprovalChainSteps { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema(TenantSchema);

            modelBuilder.Entity<WorkflowInstanceEntity>(e =>
            {
                e.HasIndex(w => w.EntityId);
                e.HasIndex(w => w.Status);
            });

            modelBuilder.Entity<ApprovalLevel>(e =>
            {
                e.HasIndex(l => new { l.WorkflowType, l.Sequence });
                e.Property(l => l.AmountMin).HasColumnType("numeric(18,2)");
                e.Property(l => l.AmountMax).HasColumnType("numeric(18,2)");
            });

            modelBuilder.Entity<ApprovalChainStep>(e =>
            {
                e.HasIndex(s => new { s.EntityId, s.EntityType });
                e.HasIndex(s => s.Status);
            });
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
            optionsBuilder.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }
    }
}
