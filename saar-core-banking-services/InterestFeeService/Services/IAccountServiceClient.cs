namespace InterestFeeService.Services
{
    public class AccountInfo
    {
        public int AccountId { get; set; }
        public decimal Balance { get; set; }
        public bool IsTDSExempt { get; set; }
        public decimal AccruedInterest { get; set; }
        public decimal AccruedTDS { get; set; }
        public bool IsClosed { get; set; }
    }

    public record InterestEligibleAccount(
        int AccountId,
        string? AccountNumber,
        string? AccountType,
        decimal Balance,
        decimal? InterestRate,
        bool IsTDSExempt,
        decimal AccruedInterest,
        decimal AccruedTDS);

    public interface IAccountServiceClient
    {
        Task<AccountInfo?> GetAccountAsync(int accountId);
        Task<List<InterestEligibleAccount>> GetInterestEligibleAsync(string tenantId, CancellationToken ct = default);
        Task UpdateAccruedInterestAsync(int accountId, string tenantId, decimal delta, CancellationToken ct = default);
    }
}
