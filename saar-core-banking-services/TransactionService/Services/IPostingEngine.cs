using Microsoft.EntityFrameworkCore;
using TransactionService.Data;
using TransactionService.Models;

namespace TransactionService.Services
{
    public interface IPostingEngine
    {
        Task<Journal> PostAsync(PostJournalRequest request, CancellationToken ct = default);
        Task<Journal?> GetByIdempotencyKeyAsync(string key, CancellationToken ct = default);
        Task<Journal?> GetByIdAsync(long journalId, CancellationToken ct = default);
        Task<IReadOnlyList<Journal>> GetRecentAsync(int page, int pageSize, CancellationToken ct = default);
    }

    // ── Request DTOs ────────────────────────────────────────────────────────

    public class PostJournalRequest
    {
        public string IdempotencyKey { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ReferenceType { get; set; } = "Manual";
        public string? ReferenceId { get; set; }
        public string PostedBy { get; set; } = "system";
        public List<PostJournalEntryRequest> Entries { get; set; } = new();
    }

    public class PostJournalEntryRequest
    {
        public string AccountCode { get; set; } = string.Empty;
        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
        public string Currency { get; set; } = "INR";
        public string? Narration { get; set; }
    }

    // ── Implementation ──────────────────────────────────────────────────────

    public class PostingEngine : IPostingEngine
    {
        private readonly TransactionDbContext _db;
        private readonly ILogger<PostingEngine> _logger;

        // Thread-safe sequence for JournalNumber generation (resets on service restart; fine for demo)
        private static long _seq = 0;

        public PostingEngine(TransactionDbContext db, ILogger<PostingEngine> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<Journal> PostAsync(PostJournalRequest request, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
                throw new ArgumentException("IdempotencyKey is required.", nameof(request));

            // ── Idempotency guard ────────────────────────────────────────────
            var existing = await GetByIdempotencyKeyAsync(request.IdempotencyKey, ct);
            if (existing != null)
            {
                _logger.LogInformation("Idempotent replay: journal {JN} already posted for key {Key}.",
                    existing.JournalNumber, request.IdempotencyKey);
                return existing;
            }

            // ── Double-entry balance check ────────────────────────────────────
            var totalDebits  = request.Entries.Sum(e => e.DebitAmount);
            var totalCredits = request.Entries.Sum(e => e.CreditAmount);

            if (totalDebits == 0 && totalCredits == 0)
                throw new InvalidOperationException("Journal must have at least one non-zero entry.");

            if (totalDebits != totalCredits)
                throw new InvalidOperationException(
                    $"Journal is imbalanced: debits={totalDebits:N2} ≠ credits={totalCredits:N2}. " +
                    "Every journal entry must satisfy debits = credits.");

            // ── Resolve account names from ChartOfAccounts ───────────────────
            var codes = request.Entries.Select(e => e.AccountCode).Distinct().ToList();
            var names = await _db.ChartOfAccounts
                .Where(a => codes.Contains(a.AccountCode))
                .ToDictionaryAsync(a => a.AccountCode, a => a.AccountName, ct);

            var seq = Interlocked.Increment(ref _seq);
            var now = DateTime.UtcNow;

            var journal = new Journal
            {
                JournalNumber  = $"JNL-{now:yyyyMMdd}-{seq:D6}",
                IdempotencyKey = request.IdempotencyKey,
                Description    = request.Description,
                ReferenceType  = request.ReferenceType,
                ReferenceId    = request.ReferenceId,
                PostedBy       = request.PostedBy,
                PostedAt       = now,
                Status         = "Posted",
                Entries        = request.Entries.Select(e => new JournalEntry
                {
                    AccountCode  = e.AccountCode,
                    AccountName  = names.GetValueOrDefault(e.AccountCode, e.AccountCode),
                    DebitAmount  = e.DebitAmount,
                    CreditAmount = e.CreditAmount,
                    Currency     = e.Currency,
                    Narration    = e.Narration,
                    EntryDate    = now,
                }).ToList()
            };

            // ── Atomic post: save journal + update LedgerBalance ─────────────
            // InMemory EF provider doesn't support transactions; skip for demo.
            var isInMemory = _db.Database.ProviderName?.Contains("InMemory") == true;

            if (isInMemory)
            {
                await SaveJournalAndBalancesAsync(journal, now, ct);
            }
            else
            {
                using var tx = await _db.Database.BeginTransactionAsync(ct);
                try
                {
                    await SaveJournalAndBalancesAsync(journal, now, ct);
                    await tx.CommitAsync(ct);
                }
                catch
                {
                    await tx.RollbackAsync(ct);
                    throw;
                }
            }

            _logger.LogInformation("Posted {JN} (id={Id}) ref={RefType}/{RefId} amount={Amt:N2} INR by {By}.",
                journal.JournalNumber, journal.JournalId,
                journal.ReferenceType, journal.ReferenceId ?? "-",
                totalDebits, journal.PostedBy);

            return journal;
        }

        private async Task SaveJournalAndBalancesAsync(Journal journal, DateTime now, CancellationToken ct)
        {
            _db.Journals.Add(journal);
            await _db.SaveChangesAsync(ct);

            foreach (var entry in journal.Entries)
            {
                var bal = await _db.LedgerBalances
                    .FirstOrDefaultAsync(b => b.AccountCode == entry.AccountCode, ct);

                if (bal == null)
                {
                    bal = new LedgerBalance { AccountCode = entry.AccountCode };
                    _db.LedgerBalances.Add(bal);
                }

                bal.DebitTotal  += entry.DebitAmount;
                bal.CreditTotal += entry.CreditAmount;
                bal.LastUpdatedAt = now;
            }

            await _db.SaveChangesAsync(ct);
        }

        public Task<Journal?> GetByIdempotencyKeyAsync(string key, CancellationToken ct = default) =>
            _db.Journals
               .Include(j => j.Entries)
               .FirstOrDefaultAsync(j => j.IdempotencyKey == key, ct);

        public Task<Journal?> GetByIdAsync(long journalId, CancellationToken ct = default) =>
            _db.Journals
               .Include(j => j.Entries)
               .FirstOrDefaultAsync(j => j.JournalId == journalId, ct);

        public async Task<IReadOnlyList<Journal>> GetRecentAsync(int page, int pageSize, CancellationToken ct = default) =>
            await _db.Journals
                     .Include(j => j.Entries)
                     .OrderByDescending(j => j.PostedAt)
                     .Skip((page - 1) * pageSize)
                     .Take(pageSize)
                     .ToListAsync(ct);
    }
}
