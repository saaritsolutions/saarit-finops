using System.Net.Http.Json;

namespace AccountService.Services
{
    public interface IWorkflowClient
    {
        Task<WorkflowInstance> StartAccountOpeningAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default);
        Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default);
    }

    public class WorkflowClient : IWorkflowClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<WorkflowClient> _logger;

        public WorkflowClient(HttpClient httpClient, ILogger<WorkflowClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<WorkflowInstance> StartAccountOpeningAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        {
            var request = new
            {
                workflowType = "ACCOUNT_OPENING",
                entityType   = "ACCOUNT",
                entityId     = entityId,
                context      = context
            };

            var url = BuildUrl("/api/Workflow/start");
            using var response = await _httpClient.PostAsJsonAsync(url, request, cancellationToken: ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await SafeReadAsync(response, ct);
                _logger.LogError("Workflow start failed: {Status} {Reason}. Body: {Body}", (int)response.StatusCode, response.ReasonPhrase, body);
                response.EnsureSuccessStatusCode();
            }
            var instance = await response.Content.ReadFromJsonAsync<WorkflowInstance>(cancellationToken: ct);
            if (instance == null) throw new Exception("Failed to start workflow: empty response");
            return instance;
        }

        public async Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default)
        {
            var request = new { action, context };
            var url = BuildUrl($"/api/Workflow/{instanceId}/process");
            using var response = await _httpClient.PostAsJsonAsync(url, request, cancellationToken: ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await SafeReadAsync(response, ct);
                _logger.LogError("Workflow process failed: {Status} {Reason}. Body: {Body}", (int)response.StatusCode, response.ReasonPhrase, body);
                response.EnsureSuccessStatusCode();
            }
            var result = await response.Content.ReadFromJsonAsync<WorkflowStepResult>(cancellationToken: ct);
            if (result == null) throw new Exception("Failed to process workflow step: empty response");
            return result;
        }

        private string BuildUrl(string relativePath)
        {
            if (_httpClient.BaseAddress != null)
                return new Uri(_httpClient.BaseAddress, relativePath).ToString();
            return "http://localhost:5012".TrimEnd('/') + relativePath;
        }

        private static async Task<string> SafeReadAsync(HttpResponseMessage response, CancellationToken ct)
        {
            try { return await response.Content.ReadAsStringAsync(ct); }
            catch { return string.Empty; }
        }
    }

    public class WorkflowInstance
    {
        public Guid   Id           { get; set; }
        public string WorkflowType { get; set; } = string.Empty;
        public Guid   EntityId     { get; set; }
        public string EntityType   { get; set; } = string.Empty;
        public string CurrentStep  { get; set; } = string.Empty;
        public string Status       { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class WorkflowStepResult
    {
        public Guid    InstanceId     { get; set; }
        public bool    Success        { get; set; }
        public string  CurrentStep    { get; set; } = string.Empty;
        public string? NextStep       { get; set; }
        public string? WorkflowStatus { get; set; }
        public string  Message        { get; set; } = string.Empty;
        public List<string>? RequiredActions { get; set; }
    }
}
