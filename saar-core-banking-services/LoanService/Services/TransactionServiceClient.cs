using System.Net.Http.Json;

namespace LoanService.Services
{
    /// <summary>Result of posting a loan disbursal journal entry.</summary>
    public record DisbursalJournalResult(bool Success, string? JournalNumber, string? Error);

    /// <summary>
    /// Calls TransactionService to post the double-entry journal for a loan disbursal.
    /// </summary>
    public interface ITransactionServiceClient
    {
        /// <summary>
        /// Posts a journal entry:
        ///   DR <paramref name="glDebitAccount"/> (Loans and Advances) for <paramref name="amount"/>
        ///   CR <paramref name="glCreditAccount"/> (Cash and Bank) for <paramref name="amount"/>
        /// Idempotent — safe to retry; the idempotency key is "DISBURSAL-{applicationNumber}".
        /// </summary>
        Task<DisbursalJournalResult> PostDisbursalJournalAsync(
            string applicationNumber,
            string productType,
            decimal amount,
            string glDebitAccount,
            string glCreditAccount,
            CancellationToken ct = default);
    }

    public class TransactionServiceClient : ITransactionServiceClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<TransactionServiceClient> _logger;

        public TransactionServiceClient(HttpClient http, ILogger<TransactionServiceClient> logger)
        {
            _http   = http;
            _logger = logger;
        }

        public async Task<DisbursalJournalResult> PostDisbursalJournalAsync(
            string applicationNumber,
            string productType,
            decimal amount,
            string glDebitAccount,
            string glCreditAccount,
            CancellationToken ct = default)
        {
            var payload = new
            {
                idempotencyKey = $"DISBURSAL-{applicationNumber}",
                description    = $"Loan Disbursal — {applicationNumber} ({productType})",
                referenceType  = "LoanDisbursal",
                referenceId    = applicationNumber,
                postedBy       = "LoanService",
                entries        = new[]
                {
                    new
                    {
                        accountCode  = glDebitAccount,
                        debitAmount  = amount,
                        creditAmount = 0m,
                        currency     = "INR",
                        narration    = $"Loan disbursed to customer — {applicationNumber}"
                    },
                    new
                    {
                        accountCode  = glCreditAccount,
                        debitAmount  = 0m,
                        creditAmount = amount,
                        currency     = "INR",
                        narration    = $"Cash out for loan disbursal — {applicationNumber}"
                    }
                }
            };

            try
            {
                var url = _http.BaseAddress != null
                    ? new Uri(_http.BaseAddress, "/api/journal").ToString()
                    : "http://localhost:5005/api/journal";

                var response = await _http.PostAsJsonAsync(url, payload, ct);

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content
                        .ReadFromJsonAsync<JournalPostResponse>(cancellationToken: ct);
                    _logger.LogInformation(
                        "Disbursal journal posted — applicationNumber={AppNo}, journalNumber={JNo}",
                        applicationNumber, result?.JournalNumber);
                    return new DisbursalJournalResult(true, result?.JournalNumber, null);
                }

                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "TransactionService rejected disbursal journal for {AppNo}: {Status} — {Error}",
                    applicationNumber, response.StatusCode, error);
                return new DisbursalJournalResult(false, null, $"HTTP {(int)response.StatusCode}: {error}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "TransactionService unreachable when posting disbursal journal for {AppNo}", applicationNumber);
                return new DisbursalJournalResult(false, null, ex.Message);
            }
        }

        private sealed class JournalPostResponse
        {
            public long   JournalId     { get; set; }
            public string JournalNumber { get; set; } = string.Empty;
            public string Status        { get; set; } = string.Empty;
        }
    }
}
