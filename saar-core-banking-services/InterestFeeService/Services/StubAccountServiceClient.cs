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
    }
}
