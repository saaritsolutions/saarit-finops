namespace TransactionService.Models
{
    public class Journal
    {
        public long JournalId { get; set; }
        public string JournalNumber { get; set; } = string.Empty;
        public string IdempotencyKey { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ReferenceType { get; set; } = "Manual";
        public string? ReferenceId { get; set; }
        public string PostedBy { get; set; } = "system";
        public DateTime PostedAt { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "Posted"; // Posted | Reversed
        public ICollection<JournalEntry> Entries { get; set; } = new List<JournalEntry>();
    }
}
