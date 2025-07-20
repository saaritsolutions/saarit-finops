using System;

namespace TransactionService.Models
{
    public class AccountHistory
    {
        public int AccountHistoryId { get; set; }
        public int AccountId { get; set; }
        public string ChangeType { get; set; }
        public string OldValue { get; set; }
        public string NewValue { get; set; }
        public DateTime ChangeDate { get; set; }
    }
}
