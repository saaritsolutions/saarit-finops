using System.ComponentModel.DataAnnotations;

namespace LoanService.Models
{
    /// <summary>
    /// Immutable audit trail of every action taken on a loan application.
    /// Powers the workflow timeline visible to applicant and officers.
    /// </summary>
    public class LoanApprovalAction
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid LoanApplicationId { get; set; }
        public LoanApplication? LoanApplication { get; set; }

        /// <summary>
        /// CREATED | SUBMITTED | ASSIGNED | CREDIT_REVIEW_STARTED |
        /// CREDIT_REVIEW_APPROVED | CREDIT_REVIEW_REJECTED |
        /// LEGAL_REVIEW_STARTED | LEGAL_REVIEW_APPROVED | LEGAL_REVIEW_REJECTED |
        /// SANCTIONED | DISBURSEMENT_INITIATED | DISBURSED |
        /// REJECTED | RETURNED_TO_APPLICANT | DOCUMENT_UPLOADED | DOCUMENT_VERIFIED
        /// </summary>
        [MaxLength(60)]
        public string Action { get; set; } = string.Empty;

        /// <summary>Human-readable description for the timeline UI</summary>
        [MaxLength(300)]
        public string? ActionDescription { get; set; }

        [MaxLength(150)]
        public string? ActionBy { get; set; }

        /// <summary>APPLICANT | MAKER | CHECKER | CREDIT_OFFICER | LEGAL_OFFICER | SYSTEM</summary>
        [MaxLength(30)]
        public string? Role { get; set; }

        [MaxLength(1000)]
        public string? Comments { get; set; }

        /// <summary>Previous status before this action</summary>
        [MaxLength(30)]
        public string? FromStatus { get; set; }

        /// <summary>New status after this action</summary>
        [MaxLength(30)]
        public string? ToStatus { get; set; }

        /// <summary>JSON blob for any additional context (e.g. docs verified, rate set)</summary>
        public string? MetadataJson { get; set; }

        public DateTime ActionAt { get; set; } = DateTime.UtcNow;
    }
}
