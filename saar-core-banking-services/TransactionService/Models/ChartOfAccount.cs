namespace TransactionService.Models
{
    /// <summary>Banking chart of accounts. AccountType: Asset|Liability|Equity|Income|Expense</summary>
    public class ChartOfAccount
    {
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public string NormalBalance { get; set; } = "Debit"; // Debit | Credit
        public bool IsActive { get; set; } = true;
    }
}
