using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models.Gold
{
    /// <summary>
    /// Gold-loan-specific details attached 1:1 to a LoanApplication (ProductType=GOLD_LOAN).
    /// Contains the pledge register, appraisal data, LTV metrics, and gold-specific lifecycle status.
    /// </summary>
    public class GoldLoanDetails
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>FK to LoanApplication (unique — one GoldLoanDetails per application)</summary>
        public Guid LoanApplicationId { get; set; }
        public LoanApplication? LoanApplication { get; set; }

        /// <summary>
        /// Gold loan lifecycle (independent of LoanApplication.Status):
        /// DRAFT | SUBMITTED | APPRAISED | SANCTIONED | DISBURSED | CLOSED
        /// </summary>
        [MaxLength(30)]
        public string GoldLoanStatus { get; set; } = "DRAFT";

        /// <summary>BULLET (Phase 1 only). EMI and INTEREST_ONLY in Phase 2.</summary>
        [MaxLength(20)]
        public string RepaymentScheme { get; set; } = "BULLET";

        /// <summary>3 | 6 | 9 | 12 months (Phase 1)</summary>
        public int TenureMonths { get; set; }

        /// <summary>DisbursedAt + TenureMonths (set at DISBURSE)</summary>
        public DateTime? MaturityDate { get; set; }

        // ── Amounts ──────────────────────────────────────────────────────────

        /// <summary>Amount approved by credit officer (≤ 75% of TotalValuedAmount)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal SanctionedAmount { get; set; }

        /// <summary>Annual interest rate %</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal InterestRatePercent { get; set; }

        /// <summary>SanctionedAmount × rate/100 × months/12 (set at DISBURSE)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalInterestAmount { get; set; }

        /// <summary>SanctionedAmount + TotalInterestAmount (set at DISBURSE)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? TotalAmountDue { get; set; }

        // ── Appraisal totals (computed from PledgeItems at APPRAISE) ─────────

        [Column(TypeName = "decimal(10,3)")]
        public decimal TotalNetWeightGrams { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalValuedAmount { get; set; }

        /// <summary>SanctionedAmount / TotalValuedAmount × 100 (set at SANCTION)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal LtvPercent { get; set; }

        /// <summary>Rate used during appraisal (INR/gram, 22K)</summary>
        [Column(TypeName = "decimal(10,2)")]
        public decimal GoldRateAtAppraisal { get; set; }

        // ── Appraiser ────────────────────────────────────────────────────────

        [MaxLength(150)]
        public string? AppraiserName { get; set; }

        [MaxLength(50)]
        public string? AppraiserEmployeeId { get; set; }

        [MaxLength(100)]
        public string? VaultLocation { get; set; }

        /// <summary>Generated on SANCTIONED transition (format: PR-{year}-{seq:D6})</summary>
        [MaxLength(30)]
        public string? PledgeReceiptNumber { get; set; }

        // ── Timestamps ───────────────────────────────────────────────────────

        public DateTime? AppraisedAt { get; set; }
        public DateTime? SanctionedAt { get; set; }
        public DateTime? DisbursedAt { get; set; }
        public DateTime? ClosedAt { get; set; }

        /// <summary>When gold was physically returned to customer (on CLOSE)</summary>
        public DateTime? GoldReleasedAt { get; set; }

        // ── GL ───────────────────────────────────────────────────────────────

        /// <summary>Journal number from TransactionService for the closure journal entry</summary>
        [MaxLength(50)]
        public string? ClosureJournalNumber { get; set; }

        // ── Navigation ───────────────────────────────────────────────────────

        public List<GoldPledgeItem> PledgeItems { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
