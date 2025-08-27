using Microsoft.EntityFrameworkCore;
using ExpressionBuilderService.Models;

namespace ExpressionBuilderService.Data;

public class ExpressionDbContext : DbContext
{
    public ExpressionDbContext(DbContextOptions<ExpressionDbContext> options) : base(options)
    {
    }

    public DbSet<ExpressionDefinition> ExpressionDefinitions { get; set; }
    public DbSet<ExpressionExecutionLog> ExpressionExecutionLogs { get; set; }
    public DbSet<ExpressionTemplate> ExpressionTemplates { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Expression Definition configuration
        modelBuilder.Entity<ExpressionDefinition>(entity =>
        {
            entity.ToTable("expression_definitions", "expressions");
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => new { e.TenantId, e.ExpressionId })
                  .IsUnique()
                  .HasDatabaseName("IX_ExpressionDefinitions_TenantId_ExpressionId");

            entity.HasIndex(e => e.TenantId)
                  .HasDatabaseName("IX_ExpressionDefinitions_TenantId");

            entity.HasIndex(e => e.Category)
                  .HasDatabaseName("IX_ExpressionDefinitions_Category");

            entity.HasIndex(e => e.Status)
                  .HasDatabaseName("IX_ExpressionDefinitions_Status");

            entity.HasIndex(e => e.CreatedAt)
                  .HasDatabaseName("IX_ExpressionDefinitions_CreatedAt");

                        // Configure properties
            entity.Property(e => e.Id)
                  .HasColumnName("id")
                  .IsRequired()
                  .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.ExpressionId)
                  .HasColumnName("expression_id")
                  .IsRequired()
                  .HasMaxLength(200);

            entity.Property(e => e.Name)
                  .HasColumnName("name")
                  .IsRequired()
                  .HasMaxLength(500);

            entity.Property(e => e.Description)
                  .HasColumnName("description");

            entity.Property(e => e.Category)
                  .HasColumnName("category")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.SubCategory)
                  .HasColumnName("sub_category")
                  .HasMaxLength(100);

            entity.Property(e => e.ExpressionText)
                  .HasColumnName("expression_text")
                  .IsRequired();

