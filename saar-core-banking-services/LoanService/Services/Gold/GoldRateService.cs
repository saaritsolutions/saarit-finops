using Microsoft.EntityFrameworkCore;
using LoanService.Data;
using LoanService.Models.Gold;

namespace LoanService.Services.Gold
{
    public class GoldRateService : IGoldRateService
    {
        private readonly LoanDbContext _db;

        public GoldRateService(LoanDbContext db)
        {
            _db = db;
        }

        public async Task<(GoldRateMaster? Rate, bool IsLatest)> GetTodayRateAsync(
            CancellationToken ct = default)
        {
            var today = DateTime.UtcNow.Date;

            // Try today's rate first
            var todayRate = await _db.GoldRateMasters
                .Where(r => r.RateDate.Date == today)
                .OrderByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (todayRate != null)
                return (todayRate, true);

            // Fallback to most recent available
            var latest = await _db.GoldRateMasters
                .OrderByDescending(r => r.RateDate)
                .FirstOrDefaultAsync(ct);

            return (latest, false);
        }

        public async Task<List<GoldRateMaster>> GetHistoryAsync(
            int days = 30,
            CancellationToken ct = default)
        {
            var since = DateTime.UtcNow.Date.AddDays(-days);
            return await _db.GoldRateMasters
                .Where(r => r.RateDate >= since)
                .OrderByDescending(r => r.RateDate)
                .ToListAsync(ct);
        }

        public async Task<GoldRateMaster> CreateRateAsync(
            DateTime rateDate,
            decimal ratePerGram,
            string source,
            string enteredBy,
            CancellationToken ct = default)
        {
            var rateDateUtc = rateDate.Date; // normalize to midnight UTC

            bool exists = await _db.GoldRateMasters
                .AnyAsync(r => r.RateDate.Date == rateDateUtc, ct);

            if (exists)
                throw new InvalidOperationException(
                    $"A gold rate for {rateDateUtc:yyyy-MM-dd} already exists. Use the existing entry or delete it first.");

            var entry = new GoldRateMaster
            {
                Id              = Guid.NewGuid(),
                RateDate        = rateDateUtc,
                RatePerGramFor22K = ratePerGram,
                Source          = source,
                EnteredBy       = enteredBy,
                CreatedAt       = DateTime.UtcNow,
            };

            _db.GoldRateMasters.Add(entry);
            await _db.SaveChangesAsync(ct);
            return entry;
        }
    }
}
