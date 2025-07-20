using System;

namespace RemittancePaymentService.Models
{
    public class Remittance
    {
        public int RemittanceId { get; set; }
        public int FromAccountId { get; set; }
        public int ToAccountId { get; set; }
        public decimal Amount { get; set; }
        public string RemittanceType { get; set; } // NEFT, RTGS, IMPS, Internal, etc.
        public string Status { get; set; } // Initiated, Processing, Completed, Failed
        public DateTime InitiatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? ReferenceNumber { get; set; }
        public string? Remarks { get; set; }
    }
}
