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

        // ── Post-Disbursal Repayment Tracking ───────────────────────────────────
        /// <summary>Set to SanctionedAmount on DISBURSE; decremented by principal component on each EMI.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? OutstandingPrincipal { get; set; }

        /// <summary>Set on DISBURSE to today+1 month; advanced +1 month on each successful EMI collection.</summary>
        public DateTime? NextDueDate { get; set; }

        /// <summary>Days past NextDueDate — computed at request time; never stored.</summary>
        [NotMapped]
        public int OverdueDays =>
            NextDueDate.HasValue && NextDueDate.Value.Date < DateTime.UtcNow.Date
                ? (int)(DateTime.UtcNow.Date - NextDueDate.Value.Date).TotalDays
                : 0;

        /// <summary>RBI IRAC SMA classification — STANDARD | SMA-0 | SMA-1 | SMA-2 | NPA.</summary>
        [NotMapped]
        public string SmaStatus => OverdueDays switch
        {
            0     => "STANDARD",
            <= 30 => "SMA-0",
            <= 60 => "SMA-1",
            <= 90 => "SMA-2",
            _     => "NPA"
        };

        /// <summary>RBI IRAC NPA sub-classification (only when SmaStatus == "NPA").</summary>
        [NotMapped]
        public string? NpaSubClassification => SmaStatus == "NPA" ? OverdueDays switch
        {
            <= 365  => "SUB_STANDARD",
            <= 730  => "DOUBTFUL_1",
            <= 1095 => "DOUBTFUL_2",
            _       => "DOUBTFUL_3",
        } : null;

        /// <summary>Required provisioning percentage per RBI IRAC (secured basis).</summary>
        [NotMapped]
        public decimal RequiredProvisioningPct => NpaSubClassification switch
        {
            "SUB_STANDARD" => 15m,
            "DOUBTFUL_1"   => 25m,
            "DOUBTFUL_2"   => 40m,
            "DOUBTFUL_3"   => 100m,
            _              => 0m,
        };

        /// <summary>Provisioning amount = OutstandingPrincipal × RequiredProvisioningPct / 100.</summary>
        [NotMapped]
        public decimal RequiredProvisioning =>
            Math.Round((OutstandingPrincipal ?? 0m) * RequiredProvisioningPct / 100m, 2);

        // ── NPA Write-Off (SAAR-NPA-002) ────────────────────────────────────────
        /// <summary>UTC timestamp when the loan was written off the balance sheet.</summary>
        public DateTime? WriteOffDate { get; set; }

        /// <summary>Reason provided at time of write-off (max 500 chars).</summary>
        [MaxLength(500)]
        public string? WriteOffReason { get; set; }

        /// <summary>User who authorized the write-off (max 150 chars).</summary>
        [MaxLength(150)]
        public string? WriteOffAuthorizedBy { get; set; }

        /// <summary>Journal number posted by TransactionService on write-off (null if fail-open).</summary>
        [MaxLength(50)]
        public string? WriteOffJournalNumber { get; set; }

        // ── Loan Restructuring (SAAR-LRP-003) ───────────────────────────────────
        /// <summary>True when the loan has been restructured (revised terms agreed with borrower).</summary>
        public bool IsRestructured { get; set; } = false;

        /// <summary>UTC timestamp of restructuring.</summary>
        public DateTime? RestructuredDate { get; set; }

        /// <summary>Reason for restructuring (max 500 chars).</summary>
        [MaxLength(500)]
        public string? RestructuredReason { get; set; }

        /// <summary>Revised monthly EMI agreed at restructuring.</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal? RestructuredNewEmi { get; set; }

        /// <summary>Revised tenure in months agreed at restructuring.</summary>
        public int? RestructuredNewTenureMonths { get; set; }

        /// <summary>Revised annual interest rate agreed at restructuring.</summary>
        [Column(TypeName = "decimal(6,4)")]
        public decimal? RestructuredNewInterestRate { get; set; }

        /// <summary>
        /// Required provisioning % for restructured loans per RBI:
        /// 5% if standard/SMA; same as NpaSubClassification rate if NPA.
        /// </summary>
        [NotMapped]
        public decimal RestructuredProvisioningPct =>
            !IsRestructured ? 0m :
            SmaStatus == "NPA" ? RequiredProvisioningPct : 5m;

        /// <summary>Provisioning amount = OutstandingPrincipal × RestructuredProvisioningPct / 100.</summary>
        [NotMapped]
        public decimal RestructuredProvisioning =>
            Math.Round((OutstandingPrincipal ?? 0m) * RestructuredProvisioningPct / 100m, 2);

        // ── Navigation ──────────────────────────────────────────────────────────
        public List<LoanDocument> Documents { get; set; } = new();
        public List<LoanApprovalAction> ApprovalActions { get; set; } = new();
        public List<LoanRepayment> Repayments { get; set; } = new();
    }
}
