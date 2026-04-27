using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Services;
using Microsoft.EntityFrameworkCore;

namespace InterestFeeService.Jobs
{
    public class DailyAccrualJob : IHostedService, IDisposable
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DailyAccrualJob> _logger;
        private Timer? _timer;

        private static readonly string[] KnownTenants = { "public", "ucb_demo", "nbfc_demo" };
        private const decimal TdsThreshold = 5000m;
        private const decimal TdsRate      = 0.10m;

        public DailyAccrualJob(
            IServiceScopeFactory scopeFactory,
            ILogger<DailyAccrualJob> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("DailyAccrualJob started. Running initial accrual...");
            // Run immediately on startup (non-blocking fire-and-forget)
            _ = Task.Run(() => RunAccrualAsync(CancellationToken.None), CancellationToken.None);
            // Schedule subsequent runs every 24h
            _timer = new Timer(
                _ => _ = Task.Run(() => RunAccrualAsync(CancellationToken.None)),
                null,
                TimeSpan.FromHours(24),
                TimeSpan.FromHours(24));
            return Task.CompletedTask;
        }

        /// <summary>
        /// Exposed as internal so InterestFeesController can trigger it manually for demo.
        /// </summary>
        public async Task RunAccrualAsync(CancellationToken ct)
        {
            var today = DateTime.UtcNow.Date;
            _logger.LogInformation("DailyAccrualJob: starting accrual for {Date}", today);

            foreach (var tenant in KnownTenants)
            {
                try
                {
                    await AccrueForTenantAsync(tenant, today, ct);
                }
                catch (Exception ex)
                {
                    // Fail-open: log and continue to next tenant
                    _logger.LogWarning(ex, "DailyAccrualJob: failed for tenant {Tenant} — continuing", tenant);
                }
            }

            _logger.LogInformation("DailyAccrualJob: completed accrual for {Date}", today);
        }

        private async Task AccrueForTenantAsync(string tenant, DateTime today, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var accountClient = scope.ServiceProvider.GetRequiredService<IAccountServiceClient>();
            var db            = scope.ServiceProvider.GetRequiredService<InterestFeeDbContext>();

            var accounts = await accountClient.GetInterestEligibleAsync(tenant, ct);
            if (accounts.Count == 0)
            {
                _logger.LogInformation("DailyAccrualJob: tenant={Tenant} — no eligible accounts", tenant);
                return;
            }

            var newFees = new List<InterestFee>();

            foreach (var acc in accounts)
            {
                // Idempotency: skip if already accrued today for this account+tenant
                bool alreadyDone = await db.InterestFees.AnyAsync(f =>
                    f.AccountId       == acc.AccountId &&
                    f.TenantId        == tenant &&
                    f.CalculationType == "DailyAccrual" &&
                    f.CalculationDate == today, ct);

                if (alreadyDone) continue;

                var rate  = acc.InterestRate ?? 0m;
                var daily = Math.Round(acc.Balance * rate / 100m / 365m, 4);
                if (daily <= 0) continue;

                newFees.Add(new InterestFee
                {
                    AccountId       = acc.AccountId,
                    AccountNumber   = acc.AccountNumber,
                    TenantId        = tenant,
                    InterestAmount  = daily,
                    FeeAmount       = 0m,
                    TdsAmount       = 0m,
                    CalculationType = "DailyAccrual",
                    CalculationDate = today,
                    Remarks         = $"{acc.AccountType} @ {rate}% p.a."
                });

                // Update AccruedInterest on AccountService (best-effort)
                await accountClient.UpdateAccruedInterestAsync(acc.AccountId, tenant, daily, ct);
            }

            if (newFees.Count > 0)
            {
                db.InterestFees.AddRange(newFees);
                await db.SaveChangesAsync(ct);
            }

            _logger.LogInformation(
                "DailyAccrualJob: tenant={Tenant} — {New} accounts accrued for {Date}",
                tenant, newFees.Count, today);
        }

