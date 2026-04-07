using System.Net.Http.Json;

namespace AccountService.Services
{
    public interface IDynamicFormsClient
    {
        Task<List<AccountDynamicField>> GetAccountFormSchemaAsync(string accountType);
    }

    public class DynamicFormsClient : IDynamicFormsClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<DynamicFormsClient> _logger;

        public DynamicFormsClient(HttpClient httpClient, ILogger<DynamicFormsClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<List<AccountDynamicField>> GetAccountFormSchemaAsync(string accountType)
        {
            var url = _httpClient.BaseAddress != null
                ? new Uri(_httpClient.BaseAddress, "/api/Fields").ToString()
                : "http://localhost:5013/api/Fields";
            var fields = await _httpClient.GetFromJsonAsync<List<AccountDynamicField>>(url);
            return fields ?? new List<AccountDynamicField>();
        }
    }

    public class AccountDynamicField
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
