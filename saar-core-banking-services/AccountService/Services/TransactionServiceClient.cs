using System.Net.Http.Json;

namespace AccountService.Services
{
    /// <summary>Result of posting a deposit lifecycle journal entry.</summary>
    public record DepositJournalResult(bool Success, string? JournalNumber, string? Error);

    /// <summary>
    /// Calls TransactionService to post double-entry journals for FD/RD lifecycle events
    /// (maturity payouts, premature closures, auto-renewals).
    /// </summary>
    public interface ITransactionServiceClient
    {
        /// <summary>
        /// Posts a maturity payout journal:
        ///   DR 2010 (Customer Deposits) for principal
        ///   DR 5010 (Interest Expense)  for interest
        ///   CR 1010 (Cash and Bank)     for principal + interest
        /// Idempotency key: "FD-MATURE-{accountNumber}".
        /// </summary>
        Task<DepositJournalResult> PostMaturityPayoutAsync(
            string accountNumber,
            string accountType,
            decimal principal,
            decimal interest,
            CancellationToken ct = default);

        /// <summary>
        /// Posts a premature closure journal:
        ///   DR 2010 (Customer Deposits) for principal
        ///   DR 5010 (Interest Expense)  for reduced interest (after penalty)
        ///   CR 1010 (Cash and Bank)     for principal + reduced interest
        /// Idempotency key: "FD-PREMATURE-{accountNumber}".
        /// </summary>
        Task<DepositJournalResult> PostPrematureClosureAsync(
            string accountNumber,
            string accountType,
            decimal principal,
            decimal reducedInterest,
            CancellationToken ct = default);

        /// <summary>
        /// Posts an account maintenance fee (AMC) journal:
        ///   DR 1010 (Cash and Bank)  for fee amount
        ///   CR 4020 (Fee Income)     for fee amount
        /// Idempotency key: "AMC-{accountNumber}-{yyyyMM}" — one charge per account per month.
        /// </summary>
        Task<DepositJournalResult> PostMaintenanceFeeAsync(
            string accountNumber,
            decimal fee,
            string postedBy,
            CancellationToken ct = default);

        /// <summary>
        /// Returns journals posted with referenceId matching the account number, within the given date range.
        /// Fail-open: returns empty result on network failure.
        /// </summary>
        Task<StatementResult> GetStatementAsync(
            string referenceId,
            DateTime from,
            DateTime to,
            int page     = 1,
            int pageSize = 50,
            CancellationToken ct = default);
    }

    // ── DTOs for account statement ───────────────────────────────────────────────

    public class StatementResult
    {
        public int                    Total      { get; set; }
        public int                    Page       { get; set; }
        public int                    PageSize   { get; set; }
        public List<StatementEntry>   Items      { get; set; } = new();
        public string?                Warning    { get; set; }
    }

    public class StatementEntry
    {
        public long     JournalId     { get; set; }
        public string   JournalNumber { get; set; } = string.Empty;
        public DateTime PostedAt      { get; set; }
        public string   Description   { get; set; } = string.Empty;
        public decimal  Debit         { get; set; }
        public decimal  Credit        { get; set; }
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

        public Task<DepositJournalResult> PostMaturityPayoutAsync(
            string accountNumber, string accountType,
            decimal principal, decimal interest,
            CancellationToken ct = default)
            => PostDepositJournalAsync(
                idempotencyKey: $"FD-MATURE-{accountNumber}",
                description:    $"{accountType} Maturity Payout — {accountNumber}",
                referenceType:  "DepositMaturity",
                referenceId:    accountNumber,
                principal:      principal,
                interest:       interest,
                accountNumber:  accountNumber,
                eventLabel:     "maturity",
                ct:             ct);

        public Task<DepositJournalResult> PostPrematureClosureAsync(
            string accountNumber, string accountType,
            decimal principal, decimal reducedInterest,
            CancellationToken ct = default)
            => PostDepositJournalAsync(
                idempotencyKey: $"FD-PREMATURE-{accountNumber}",
                description:    $"{accountType} Premature Closure — {accountNumber}",
                referenceType:  "PrematureClosure",
                referenceId:    accountNumber,
                principal:      principal,
                interest:       reducedInterest,
                accountNumber:  accountNumber,
                eventLabel:     "premature closure",
                ct:             ct);

        public async Task<DepositJournalResult> PostMaintenanceFeeAsync(
            string accountNumber, decimal fee, string postedBy,
            CancellationToken ct = default)
        {
            var payload = new
            {
                idempotencyKey = $"AMC-{accountNumber}-{DateTime.UtcNow:yyyyMM}",
                description    = $"Account Maintenance Fee — {accountNumber}",
                referenceType  = "MaintenanceFee",
                referenceId    = accountNumber,
                postedBy,
                entries = new object[]
                {
                    new
                    {
                        accountCode  = "1010",
                        debitAmount  = fee,
                        creditAmount = 0m,
                        currency     = "INR",
                        narration    = $"AMC debit — {accountNumber}"
                    },
                    new
                    {
                        accountCode  = "4020",
                        debitAmount  = 0m,
                        creditAmount = fee,
                        currency     = "INR",
                        narration    = $"AMC fee income — {accountNumber}"
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
                        "AMC journal {JNo} posted for account {AccNo}", result?.JournalNumber, accountNumber);
                    return new DepositJournalResult(true, result?.JournalNumber, null);
                }

                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "TransactionService rejected AMC journal for {AccNo}: {Status} — {Error}",
                    accountNumber, response.StatusCode, error);
                return new DepositJournalResult(false, null, $"HTTP {(int)response.StatusCode}: {error}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TransactionService unreachable posting AMC journal for {AccNo}", accountNumber);
                return new DepositJournalResult(false, null, ex.Message);
            }
        }

