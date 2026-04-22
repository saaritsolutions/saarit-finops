using LoanService.Models.Gold;

namespace LoanService.Services.Gold
{
    public interface IGoldRateService
    {
        /// <summary>
        /// Returns today's rate. If no entry for today, returns the most recent available rate
        /// with IsLatest=false so the caller can warn the user.
        /// Returns null if no rate has ever been entered.
        /// </summary>
        Task<(GoldRateMaster? Rate, bool IsLatest)> GetTodayRateAsync(CancellationToken ct = default);

        /// <summary>Returns rate entries for the last <paramref name="days"/> days, newest first.</summary>
        Task<List<GoldRateMaster>> GetHistoryAsync(int days = 30, CancellationToken ct = default);

        /// <summary>
        /// Creates a new daily rate entry. Throws InvalidOperationException if a rate for the
        /// same date already exists (HTTP 409 in controller).
        /// </summary>
        Task<GoldRateMaster> CreateRateAsync(
            DateTime rateDate,
            decimal ratePerGram,
            string source,
            string enteredBy,
            CancellationToken ct = default);
    }
}
