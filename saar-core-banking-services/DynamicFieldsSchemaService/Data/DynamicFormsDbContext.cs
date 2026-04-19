using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using DynamicFieldsSchemaService.Models;
using DynamicFieldsSchemaService.Services;

namespace DynamicFieldsSchemaService.Data
{
    public class DynamicFormsDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime — ITenantService is request-scoped)
        public DynamicFormsDbContext(DbContextOptions<DynamicFormsDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling — defaults to "public" schema)
        public DynamicFormsDbContext(DbContextOptions<DynamicFormsDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        public DbSet<FormSchema>        FormSchemas        { get; set; }
        public DbSet<FormSchemaHistory> FormSchemaHistories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema(TenantSchema);

            modelBuilder.Entity<FormSchema>(e =>
            {
                e.HasKey(f => f.Id);
                e.Property(f => f.FormType).IsRequired().HasMaxLength(50);
                e.Property(f => f.TenantId).IsRequired().HasMaxLength(50);
                e.Property(f => f.SchemaJson).IsRequired().HasColumnType("text");
                e.Property(f => f.CreatedBy).HasMaxLength(100);
                e.Property(f => f.Notes).HasMaxLength(500);
                // Unique: only one active schema per (FormType, TenantId)
                e.HasIndex(f => new { f.FormType, f.TenantId, f.IsActive }).HasDatabaseName("IX_FormSchemas_FormType_TenantId_Active");
                e.HasIndex(f => new { f.FormType, f.TenantId }).HasDatabaseName("IX_FormSchemas_FormType_TenantId");
            });

            modelBuilder.Entity<FormSchemaHistory>(e =>
            {
                e.HasKey(h => h.Id);
                e.Property(h => h.FormType).IsRequired().HasMaxLength(50);
                e.Property(h => h.TenantId).IsRequired().HasMaxLength(50);
                e.Property(h => h.SchemaJson).IsRequired().HasColumnType("text");
                e.Property(h => h.SavedBy).HasMaxLength(100);
                e.Property(h => h.Notes).HasMaxLength(500);
                e.HasIndex(h => new { h.FormSchemaId, h.Version }).HasDatabaseName("IX_FormSchemaHistory_SchemaId_Version");
            });
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
            optionsBuilder.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }
    }

    /// <summary>Cache key includes tenant schema so EF compiles one model per tenant.</summary>
    public class TenantModelCacheKeyFactory : IModelCacheKeyFactory
    {
        public object Create(DbContext context, bool designTime) =>
            context is DynamicFormsDbContext db
                ? (context.GetType(), db.TenantSchema, designTime)
                : (context.GetType(), designTime);
    }
}
