using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models
{
    /// <summary>
    /// PHASE 1: Loan Eligibility Check Results
    /// Real-time credit scoring with CIBIL band mapping, FOIR, LTV calculations.
    /// Validity: 24 hours from check date.
    /// </summary>
    public class LoanEligibilityCheck
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>Reference to the loan application (if eligibility resulted in application submission)</summary>
        public Guid? ApplicationId { get; set; }

        // ── Applicant Info ──────────────────────────────────────────────────────
        [MaxLength(150)]
        public string ApplicantName { get; set; } = string.Empty;

        [MaxLength(10)]
        public string? PanNumber { get; set; }

        public DateTime? DateOfBirth { get; set; }

        /// <summary>Product type for which eligibility is being checked (PERSONAL_LOAN, HOME_LOAN, etc.)</summary>
        [MaxLength(50)]
        public string ProductType { get; set; } = string.Empty;

        [MaxLength(30)]
        public string? EmploymentType { get; set; } // SALARIED | SELF_EMPLOYED | BUSINESS_OWNER | RETIRED

        // ── Income & Financial Data ─────────────────────────────────────────────
        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossMonthlyIncome { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ExistingMonthlyEMI { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MonthlyObligations { get; set; }

        /// <summary>Other income sources (rental, business, pension, etc.)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherMonthlyIncome { get; set; }

        // ── Credit Data (CIBIL) ─────────────────────────────────────────────────
        public int? CibilScore { get; set; }

        /// <summary>EXCELLENT (750+) | GOOD (700-749) | FAIR (650-699) | POOR (<650)</summary>
        [MaxLength(20)]
        public string? CibilBand { get; set; }

        // ── Scoring Results ─────────────────────────────────────────────────────
        /// <summary>Overall eligibility score (0-100) — higher is better</summary>
        public int EligibilityScore { get; set; }

        /// <summary>Risk grade assigned: A+ (best) to C (riskiest)</summary>
        [MaxLength(5)]
        public string RiskGrade { get; set; } = "B"; // A+ | A | B+ | B | C

        /// <summary>Maximum loan amount customer is eligible for (based on FOIR, collateral, product limits)</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal MaxEligibleAmount { get; set; }

        /// <summary>Recommended interest rate for this applicant (may vary based on risk grade)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal? RecommendedRate { get; set; }

        // ── Calculated Ratios ───────────────────────────────────────────────────
        /// <summary>Fixed Obligation to Income Ratio (%) — (ExistingEMI + MonthlyObligations) / GrossMonthlyIncome * 100</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal? FOIRPercent { get; set; }

        /// <summary>FOIR Limit for the employment type (50% for salaried, 40% for self-employed)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal FOIRLimit { get; set; } = 50m; // Will be set based on employment type

        /// <summary>True if FOIR exceeds limit</summary>
        public bool FOIRBreach { get; set; }

        /// <summary>Loan-to-Value ratio for secured loans (%)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal? LTVPercent { get; set; }

        /// <summary>LTV Limit for the product (80% for property, 75% for gold, etc.)</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal LTVLimit { get; set; } = 80m; // Will be set based on product

        /// <summary>True if LTV exceeds limit</summary>
        public bool LTVBreach { get; set; }

        // ── Collateral (for secured products) ────────────────────────────────────
        [MaxLength(50)]
        public string? CollateralType { get; set; } // PROPERTY | GOLD | VEHICLE | FD | SHARES

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CollateralValue { get; set; }

        // ── Rejection / Approval Details ────────────────────────────────────────
        /// <summary>Array of rejection reasons (JSON) if eligibility declined</summary>
        public string? RejectionReasonsJson { get; set; }

        /// <summary>Status of eligibility check: APPROVED | APPROVED_WITH_CONDITIONS | DECLINED</summary>
        [MaxLength(30)]
        public string Status { get; set; } = "APPROVED"; // APPROVED | APPROVED_WITH_CONDITIONS | DECLINED

        /// <summary>Conditions if status = APPROVED_WITH_CONDITIONS (e.g., "Requires higher rate", "Additional collateral needed")</summary>
        public string? ConditionsJson { get; set; }

        // ── Temporal / Audit ────────────────────────────────────────────────────
        /// <summary>When the eligibility check was performed</summary>
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(150)]
        public string? CheckedBy { get; set; } // User/system that performed check

        /// <summary>Eligibility is valid until this timestamp (24 hours from CheckedAt)</summary>
        public DateTime ExpiresAt { get; set; }

        [MaxLength(500)]
        public string? CheckNotes { get; set; } // Additional notes from the eligibility check

        // ── Metadata ────────────────────────────────────────────────────────────
        /// <summary>JSON blob for storing additional scoring factors / details</summary>
        public string? MetadataJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// PHASE 1: KYC Verification Status (extends customer KYC workflow)
    /// Tracks verification status per loan application, document checklists by customer type.
    /// </summary>
    public class LoanApplicationKycVerification
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>Reference to the loan application</summary>
        public Guid ApplicationId { get; set; }

        /// <summary>Reference to customer (same as LoanApplication.CustomerId)</summary>
        [MaxLength(150)]
        public string? CustomerId { get; set; }

        /// <summary>Customer type: INDIVIDUAL | JOINT | CORPORATE | HUF | PARTNERSHIP</summary>
        [MaxLength(30)]
        public string CustomerType { get; set; } = "INDIVIDUAL";

        // ── KYC Verification Status ─────────────────────────────────────────────
        /// <summary>INITIATED | IN_PROGRESS | VERIFIED | REJECTED | EXPIRED</summary>
        [MaxLength(30)]
        public string VerificationStatus { get; set; } = "INITIATED";

        /// <summary>Verification method: OFFLINE | VIDEO_KYC | BIOMETRIC</summary>
        [MaxLength(30)]
        public string? VerificationMethod { get; set; }

        /// <summary>When KYC was verified/approved</summary>
        public DateTime? VerifiedAt { get; set; }

        /// <summary>Officer who verified the KYC</summary>
        [MaxLength(150)]
        public string? VerifiedBy { get; set; }

        /// <summary>When KYC will expire (3 years from VerifiedAt)</summary>
        public DateTime? ExpiresAt { get; set; }

        /// <summary>Rejection reason if status = REJECTED</summary>
        public string? RejectionReason { get; set; }

        // ── Document Checklist ──────────────────────────────────────────────────
        /// <summary>JSON array of required documents per customer type
        /// Example for INDIVIDUAL: [
        ///   { "type": "pan", "label": "PAN Card", "required": true, "uploaded": false },
        ///   { "type": "aadhaar", "label": "Aadhaar Card", "required": true, "uploaded": false },
        ///   { "type": "identity", "label": "Identity Proof", "required": true, "uploaded": false },
        ///   { "type": "address", "label": "Address Proof", "required": true, "uploaded": false }
        /// ]
        /// </summary>
        public string? DocumentChecklistJson { get; set; }

        /// <summary>Count of required documents uploaded</summary>
        public int DocumentsUploadedCount { get; set; }

        /// <summary>Total count of required documents</summary>
        public int DocumentsRequiredCount { get; set; }

        // ── Additional Verification ─────────────────────────────────────────────
        /// <summary>Video KYC link/details (JSON) if method = VIDEO_KYC</summary>
        public string? VideoKycMetadataJson { get; set; }

        /// <summary>PEP (Politically Exposed Person) check result: CLEAR | MATCH | PENDING</summary>
        [MaxLength(30)]
        public string? PepCheckStatus { get; set; }

        /// <summary>If PepCheckStatus = MATCH, details of the match (JSON)</summary>
        public string? PepCheckDetails { get; set; }

        /// <summary>PEP check performed date</summary>
        public DateTime? PepCheckedAt { get; set; }

        // ── Audit ───────────────────────────────────────────────────────────────
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(150)]
        public string? CreatedBy { get; set; }
    }
}
