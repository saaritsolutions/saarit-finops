using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using LoanService.Models;
using LoanService.Models.Gold;
using LoanService.Services;
using System.Text.Json;

namespace LoanService.Data
{
    public class LoanDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime)
        public LoanDbContext(DbContextOptions<LoanDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling)
        public LoanDbContext(DbContextOptions<LoanDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        public DbSet<LoanAccount> LoanAccounts { get; set; }
        public DbSet<LoanApplication> LoanApplications { get; set; }
        public DbSet<LoanProduct> LoanProducts { get; set; }
        public DbSet<LoanDocument> LoanDocuments { get; set; }
        public DbSet<LoanApprovalAction> LoanApprovalActions { get; set; }

        // ── Gold Loan ──────────────────────────────────────────────────────────
        public DbSet<GoldLoanDetails> GoldLoanDetails { get; set; }
        public DbSet<GoldPledgeItem> GoldPledgeItems { get; set; }
        public DbSet<GoldRateMaster> GoldRateMasters { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema(TenantSchema);

            // ── LoanApplication relationships ───────────────────────────────────
            modelBuilder.Entity<LoanApplication>(e =>
            {
                e.HasMany(a => a.Documents)
                 .WithOne(d => d.LoanApplication)
                 .HasForeignKey(d => d.LoanApplicationId)
                 .OnDelete(DeleteBehavior.Cascade);

                e.HasMany(a => a.ApprovalActions)
                 .WithOne(d => d.LoanApplication)
                 .HasForeignKey(d => d.LoanApplicationId)
                 .OnDelete(DeleteBehavior.Cascade);

                e.HasIndex(a => a.ApplicationNumber).IsUnique();
                e.HasIndex(a => a.Status);
                e.HasIndex(a => a.ProductType);
                e.HasIndex(a => a.CreatedAt);
            });

            modelBuilder.Entity<LoanProduct>(e =>
            {
                e.HasIndex(p => p.ProductCode).IsUnique();
            });

            // ── GoldLoanDetails ↔ LoanApplication (1:1) ──────────────────────
            modelBuilder.Entity<GoldLoanDetails>(e =>
            {
                e.HasOne(g => g.LoanApplication)
                 .WithOne()
                 .HasForeignKey<GoldLoanDetails>(g => g.LoanApplicationId)
                 .OnDelete(DeleteBehavior.Cascade);

                e.HasIndex(g => g.LoanApplicationId).IsUnique();
                e.HasIndex(g => g.GoldLoanStatus);
            });

            // ── GoldPledgeItem ↔ GoldLoanDetails (1:N) ───────────────────────
            modelBuilder.Entity<GoldPledgeItem>(e =>
            {
                e.HasOne(p => p.GoldLoanDetails)
                 .WithMany(g => g.PledgeItems)
                 .HasForeignKey(p => p.GoldLoanDetailsId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // ── GoldRateMaster: unique RateDate per tenant schema ────────────
            modelBuilder.Entity<GoldRateMaster>(e =>
            {
                e.HasIndex(r => r.RateDate).IsUnique();
            });
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
            optionsBuilder.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }
    }

    // ── Loan Product Seeder ────────────────────────────────────────────────────
    public static class LoanProductSeeder
    {
        private static readonly string[] DocumentChecklist_Unsecured = new[]
        {
            "PAN_CARD", "AADHAAR", "SALARY_SLIP_3M", "BANK_STATEMENT_6M", "FORM_16", "PHOTO", "SIGNATURE"
        };

        private static readonly string[] DocumentChecklist_HomeLoan = new[]
        {
            "PAN_CARD", "AADHAAR", "SALARY_SLIP_3M", "BANK_STATEMENT_6M", "ITR_2Y",
            "PROPERTY_DOCS", "FORM_16", "PHOTO", "SIGNATURE"
        };

        private static readonly string[] DocumentChecklist_BusinessLoan = new[]
        {
            "PAN_CARD", "AADHAAR", "BANK_STATEMENT_6M", "ITR_2Y",
            "GST_CERTIFICATE", "BUSINESS_PROOF", "PHOTO", "SIGNATURE"
        };

        private static readonly string[] DocumentChecklist_GoldLoan = new[]
        {
            "PAN_CARD", "AADHAAR", "GOLD_RECEIPT", "PHOTO", "SIGNATURE"
        };

        private static readonly string[] DocumentChecklist_VehicleLoan = new[]
        {
            "PAN_CARD", "AADHAAR", "SALARY_SLIP_3M", "BANK_STATEMENT_6M", "VEHICLE_RC", "PHOTO", "SIGNATURE"
        };

        public static readonly LoanProduct[] Products = new[]
        {
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000001"),
                ProductCode = "PERSONAL_LOAN",
                Name = "Personal Loan",
                Description = "Unsecured personal loan for any purpose — medical, travel, education, or lifestyle.",
                Category = "UNSECURED",
                MinAmount = 50_000,
                MaxAmount = 40_00_000,
                MinTenureMonths = 12,
                MaxTenureMonths = 60,
                BaseRatePercent = 10.50m,
                MaxRatePercent = 18.00m,
                ProcessingFeePercent = 1.50m,
                MinCibilScore = 700,
                MinMonthlyIncome = 20_000,
                MaxFoirPercent = 0.50m,
                RequiresCollateral = false,
                AllowsCoApplicant = true,
                RequiresGuarantor = false,
                DocumentChecklistJson = JsonSerializer.Serialize(DocumentChecklist_Unsecured),
                IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000002"),
                ProductCode = "HOME_LOAN",
                Name = "Home Loan",
                Description = "Purchase, construct, or renovate your dream home with competitive rates.",
                Category = "SECURED",
                MinAmount = 5_00_000,
                MaxAmount = 5_00_00_000,
                MinTenureMonths = 60,
                MaxTenureMonths = 300,
                BaseRatePercent = 8.50m,
                MaxRatePercent = 12.50m,
                ProcessingFeePercent = 0.50m,
                MinCibilScore = 650,
                MinMonthlyIncome = 30_000,
                MaxFoirPercent = 0.55m,
                MaxLtvPercent = 0.80m,
                RequiresCollateral = true,
                AllowsCoApplicant = true,
                RequiresGuarantor = false,
                DocumentChecklistJson = JsonSerializer.Serialize(DocumentChecklist_HomeLoan),
                IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000003"),
                ProductCode = "BUSINESS_LOAN",
                Name = "Business Loan",
                Description = "Fuel your business growth — working capital, equipment, or expansion.",
                Category = "UNSECURED",
                MinAmount = 2_00_000,
                MaxAmount = 2_00_00_000,
                MinTenureMonths = 12,
                MaxTenureMonths = 84,
                BaseRatePercent = 12.00m,
                MaxRatePercent = 22.00m,
                ProcessingFeePercent = 2.00m,
                MinCibilScore = 680,
                MinMonthlyIncome = 50_000,
                MaxFoirPercent = 0.55m,
                RequiresCollateral = false,
                AllowsCoApplicant = true,
                RequiresGuarantor = false,
                DocumentChecklistJson = JsonSerializer.Serialize(DocumentChecklist_BusinessLoan),
                IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000004"),
                ProductCode = "GOLD_LOAN",
                Name = "Gold Loan",
                Description = "Instant funds against your gold ornaments. Same-day disbursal available.",
                Category = "SECURED",
                MinAmount = 10_000,
                MaxAmount = 50_00_000,
                MinTenureMonths = 3,
                MaxTenureMonths = 24,
                BaseRatePercent = 7.00m,
                MaxRatePercent = 10.00m,
                ProcessingFeePercent = 0.25m,
                MinCibilScore = 0,
                MinMonthlyIncome = 0,
                MaxFoirPercent = 1.00m,
                MaxLtvPercent = 0.75m,
                RequiresCollateral = true,
                AllowsCoApplicant = false,
                RequiresGuarantor = false,
                DocumentChecklistJson = JsonSerializer.Serialize(DocumentChecklist_GoldLoan),
                IsActive = true,
            },
            new LoanProduct
            {
                Id = new Guid("10000000-0000-0000-0000-000000000005"),
                ProductCode = "VEHICLE_LOAN",
                Name = "Vehicle Loan",
                Description = "Finance your new car or two-wheeler with flexible repayment options.",
                Category = "SECURED",
                MinAmount = 50_000,
                MaxAmount = 2_00_00_000,
                MinTenureMonths = 12,
                MaxTenureMonths = 84,
                BaseRatePercent = 8.75m,
                MaxRatePercent = 14.00m,
                ProcessingFeePercent = 1.00m,
                MinCibilScore = 650,
                MinMonthlyIncome = 15_000,
                MaxFoirPercent = 0.50m,
                MaxLtvPercent = 0.85m,
                RequiresCollateral = true,
                AllowsCoApplicant = true,
                RequiresGuarantor = false,
                DocumentChecklistJson = JsonSerializer.Serialize(DocumentChecklist_VehicleLoan),
                IsActive = true,
            },
        };

        public static async Task SeedAsync(LoanDbContext db)
        {
            foreach (var product in Products)
            {
                if (!await db.LoanProducts.AnyAsync(p => p.ProductCode == product.ProductCode))
                {
                    db.LoanProducts.Add(product);
                }
            }
            await db.SaveChangesAsync();
        }
    }
}
