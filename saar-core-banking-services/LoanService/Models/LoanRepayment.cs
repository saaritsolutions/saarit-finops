using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models
{
    /// <summary>
    /// One row per EMI collected against a disbursed loan.
    /// </summary>
    public class LoanRepayment
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid LoanApplicationId { get; set; }
        public LoanApplication LoanApplication { get; set; } = null!;

        /// <summary>Sequential installment counter per loan (1, 2, 3, …).</summary>
        public int InstallmentNumber { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal PrincipalComponent { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InterestComponent { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }

        public DateTime DueDate { get; set; }

        public DateTime PaidAt { get; set; } = DateTime.UtcNow;

        /// <summary>CASH | NEFT | RTGS | UPI | CHEQUE</summary>
        [MaxLength(20)]
        public string PaymentMode { get; set; } = "CASH";

        [MaxLength(100)]
        public string? PaymentReference { get; set; }

        /// <summary>Journal number returned by TransactionService on successful GL posting.</summary>
        [MaxLength(50)]
        public string? JournalNumber { get; set; }

        [MaxLength(50)]
        public string TenantId { get; set; } = "public";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
