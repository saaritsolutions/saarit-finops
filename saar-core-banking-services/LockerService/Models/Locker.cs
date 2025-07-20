using System;

namespace LockerService.Models
{
    public class Locker
    {
        public int LockerId { get; set; }
        public string LockerNumber { get; set; }
        public int BranchId { get; set; }
        public int? CustomerId { get; set; }
        public string Size { get; set; } // Small, Medium, Large
        public string Status { get; set; } // Available, Allotted, Closed
        public DateTime? AllottedDate { get; set; }
        public DateTime? ClosedDate { get; set; }
        public string? Remarks { get; set; }
    }
}
