using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using DynamicFieldsSchemaService.Data;
using DynamicFieldsSchemaService.Models;
using DynamicFieldsSchemaService.Services;

namespace DynamicFieldsSchemaService.Controllers
{
    [ApiController]
    [Route("api/forms")]
    public class FormsController : ControllerBase
    {
        private readonly DynamicFormsDbContext _db;
        private readonly ITenantService _tenant;
        private readonly ILogger<FormsController> _logger;

        public FormsController(DynamicFormsDbContext db, ITenantService tenant,
            ILogger<FormsController> logger)
        {
            _db     = db;
            _tenant = tenant;
            _logger = logger;
        }

        // ── GET /api/forms/{formType} ─────────────────────────────────────────
        /// <summary>
        /// Returns the active schema for the given form type.
        /// Lookup order: tenant-specific → public default → 404.
        /// </summary>
        [HttpGet("{formType}")]
        public async Task<ActionResult<FormSchemaResponse>> GetSchema(string formType)
        {
            var tenantId = _tenant.TenantId;
            var upper    = formType.ToUpperInvariant();

            // 1. Tenant-specific active schema
            var schema = await _db.FormSchemas
                .Where(s => s.FormType == upper && s.TenantId == tenantId && s.IsActive)
                .FirstOrDefaultAsync();

            // 2. Public default fallback
            if (schema == null && tenantId != "public")
                schema = await _db.FormSchemas
                    .Where(s => s.FormType == upper && s.TenantId == "public" && s.IsActive)
                    .FirstOrDefaultAsync();

            if (schema == null)
                return NotFound(new { error = $"Form schema '{upper}' not found." });

            return Ok(ToResponse(schema));
        }

        // ── GET /api/forms ────────────────────────────────────────────────────
        /// <summary>Lists all schemas for the current tenant (including inactive versions).</summary>
        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<FormSchemaListItem>>> ListSchemas()
        {
            var tenantId = _tenant.TenantId;
            var schemas  = await _db.FormSchemas
                .Where(s => s.TenantId == tenantId || s.TenantId == "public")
                .OrderBy(s => s.FormType).ThenByDescending(s => s.Version)
                .Select(s => new FormSchemaListItem
                {
                    FormType  = s.FormType,
                    TenantId  = s.TenantId,
                    Version   = s.Version,
                    IsActive  = s.IsActive,
                    IsDefault = s.IsDefault,
                    UpdatedAt = s.UpdatedAt,
                    UpdatedBy = s.CreatedBy,
                    Notes     = s.Notes
                })
                .ToListAsync();

            return Ok(schemas);
        }

        // ── PUT /api/forms/{formType} ─────────────────────────────────────────
        /// <summary>
        /// Saves (creates or overwrites) the active schema for the current tenant.
        /// Deactivates the previous version and appends to history.
        /// </summary>
        [HttpPut("{formType}")]
        [Authorize]
        public async Task<ActionResult<FormSchemaResponse>> SaveSchema(
            string formType, [FromBody] SaveSchemaRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Schema))
                return BadRequest(new { error = "Schema is required." });

            // Validate it's at least parseable JSON
            try { JsonDocument.Parse(request.Schema); }
            catch { return BadRequest(new { error = "Schema must be valid JSON." }); }

            var tenantId  = _tenant.TenantId;
            var upper     = formType.ToUpperInvariant();
            var savedBy   = User?.Identity?.Name ?? "system";

            // Deactivate current active schema (if any)
            var current = await _db.FormSchemas
                .Where(s => s.FormType == upper && s.TenantId == tenantId && s.IsActive)
                .FirstOrDefaultAsync();

            int nextVersion = 1;
            if (current != null)
            {
                // Archive current to history
                _db.FormSchemaHistories.Add(new FormSchemaHistory
                {
                    FormSchemaId = current.Id,
                    FormType     = current.FormType,
                    TenantId     = current.TenantId,
                    Version      = current.Version,
                    SchemaJson   = current.SchemaJson,
                    SavedBy      = savedBy,
                    SavedAt      = DateTime.UtcNow,
                    Notes        = $"Superseded by v{current.Version + 1}"
                });
                nextVersion = current.Version + 1;
                current.IsActive  = false;
                current.UpdatedAt = DateTime.UtcNow;
            }

