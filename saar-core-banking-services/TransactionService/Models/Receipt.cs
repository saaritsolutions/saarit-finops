using System;

namespace TransactionService.Models
{
    public class Receipt
    {
        public int ReceiptId { get; set; }
        public int AccountId { get; set; }
        public string? ReceiptNumber { get; set; }
        public DateTime IssuedDate { get; set; } = DateTime.UtcNow;
        public string? IssuedBy { get; set; }
        public string? TransactionType { get; set; } // Deposit, Withdrawal, etc.
        public decimal Amount { get; set; }
        public string? Remarks { get; set; }
    }
}
