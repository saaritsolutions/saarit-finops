using LoanService.Services;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using System.Text;

namespace LoanService.Controllers
{
    [ApiController]
    [Route("api/admin/config")]
    public class AdminConfigController : ControllerBase
    {
        private readonly IWorkflowOrchestrator _orchestrator;
        private readonly IDynamicFormsClient   _forms;
        private readonly IHttpClientFactory    _httpClientFactory;
        private readonly IConfiguration        _config;
        private readonly ILogger<AdminConfigController> _logger;

        public AdminConfigController(
            IWorkflowOrchestrator orchestrator,
            IDynamicFormsClient forms,
            IHttpClientFactory httpClientFactory,
            IConfiguration config,
            ILogger<AdminConfigController> logger)
        {
            _orchestrator      = orchestrator;
            _forms             = forms;
            _httpClientFactory = httpClientFactory;
            _config            = config;
            _logger            = logger;
        }

        [HttpGet("workflow/{workflowType}")]
        public async Task<ActionResult<WorkflowDefinition>> GetWorkflow(string workflowType)
        {
            var def = await _orchestrator.GetDefinitionAsync(workflowType);
            return Ok(def);
        }

        [HttpPost("workflow/{workflowType}")]
        public async Task<ActionResult> SaveWorkflow(string workflowType, [FromBody] WorkflowDefinition definition)
        {
            await _orchestrator.SaveDefinitionAsync(workflowType, definition);
            return NoContent();
        }

        // ── SAAR-DFS-001: proxy form schema CRUD to DynamicFieldsSchemaService ──

        /// <summary>
        /// Returns the active form schema for a product type.
        /// Proxies to DynamicFieldsSchemaService when EnableDynamicForms=true;
        /// falls back to static JSON file otherwise.
        /// </summary>
        [HttpGet("forms/{productType}")]
        public async Task<ActionResult> GetFormSchema(string productType)
        {
            if (_config.GetValue<bool>("FeatureFlags:EnableDynamicForms"))
            {
                var schema = await _forms.GetFormSchemaAsync(productType.ToUpperInvariant());
                if (schema != null)
                    return Content(schema.Schema, "application/json");
                // Fall through to static fallback if DFS returns null
            }

            // Static file fallback (kept for backwards-compat / service-down scenarios)
            var staticPath = Path.Combine(AppContext.BaseDirectory, "Static",
                $"loan_form_{productType.ToUpperInvariant()}.json");
            if (System.IO.File.Exists(staticPath))
            {
                var json = await System.IO.File.ReadAllTextAsync(staticPath);
                return Content(json, "application/json");
            }

            return NotFound(new { error = $"Schema for '{productType}' not found." });
        }

        /// <summary>
        /// Saves a form schema.
        /// Proxies to DynamicFieldsSchemaService when EnableDynamicForms=true;
        /// falls back to writing a static JSON file otherwise.
        /// </summary>
        [HttpPost("forms/{productType}")]
        public async Task<ActionResult> SaveFormSchema(string productType)
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            if (_config.GetValue<bool>("FeatureFlags:EnableDynamicForms"))
            {
                try
                {
                    var dfsBase = _config["Services:DynamicFormsBaseUrl"] ?? "http://localhost:5013";
                    var client  = _httpClientFactory.CreateClient();
                    client.BaseAddress = new Uri(dfsBase.EndsWith('/') ? dfsBase : dfsBase + "/");

                    // Forward the Authorization header so the DFS can identify the caller
                    if (Request.Headers.TryGetValue("Authorization", out var auth))
                        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", (string?)auth);

                    // Forward the tenant header
                    if (Request.Headers.TryGetValue("X-Tenant-ID", out var tenantHdr))
                        client.DefaultRequestHeaders.TryAddWithoutValidation("X-Tenant-ID", (string?)tenantHdr);

                    var payload = new StringContent(
                        System.Text.Json.JsonSerializer.Serialize(new { schema = body }),
                        Encoding.UTF8, "application/json");

                    var response = await client.PutAsync(
                        $"/api/forms/{Uri.EscapeDataString(productType.ToUpperInvariant())}", payload);

                    if (response.IsSuccessStatusCode)
                        return NoContent();

                    var err = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("DFS PUT schema failed {Status}: {Err}", response.StatusCode, err);
                    return StatusCode((int)response.StatusCode, new { error = err });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "DFS unreachable — falling back to static file save");
                }
            }

            // Static file fallback
            var staticDir  = Path.Combine(AppContext.BaseDirectory, "Static");
            Directory.CreateDirectory(staticDir);
            var staticPath = Path.Combine(staticDir, $"loan_form_{productType.ToUpperInvariant()}.json");
            await System.IO.File.WriteAllTextAsync(staticPath, body);
            return NoContent();
        }
    }
}
