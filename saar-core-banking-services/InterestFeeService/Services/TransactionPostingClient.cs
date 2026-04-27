using System.Net.Http.Json;
using System.Text.Json;

namespace InterestFeeService.Services
{
    public class TransactionPostingClient : ITransactionPostingClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<TransactionPostingClient> _logger;

        public TransactionPostingClient(HttpClient http, ILogger<TransactionPostingClient> logger)
        {
            _http = http;
            _logger = logger;
        }

        /// <summary>
        /// Monthly interest credit: DR 5010 (Interest Expense) / CR 2010 (Customer Deposits).
        /// </summary>
        public async Task<string?> PostMonthlyInterestAsync(
            int accountId, string accountNumber, string tenantId,
            decimal interestAmount, string period, CancellationToken ct = default)
        {
            var key = $"MONTHLY-INTEREST-{accountNumber}-{period}";
            var request = new
            {
                IdempotencyKey = key,
                Description    = $"Monthly interest credit — {accountNumber} period {period}",
                ReferenceType  = "InterestAccrual",
                ReferenceId    = accountNumber,
                PostedBy       = "interest-fee-service",
                Entries = new[]
                {
                    new { AccountCode = "5010", DebitAmount  = interestAmount, CreditAmount = 0m,
                          Currency = "INR", Narration = $"Interest expense {period}" },
                    new { AccountCode = "2010", DebitAmount  = 0m, CreditAmount = interestAmount,
                          Currency = "INR", Narration = $"Interest credited — {accountNumber}" }
                }
            };

            return await PostJournalAsync(key, request, ct);
        }

        /// <summary>
        /// TDS deduction: DR 2010 (Customer Deposits) / CR 2040 (Other Liabilities — TDS Payable).
        /// </summary>
        public async Task<string?> PostTdsDeductionAsync(
            int accountId, string accountNumber, string tenantId,
            decimal tdsAmount, string period, CancellationToken ct = default)
        {
            var key = $"TDS-{accountNumber}-{period}";
            var request = new
            {
                IdempotencyKey = key,
                Description    = $"TDS deduction — {accountNumber} period {period}",
                ReferenceType  = "TDSDeduction",
                ReferenceId    = accountNumber,
                PostedBy       = "interest-fee-service",
                Entries = new[]
                {
                    new { AccountCode = "2010", DebitAmount  = tdsAmount, CreditAmount = 0m,
                          Currency = "INR", Narration = $"TDS deducted — {accountNumber}" },
                    new { AccountCode = "2040", DebitAmount  = 0m, CreditAmount = tdsAmount,
                          Currency = "INR", Narration = $"TDS payable {period}" }
                }
            };

            return await PostJournalAsync(key, request, ct);
        }

        private async Task<string?> PostJournalAsync(
            string idempotencyKey, object request, CancellationToken ct)
        {
            try
            {
                var response = await _http.PostAsJsonAsync("/api/journal", request, ct);

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(ct);
                    var doc  = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("journalNumber", out var jn))
                        return jn.GetString();
                    return "POSTED";
                }

                // 400 with "already posted" idempotency response is still OK
                if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
                {
                    var body = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("Journal POST returned 400 for key {Key}: {Body}", idempotencyKey, body);
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TransactionService unavailable — journal {Key} not posted (fail-open)",
                    idempotencyKey);
                return null;
            }
        }
    }
}
