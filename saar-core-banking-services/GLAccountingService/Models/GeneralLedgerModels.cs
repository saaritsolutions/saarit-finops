using System;
using System.ComponentModel.DataAnnotations;

namespace GLAccountingService.Models
{
    public class GeneralLedgerAccount
    {
        [Key]
        public int Id { get; set; }
        public string AccountNumber { get; set; }
        public string Name { get; set; }
        public string Type { get; set; } // Asset, Liability, Income, Expense
        public decimal Balance { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class JournalEntry
    {
        [Key]
        public int Id { get; set; }
        public DateTime EntryDate { get; set; }
        public string Description { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public int GLAccountId { get; set; }
        public GeneralLedgerAccount GLAccount { get; set; }
    }
}
