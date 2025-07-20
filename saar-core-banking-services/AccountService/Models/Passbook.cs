using System;

namespace AccountService.Models
{
    public class Passbook
    {
        public int PassbookId { get; set; }
        public int AccountId { get; set; }
        public string? PassbookNumber { get; set; }
        public DateTime IssuedDate { get; set; } = DateTime.UtcNow;
        public string? IssuedBy { get; set; }
        public string? Remarks { get; set; }
    }
}