            entity.Property(e => e.ReturnType)
                  .HasColumnName("return_type")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.ContextType)
                  .HasColumnName("context_type")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.CompiledCode)
                  .HasColumnName("compiled_code");

            entity.Property(e => e.UsageType)
                  .HasColumnName("usage_type")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.Version)
                  .HasColumnName("version")
                  .IsRequired()
                  .HasMaxLength(50)
                  .HasDefaultValue("1.0");

            entity.Property(e => e.Status)
                  .HasColumnName("status")
                  .IsRequired()
                  .HasMaxLength(50)
                  .HasDefaultValue("Draft");

            entity.Property(e => e.IsGlobal)
                  .HasColumnName("is_global")
                  .HasDefaultValue(false);

            entity.Property(e => e.IsTemplate)
                  .HasColumnName("is_template")
                  .HasDefaultValue(false);

            entity.Property(e => e.AverageExecutionTimeMs)
                  .HasColumnName("average_execution_time_ms")
                  .HasDefaultValue(0);

            entity.Property(e => e.TotalExecutions)
                  .HasColumnName("total_executions")
                  .HasDefaultValue(0L);

            entity.Property(e => e.SuccessfulExecutions)
                  .HasColumnName("successful_executions")
                  .HasDefaultValue(0L);

            entity.Property(e => e.LastExecutionAt)
                  .HasColumnName("last_execution_at");

            entity.Property(e => e.Tags)
                  .HasColumnName("tags")
                  .HasColumnType("jsonb")
                  .HasConversion(
                      tags => System.Text.Json.JsonSerializer.Serialize(tags, (System.Text.Json.JsonSerializerOptions)null),
                      json => System.Text.Json.JsonSerializer.Deserialize<List<string>>(json, (System.Text.Json.JsonSerializerOptions)null) ?? new List<string>())
                  .HasDefaultValue(new List<string>());

            entity.Property(e => e.Dependencies)
                  .HasColumnName("dependencies")
                  .HasColumnType("jsonb")
                  .HasConversion(
                      deps => System.Text.Json.JsonSerializer.Serialize(deps, (System.Text.Json.JsonSerializerOptions)null),
                      json => System.Text.Json.JsonSerializer.Deserialize<List<string>>(json, (System.Text.Json.JsonSerializerOptions)null) ?? new List<string>())
                  .HasDefaultValue(new List<string>());

            entity.Property(e => e.Variables)
                  .HasColumnName("variables")
                  .HasColumnType("jsonb")
                  .HasConversion(
                      vars => System.Text.Json.JsonSerializer.Serialize(vars, (System.Text.Json.JsonSerializerOptions)null),
                      json => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json, (System.Text.Json.JsonSerializerOptions)null) ?? new Dictionary<string, object>())
                  .HasDefaultValue(new Dictionary<string, object>());

            entity.Property(e => e.Functions)
                  .HasColumnName("functions")
                  .HasColumnType("jsonb")
                  .HasConversion(
                      funcs => System.Text.Json.JsonSerializer.Serialize(funcs, (System.Text.Json.JsonSerializerOptions)null),
                      json => System.Text.Json.JsonSerializer.Deserialize<List<string>>(json, (System.Text.Json.JsonSerializerOptions)null) ?? new List<string>())
                  .HasDefaultValue(new List<string>());

            entity.Property(e => e.IntegrationPoints)
                  .HasColumnName("integration_points")
                  .HasColumnType("jsonb")
                  .HasConversion(
                      points => System.Text.Json.JsonSerializer.Serialize(points, (System.Text.Json.JsonSerializerOptions)null),
                      json => System.Text.Json.JsonSerializer.Deserialize<List<string>>(json, (System.Text.Json.JsonSerializerOptions)null) ?? new List<string>())
                  .HasDefaultValue(new List<string>());

            entity.Property(e => e.CreatedAt)
                  .HasColumnName("created_at")
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                  .HasColumnName("updated_at")
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.LastCompiledAt)
                  .HasColumnName("last_compiled_at");

            entity.Property(e => e.ApprovedBy)
                  .HasColumnName("approved_by");

            entity.Property(e => e.ApprovedAt)
                  .HasColumnName("approved_at");

            entity.Property(e => e.CreatedBy)
                  .HasColumnName("created_by")
                  .IsRequired();

            entity.Property(e => e.TenantId)
                  .HasColumnName("tenant_id")
                  .IsRequired();

            // Configure JSON properties
            entity.Property(e => e.Tags)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("jsonb");

            entity.Property(e => e.Dependencies)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("jsonb");

            entity.Property(e => e.Variables)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                  .HasColumnType("jsonb");

            entity.Property(e => e.Functions)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("jsonb");

            entity.Property(e => e.IntegrationPoints)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>())
                  .HasColumnType("jsonb");

            // Configure audit fields
            entity.Property(e => e.CreatedBy).IsRequired();
            entity.Property(e => e.TenantId).IsRequired();
        });

        // Expression Execution Log configuration
        modelBuilder.Entity<ExpressionExecutionLog>(entity =>
        {
            entity.ToTable("expression_execution_logs", "expressions");
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.ExpressionDefinitionId)
                  .HasDatabaseName("IX_ExpressionExecutionLogs_ExpressionDefinitionId");

            entity.HasIndex(e => e.TenantId)
                  .HasDatabaseName("IX_ExpressionExecutionLogs_TenantId");

            entity.HasIndex(e => e.ExecutedAt)
                  .HasDatabaseName("IX_ExpressionExecutionLogs_ExecutedAt");

            entity.HasIndex(e => e.Success)
                  .HasDatabaseName("IX_ExpressionExecutionLogs_Success");

            entity.HasIndex(e => new { e.TenantId, e.ExecutedAt })
                  .HasDatabaseName("IX_ExpressionExecutionLogs_TenantId_ExecutedAt");

            // Configure properties
            entity.Property(e => e.Id)
                  .IsRequired()
                  .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.ExecutionContext)
                  .IsRequired()
                  .HasMaxLength(500);

            entity.Property(e => e.ResultType)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.ErrorMessage)
                  .HasMaxLength(2000);

            entity.Property(e => e.StackTrace)
                  .HasColumnType("text");

            entity.Property(e => e.UserAgent)
                  .HasMaxLength(500);

            entity.Property(e => e.IPAddress)
                  .HasColumnName("IPAddress")
                  .HasColumnType("inet");

            entity.Property(e => e.ExecutedAt)
                  .IsRequired()
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Configure JSON properties
            entity.Property(e => e.InputVariables)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                  .HasColumnType("jsonb");

            entity.Property(e => e.ExecutionResult)
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                  .HasColumnType("jsonb");

            // Configure foreign key relationship
            entity.HasOne(e => e.ExpressionDefinition)
                  .WithMany()
                  .HasForeignKey(e => e.ExpressionDefinitionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(e => e.TenantId).IsRequired();
        });

        // Expression Template configuration
        modelBuilder.Entity<ExpressionTemplate>(entity =>
        {
            entity.ToTable("expression_templates", "expressions");
            entity.HasKey(e => e.Id);

            entity.HasIndex(e => e.TemplateId)
                  .IsUnique()
                  .HasDatabaseName("IX_ExpressionTemplates_TemplateId");

            entity.HasIndex(e => e.Category)
                  .HasDatabaseName("IX_ExpressionTemplates_Category");

            entity.HasIndex(e => e.IsBuiltIn)
                  .HasDatabaseName("IX_ExpressionTemplates_IsBuiltIn");

            entity.HasIndex(e => e.SortOrder)
                  .HasDatabaseName("IX_ExpressionTemplates_SortOrder");

            // Configure properties
            entity.Property(e => e.Id)
                  .HasColumnName("id")
                  .IsRequired()
                  .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.TemplateId)
                  .HasColumnName("template_id")
                  .IsRequired()
                  .HasMaxLength(200);

            entity.Property(e => e.Name)
                  .HasColumnName("name")
                  .IsRequired()
                  .HasMaxLength(500);

            entity.Property(e => e.Description)
                  .HasColumnName("description")
                  .IsRequired()
                  .HasMaxLength(2000);

            entity.Property(e => e.Category)
                  .HasColumnName("category")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.TemplateExpression)
                  .HasColumnName("template_expression")
                  .IsRequired()
                  .HasColumnType("text");

            entity.Property(e => e.SampleExpression)
                  .HasColumnName("sample_expression")
                  .IsRequired()
                  .HasColumnType("text");

            entity.Property(e => e.ContextType)
                  .HasColumnName("context_type")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.ReturnType)
                  .HasColumnName("return_type")
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(e => e.UsageInstructions)
                  .HasColumnName("usage_instructions")
                  .HasColumnType("text");

            entity.Property(e => e.IsBuiltIn)
                  .HasColumnName("is_built_in")
                  .HasDefaultValue(true);

            entity.Property(e => e.SortOrder)
                  .HasColumnName("sort_order")
                  .HasDefaultValue(0);

            entity.Property(e => e.CreatedAt)
                  .HasColumnName("created_at")
                  .IsRequired()
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");

            entity.Property(e => e.UpdatedAt)
                  .HasColumnName("updated_at")
                  .IsRequired()
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");

            // Configure JSON properties
            entity.Property(e => e.TemplateVariables)
                  .HasColumnName("template_variables")
                  .HasConversion(
                      v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                      v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new Dictionary<string, object>())
                  .HasColumnType("jsonb");
        });

        // Configure update timestamp triggers (for PostgreSQL)
        ConfigureUpdateTimestamps(modelBuilder);
    }

    private void ConfigureUpdateTimestamps(ModelBuilder modelBuilder)
    {
        // This would typically be handled by database triggers or overriding SaveChanges
        // For now, we'll handle it in the service layer
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Update timestamps before saving
        var entries = ChangeTracker
            .Entries()
            .Where(e => e.Entity is ExpressionDefinition && e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            if (entry.Entity is ExpressionDefinition expressionDefinition)
            {
                expressionDefinition.UpdatedAt = DateTime.UtcNow;
            }
        }

        var templateEntries = ChangeTracker
            .Entries()
            .Where(e => e.Entity is ExpressionTemplate && e.State == EntityState.Modified);

        foreach (var entry in templateEntries)
        {
            if (entry.Entity is ExpressionTemplate template)
            {
                template.UpdatedAt = DateTime.UtcNow;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
