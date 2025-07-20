using System;
using System.Collections.Generic;

namespace ChequeClearingService.Models
{
    public class ClearingBatch
    {
        public int ClearingBatchId { get; set; }
        public DateTime BatchDate { get; set; }
        public string Status { get; set; } // Open, Closed, Processed
        public List<Cheque> Cheques { get; set; } = new List<Cheque>();
        public string? Remarks { get; set; }
    }
}
