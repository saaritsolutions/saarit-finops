using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models
{
    /// <summary>
    /// Loan product master — defines parameters for each loan type.
    /// Seeded on startup per tenant.
    /// </summary>
    public class LoanProduct
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>PERSONAL_LOAN | HOME_LOAN | BUSINESS_LOAN | GOLD_LOAN | VEHICLE_LOAN</summary>
        [MaxLength(50)]
        public string ProductCode { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>SECURED | UNSECURED</summary>
        [MaxLength(20)]
        public string Category { get; set; } = "UNSECURED";

        // ── Amount Limits ───────────────────────────────────────────────────────
        [Column(TypeName = "decimal(18,2)")]
        public decimal MinAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MaxAmount { get; set; }

        // ── Tenure Limits ───────────────────────────────────────────────────────
        public int MinTenureMonths { get; set; }
        public int MaxTenureMonths { get; set; }

        // ── Rates ───────────────────────────────────────────────────────────────
        [Column(TypeName = "decimal(6,4)")]
        public decimal BaseRatePercent { get; set; }

        [Column(TypeName = "decimal(6,4)")]
        public decimal MaxRatePercent { get; set; }

        [Column(TypeName = "decimal(6,4)")]
        public decimal ProcessingFeePercent { get; set; }

        // ── Eligibility Thresholds ──────────────────────────────────────────────
        public int MinCibilScore { get; set; } = 650;
        public int MinAgeYears { get; set; } = 21;
        public int MaxAgeYears { get; set; } = 65;

        [Column(TypeName = "decimal(18,2)")]
        public decimal MinMonthlyIncome { get; set; }

        [Column(TypeName = "decimal(6,4)")]
        public decimal MaxFoirPercent { get; set; } = 0.50m;

        [Column(TypeName = "decimal(6,4)")]
        public decimal MaxLtvPercent { get; set; } = 0.80m;

        // ── Features ───────────────────────────────────────────────────────────
        public bool RequiresCollateral { get; set; }
        public bool AllowsCoApplicant { get; set; } = true;
        public bool RequiresGuarantor { get; set; }

        /// <summary>JSON array of document codes required for this product</summary>
        public string? DocumentChecklistJson { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
