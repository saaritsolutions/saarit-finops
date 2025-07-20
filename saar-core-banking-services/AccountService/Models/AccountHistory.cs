using System;

namespace AccountService.Models
{
    public class AccountHistory
    {
        public int AccountHistoryId { get; set; }
        public int AccountId { get; set; }
        public Account Account { get; set; }
        public string ChangeType { get; set; } // e.g. Substitution, Modification
        public string OldValue { get; set; }
        public string NewValue { get; set; }
        public DateTime ChangeDate { get; set; }
    }
}
