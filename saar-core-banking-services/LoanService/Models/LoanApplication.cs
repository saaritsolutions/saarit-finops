using System;

namespace LoanService.Models
{
    public class LoanApplication
    {
        public Guid Id { get; set; }
        public string CustomerId { get; set; } = string.Empty;
        public string ProductType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public int TenureMonths { get; set; }
        public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED, DISBURSED
        public decimal? InterestRate { get; set; }
        public Guid? WorkflowInstanceId { get; set; }
        public string? FormDataJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
