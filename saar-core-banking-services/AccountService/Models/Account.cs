namespace AccountService.Models
{
    public class Account
    {
        public int AccountId { get; set; }
        public string? AccountNumber { get; set; }
        public int CustomerId { get; set; }
        // TODO: Reference to Customer microservice entity
        public int ProductTypeId { get; set; }
        public AccountProductType? ProductType { get; set; }
        public decimal Balance { get; set; }
        public string? Status { get; set; }
        public DateTime DateOpened { get; set; }
        public DateTime? DateClosed { get; set; }
        public string? ModeOfOperation { get; set; }
        public ICollection<AccountRestriction>? Restrictions { get; set; }
        // TODO: Nominee entity migration
        public ICollection<AccountHistory>? History { get; set; }
        // Account type flags
        public bool IsSimplifiedKYC { get; set; }
        public bool IsBSBD { get; set; }
        public bool IsSpecialScheme { get; set; }
        public string? SpecialSchemeName { get; set; }
        // Old account number fields
        public string? OldAccountNumber { get; set; }
        public DateTime? OldAccountOpenedDate { get; set; }
        // Initial deposit mode
        public string? InitialDepositMode { get; set; } // cash/transfer/clearing
        // Minor/guardian fields
        public bool IsMinor { get; set; }
        public string? LegalGuardianName { get; set; }
        public decimal? MinorAccountLimit { get; set; }
        // Maker-checker fields
        public string? CreatedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public string? ApprovalStatus { get; set; } // e.g. Pending, Approved, Rejected
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ApprovedAt { get; set; }
        // Company/trust/association docs (for current accounts)
        public string? CompanyDocuments { get; set; } // JSON or comma-separated list
        // Transaction limits for flagged accounts
        public decimal? TransactionLimit { get; set; } // Per transaction limit
        public decimal? DailyTransactionLimit { get; set; } // Daily total limit
        public bool IsDeceased { get; set; } // Flag for deceased/flagged account
        public decimal AccruedInterest { get; set; } // Interest accrued but not yet applied
        public decimal AccruedTDS { get; set; } // TDS accrued but not yet deducted
        public bool IsTDSExempt { get; set; } // TDS exemption flag
        // Branch association
        public int BranchId { get; set; }
        // TODO: JointCustomers migration
        public IList<int>? JointCustomers { get; set; } // List of CustomerIds for joint account holders
        public IList<Nominee>? Nominees { get; set; } // Nominees for this account
    }
}
