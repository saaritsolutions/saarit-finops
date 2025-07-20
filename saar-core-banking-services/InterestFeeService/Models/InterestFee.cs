using System;

namespace InterestFeeService.Models
{
    public class InterestFee
    {
        public int InterestFeeId { get; set; }
        public int AccountId { get; set; }
        public decimal InterestAmount { get; set; }
        public decimal FeeAmount { get; set; }
        public decimal TdsAmount { get; set; }
        public DateTime CalculationDate { get; set; }
        public string CalculationType { get; set; } // Interest, Fee, TDS
        public string? Remarks { get; set; }
    }
}
