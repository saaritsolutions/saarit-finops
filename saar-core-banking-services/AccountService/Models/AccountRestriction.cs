using System;

namespace AccountService.Models
{
    public class AccountRestriction
    {
        public int AccountRestrictionId { get; set; }
        public int AccountId { get; set; }
        public Account Account { get; set; }
        public string RestrictionType { get; set; } // e.g. DebitNotAllowed, CreditNotAllowed
        public string Reason { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public bool IsActive { get; set; }
    }
}
