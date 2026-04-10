using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LoanService.Models
{
    /// <summary>
    /// Enterprise-grade loan application entity covering the full lifecycle:
    /// DRAFT → SUBMITTED → CREDIT_REVIEW → LEGAL_REVIEW → SANCTIONED → DISBURSED / REJECTED
    /// </summary>
    public class LoanApplication
    {
        // ── Identity ────────────────────────────────────────────────────────────
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>Human-readable reference e.g. LAP-2026-000042</summary>
        [MaxLength(30)]
        public string ApplicationNumber { get; set; } = string.Empty;

        // ── Loan Parameters ─────────────────────────────────────────────────────
        /// <summary>PERSONAL_LOAN | HOME_LOAN | BUSINESS_LOAN | GOLD_LOAN | VEHICLE_LOAN</summary>
        [MaxLength(50)]
        public string ProductType { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal RequestedAmount { get; set; }

        public int TenureMonths { get; set; }

        [MaxLength(200)]
        public string? PurposeOfLoan { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? SanctionedAmount { get; set; }

        [Column(TypeName = "decimal(6,4)")]
        public decimal? InterestRate { get; set; }

        // ── Status / Workflow ───────────────────────────────────────────────────
        /// <summary>DRAFT | SUBMITTED | CREDIT_REVIEW | LEGAL_REVIEW | SANCTIONED | DISBURSED | REJECTED</summary>
        [MaxLength(30)]
        public string Status { get; set; } = "DRAFT";

        public Guid? WorkflowInstanceId { get; set; }

        [MaxLength(500)]
        public string? RejectionReason { get; set; }

        [MaxLength(1000)]
        public string? SanctionRemarks { get; set; }

        // ── Applicant Personal Details ──────────────────────────────────────────
        [MaxLength(150)]
        public string ApplicantName { get; set; } = string.Empty;

        public DateTime? DateOfBirth { get; set; }

        /// <summary>M | F | O</summary>
        [MaxLength(1)]
        public string? Gender { get; set; }

        /// <summary>SINGLE | MARRIED | DIVORCED | WIDOWED</summary>
        [MaxLength(20)]
        public string? MaritalStatus { get; set; }

        /// <summary>Format: ABCDE1234F</summary>
        [MaxLength(10)]
        public string? PanNumber { get; set; }

        /// <summary>Last 4 digits of Aadhaar only — never store full number</summary>
        [MaxLength(4)]
        public string? AadhaarLast4 { get; set; }

        [MaxLength(15)]
        public string? MobileNumber { get; set; }

        [MaxLength(150)]
        public string? Email { get; set; }

        // ── Current Address ─────────────────────────────────────────────────────
        [MaxLength(200)]
        public string? CurrentAddressLine1 { get; set; }

        [MaxLength(200)]
        public string? CurrentAddressLine2 { get; set; }

        [MaxLength(100)]
        public string? CurrentCity { get; set; }

        [MaxLength(60)]
        public string? CurrentState { get; set; }

        [MaxLength(10)]
        public string? CurrentPinCode { get; set; }

        [MaxLength(50)]
        public string? ResidenceType { get; set; } // OWNED | RENTED | PARENTAL

        // ── Permanent Address ───────────────────────────────────────────────────
        public bool SameAsCurrent { get; set; }

        [MaxLength(200)]
        public string? PermanentAddressLine1 { get; set; }

        [MaxLength(200)]
        public string? PermanentAddressLine2 { get; set; }

        [MaxLength(100)]
        public string? PermanentCity { get; set; }

        [MaxLength(60)]
        public string? PermanentState { get; set; }

        [MaxLength(10)]
        public string? PermanentPinCode { get; set; }

        // ── Employment Details ──────────────────────────────────────────────────
        /// <summary>SALARIED | SELF_EMPLOYED | BUSINESS_OWNER | RETIRED | OTHERS</summary>
        [MaxLength(30)]
        public string? EmploymentType { get; set; }

        [MaxLength(200)]
        public string? EmployerName { get; set; }

        [MaxLength(100)]
        public string? Designation { get; set; }

        public int? YearsAtCurrentJob { get; set; }

        public int? TotalWorkExperienceYears { get; set; }

        [MaxLength(20)]
        public string? OfficePhone { get; set; }

        // ── Financial Details ───────────────────────────────────────────────────
        [Column(TypeName = "decimal(18,2)")]
        public decimal GrossMonthlyIncome { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetMonthlyIncome { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherMonthlyIncome { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ExistingMonthlyEMI { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MonthlyObligations { get; set; }

        // ── Credit Assessment ───────────────────────────────────────────────────
        public int? CibilScore { get; set; }

        [MaxLength(20)]
        public string? CibilBand { get; set; } // EXCELLENT | GOOD | FAIR | POOR

        [Column(TypeName = "decimal(6,4)")]
        public decimal? FOIRPercent { get; set; } // Fixed Obligation to Income Ratio

        [Column(TypeName = "decimal(6,4)")]
        public decimal? LTVPercent { get; set; } // Loan to Value ratio (secured loans)

        [MaxLength(20)]
        public string? RiskGrade { get; set; } // A+ | A | B+ | B | C

        // ── Collateral (Secured Loans) ──────────────────────────────────────────
        [MaxLength(50)]
        public string? CollateralType { get; set; } // PROPERTY | GOLD | VEHICLE | FD | SHARES

        [Column(TypeName = "decimal(18,2)")]
        public decimal? CollateralValue { get; set; }

        [MaxLength(500)]
        public string? CollateralDescription { get; set; }

        // ── Co-Applicant ────────────────────────────────────────────────────────
        public bool HasCoApplicant { get; set; }

        /// <summary>JSON blob for co-applicant details (mirrors applicant fields)</summary>
        public string? CoApplicantJson { get; set; }

        // ── Assignment / Processing ─────────────────────────────────────────────
        [MaxLength(150)]
        public string? CreatedBy { get; set; }

        [MaxLength(150)]
        public string? AssignedTo { get; set; }

        [MaxLength(150)]
        public string? CreditOfficer { get; set; }

        // ── Disbursement ────────────────────────────────────────────────────────
        [MaxLength(30)]
        public string? DisbursementAccountNumber { get; set; }

        [MaxLength(11)]
        public string? DisbursementIFSC { get; set; }

        public DateTime? DisbursedAt { get; set; }

        /// <summary>Journal number returned by TransactionService on successful disbursal posting.</summary>
        [MaxLength(50)]
        public string? DisbursalJournalNumber { get; set; }

        // ── Legacy / Compatibility ──────────────────────────────────────────────
        [MaxLength(100)]
        public string? CustomerId { get; set; }

        /// <summary>Backward-compatible alias</summary>
        [NotMapped]
        public decimal Amount => RequestedAmount;

        public string? FormDataJson { get; set; }

        // ── Audit ───────────────────────────────────────────────────────────────
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // ── Navigation ──────────────────────────────────────────────────────────
        public List<LoanDocument> Documents { get; set; } = new();
        public List<LoanApprovalAction> ApprovalActions { get; set; } = new();
    }
}
