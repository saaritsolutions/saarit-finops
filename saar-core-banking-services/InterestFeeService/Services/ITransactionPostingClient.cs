namespace InterestFeeService.Services
{
    public interface ITransactionPostingClient
    {
        /// <summary>
        /// Posts monthly interest credit: DR 5010 (Interest Expense) / CR 2010 (Customer Deposits).
        /// Returns the journal number on success, or null on failure (fail-open).
        /// </summary>
        Task<string?> PostMonthlyInterestAsync(
            int accountId, string accountNumber, string tenantId,
            decimal interestAmount, string period, CancellationToken ct = default);

        /// <summary>
        /// Posts TDS deduction: DR 2010 (Customer Deposits) / CR 2040 (Other Liabilities — TDS Payable).
        /// Returns the journal number on success, or null on failure (fail-open).
        /// </summary>
        Task<string?> PostTdsDeductionAsync(
            int accountId, string accountNumber, string tenantId,
            decimal tdsAmount, string period, CancellationToken ct = default);
    }
}
