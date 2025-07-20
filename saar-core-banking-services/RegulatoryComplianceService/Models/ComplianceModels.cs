using System.ComponentModel.DataAnnotations;

namespace RegulatoryComplianceService.Models
{
    public class ComplianceReport
    {
        [Key]
        public int Id { get; set; }
        public string ReportType { get; set; } // AML, CERSAI, Statutory, etc.
        public DateTime ReportDate { get; set; }
        public string Status { get; set; } // Pending, Submitted, Approved
        public string Remarks { get; set; }
    }

    public class RegulatoryFiling
    {
        [Key]
        public int Id { get; set; }
        public string Regulation { get; set; }
        public DateTime FilingDate { get; set; }
        public string Status { get; set; }
        public string Details { get; set; }
    }
}
