namespace TransactionService.Models
{
    /// <summary>
    /// Compliance alert created when a transaction triggers a regulatory reporting threshold.
    /// Currently supports CTR (Cash Transaction Report, RBI) — STR (Suspicious Transaction Report)
    /// will be added in SAAR-EXPR-002.
    /// </summary>
    public class ComplianceAlert
    {
        public Guid    Id            { get; set; } = Guid.NewGuid();

        /// <summary>Alert type: CTR | STR</summary>
        public string  AlertType     { get; set; } = string.Empty;

        /// <summary>Journal number that triggered the alert (e.g. JNL-20260419-000001)</summary>
        public string  JournalNumber { get; set; } = string.Empty;

        /// <summary>External reference ID from the journal (loan ID, account ID, etc.)</summary>
        public string  ReferenceId   { get; set; } = string.Empty;

        /// <summary>Amount that triggered the threshold (₹)</summary>
        public decimal TriggerAmount { get; set; }

        /// <summary>Status: PENDING | FILED | DISMISSED</summary>
        public string  Status        { get; set; } = "PENDING";

        public DateTime  CreatedAt   { get; set; } = DateTime.UtcNow;
        public string?   ReviewedBy  { get; set; }
        public DateTime? ReviewedAt  { get; set; }
        public string?   ReviewNotes { get; set; }
    }
}
