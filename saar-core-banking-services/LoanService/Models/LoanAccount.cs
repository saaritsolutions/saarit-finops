using System;

namespace LoanService.Models
{
    public class LoanAccount
    {
        public int LoanAccountId { get; set; }
        public int CustomerId { get; set; }
        public string LoanType { get; set; } // e.g., Term Loan, Cash Credit, Overdraft
        public decimal PrincipalAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public decimal InterestRate { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Status { get; set; } // Active, Closed, NPA, etc.
        public string? CollateralDetails { get; set; }
        public string? Remarks { get; set; }
    }
}
