using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace InterestFeeService.Services
{
    public class StubAccountServiceClient : IAccountServiceClient
    {
        private static readonly ConcurrentDictionary<int, AccountInfo> _accounts = new();

        public static void AddOrUpdateAccount(AccountInfo account)
        {
            _accounts[account.AccountId] = account;
        }

        public static void ClearAccounts()
        {
            _accounts.Clear();
        }

        public Task<AccountInfo?> GetAccountAsync(int accountId)
        {
            _accounts.TryGetValue(accountId, out var account);
            return Task.FromResult<AccountInfo?>(account);
        }

        public Task<List<InterestEligibleAccount>> GetInterestEligibleAsync(
            string tenantId, CancellationToken ct = default)
        {
            // Return stub accounts as InterestEligibleAccount records for testing
            var result = _accounts.Values.Select(a => new InterestEligibleAccount(
                a.AccountId, $"ACC{a.AccountId:D5}", "Savings",
                a.Balance, 3.5m, a.IsTDSExempt, a.AccruedInterest, a.AccruedTDS
            )).ToList();
            return Task.FromResult(result);
        }

        public Task UpdateAccruedInterestAsync(
            int accountId, string tenantId, decimal delta, CancellationToken ct = default)
        {
            if (_accounts.TryGetValue(accountId, out var account))
                account.AccruedInterest += delta;
            return Task.CompletedTask;
        }
    }
}