            // Create new active schema
            var newSchema = new FormSchema
            {
                FormType  = upper,
                TenantId  = tenantId,
                Version   = nextVersion,
                SchemaJson = request.Schema,
                IsActive  = true,
                IsDefault = false,
                CreatedBy = savedBy,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Notes     = request.Notes
            };
            _db.FormSchemas.Add(newSchema);
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Schema '{FormType}' v{Version} saved for tenant '{Tenant}' by {User}",
                upper, nextVersion, tenantId, savedBy);

            return Ok(ToResponse(newSchema));
        }

        // ── POST /api/forms/{formType}/reset ──────────────────────────────────
        /// <summary>
        /// Resets the current tenant to the public default by deactivating any tenant override.
        /// </summary>
        [HttpPost("{formType}/reset")]
        [Authorize]
        public async Task<ActionResult> ResetToDefault(string formType)
        {
            var tenantId = _tenant.TenantId;
            if (tenantId == "public")
                return BadRequest(new { error = "Cannot reset the public default schema." });

            var upper = formType.ToUpperInvariant();
            var current = await _db.FormSchemas
                .Where(s => s.FormType == upper && s.TenantId == tenantId && s.IsActive)
                .FirstOrDefaultAsync();

            if (current == null)
                return Ok(new { message = "No tenant override found — already using public default." });

            current.IsActive  = false;
            current.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Schema '{FormType}' tenant override removed for '{Tenant}'", upper, tenantId);

            return Ok(new { message = $"Tenant override removed. '{upper}' now uses public default." });
        }

        // ── GET /api/forms/{formType}/history ─────────────────────────────────
        /// <summary>Returns version history for a form type in the current tenant (latest first).</summary>
        [HttpGet("{formType}/history")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<FormSchemaHistoryItem>>> GetHistory(
            string formType, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var tenantId = _tenant.TenantId;
            var upper    = formType.ToUpperInvariant();

            var history = await _db.FormSchemaHistories
                .Where(h => h.FormType == upper && h.TenantId == tenantId)
                .OrderByDescending(h => h.SavedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(h => new FormSchemaHistoryItem
                {
                    Version    = h.Version,
                    SavedBy    = h.SavedBy,
                    SavedAt    = h.SavedAt,
                    Notes      = h.Notes,
                    SchemaJson = h.SchemaJson
                })
                .ToListAsync();

            return Ok(history);
        }

        // ── POST /api/forms/validate ──────────────────────────────────────────
        /// <summary>
        /// Validates a form submission payload against the active schema.
        /// Returns field-level errors for required, min/max, maxLength, regex violations.
        /// </summary>
        [HttpPost("validate")]
        public async Task<ActionResult<ValidateFormResponse>> ValidateForm(
            [FromBody] ValidateFormRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FormType))
                return BadRequest(new { error = "FormType is required." });

            var upper    = request.FormType.ToUpperInvariant();
            var tenantId = _tenant.TenantId;

            // Resolve schema (same fallback chain as GET)
            var schema = await _db.FormSchemas
                .Where(s => s.FormType == upper && s.TenantId == tenantId && s.IsActive)
                .FirstOrDefaultAsync();
            if (schema == null && tenantId != "public")
                schema = await _db.FormSchemas
                    .Where(s => s.FormType == upper && s.TenantId == "public" && s.IsActive)
                    .FirstOrDefaultAsync();

            if (schema == null)
                return NotFound(new { error = $"Form schema '{upper}' not found." });

            var errors   = new List<ValidationError>();
            var warnings = new List<string>();

            // Parse schema and data
            JsonElement schemaDoc;
            try { schemaDoc = JsonDocument.Parse(schema.SchemaJson).RootElement; }
            catch { return StatusCode(500, new { error = "Stored schema is invalid JSON." }); }

            var data = request.Data ?? new Dictionary<string, JsonElement>();

            if (!schemaDoc.TryGetProperty("fields", out var fieldsEl) ||
                fieldsEl.ValueKind != JsonValueKind.Array)
                return Ok(new ValidateFormResponse { IsValid = true, Errors = errors, Warnings = warnings });

            // Collect known field names for unknown-field warning
            var knownFields = new HashSet<string>();

            foreach (var fieldEl in fieldsEl.EnumerateArray())
            {
                if (!fieldEl.TryGetProperty("name", out var nameProp)) continue;
                var name = nameProp.GetString() ?? "";
                knownFields.Add(name);

                var label    = fieldEl.TryGetProperty("label",    out var lp) ? (lp.GetString() ?? name) : name;
                var required = fieldEl.TryGetProperty("required", out var rp) && rp.GetBoolean();

                data.TryGetValue(name, out var valueEl);
                var valueStr = valueEl.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
                    ? null : valueEl.ToString();

                // Required check
                if (required && string.IsNullOrWhiteSpace(valueStr))
                {
                    errors.Add(new ValidationError { Field = name, Message = $"{label} is required." });
                    continue;
                }

                if (string.IsNullOrWhiteSpace(valueStr)) continue;

                // Numeric range checks
                if (fieldEl.TryGetProperty("type", out var typeProp) &&
                    typeProp.GetString() == "number" &&
                    decimal.TryParse(valueStr, out var numVal))
                {
                    if (fieldEl.TryGetProperty("min", out var minProp) &&
                        minProp.TryGetDecimal(out var minVal) && numVal < minVal)
                        errors.Add(new ValidationError { Field = name, Message = $"{label} must be at least {minVal}." });

                    if (fieldEl.TryGetProperty("max", out var maxProp) &&
                        maxProp.TryGetDecimal(out var maxVal) && numVal > maxVal)
                        errors.Add(new ValidationError { Field = name, Message = $"{label} must be at most {maxVal}." });
                }

                // MaxLength check
                if (fieldEl.TryGetProperty("maxLength", out var mlProp) &&
                    mlProp.TryGetInt32(out var maxLen) && valueStr.Length > maxLen)
                    errors.Add(new ValidationError { Field = name, Message = $"{label} must not exceed {maxLen} characters." });

                // Regex check
                if (fieldEl.TryGetProperty("validationRegex", out var rxProp))
                {
                    var pattern = rxProp.GetString();
                    if (!string.IsNullOrWhiteSpace(pattern))
                    {
                        try
                        {
                            if (!System.Text.RegularExpressions.Regex.IsMatch(valueStr, pattern))
                                errors.Add(new ValidationError { Field = name, Message = $"{label} format is invalid." });
                        }
                        catch { /* ignore bad regex */ }
                    }
                }
            }

            // Unknown field warnings
            foreach (var key in data.Keys)
                if (!knownFields.Contains(key))
                    warnings.Add($"Unknown field: {key}");

            return Ok(new ValidateFormResponse
            {
                IsValid  = errors.Count == 0,
                Errors   = errors,
                Warnings = warnings
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static FormSchemaResponse ToResponse(FormSchema s) => new()
        {
            FormType  = s.FormType,
            TenantId  = s.TenantId,
            Version   = s.Version,
            IsDefault = s.IsDefault,
            UpdatedAt = s.UpdatedAt,
            UpdatedBy = s.CreatedBy,
            Notes     = s.Notes,
            Schema    = s.SchemaJson
        };
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    public class FormSchemaResponse
    {
        public string   FormType  { get; set; } = "";
        public string   TenantId  { get; set; } = "";
        public int      Version   { get; set; }
        public bool     IsDefault { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string?  UpdatedBy { get; set; }
        public string?  Notes     { get; set; }
        /// <summary>Raw JSON string of the form schema (FormSchema TS interface shape).</summary>
        public string   Schema    { get; set; } = "{}";
    }

    public class FormSchemaListItem
    {
        public string   FormType  { get; set; } = "";
        public string   TenantId  { get; set; } = "";
        public int      Version   { get; set; }
        public bool     IsActive  { get; set; }
        public bool     IsDefault { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string?  UpdatedBy { get; set; }
        public string?  Notes     { get; set; }
    }

    public class SaveSchemaRequest
    {
        /// <summary>Raw JSON string of the schema.</summary>
        public string  Schema { get; set; } = "";
        public string? Notes  { get; set; }
    }

    public class FormSchemaHistoryItem
    {
        public int      Version    { get; set; }
        public string   SavedBy    { get; set; } = "";
        public DateTime SavedAt    { get; set; }
        public string?  Notes      { get; set; }
        public string   SchemaJson { get; set; } = "{}";
    }

    public class ValidateFormRequest
    {
        public string                            FormType { get; set; } = "";
        public Dictionary<string, JsonElement>?  Data     { get; set; }
    }

    public class ValidateFormResponse
    {
        public bool                  IsValid  { get; set; }
        public List<ValidationError> Errors   { get; set; } = new();
        public List<string>          Warnings { get; set; } = new();
    }

    public class ValidationError
    {
        public string Field   { get; set; } = "";
        public string Message { get; set; } = "";
    }
}
