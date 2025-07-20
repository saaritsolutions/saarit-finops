using System;

namespace ChequeClearingService.Models
{
    public class Cheque
    {
        public int ChequeId { get; set; }
        public int AccountId { get; set; }
        public string ChequeNumber { get; set; }
        public DateTime IssueDate { get; set; }
        public DateTime? ClearedDate { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } // Issued, Presented, Cleared, Bounced, Cancelled
        public string? PayeeName { get; set; }
        public string? Remarks { get; set; }
    }
}
