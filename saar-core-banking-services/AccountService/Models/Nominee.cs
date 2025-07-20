using System;

namespace AccountService.Models
{
    public class Nominee
    {
        public int NomineeId { get; set; }
        public int AccountId { get; set; }
        public int CustomerId { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        public string? Relationship { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public string? AuthorizedReceiver { get; set; } // For minor nominee
        public string? Signature { get; set; }
        public decimal? PercentageShare { get; set; } // Added for nominee share
    }
}
