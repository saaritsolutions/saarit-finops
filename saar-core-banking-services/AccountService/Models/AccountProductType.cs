namespace AccountService.Models
{
    public class AccountProductType
    {
        public int AccountProductTypeId { get; set; }
        public string? Name { get; set; } // e.g. Savings, Current, FD, RD, NRE, NRO, FCNR
        public string? Description { get; set; }
        // Eligibility criteria fields
        public int? MinimumAge { get; set; }
        public string? AllowedCustomerTypes { get; set; } // e.g. Individual, Company, Trust, etc. (comma-separated)
        public decimal? MinimumOpeningAmount { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
