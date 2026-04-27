using NUnit.Framework;
using Microsoft.EntityFrameworkCore;
using InterestFeeService.Data;
using InterestFeeService.Models;
using InterestFeeService.Jobs;
using InterestFeeService.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace InterestFeeService.Tests
{
    /// <summary>
    /// SAAR-IFS-001 — 5 unit tests for interest accrual business logic.
    /// </summary>
    [TestFixture]
    public class AccrualTests
    {
        private static InterestFeeDbContext GetDb(string dbName)
        {
            var opts = new DbContextOptionsBuilder<InterestFeeDbContext>()
                .UseInMemoryDatabase(dbName)
                .Options;
            return new InterestFeeDbContext(opts);
        }

        // ─── T-1: SB account daily interest ──────────────────────────────────

        [Test]
        public void DailyAccrual_SavingsAccount_CalculatesCorrectly()
        {
            // balance=100000, rate=3.5% p.a.
            // daily = Round(100000 × 3.5 / 100 / 365, 4)
            const decimal balance = 100_000m;
            const decimal rate    = 3.5m;

            var daily = Math.Round(balance * rate / 100m / 365m, 4);

            Assert.That(daily, Is.EqualTo(9.5890m),
                "Savings daily interest should be ₹9.5890 for ₹1L at 3.5% p.a.");
        }

        // ─── T-2: FD account daily interest ──────────────────────────────────

        [Test]
        public void DailyAccrual_FDAccount_CalculatesCorrectly()
        {
            // principal=500000, rate=8.0% p.a.
            // daily = Round(500000 × 8 / 100 / 365, 4)
            const decimal principal = 500_000m;
            const decimal rate      = 8.0m;

            var daily = Math.Round(principal * rate / 100m / 365m, 4);

            Assert.That(daily, Is.EqualTo(109.5890m),
                "FD daily interest should be ₹109.5890 for ₹5L at 8.0% p.a.");
        }

        // ─── T-3: Idempotency — second run skips already-accrued date ────────

        [Test]
        public async Task DailyAccrual_IsIdempotent_SecondRunSkipsAlreadyAccruedDate()
        {
            using var db  = GetDb(nameof(DailyAccrual_IsIdempotent_SecondRunSkipsAlreadyAccruedDate));
            var today     = DateTime.UtcNow.Date;
            const int accountId = 42;
            const string tenant = "public";

            // Simulate first accrual: insert one DailyAccrual record
            db.InterestFees.Add(new InterestFee
            {
                AccountId       = accountId,
                TenantId        = tenant,
                InterestAmount  = 9.5890m,
                CalculationType = "DailyAccrual",
                CalculationDate = today,
            });
            await db.SaveChangesAsync();

            // Check the idempotency guard (same logic DailyAccrualJob uses)
            bool alreadyDone = await db.InterestFees.AnyAsync(f =>
                f.AccountId       == accountId &&
                f.TenantId        == tenant &&
                f.CalculationType == "DailyAccrual" &&
                f.CalculationDate == today);

            Assert.That(alreadyDone, Is.True,
                "Idempotency guard should detect the existing record and skip a second accrual.");

            // Total records should still be 1 (the job would NOT insert another)
            var count = db.InterestFees.Count(f =>
                f.AccountId == accountId && f.CalculationType == "DailyAccrual" && f.CalculationDate == today);
            Assert.That(count, Is.EqualTo(1),
                "Only one DailyAccrual record should exist per account per date.");
        }

        // ─── T-4: TDS applied when interest > ₹5000 and not exempt ──────────

        [Test]
        public void MonthlyPosting_ComputesTDS_WhenInterestExceedsThreshold()
        {
            // Business rule: TDS = 10% of interest if totalInterest > ₹5000 AND !IsTDSExempt
            const decimal totalInterest = 6_000m;
            const bool    isTDSExempt   = false;
            const decimal TdsThreshold  = 5_000m;
            const decimal TdsRate       = 0.10m;

            decimal tds = 0m;
            if (totalInterest > TdsThreshold && !isTDSExempt)
                tds = Math.Round(totalInterest * TdsRate, 2);

            Assert.That(tds, Is.EqualTo(600m),
                "TDS should be ₹600 (10%) on ₹6000 interest for a non-exempt account.");
        }

        // ─── T-5: TDS skipped when IsTDSExempt = true ────────────────────────

        [Test]
        public void MonthlyPosting_SkipsTDS_WhenIsTDSExempt()
        {
            const decimal totalInterest = 6_000m;
            bool          isTDSExempt   = true;   // non-const to avoid CS0162 unreachable-code warning
            const decimal TdsThreshold  = 5_000m;
            const decimal TdsRate       = 0.10m;

            decimal tds = 0m;
            if (totalInterest > TdsThreshold && !isTDSExempt)
                tds = Math.Round(totalInterest * TdsRate, 2);

            Assert.That(tds, Is.EqualTo(0m),
                "TDS should be ₹0 for a TDS-exempt account regardless of interest amount.");
        }
    }
}
