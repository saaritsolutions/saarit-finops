namespace TransactionService.Models
{
    public class JournalEntry
    {
        public long JournalEntryId { get; set; }
        public long JournalId { get; set; }
        public Journal Journal { get; set; } = null!;
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
        public string Currency { get; set; } = "INR";
        public string? Narration { get; set; }
        public DateTime EntryDate { get; set; } = DateTime.UtcNow;
    }
}
