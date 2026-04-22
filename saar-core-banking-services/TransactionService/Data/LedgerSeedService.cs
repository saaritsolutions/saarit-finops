using Microsoft.EntityFrameworkCore;
using TransactionService.Models;

namespace TransactionService.Data
{
    /// <summary>
    /// Seeds the standard banking Chart of Accounts on first startup.
    /// Account scheme:
    ///   1xxx = Assets (normal balance: Debit)
    ///   2xxx = Liabilities (normal balance: Credit)
    ///   3xxx = Equity (normal balance: Credit)
    ///   4xxx = Income (normal balance: Credit)
    ///   5xxx = Expense (normal balance: Debit)
    /// </summary>
    public class LedgerSeedService
    {
        private readonly TransactionDbContext _db;
        private readonly ILogger<LedgerSeedService> _logger;

        public LedgerSeedService(TransactionDbContext db, ILogger<LedgerSeedService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task SeedAsync(CancellationToken ct = default)
        {
            var seeds = BuildChartOfAccounts();
            int added = 0;

            foreach (var account in seeds)
            {
                bool exists = await _db.ChartOfAccounts
                    .AnyAsync(a => a.AccountCode == account.AccountCode, ct);

                if (!exists)
                {
                    _db.ChartOfAccounts.Add(account);
                    added++;
                }
            }

            if (added > 0)
            {
                await _db.SaveChangesAsync(ct);
                _logger.LogInformation("LedgerSeedService: inserted {Count} chart-of-account entries.", added);
            }
            else
            {
                _logger.LogDebug("LedgerSeedService: chart of accounts already present — skipping.");
            }
        }

        private static List<ChartOfAccount> BuildChartOfAccounts() => new()
        {
            // ── Assets (Debit normal) ────────────────────────────────────────
            Coa("1010", "Cash and Bank",              "Asset",     "Debit"),
            Coa("1020", "Loans and Advances",         "Asset",     "Debit"),
            Coa("1025", "Gold Loans Outstanding",     "Asset",     "Debit"),
            Coa("1030", "Interest Receivable",        "Asset",     "Debit"),
            Coa("1040", "Fixed Assets",               "Asset",     "Debit"),
            Coa("1050", "Other Assets",               "Asset",     "Debit"),

            // ── Liabilities (Credit normal) ──────────────────────────────────
            Coa("2010", "Customer Deposits",          "Liability", "Credit"),
            Coa("2020", "Borrowings",                 "Liability", "Credit"),
            Coa("2030", "Interest Payable",           "Liability", "Credit"),
            Coa("2040", "Other Liabilities",          "Liability", "Credit"),
            Coa("2050", "Gold in Custody",            "Liability", "Credit"),

            // ── Equity (Credit normal) ────────────────────────────────────────
            Coa("3010", "Share Capital",            "Equity",  "Credit"),
            Coa("3020", "Retained Earnings",        "Equity",  "Credit"),
            Coa("3030", "Statutory Reserve",        "Equity",  "Credit"),

            // ── Income (Credit normal) ────────────────────────────────────────
            Coa("4010", "Interest Income",            "Income",  "Credit"),
            Coa("4015", "Gold Loan Interest Income",  "Income",  "Credit"),
            Coa("4020", "Fee and Commission Income",  "Income",  "Credit"),
            Coa("4030", "Other Income",               "Income",  "Credit"),

            // ── Expense (Debit normal) ────────────────────────────────────────
            Coa("5010", "Interest Expense",           "Expense", "Debit"),
            Coa("5020", "Salary and HR Expense",      "Expense", "Debit"),
            Coa("5030", "Operating Expense",          "Expense", "Debit"),
            Coa("5040", "Loan Loss Provision",        "Expense", "Debit"),
            Coa("5050", "Auction Expenses",           "Expense", "Debit"),
        };

        private static ChartOfAccount Coa(string code, string name, string type, string normal) => new()
        {
            AccountCode   = code,
            AccountName   = name,
            AccountType   = type,
            NormalBalance = normal,
            IsActive      = true,
        };
    }
}
