using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace LoanService.Services
{
    public interface IDynamicFormsClient
    {
        /// <summary>
        /// Returns the active form schema for the given form type.
        /// Falls back to null on error (fail-open).
        /// </summary>
        Task<FormSchemaResponse?> GetFormSchemaAsync(string formType);

        /// <summary>
        /// Legacy method — returns null so callers fall back to static schema validation.
        /// Form validation is now delegated to POST /api/forms/validate on DynamicFieldsSchemaService.
        /// </summary>
        Task<List<DynamicField>?> GetLoanFormSchemaAsync(string productType)
            => Task.FromResult<List<DynamicField>?>(null);
    }

    public class DynamicFormsClient : IDynamicFormsClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<DynamicFormsClient> _logger;

        public DynamicFormsClient(HttpClient http, ILogger<DynamicFormsClient> logger)
        {
            _http   = http;
            _logger = logger;
        }

        public async Task<FormSchemaResponse?> GetFormSchemaAsync(string formType)
        {
            try
            {
                var url  = _http.BaseAddress != null
                    ? new Uri(_http.BaseAddress, $"/api/forms/{Uri.EscapeDataString(formType)}").ToString()
                    : $"http://localhost:5013/api/forms/{Uri.EscapeDataString(formType)}";

                var response = await _http.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "DynamicFieldsSchemaService returned {Status} for form '{FormType}'",
                        response.StatusCode, formType);
                    return null;
                }

                return await response.Content.ReadFromJsonAsync<FormSchemaResponse>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "DynamicFieldsSchemaService unreachable (fail-open) — formType: {FormType}", formType);
                return null;
            }
        }
    }

    /// <summary>Response shape from GET /api/forms/{formType}.</summary>
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

    // ── Legacy DynamicField kept for backwards-compat until all callers migrated ──

    public class DynamicField
    {
        public int     Id       { get; set; }
        public string  Name     { get; set; } = string.Empty;
        public string? Label    { get; set; }
        public string? Type     { get; set; }
        public bool?   Required { get; set; }
        public decimal? Min     { get; set; }
        public decimal? Max     { get; set; }
    }
}
