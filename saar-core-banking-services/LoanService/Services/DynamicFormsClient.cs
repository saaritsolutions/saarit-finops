using System.Net.Http.Json;

namespace LoanService.Services
{
    public interface IDynamicFormsClient
    {
        Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType);
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

        public async Task<List<DynamicField>> GetLoanFormSchemaAsync(string productType)
        {
            var url = _httpClient.BaseAddress != null ? new Uri(_httpClient.BaseAddress, "/api/Fields").ToString() : "http://localhost:5013/api/Fields";
            var fields = await _httpClient.GetFromJsonAsync<List<DynamicField>>(url);
            return fields ?? new List<DynamicField>();
        }
    }

    public class DynamicField
    {
        public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Label { get; set; }
    public string? Type { get; set; }
    public bool? Required { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }
    }
}
