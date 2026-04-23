using System.Net.Http.Json;

namespace LoanService.Services
{
    public interface IWorkflowClient
    {
        Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default);
        Task<WorkflowStepResult> ProcessStepAsync(Guid instanceId, string action, Dictionary<string, object> context, CancellationToken ct = default);

        /// <summary>Initialise the approval chain for a loan (amount-band lookup). Fire-and-forget safe.</summary>
        Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default);

        /// <summary>Get current approval chain steps. Returns null on error (fail-open).</summary>
        Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default);

        /// <summary>Submit APPROVE or REJECT at the current pending chain step. Fire-and-forget safe.</summary>
        Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default);
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

        public async Task<WorkflowInstance> StartLoanOriginationAsync(Guid entityId, Dictionary<string, object> context, CancellationToken ct = default)
        {
            var request = new
            {
                workflowType = "LOAN_ORIGINATION",
                entityType = "LOAN",
                entityId = entityId,
                context = context
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

        public async Task InitApprovalChainAsync(string applicationId, decimal amount, string workflowType = "LOAN_ORIGINATION", CancellationToken ct = default)
        {
            var body = new { entityId = applicationId, entityType = "LOAN", workflowType, amount };
            var url  = BuildUrl("/api/approval/chain/init");
            using var response = await _httpClient.PostAsJsonAsync(url, body, cancellationToken: ct);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("InitApprovalChain failed for {AppId}: {Status}", applicationId, (int)response.StatusCode);
        }

        public async Task<ApprovalChainDto?> GetApprovalChainAsync(string applicationId, CancellationToken ct = default)
        {
            try
            {
                var url = BuildUrl($"/api/approval/chain?entityId={Uri.EscapeDataString(applicationId)}&entityType=LOAN");
                using var response = await _httpClient.GetAsync(url, ct);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadFromJsonAsync<ApprovalChainDto>(cancellationToken: ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GetApprovalChain failed for {AppId} — returning null (fail-open)", applicationId);
                return null;
            }
        }

        public async Task SubmitChainStepActionAsync(string applicationId, string action, string? performedBy, string? comments, CancellationToken ct = default)
        {
            try
            {
                // Get current pending step
                var chain = await GetApprovalChainAsync(applicationId, ct);
                if (chain == null || !chain.Steps.Any()) return;

                var pendingStep = chain.Steps
                    .Where(s => s.Status == "PENDING")
                    .OrderBy(s => s.Sequence)
                    .FirstOrDefault();

                if (pendingStep == null) return;

                var body = new { action, performedBy, comments };
                var url  = BuildUrl($"/api/approval/chain/steps/{pendingStep.Id}/action");
                using var response = await _httpClient.PostAsJsonAsync(url, body, cancellationToken: ct);
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("SubmitChainStepAction {Action} failed for {AppId}: {Status}", action, applicationId, (int)response.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SubmitChainStepAction failed for {AppId} — continuing (fail-open)", applicationId);
            }
        }

        private string BuildUrl(string relativePath)
        {
            if (_httpClient.BaseAddress != null)
            {
                return new Uri(_httpClient.BaseAddress, relativePath).ToString();
            }
            // Fallback to well-known local dev port
            var baseUrl = "http://localhost:5012";
            return baseUrl.TrimEnd('/') + relativePath;
        }

        private static async Task<string> SafeReadAsync(HttpResponseMessage response, CancellationToken ct)
        {
            try
            {
                return await response.Content.ReadAsStringAsync(ct);
            }
            catch
            {
                return string.Empty;
            }
        }
    }

    // Minimal copies of models to map response
    public class WorkflowInstance
    {
        public Guid Id { get; set; }
        public string WorkflowType { get; set; } = string.Empty;
        public Guid EntityId { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public string CurrentStep { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public Dictionary<string, object> Context { get; set; } = new();
    }

    public class WorkflowStepResult
    {
        public Guid InstanceId { get; set; }
        public bool Success { get; set; }
        public string CurrentStep { get; set; } = string.Empty;
        public string? NextStep { get; set; }
        public string? WorkflowStatus { get; set; }
        public string Message { get; set; } = string.Empty;
        // Optional list of actions the UI should render for the current step
        public List<string>? RequiredActions { get; set; }
    }

    /// <summary>Minimal DTO mirroring WorkflowOrchestrationService ApprovalChainResponse.</summary>
    public class ApprovalChainDto
    {
        public string                   EntityId   { get; set; } = string.Empty;
        public string                   EntityType { get; set; } = string.Empty;
        public List<ApprovalChainStepDto> Steps    { get; set; } = new();
    }

    public class ApprovalChainStepDto
    {
        public Guid     Id           { get; set; }
        public int      Sequence     { get; set; }
        public string   Label        { get; set; } = string.Empty;
        public string   RequiredRole { get; set; } = string.Empty;
        public string   Status       { get; set; } = string.Empty;  // PENDING|APPROVED|REJECTED|SKIPPED
        public string?  PerformedBy  { get; set; }
        public string?  Comments     { get; set; }
        public DateTime? ActionedAt  { get; set; }
    }
}
