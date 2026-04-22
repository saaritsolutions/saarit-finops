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

        /// <summary>
        /// Posts gold loan disbursal journal:
        ///   DR 1025 Gold Loans Outstanding / CR 1010 Cash and Bank
        /// Idempotency key: GL-DISBURSE-{applicationNumber}.
        /// </summary>
        Task<DisbursalJournalResult> PostGoldLoanDisbursalJournalAsync(
            string applicationNumber,
            decimal amount,
            CancellationToken ct = default);

        /// <summary>
        /// Posts gold loan bullet closure journal (3-line):
        ///   DR 1010 Cash and Bank (principal) / CR 1025 Gold Loans Outstanding
        ///   DR 1010 Cash and Bank (interest)  / CR 4015 Gold Loan Interest Income
        /// Idempotency key: GL-CLOSE-{applicationNumber}.
        /// </summary>
        Task<DisbursalJournalResult> PostGoldLoanClosureJournalAsync(
            string applicationNumber,
            decimal principal,
            decimal interest,
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
                    new { accountCode = glDebitAccount, debitAmount = amount,  creditAmount = 0m,
                          currency = "INR", narration = $"Loan disbursed to customer — {applicationNumber}" },
                    new { accountCode = glCreditAccount, debitAmount = 0m,     creditAmount = amount,
                          currency = "INR", narration = $"Cash out for loan disbursal — {applicationNumber}" }
                }
            };
            return await PostJournalAsync(applicationNumber, payload, ct);
        }

        public async Task<DisbursalJournalResult> PostGoldLoanDisbursalJournalAsync(
            string applicationNumber,
            decimal amount,
            CancellationToken ct = default)
        {
            var payload = new
            {
                idempotencyKey = $"GL-DISBURSE-{applicationNumber}",
                description    = $"Gold Loan Disbursal — {applicationNumber}",
                referenceType  = "GoldLoanDisbursal",
                referenceId    = applicationNumber,
                postedBy       = "LoanService",
                entries        = new[]
                {
                    new { accountCode = "1025", debitAmount = amount,  creditAmount = 0m,
                          currency = "INR", narration = $"Gold loan disbursed — {applicationNumber}" },
                    new { accountCode = "1010", debitAmount = 0m,      creditAmount = amount,
                          currency = "INR", narration = $"Cash out for gold loan — {applicationNumber}" }
                }
            };
            return await PostJournalAsync(applicationNumber, payload, ct);
        }

        public async Task<DisbursalJournalResult> PostGoldLoanClosureJournalAsync(
            string applicationNumber,
            decimal principal,
            decimal interest,
            CancellationToken ct = default)
        {
            var totalCash = principal + interest;
            var payload = new
            {
                idempotencyKey = $"GL-CLOSE-{applicationNumber}",
                description    = $"Gold Loan Closure — {applicationNumber}",
                referenceType  = "GoldLoanClosure",
                referenceId    = applicationNumber,
                postedBy       = "LoanService",
                entries        = new object[]
                {
                    new { accountCode = "1010", debitAmount = totalCash, creditAmount = 0m,
                          currency = "INR", narration = $"Cash received on gold loan closure — {applicationNumber}" },
                    new { accountCode = "1025", debitAmount = 0m,        creditAmount = principal,
                          currency = "INR", narration = $"Gold loan principal closed — {applicationNumber}" },
                    new { accountCode = "4015", debitAmount = 0m,        creditAmount = interest,
                          currency = "INR", narration = $"Gold loan interest income — {applicationNumber}" }
                }
            };
            return await PostJournalAsync(applicationNumber, payload, ct);
        }

        private async Task<DisbursalJournalResult> PostJournalAsync(
            string applicationNumber,
            object payload,
            CancellationToken ct)
        {
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
                        "Journal posted — applicationNumber={AppNo}, journalNumber={JNo}",
                        applicationNumber, result?.JournalNumber);
                    return new DisbursalJournalResult(true, result?.JournalNumber, null);
                }

                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "TransactionService rejected journal for {AppNo}: {Status} — {Error}",
                    applicationNumber, response.StatusCode, error);
                return new DisbursalJournalResult(false, null, $"HTTP {(int)response.StatusCode}: {error}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "TransactionService unreachable when posting journal for {AppNo}", applicationNumber);
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