        /// <summary>
        /// Sums DailyAccrual records for the given period and posts monthly GL journals.
        /// Returns per-tenant summary.
        /// </summary>
        public async Task<MonthlyPostingResult> RunMonthlyPostingAsync(
            string period, CancellationToken ct)
        {
            // period format: "202604"
            if (!int.TryParse(period[..4], out var year) || !int.TryParse(period[4..], out var month))
                throw new ArgumentException($"Invalid period format '{period}'. Expected yyyyMM.");

            var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var to   = from.AddMonths(1);

            var result = new MonthlyPostingResult { Period = period };

            foreach (var tenant in KnownTenants)
            {
                try
                {
                    var tenantResult = await PostMonthlyForTenantAsync(tenant, period, from, to, ct);
                    result.AccountsPosted  += tenantResult.AccountsPosted;
                    result.TotalInterest   += tenantResult.TotalInterest;
                    result.TotalTds        += tenantResult.TotalTds;
                    result.TenantsProcessed++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "RunMonthlyPosting: failed for tenant {Tenant}", tenant);
                }
            }

            return result;
        }

        private async Task<MonthlyPostingResult> PostMonthlyForTenantAsync(
            string tenant, string period, DateTime from, DateTime to, CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db     = scope.ServiceProvider.GetRequiredService<InterestFeeDbContext>();
            var txnClient = scope.ServiceProvider.GetRequiredService<ITransactionPostingClient>();

            // Group unposted DailyAccrual records by account for this period
            var groups = await db.InterestFees
                .Where(f => f.TenantId        == tenant &&
                            f.CalculationType == "DailyAccrual" &&
                            f.CalculationDate >= from &&
                            f.CalculationDate < to)
                .GroupBy(f => new { f.AccountId, f.AccountNumber })
                .Select(g => new
                {
                    g.Key.AccountId,
                    g.Key.AccountNumber,
                    TotalInterest = g.Sum(f => f.InterestAmount)
                })
                .ToListAsync(ct);

            var result = new MonthlyPostingResult { Period = period };

            foreach (var g in groups)
            {
                // Skip if monthly posting record already exists (idempotency)
                var postingKey = $"MONTHLY-INTEREST-{g.AccountNumber}-{period}";
                bool alreadyPosted = await db.InterestFees.AnyAsync(f =>
                    f.TenantId        == tenant &&
                    f.AccountId       == g.AccountId &&
                    f.CalculationType == "MonthlyPosted" &&
                    f.Remarks         != null && f.Remarks.Contains(period), ct);

                if (alreadyPosted) continue;

                var accountNumber = g.AccountNumber ?? g.AccountId.ToString();

                // Post monthly interest journal to TransactionService
                var jnl = await txnClient.PostMonthlyInterestAsync(
                    g.AccountId, accountNumber, tenant, g.TotalInterest, period, ct);

                // Compute and post TDS if applicable
                decimal tds = 0m;
                if (g.TotalInterest > TdsThreshold)
                {
                    // Fetch TDS-exempt status from AccountService
                    using var accScope = _scopeFactory.CreateScope();
                    var accClient = accScope.ServiceProvider.GetRequiredService<IAccountServiceClient>();
                    var accounts = await accClient.GetInterestEligibleAsync(tenant, ct);
                    var acc = accounts.FirstOrDefault(a => a.AccountId == g.AccountId);

                    if (acc != null && !acc.IsTDSExempt)
                    {
                        tds = Math.Round(g.TotalInterest * TdsRate, 2);
                        await txnClient.PostTdsDeductionAsync(
                            g.AccountId, accountNumber, tenant, tds, period, ct);
                    }
                }

                // Record the monthly posting
                db.InterestFees.Add(new InterestFee
                {
                    AccountId       = g.AccountId,
                    AccountNumber   = accountNumber,
                    TenantId        = tenant,
                    InterestAmount  = g.TotalInterest,
                    TdsAmount       = tds,
                    FeeAmount       = 0m,
                    CalculationType = "MonthlyPosted",
                    CalculationDate = DateTime.UtcNow,
                    Remarks         = $"Monthly posting period={period} journal={jnl ?? "N/A"}"
                });

                result.AccountsPosted++;
                result.TotalInterest += g.TotalInterest;
                result.TotalTds      += tds;
            }

            await db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "RunMonthlyPosting: tenant={Tenant} period={Period} — {N} accounts posted, interest={Int:N2}, TDS={Tds:N2}",
                tenant, period, result.AccountsPosted, result.TotalInterest, result.TotalTds);

            return result;
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _timer?.Change(Timeout.Infinite, 0);
            return Task.CompletedTask;
        }

        public void Dispose() => _timer?.Dispose();
    }

    public class MonthlyPostingResult
    {
        public string Period         { get; set; } = string.Empty;
        public int    TenantsProcessed { get; set; }
        public int    AccountsPosted { get; set; }
        public decimal TotalInterest { get; set; }
        public decimal TotalTds      { get; set; }
    }
}
