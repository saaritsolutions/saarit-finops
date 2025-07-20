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

    public interface IAccountServiceClient
    {
        Task<AccountInfo?> GetAccountAsync(int accountId);
    }
}
