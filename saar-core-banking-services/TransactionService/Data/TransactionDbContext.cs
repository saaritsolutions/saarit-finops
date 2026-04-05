using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TransactionService.Models;
using TransactionService.Services;

namespace TransactionService.Data
{
    public class TransactionDbContext : DbContext
    {
        public string TenantSchema { get; }

        // DI constructor (runtime)
        public TransactionDbContext(DbContextOptions<TransactionDbContext> options, ITenantService tenantService)
            : base(options)
        {
            TenantSchema = tenantService.TenantId;
        }

        // Design-time constructor (EF tooling)
        public TransactionDbContext(DbContextOptions<TransactionDbContext> options)
            : base(options)
        {
            TenantSchema = "public";
        }

        // ── Existing tables ─────────────────────────────────────────────────
        public DbSet<Receipt> Receipts { get; set; }
        public DbSet<AccountHistory> AccountHistories { get; set; }

        // ── Double-entry ledger tables ───────────────────────────────────────
        public DbSet<Journal> Journals { get; set; }
        public DbSet<JournalEntry> JournalEntries { get; set; }
        public DbSet<ChartOfAccount> ChartOfAccounts { get; set; }
        public DbSet<LedgerBalance> LedgerBalances { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.HasDefaultSchema(TenantSchema);

            // ── Journal ──────────────────────────────────────────────────────
            modelBuilder.Entity<Journal>(e =>
            {
                e.HasKey(j => j.JournalId);
                e.Property(j => j.JournalNumber).IsRequired().HasMaxLength(30);
                e.Property(j => j.IdempotencyKey).IsRequired().HasMaxLength(200);
                e.HasIndex(j => j.IdempotencyKey).IsUnique();
                e.Property(j => j.Description).HasMaxLength(500);
                e.Property(j => j.ReferenceType).HasMaxLength(50);
                e.Property(j => j.ReferenceId).HasMaxLength(100);
                e.Property(j => j.PostedBy).HasMaxLength(100);
                e.Property(j => j.Status).HasMaxLength(20);
                e.HasMany(j => j.Entries)
                 .WithOne(je => je.Journal)
                 .HasForeignKey(je => je.JournalId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // ── JournalEntry ─────────────────────────────────────────────────
            modelBuilder.Entity<JournalEntry>(e =>
            {
                e.HasKey(je => je.JournalEntryId);
                e.Property(je => je.AccountCode).IsRequired().HasMaxLength(10);
                e.Property(je => je.AccountName).HasMaxLength(100);
                e.Property(je => je.DebitAmount).HasPrecision(18, 2);
                e.Property(je => je.CreditAmount).HasPrecision(18, 2);
                e.Property(je => je.Currency).HasMaxLength(3);
                e.Property(je => je.Narration).HasMaxLength(500);
                e.HasIndex(je => je.AccountCode);
            });

            // ── ChartOfAccount ───────────────────────────────────────────────
            modelBuilder.Entity<ChartOfAccount>(e =>
            {
                e.HasKey(a => a.AccountCode);
                e.Property(a => a.AccountCode).HasMaxLength(10);
                e.Property(a => a.AccountName).IsRequired().HasMaxLength(100);
                e.Property(a => a.AccountType).HasMaxLength(20);
                e.Property(a => a.NormalBalance).HasMaxLength(6);
            });

            // ── LedgerBalance ────────────────────────────────────────────────
            modelBuilder.Entity<LedgerBalance>(e =>
            {
                e.HasKey(b => b.LedgerBalanceId);
                e.Property(b => b.AccountCode).IsRequired().HasMaxLength(10);
                e.HasIndex(b => b.AccountCode).IsUnique();
                e.Property(b => b.DebitTotal).HasPrecision(18, 2);
                e.Property(b => b.CreditTotal).HasPrecision(18, 2);
            });
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ReplaceService<IModelCacheKeyFactory, TenantModelCacheKeyFactory>();
            optionsBuilder.ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        }
    }
}
