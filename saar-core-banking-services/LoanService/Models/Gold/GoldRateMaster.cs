using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models.Gold
{
    /// <summary>
    /// Daily gold rate entry — drives pledge valuation and LTV calculations.
    /// One entry per date per tenant (unique index enforced in EF).
    /// </summary>
    public class GoldRateMaster
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>The date this rate applies to (UTC date, time component should be 00:00:00Z)</summary>
        public DateTime RateDate { get; set; }

        /// <summary>IBJA 22-carat gold rate in INR per gram</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal RatePerGramFor22K { get; set; }

        /// <summary>MANUAL | IBJA | MCX</summary>
        [MaxLength(20)]
        public string Source { get; set; } = "MANUAL";

        [MaxLength(150)]
        public string EnteredBy { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
