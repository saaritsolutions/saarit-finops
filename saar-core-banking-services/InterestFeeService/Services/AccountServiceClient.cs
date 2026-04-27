using System.Net.Http.Json;

namespace InterestFeeService.Services
{
    public class AccountServiceClient : IAccountServiceClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<AccountServiceClient> _logger;

        public AccountServiceClient(HttpClient http, ILogger<AccountServiceClient> logger)
        {
            _http = http;
            _logger = logger;
        }

        public async Task<AccountInfo?> GetAccountAsync(int accountId)
        {
            try
            {
                return await _http.GetFromJsonAsync<AccountInfo>($"/api/account/{accountId}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GetAccountAsync failed for accountId={Id}", accountId);
                return null;
            }
        }

        public async Task<List<InterestEligibleAccount>> GetInterestEligibleAsync(
            string tenantId, CancellationToken ct = default)
        {
            SetTenantHeader(tenantId);
            try
            {
                return await _http.GetFromJsonAsync<List<InterestEligibleAccount>>(
                    "/api/account/interest-eligible", ct) ?? new List<InterestEligibleAccount>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GetInterestEligibleAsync failed for tenant={Tenant}", tenantId);
                return new List<InterestEligibleAccount>();
            }
        }

        public async Task UpdateAccruedInterestAsync(
            int accountId, string tenantId, decimal delta, CancellationToken ct = default)
        {
            SetTenantHeader(tenantId);
            try
            {
                var response = await _http.PatchAsJsonAsync(
                    $"/api/account/{accountId}/accrued-interest", delta, ct);
                if (!response.IsSuccessStatusCode)
                    _logger.LogWarning("UpdateAccruedInterest returned {Status} for accountId={Id}",
                        response.StatusCode, accountId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "UpdateAccruedInterestAsync failed for accountId={Id} tenant={Tenant}",
                    accountId, tenantId);
            }
        }

        private void SetTenantHeader(string tenantId)
        {
            _http.DefaultRequestHeaders.Remove("X-Tenant-ID");
            _http.DefaultRequestHeaders.Add("X-Tenant-ID", tenantId);
        }
    }
}