        private async Task<DepositJournalResult> PostDepositJournalAsync(
            string idempotencyKey, string description, string referenceType, string referenceId,
            decimal principal, decimal interest, string accountNumber, string eventLabel,
            CancellationToken ct)
        {
            var totalPayout = principal + interest;

            var payload = new
            {
                idempotencyKey,
                description,
                referenceType,
                referenceId,
                postedBy = "AccountService",
                entries  = new object[]
                {
                    new
                    {
                        accountCode  = "2010",           // Customer Deposits (liability decreases)
                        debitAmount  = principal,
                        creditAmount = 0m,
                        currency     = "INR",
                        narration    = $"Principal returned on {eventLabel} — {accountNumber}"
                    },
                    new
                    {
                        accountCode  = "5010",           // Interest Expense (expense increases)
                        debitAmount  = interest,
                        creditAmount = 0m,
                        currency     = "INR",
                        narration    = $"Interest paid on {eventLabel} — {accountNumber}"
                    },
                    new
                    {
                        accountCode  = "1010",           // Cash and Bank (asset decreases)
                        debitAmount  = 0m,
                        creditAmount = totalPayout,
                        currency     = "INR",
                        narration    = $"Cash out for {eventLabel} — {accountNumber}"
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
                        "Deposit {Event} journal {JNo} posted for account {AccNo}",
                        eventLabel, result?.JournalNumber, accountNumber);
                    return new DepositJournalResult(true, result?.JournalNumber, null);
                }

                var error = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "TransactionService rejected deposit {Event} journal for {AccNo}: {Status} — {Error}",
                    eventLabel, accountNumber, response.StatusCode, error);
                return new DepositJournalResult(false, null, $"HTTP {(int)response.StatusCode}: {error}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "TransactionService unreachable posting {Event} journal for account {AccNo}",
                    eventLabel, accountNumber);
                return new DepositJournalResult(false, null, ex.Message);
            }
        }

        public async Task<StatementResult> GetStatementAsync(
            string referenceId, DateTime from, DateTime to,
            int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            try
            {
                var baseUrl = _http.BaseAddress?.ToString().TrimEnd('/')
                              ?? "http://localhost:5005";
                var url = $"{baseUrl}/api/journal/by-reference/{Uri.EscapeDataString(referenceId)}" +
                          $"?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}&page={page}&pageSize={pageSize}";

                var response = await _http.GetAsync(url, ct);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("GetStatement failed for {RefId}: {Status}", referenceId, response.StatusCode);
                    return new StatementResult { Warning = $"HTTP {(int)response.StatusCode}" };
                }

                var paged = await response.Content.ReadFromJsonAsync<TxnPagedResult>(cancellationToken: ct);
                if (paged == null) return new StatementResult { Warning = "Empty response from TransactionService" };

                var entries = paged.Items.Select(j => new StatementEntry
                {
                    JournalId     = j.JournalId,
                    JournalNumber = j.JournalNumber,
                    PostedAt      = j.PostedAt,
                    Description   = j.Description,
                    Debit         = j.Entries.Sum(e => e.DebitAmount),
                    Credit        = j.Entries.Sum(e => e.CreditAmount),
                }).ToList();

                return new StatementResult
                {
                    Total    = paged.Total,
                    Page     = paged.Page,
                    PageSize = paged.PageSize,
                    Items    = entries,
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "TransactionService unreachable fetching statement for {RefId}", referenceId);
                return new StatementResult { Warning = "Transaction service unavailable" };
            }
        }

        // ── Local DTOs for deserializing TransactionService responses ────────

        private sealed class JournalPostResponse
        {
            public long   JournalId     { get; set; }
            public string JournalNumber { get; set; } = string.Empty;
            public string Status        { get; set; } = string.Empty;
        }

        private sealed class TxnPagedResult
        {
            public int               Total    { get; set; }
            public int               Page     { get; set; }
            public int               PageSize { get; set; }
            public List<TxnJournal>  Items    { get; set; } = new();
        }

        private sealed class TxnJournal
        {
            public long               JournalId     { get; set; }
            public string             JournalNumber { get; set; } = string.Empty;
            public DateTime           PostedAt      { get; set; }
            public string             Description   { get; set; } = string.Empty;
            public List<TxnEntry>     Entries       { get; set; } = new();
        }

        private sealed class TxnEntry
        {
            public decimal DebitAmount  { get; set; }
            public decimal CreditAmount { get; set; }
        }
    }
}
