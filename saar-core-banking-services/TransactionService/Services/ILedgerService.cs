using Microsoft.EntityFrameworkCore;
using TransactionService.Data;
using TransactionService.Models;

namespace TransactionService.Services
{
    public interface ILedgerService
    {
        Task<LedgerBalanceDto?> GetBalanceAsync(string accountCode, CancellationToken ct = default);
        Task<IReadOnlyList<LedgerBalanceDto>> GetAllBalancesAsync(CancellationToken ct = default);
        Task<IReadOnlyList<JournalEntry>> GetEntriesAsync(string accountCode, int page, int pageSize, CancellationToken ct = default);
    }

    public class LedgerBalanceDto
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public string NormalBalance { get; set; } = "Debit";
        public decimal DebitTotal { get; set; }
        public decimal CreditTotal { get; set; }
        /// <summary>Net balance in the account's normal direction (always positive when normal, negative when contra).</summary>
        public decimal Balance { get; set; }
        public DateTime LastUpdatedAt { get; set; }
    }

    public class LedgerService : ILedgerService
    {
        private readonly TransactionDbContext _db;

        public LedgerService(TransactionDbContext db) => _db = db;

        public async Task<LedgerBalanceDto?> GetBalanceAsync(string accountCode, CancellationToken ct = default)
        {
            var coa = await _db.ChartOfAccounts.FirstOrDefaultAsync(a => a.AccountCode == accountCode, ct);
            var bal = await _db.LedgerBalances.FirstOrDefaultAsync(b => b.AccountCode == accountCode, ct);

            if (coa == null && bal == null) return null;

            return BuildDto(coa, bal, accountCode);
        }

        public async Task<IReadOnlyList<LedgerBalanceDto>> GetAllBalancesAsync(CancellationToken ct = default)
        {
            var accounts = await _db.ChartOfAccounts.Where(a => a.IsActive).ToListAsync(ct);
            var balances = await _db.LedgerBalances.ToListAsync(ct);
            var balMap = balances.ToDictionary(b => b.AccountCode);

            return accounts
                .Select(a => BuildDto(a, balMap.GetValueOrDefault(a.AccountCode), a.AccountCode))
                .OrderBy(d => d.AccountCode)
                .ToList();
        }

        public async Task<IReadOnlyList<JournalEntry>> GetEntriesAsync(
            string accountCode, int page, int pageSize, CancellationToken ct = default) =>
            await _db.JournalEntries
                     .Where(e => e.AccountCode == accountCode)
                     .OrderByDescending(e => e.EntryDate)
                     .Skip((page - 1) * pageSize)
                     .Take(pageSize)
                     .ToListAsync(ct);

        private static LedgerBalanceDto BuildDto(ChartOfAccount? coa, LedgerBalance? bal, string code)
        {
            var dt = bal?.DebitTotal ?? 0m;
            var ct2 = bal?.CreditTotal ?? 0m;
            var normal = coa?.NormalBalance ?? "Debit";
            var balance = normal == "Debit" ? dt - ct2 : ct2 - dt;

            return new LedgerBalanceDto
            {
                AccountCode   = code,
                AccountName   = coa?.AccountName ?? code,
                AccountType   = coa?.AccountType ?? "Unknown",
                NormalBalance = normal,
                DebitTotal    = dt,
                CreditTotal   = ct2,
                Balance       = balance,
                LastUpdatedAt = bal?.LastUpdatedAt ?? DateTime.UtcNow,
            };
        }
    }
}
