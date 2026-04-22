using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models.Gold
{
    /// <summary>
    /// Individual gold ornament / bar pledged as collateral.
    /// Weights and valuation are stored (not computed at query time) for audit immutability.
    /// </summary>
    public class GoldPledgeItem
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid GoldLoanDetailsId { get; set; }
        public GoldLoanDetails? GoldLoanDetails { get; set; }

        /// <summary>NECKLACE | BANGLE | RING | COIN | BAR | ANKLET | EARRING | OTHER</summary>
        [MaxLength(30)]
        public string ItemType { get; set; } = "OTHER";

        [MaxLength(200)]
        public string? Description { get; set; }

        /// <summary>Gross weight in grams including stones</summary>
        [Column(TypeName = "decimal(10,3)")]
        public decimal GrossWeightGrams { get; set; }

        /// <summary>Deduction for stones / non-gold components</summary>
        [Column(TypeName = "decimal(10,3)")]
        public decimal StoneDeductionGrams { get; set; }

        /// <summary>Net gold weight = Gross - Stone deduction (stored for audit)</summary>
        [Column(TypeName = "decimal(10,3)")]
        public decimal NetWeightGrams { get; set; }

        /// <summary>18 | 20 | 22 | 24 carats</summary>
        public int PurityCarats { get; set; }

        /// <summary>PurityCarats / 24 (stored for audit)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal PurityFactor { get; set; }

        /// <summary>Market rate per gram used at time of appraisal (INR)</summary>
        [Column(TypeName = "decimal(10,2)")]
        public decimal GoldRatePerGram { get; set; }

        /// <summary>NetWeightGrams × PurityFactor × GoldRatePerGram (stored for audit)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal ValuedAmount { get; set; }

        /// <summary>Physical packet / tag number assigned in vault</summary>
        [MaxLength(50)]
        public string? PacketNumber { get; set; }

        /// <summary>True once the loan is closed and gold returned to customer</summary>
        public bool IsReleased { get; set; }

        public DateTime? ReleasedAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
