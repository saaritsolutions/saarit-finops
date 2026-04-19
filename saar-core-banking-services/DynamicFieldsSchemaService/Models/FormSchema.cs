namespace DynamicFieldsSchemaService.Models
{
    /// <summary>
    /// Stores a bank-specific (or default public) form schema as JSON text.
    /// One active record per (FormType, TenantId).
    /// </summary>
    public class FormSchema
    {
        public Guid   Id         { get; set; } = Guid.NewGuid();

        /// <summary>e.g. PERSONAL_LOAN, GOLD_LOAN, ACCOUNT_OPENING_SB</summary>
        public string FormType   { get; set; } = string.Empty;

        /// <summary>"public" = default for all banks; "ucb_demo" = UCB override.</summary>
        public string TenantId   { get; set; } = "public";

        /// <summary>Increments on each PUT (1-based).</summary>
        public int    Version    { get; set; } = 1;

        /// <summary>Full FormSchema JSON (same shape as TypeScript FormSchema interface).</summary>
        public string SchemaJson { get; set; } = "{}";

        /// <summary>Only one active schema per (FormType, TenantId).</summary>
        public bool   IsActive   { get; set; } = true;

        /// <summary>Seed/baseline record — bank admins clone from this, not overwrite it.</summary>
        public bool   IsDefault  { get; set; } = false;

        public string  CreatedBy  { get; set; } = "system";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Optional note saved with each version.</summary>
        public string? Notes     { get; set; }
    }

    /// <summary>
    /// Append-only audit trail — one row per saved version.
    /// </summary>
    public class FormSchemaHistory
    {
        public Guid   Id           { get; set; } = Guid.NewGuid();
        public Guid   FormSchemaId { get; set; }

        public string FormType     { get; set; } = string.Empty;
        public string TenantId     { get; set; } = "public";
        public int    Version      { get; set; }
        public string SchemaJson   { get; set; } = "{}";
        public string SavedBy      { get; set; } = "system";
        public DateTime SavedAt    { get; set; } = DateTime.UtcNow;
        public string? Notes       { get; set; }
    }
}
