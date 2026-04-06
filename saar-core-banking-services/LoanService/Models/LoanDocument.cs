using System.ComponentModel.DataAnnotations;

namespace LoanService.Models
{
    /// <summary>
    /// Represents a document attached to a loan application.
    /// Tracks upload status and verification by credit officer.
    /// </summary>
    public class LoanDocument
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid LoanApplicationId { get; set; }
        public LoanApplication? LoanApplication { get; set; }

        /// <summary>
        /// PAN_CARD | AADHAAR | SALARY_SLIP_3M | BANK_STATEMENT_6M | ITR_2Y |
        /// FORM_16 | PROPERTY_DOCS | VEHICLE_RC | GOLD_RECEIPT | GST_CERTIFICATE |
        /// BUSINESS_PROOF | PHOTO | SIGNATURE
        /// </summary>
        [MaxLength(50)]
        public string DocumentType { get; set; } = string.Empty;

        [MaxLength(200)]
        public string? DocumentLabel { get; set; }

        public bool IsMandatory { get; set; }

        // ── Upload State ────────────────────────────────────────────────────────
        public bool IsUploaded { get; set; }

        [MaxLength(300)]
        public string? FileName { get; set; }

        [MaxLength(20)]
        public string? ContentType { get; set; } // application/pdf | image/jpeg | image/png

        /// <summary>Stored file path or blob key (not base64 — ref only)</summary>
        [MaxLength(500)]
        public string? StoragePath { get; set; }

        public long? FileSizeBytes { get; set; }

        public DateTime? UploadedAt { get; set; }

        [MaxLength(150)]
        public string? UploadedBy { get; set; }

        // ── Verification ────────────────────────────────────────────────────────
        public bool IsVerified { get; set; }

        [MaxLength(150)]
        public string? VerifiedBy { get; set; }

        public DateTime? VerifiedAt { get; set; }

        [MaxLength(500)]
        public string? VerificationRemarks { get; set; }

        /// <summary>PENDING | UPLOADED | VERIFIED | REJECTED</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "PENDING";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
