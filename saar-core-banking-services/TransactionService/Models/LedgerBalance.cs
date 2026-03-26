namespace TransactionService.Models
{
    /// <summary>Materialized running total per account code, updated atomically on every journal post.</summary>
    public class LedgerBalance
    {
        public long LedgerBalanceId { get; set; }
        public string AccountCode { get; set; } = string.Empty;
        public decimal DebitTotal { get; set; }
        public decimal CreditTotal { get; set; }
        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
