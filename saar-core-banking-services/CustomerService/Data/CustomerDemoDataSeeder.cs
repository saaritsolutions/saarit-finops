using CustomerService.Models;
using Microsoft.EntityFrameworkCore;

namespace CustomerService.Data
{
    /// <summary>
    /// Seeds 8 realistic customers per tenant covering all KYC states and customer types.
    /// Idempotent — checks by Mobile before inserting.
    /// Mirrors LoanDemoDataSeeder pattern exactly.
    /// </summary>
    public static class CustomerDemoDataSeeder
    {
        // Anchor date — fixed so timestamps look consistent every run
        private static readonly DateTime Anchor = new DateTime(2026, 1, 1, 9, 0, 0, DateTimeKind.Utc);

        public static async Task SeedAsync(CustomerDbContext db, string tenantId)
        {
            foreach (var seed in BuildCustomers())
            {
                if (await db.Customers.AnyAsync(c => c.Mobile == seed.Mobile))
                    continue;

                db.Customers.Add(seed);
                await db.SaveChangesAsync();
            }
        }

        private static List<Customer> BuildCustomers() => new List<Customer>
        {
            // 1. Individual — Verified
            new Customer
            {
                Salutation          = "Mr.",
                FirstName           = "Ramesh",
                LastName            = "Kumar",
                Mobile              = "9876543210",
                Email               = "ramesh.kumar@example.com",
                DateOfBirth         = new DateTime(1985, 6, 15, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Male",
                PAN                 = "ABCDE1234F",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.Verified,
                KycVerifiedAt       = Anchor.AddDays(5),
                KycVerifiedBy       = "Branch Manager",
                PostalAddress       = "12, MG Road, Bengaluru, Karnataka 560001",
                ApprovalStatus      = "Approved",
                CreatedBy           = "branch-officer@bank.com",
                CreatedAt           = Anchor,
            },
            // 2. Individual — InProgress
            new Customer
            {
                Salutation          = "Ms.",
                FirstName           = "Priya",
                LastName            = "Sharma",
                Mobile              = "9123456780",
                Email               = "priya.sharma@example.com",
                DateOfBirth         = new DateTime(1992, 3, 22, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Female",
                PAN                 = "PQRST5678H",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.InProgress,
                PostalAddress       = "45, Park Street, Mumbai, Maharashtra 400001",
                ApprovalStatus      = "Pending",
                CreatedBy           = "branch-officer@bank.com",
                CreatedAt           = Anchor.AddDays(2),
            },
            // 3. Individual — DocumentsSubmitted
            new Customer
            {
                Salutation          = "Mrs.",
                FirstName           = "Anjali",
                LastName            = "Mehta",
                Mobile              = "9000111222",
                Email               = "anjali.mehta@example.com",
                DateOfBirth         = new DateTime(1988, 9, 10, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Female",
                PAN                 = "GHIJK9012L",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.DocumentsSubmitted,
                PostalAddress       = "78, Linking Road, Mumbai, Maharashtra 400054",
                ApprovalStatus      = "Pending",
                CreatedBy           = "online-portal",
                CreatedAt           = Anchor.AddDays(4),
            },
            // 4. Individual — Rejected
            new Customer
            {
                Salutation          = "Mr.",
                FirstName           = "Vikram",
                LastName            = "Nair",
                Mobile              = "9000333444",
                Email               = "vikram.nair@example.com",
                DateOfBirth         = new DateTime(1975, 12, 5, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Male",
                PAN                 = "MNOPQ3456R",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.Rejected,
                KycRejectionReason  = "Documents unclear — PAN card not legible. Please resubmit.",
                PostalAddress       = "34, Anna Nagar, Chennai, Tamil Nadu 600040",
                ApprovalStatus      = "Pending",
                CreatedBy           = "branch-officer@bank.com",
                CreatedAt           = Anchor.AddDays(6),
            },
            // 5. Individual — NotStarted
            new Customer
            {
                Salutation          = "Mrs.",
                FirstName           = "Sunita",
                LastName            = "Patel",
                Mobile              = "9000555666",
                Email               = "sunita.patel@example.com",
                DateOfBirth         = new DateTime(1995, 7, 20, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Female",
                PAN                 = "STUVW7890X",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.NotStarted,
                PostalAddress       = "15, Navrangpura, Ahmedabad, Gujarat 380009",
                ApprovalStatus      = "Pending",
                CreatedBy           = "online-portal",
                CreatedAt           = Anchor.AddDays(8),
            },
            // 6. NRI — Verified
            new Customer
            {
                Salutation          = "Mr.",
                FirstName           = "Arun",
                LastName            = "Iyer",
                Mobile              = "9000777888",
                Email               = "arun.iyer@example.com",
                DateOfBirth         = new DateTime(1980, 4, 12, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Male",
                PAN                 = "ABCFI2345G",
                CustomerType        = "NRI",
                KycStatus           = KycStatus.Verified,
                KycVerifiedAt       = Anchor.AddDays(3),
                KycVerifiedBy       = "NRI Cell Officer",
                PostalAddress       = "Flat 12, Silicon Valley, San Jose, CA 95110, USA",
                ApprovalStatus      = "Approved",
                CreatedBy           = "nri-cell@bank.com",
                CreatedAt           = Anchor.AddDays(1),
            },
            // 7. Corporate — Verified
            new Customer
            {
                FirstName           = "MegaCorp",
                LastName            = "Ltd",
                Mobile              = "9000999000",
                Email               = "accounts@megacorp.in",
                DateOfBirth         = new DateTime(2005, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                PAN                 = "AABCM1234D",
                CustomerType        = "Corporate",
                KycStatus           = KycStatus.Verified,
                KycVerifiedAt       = Anchor.AddDays(7),
                KycVerifiedBy       = "Branch Manager",
                PostalAddress       = "MegaCorp House, Nariman Point, Mumbai, Maharashtra 400021",
                ApprovalStatus      = "Approved",
                CreatedBy           = "branch-officer@bank.com",
                CreatedAt           = Anchor.AddDays(3),
            },
            // 8. Individual — Expired
            new Customer
            {
                Salutation          = "Mrs.",
                FirstName           = "Kavita",
                LastName            = "Singh",
                Mobile              = "9001111222",
                Email               = "kavita.singh@example.com",
                DateOfBirth         = new DateTime(1978, 11, 30, 0, 0, 0, DateTimeKind.Utc),
                Gender              = "Female",
                PAN                 = "XYZAB5678C",
                CustomerType        = "Individual",
                KycStatus           = KycStatus.Expired,
                KycVerifiedAt       = Anchor.AddDays(-180),   // verified 6 months ago
                KycVerifiedBy       = "Branch Manager",
                PostalAddress       = "22, Civil Lines, Jaipur, Rajasthan 302006",
                ApprovalStatus      = "Approved",
                CreatedBy           = "branch-officer@bank.com",
                CreatedAt           = Anchor.AddDays(-180),
            },
        };
    }
}
