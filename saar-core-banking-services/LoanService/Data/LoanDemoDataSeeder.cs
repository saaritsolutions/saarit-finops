using LoanService.Models;
using Microsoft.EntityFrameworkCore;

namespace LoanService.Data
{
    /// <summary>
    /// Seeds 5 realistic loan applications per tenant spanning all workflow states.
    /// Idempotent — checks by ApplicationNumber before inserting.
    /// Only runs when ASPNETCORE_ENVIRONMENT != IntegrationTesting.
    /// </summary>
    public static class LoanDemoDataSeeder
    {
        // Anchor date for relative timestamps — fixed so data looks consistent every run
        private static readonly DateTime Anchor = new DateTime(2026, 4, 6, 9, 0, 0, DateTimeKind.Utc);

        public static async Task SeedAsync(LoanDbContext db, string tenantId)
        {
            var apps = BuildApplications(tenantId);

            foreach (var (app, docs, actions) in apps)
            {
                if (await db.LoanApplications.AnyAsync(a => a.ApplicationNumber == app.ApplicationNumber))
                    continue;

                db.LoanApplications.Add(app);
                db.LoanDocuments.AddRange(docs);
                db.LoanApprovalActions.AddRange(actions);
            }

            await db.SaveChangesAsync();
        }

        // ── Deterministic GUID: unique per (tenant, appIndex) ──────────────────
        private static Guid G(string tenantId, int appIndex)
        {
            int t = tenantId switch { "ucb_demo" => 1, "nbfc_demo" => 2, _ => 0 };
            return Guid.Parse($"{appIndex:X8}-0000-4000-8000-{t:X12}");
        }

        // ── Document helper ────────────────────────────────────────────────────
        private static LoanDocument Doc(
            Guid loanId, string type, string label, bool mandatory, string status,
            DateTime? uploadedAt = null, string? fileName = null, string? uploadedBy = null)
        {
            bool uploaded = status is "UPLOADED" or "VERIFIED";
            bool verified = status is "VERIFIED";
            return new LoanDocument
            {
                Id                  = Guid.NewGuid(),
                LoanApplicationId   = loanId,
                DocumentType        = type,
                DocumentLabel       = label,
                IsMandatory         = mandatory,
                Status              = status,
                IsUploaded          = uploaded,
                IsVerified          = verified,
                FileName            = fileName,
                ContentType         = fileName?.EndsWith(".pdf") == true ? "application/pdf"
                                    : fileName?.EndsWith(".jpg") == true ? "image/jpeg"
                                    : null,
                UploadedAt          = uploaded ? uploadedAt : null,
                UploadedBy          = uploaded ? uploadedBy : null,
                VerifiedBy          = verified ? (uploadedBy ?? "credit.officer@bank.com") : null,
                VerifiedAt          = verified ? uploadedAt?.AddMinutes(45) : null,
                CreatedAt           = uploadedAt ?? Anchor,
                UpdatedAt           = uploadedAt ?? Anchor,
            };
        }

        // ── Approval action helper ─────────────────────────────────────────────
        private static LoanApprovalAction Act(
            Guid loanId, string action, string description,
            string by, string role, string? from, string to, DateTime at,
            string? comments = null)
        {
            return new LoanApprovalAction
            {
                Id                = Guid.NewGuid(),
                LoanApplicationId = loanId,
                Action            = action,
                ActionDescription = description,
                ActionBy          = by,
                Role              = role,
                FromStatus        = from,
                ToStatus          = to,
                Comments          = comments,
                ActionAt          = at,
            };
        }

        // ── Build all 5 applications ───────────────────────────────────────────
        private static List<(LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)>
            BuildApplications(string tenantId)
        {
            string pfx = tenantId switch
            {
                "ucb_demo"  => "UCB",
                "nbfc_demo" => "NBFC",
                _           => "SB",
            };

            return new List<(LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)>
            {
                App1_PersonalLoan_Submitted(tenantId, pfx),
                App2_HomeLoan_InReview(tenantId, pfx),
                App3_BusinessLoan_CreditApproved(tenantId, pfx),
                App4_GoldLoan_Disbursed(tenantId, pfx),
                App5_VehicleLoan_Rejected(tenantId, pfx),
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // 1. Personal Loan — SUBMITTED (2 days ago, awaiting first review)
        // ════════════════════════════════════════════════════════════════════════
        private static (LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)
            App1_PersonalLoan_Submitted(string tenantId, string pfx)
        {
            var id  = G(tenantId, 1);
            var t0  = Anchor.AddDays(-2).AddHours(-1);   // applied
            var t1  = Anchor.AddDays(-2);                 // submitted

            var app = new LoanApplication
            {
                Id                    = id,
                ApplicationNumber     = $"{pfx}-PL-2026-001",
                ProductType           = "PERSONAL_LOAN",
                RequestedAmount       = 500_000,
                TenureMonths          = 36,
                InterestRate          = 12.50m,
                Status                = "SUBMITTED",
                PurposeOfLoan         = "Medical expenses and home renovation",

                ApplicantName         = "Priya Sharma",
                DateOfBirth           = new DateTime(1990, 6, 15, 0, 0, 0, DateTimeKind.Utc),
                Gender                = "F",
                MaritalStatus         = "MARRIED",
                PanNumber             = "BCLPS4821K",
                AadhaarLast4          = "7823",
                MobileNumber          = "9845672310",
                Email                 = "priya.sharma@gmail.com",

                CurrentAddressLine1   = "Flat 4B, Green Valley Apartments",
                CurrentAddressLine2   = "Koramangala 5th Block",
                CurrentCity           = "Bengaluru",
                CurrentState          = "Karnataka",
                CurrentPinCode        = "560095",
                ResidenceType         = "RENTED",
                SameAsCurrent         = true,

                EmploymentType        = "SALARIED",
                EmployerName          = "Infosys Limited",
                Designation           = "Senior Software Engineer",
                YearsAtCurrentJob     = 5,
                TotalWorkExperienceYears = 8,

                GrossMonthlyIncome    = 75_000,
                NetMonthlyIncome      = 62_000,
                OtherMonthlyIncome    = 5_000,
                ExistingMonthlyEMI    = 8_000,
                MonthlyObligations    = 8_000,

                CibilScore            = 745,
                CibilBand             = "GOOD",
                FOIRPercent           = 0.38m,
                RiskGrade             = "A",

                CreatedBy             = "online-portal",
                CreatedAt             = t0,
                UpdatedAt             = t1,
            };

            var docs = new List<LoanDocument>
            {
                Doc(id, "PAN_CARD",         "PAN Card",                  true,  "VERIFIED", t0.AddMinutes(-30), "priya-pan.pdf",      "priya.sharma@gmail.com"),
                Doc(id, "AADHAAR",          "Aadhaar Card",              true,  "VERIFIED", t0.AddMinutes(-28), "priya-aadhaar.pdf",  "priya.sharma@gmail.com"),
                Doc(id, "SALARY_SLIP_3M",   "Last 3 Months Salary Slip", true,  "UPLOADED", t0.AddMinutes(-20), "priya-salslip.pdf",  "priya.sharma@gmail.com"),
                Doc(id, "BANK_STATEMENT_6M","6 Months Bank Statement",   true,  "PENDING"),
                Doc(id, "FORM_16",          "Form 16",                   false, "PENDING"),
                Doc(id, "PHOTO",            "Passport Photo",            true,  "UPLOADED", t0.AddMinutes(-25), "priya-photo.jpg",    "priya.sharma@gmail.com"),
            };

            var actions = new List<LoanApprovalAction>
            {
                Act(id, "CREATED",   "Application created via online portal",           "priya.sharma@gmail.com", "APPLICANT", null,      "DRAFT",     t0),
                Act(id, "SUBMITTED", "Application submitted — documents being reviewed", "priya.sharma@gmail.com", "APPLICANT", "DRAFT",   "SUBMITTED", t1,
                    "PAN and Aadhaar verified. Awaiting bank statement upload."),
            };

            return (app, docs, actions);
        }

        // ════════════════════════════════════════════════════════════════════════
        // 2. Home Loan — IN_REVIEW (10 days ago, credit officer assigned)
        // ════════════════════════════════════════════════════════════════════════
        private static (LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)
            App2_HomeLoan_InReview(string tenantId, string pfx)
        {
            var id       = G(tenantId, 2);
            var t0       = Anchor.AddDays(-11);   // created at branch
            var t1       = Anchor.AddDays(-10);   // submitted
            var t2       = Anchor.AddDays(-7);    // sent to review

            var app = new LoanApplication
            {
                Id                    = id,
                ApplicationNumber     = $"{pfx}-HL-2026-002",
                ProductType           = "HOME_LOAN",
                RequestedAmount       = 45_00_000,
                TenureMonths          = 240,
                InterestRate          = 9.25m,
                Status                = "IN_REVIEW",
                PurposeOfLoan         = "Purchase of 2BHK residential flat in Whitefield, Bengaluru",

                ApplicantName         = "Rajesh Kumar",
                DateOfBirth           = new DateTime(1982, 3, 22, 0, 0, 0, DateTimeKind.Utc),
                Gender                = "M",
                MaritalStatus         = "MARRIED",
                PanNumber             = "ARQPK3218M",
                AadhaarLast4          = "4561",
                MobileNumber          = "9741236548",
                Email                 = "rajesh.kumar@tcs.com",

                CurrentAddressLine1   = "12, Whitefield Main Road",
                CurrentAddressLine2   = "Brookefield",
                CurrentCity           = "Bengaluru",
                CurrentState          = "Karnataka",
                CurrentPinCode        = "560066",
                ResidenceType         = "RENTED",
                SameAsCurrent         = true,

                EmploymentType        = "SALARIED",
                EmployerName          = "Tata Consultancy Services",
                Designation           = "Technical Lead",
                YearsAtCurrentJob     = 7,
                TotalWorkExperienceYears = 15,

                GrossMonthlyIncome    = 1_40_000,
                NetMonthlyIncome      = 1_15_000,
                OtherMonthlyIncome    = 0,
                ExistingMonthlyEMI    = 15_000,
                MonthlyObligations    = 15_000,

                CibilScore            = 782,
                CibilBand             = "EXCELLENT",
                FOIRPercent           = 0.42m,
                LTVPercent            = 0.75m,
                RiskGrade             = "A+",

                CollateralType        = "PROPERTY",
                CollateralValue       = 60_00_000,
                CollateralDescription = "2BHK flat in Prestige Whitefield — registration in progress",

                AssignedTo            = "credit.officer@bank.com",
                CreditOfficer         = "Suresh Nair",
                CreatedBy             = "branch-manager@bank.com",
                CreatedAt             = t0,
                UpdatedAt             = t2,
            };

            var docs = new List<LoanDocument>
            {
                Doc(id, "PAN_CARD",         "PAN Card",                  true, "VERIFIED", t0, "rajesh-pan.pdf",      "branch-manager@bank.com"),
                Doc(id, "AADHAAR",          "Aadhaar Card",              true, "VERIFIED", t0, "rajesh-aadhaar.pdf",  "branch-manager@bank.com"),
                Doc(id, "SALARY_SLIP_3M",   "Last 3 Months Salary Slip", true, "VERIFIED", t0, "rajesh-salslip.pdf",  "branch-manager@bank.com"),
                Doc(id, "BANK_STATEMENT_6M","6 Months Bank Statement",   true, "VERIFIED", t0, "rajesh-bankstmt.pdf", "branch-manager@bank.com"),
                Doc(id, "PROPERTY_DOCS",    "Property Documents",        true, "UPLOADED", t2, "rajesh-property.pdf", "rajesh.kumar@tcs.com"),
                Doc(id, "ITR_2Y",           "Income Tax Returns (2 yrs)",true, "PENDING"),
                Doc(id, "FORM_16",          "Form 16",                   false,"UPLOADED", t0, "rajesh-form16.pdf",   "branch-manager@bank.com"),
            };

            var actions = new List<LoanApprovalAction>
            {
                Act(id, "CREATED",       "Application received at branch — Whitefield Branch",        "branch-manager@bank.com",    "MAKER",         null,        "DRAFT",     t0),
                Act(id, "SUBMITTED",     "Documents verified at branch, application submitted",        "branch-manager@bank.com",    "MAKER",         "DRAFT",     "SUBMITTED", t1,
                    "KYC documents in order. Salary slip and bank statement verified. Forwarding for credit review."),
                Act(id, "SEND_TO_REVIEW","Assigned to Credit Team — Home Loan desk",                  "credit.officer@bank.com",    "CHECKER",       "SUBMITTED", "IN_REVIEW", t2,
                    "Assigned to Suresh Nair, Credit Officer. CIBIL 782 — excellent profile. ITR (2 years) pending from applicant. Property valuation scheduled for next week."),
            };

            return (app, docs, actions);
        }

        // ════════════════════════════════════════════════════════════════════════
        // 3. Business Loan — CREDIT_APPROVED (20 days ago, awaiting MD sanction)
        // ════════════════════════════════════════════════════════════════════════
        private static (LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)
            App3_BusinessLoan_CreditApproved(string tenantId, string pfx)
        {
            var id       = G(tenantId, 3);
            var t0       = Anchor.AddDays(-22);   // created
            var t1       = Anchor.AddDays(-20);   // submitted
            var t2       = Anchor.AddDays(-17);   // in review
            var t3       = Anchor.AddDays(-5);    // credit approved

            var app = new LoanApplication
            {
                Id                    = id,
                ApplicationNumber     = $"{pfx}-BL-2026-003",
                ProductType           = "BUSINESS_LOAN",
                RequestedAmount       = 10_00_000,
                TenureMonths          = 60,
                InterestRate          = 15.50m,
                Status                = "CREDIT_APPROVED",
                SanctionedAmount      = 10_00_000,
                PurposeOfLoan         = "Working capital — raw material purchase for textile export season",

                ApplicantName         = "Anjali Mehta",
                DateOfBirth           = new DateTime(1978, 11, 5, 0, 0, 0, DateTimeKind.Utc),
                Gender                = "F",
                MaritalStatus         = "MARRIED",
                PanNumber             = "CLNPM6743G",
                AadhaarLast4          = "2190",
                MobileNumber          = "9632587410",
                Email                 = "anjali.mehta@textilexport.co",

                CurrentAddressLine1   = "Shop No. 8, Textile Market Complex",
                CurrentAddressLine2   = "Ring Road",
                CurrentCity           = "Surat",
                CurrentState          = "Gujarat",
                CurrentPinCode        = "395003",
                ResidenceType         = "OWNED",
                SameAsCurrent         = false,
                PermanentAddressLine1 = "14, Shivam Society, Near Railway Station",
                PermanentCity         = "Surat",
                PermanentState        = "Gujarat",
                PermanentPinCode      = "395001",

                EmploymentType        = "BUSINESS_OWNER",
                EmployerName          = "Anjali Textiles Pvt Ltd",
                Designation           = "Managing Director",
                YearsAtCurrentJob     = 12,
                TotalWorkExperienceYears = 15,

                GrossMonthlyIncome    = 1_20_000,
                NetMonthlyIncome      = 95_000,
                OtherMonthlyIncome    = 15_000,
                ExistingMonthlyEMI    = 18_000,
                MonthlyObligations    = 18_000,

                CibilScore            = 761,
                CibilBand             = "EXCELLENT",
                FOIRPercent           = 0.44m,
                RiskGrade             = "A",

                AssignedTo            = "credit.officer@bank.com",
                CreditOfficer         = "Vikash Gupta",
                CreatedBy             = "branch-manager@bank.com",
                CreatedAt             = t0,
                UpdatedAt             = t3,
            };

            var docs = new List<LoanDocument>
            {
                Doc(id, "PAN_CARD",        "PAN Card",                  true, "VERIFIED", t0, "anjali-pan.pdf",      "branch-manager@bank.com"),
                Doc(id, "AADHAAR",         "Aadhaar Card",              true, "VERIFIED", t0, "anjali-aadhaar.pdf",  "branch-manager@bank.com"),
                Doc(id, "BANK_STATEMENT_6M","6 Months Bank Statement",  true, "VERIFIED", t0, "anjali-bankstmt.pdf", "branch-manager@bank.com"),
                Doc(id, "ITR_2Y",          "Income Tax Returns (2 yrs)",true, "VERIFIED", t0, "anjali-itr.pdf",      "branch-manager@bank.com"),
                Doc(id, "GST_CERTIFICATE", "GST Registration Certificate",true,"VERIFIED",t0, "anjali-gst.pdf",      "branch-manager@bank.com"),
                Doc(id, "BUSINESS_PROOF",  "Business Registration Certificate",true,"VERIFIED",t0,"anjali-bizreg.pdf","branch-manager@bank.com"),
                Doc(id, "PHOTO",           "Passport Photo",            true, "VERIFIED", t0, "anjali-photo.jpg",    "branch-manager@bank.com"),
                Doc(id, "SIGNATURE",       "Specimen Signature",        true, "PENDING"),
            };

            var actions = new List<LoanApprovalAction>
            {
                Act(id, "CREATED",        "Application received — Surat Main Branch",                "branch-manager@bank.com",    "MAKER",         null,         "DRAFT",          t0),
                Act(id, "SUBMITTED",      "All mandatory documents collected and verified at branch", "branch-manager@bank.com",    "MAKER",         "DRAFT",      "SUBMITTED",      t1,
                    "GST and ITR verified. Business is 12 years old with strong export track record."),
                Act(id, "SEND_TO_REVIEW", "Forwarded to Credit team for assessment",                 "credit.officer@bank.com",    "CHECKER",       "SUBMITTED",  "IN_REVIEW",      t2),
                Act(id, "CREDIT_APPROVE", "Credit assessment complete — RECOMMENDED FOR SANCTION",   "vikash.gupta@bank.com",      "CREDIT_OFFICER","IN_REVIEW",  "CREDIT_APPROVED",t3,
                    "CIBIL 761, FOIR 44% within permitted limits. GST returns show consistent turnover ₹2.4Cr p.a. ITR verified for FY24 and FY25. " +
                    "Business profile strong — 12 years operational, 3 export licences. " +
                    "Recommend full sanction of ₹10,00,000 at 15.50% p.a. Repayment capacity confirmed. " +
                    "Awaiting MD signature for final sanction letter."),
            };

            return (app, docs, actions);
        }

        // ════════════════════════════════════════════════════════════════════════
        // 4. Gold Loan — DISBURSED (30 days ago, fully completed)
        // ════════════════════════════════════════════════════════════════════════
        private static (LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)
            App4_GoldLoan_Disbursed(string tenantId, string pfx)
        {
            var id       = G(tenantId, 4);
            var t0       = Anchor.AddDays(-30);              // walk-in
            var t1       = t0.AddHours(1);                   // submitted (after gold weighed)
            var t2       = t0.AddHours(2);                   // in review
            var t3       = t0.AddHours(3);                   // credit approved
            var t4       = t0.AddHours(4);                   // sanctioned
            var t5       = Anchor.AddDays(-25);              // disbursed

            var app = new LoanApplication
            {
                Id                    = id,
                ApplicationNumber     = $"{pfx}-GL-2026-004",
                ProductType           = "GOLD_LOAN",
                RequestedAmount       = 2_00_000,
                TenureMonths          = 12,
                InterestRate          = 8.50m,
                Status                = "DISBURSED",
                SanctionedAmount      = 2_00_000,
                SanctionRemarks       = "Gold purity verified — 22K hallmarked, 95g gross / 90g net. LTV 75% of ₹2,66,667 = ₹2,00,000 sanctioned.",
                PurposeOfLoan         = "Business working capital — seasonal inventory procurement",

                ApplicantName         = "Vikram Nair",
                DateOfBirth           = new DateTime(1970, 8, 18, 0, 0, 0, DateTimeKind.Utc),
                Gender                = "M",
                MaritalStatus         = "MARRIED",
                PanNumber             = "ADNPN8821V",
                AadhaarLast4          = "9034",
                MobileNumber          = "9876543210",
                Email                 = "vikram.nair@gmail.com",

                CurrentAddressLine1   = "23, MG Road, Near Vadakkumnathan Temple",
                CurrentCity           = "Thrissur",
                CurrentState          = "Kerala",
                CurrentPinCode        = "680001",
                ResidenceType         = "OWNED",
                SameAsCurrent         = true,

                EmploymentType        = "SELF_EMPLOYED",
                EmployerName          = "Vikram Nair & Co — General Merchants",
                Designation           = "Proprietor",
                YearsAtCurrentJob     = 20,

                GrossMonthlyIncome    = 80_000,
                NetMonthlyIncome      = 70_000,
                OtherMonthlyIncome    = 0,
                ExistingMonthlyEMI    = 0,
                MonthlyObligations    = 0,

                CibilScore            = 720,
                CibilBand             = "GOOD",
                FOIRPercent           = 0.23m,
                LTVPercent            = 0.75m,
                RiskGrade             = "A",

                CollateralType        = "GOLD",
                CollateralValue       = 2_66_667,
                CollateralDescription = "22K hallmarked gold ornaments — 95g gross weight, 90g net. Stored in bank safe custody.",

                DisbursementAccountNumber = "2045678912",
                DisbursementIFSC          = "SBIN0003214",
                DisbursedAt               = t5,

                AssignedTo            = "gold.appraiser@bank.com",
                CreditOfficer         = "Meera Pillai",
                CreatedBy             = "branch-teller@bank.com",
                CreatedAt             = t0,
                UpdatedAt             = t5,
            };

            var docs = new List<LoanDocument>
            {
                Doc(id, "PAN_CARD",     "PAN Card",                 true, "VERIFIED", t0, "vikram-pan.pdf",         "branch-teller@bank.com"),
                Doc(id, "AADHAAR",      "Aadhaar Card",             true, "VERIFIED", t0, "vikram-aadhaar.pdf",     "branch-teller@bank.com"),
                Doc(id, "GOLD_RECEIPT", "Gold Appraisal Certificate",true,"VERIFIED", t2, "vikram-gold-cert.pdf",   "gold.appraiser@bank.com"),
                Doc(id, "PHOTO",        "Passport Photo",           true, "VERIFIED", t0, "vikram-photo.jpg",       "branch-teller@bank.com"),
                Doc(id, "SIGNATURE",    "Specimen Signature",       true, "VERIFIED", t0, "vikram-signature.jpg",   "branch-teller@bank.com"),
            };

            var actions = new List<LoanApprovalAction>
            {
                Act(id, "CREATED",             "Walk-in customer — gold ornaments submitted for appraisal",       "branch-teller@bank.com",     "MAKER",         null,             "DRAFT",          t0),
                Act(id, "SUBMITTED",           "Gold weighed & appraised — 22K, 95g gross. Application submitted","branch-teller@bank.com",     "MAKER",         "DRAFT",          "SUBMITTED",      t1,
                    "Appraisal by certified gold assayer. Market rate: ₹5,900/g for 22K."),
                Act(id, "SEND_TO_REVIEW",      "Assigned to Gold Loan Officer for verification",                  "meera.pillai@bank.com",      "CHECKER",       "SUBMITTED",      "IN_REVIEW",      t2),
                Act(id, "CREDIT_APPROVE",      "Gold purity and weight verified — LTV approved",                  "meera.pillai@bank.com",      "CREDIT_OFFICER","IN_REVIEW",      "CREDIT_APPROVED",t3,
                    "BIS hallmark verified. 22K purity confirmed. Net weight 90g × ₹5,900 × 0.75 LTV = ₹2,00,250. Rounding to ₹2,00,000."),
                Act(id, "SANCTION",            "Loan sanctioned. Agreement signed by customer.",                  "meera.pillai@bank.com",      "CREDIT_OFFICER","CREDIT_APPROVED","APPROVED",       t4,
                    "Demand promissory note (DPN) executed. Loan agreement stamped and signed. Gold stored in vault — receipt issued."),
                Act(id, "DISBURSE",            "₹2,00,000 credited to SBI account 2045678912 (SBIN0003214)",     "disbursement@bank.com",      "SYSTEM",        "APPROVED",       "DISBURSED",      t5,
                    "NEFT transfer successful. UTR: SBIN026123456789. Loan account LAC-GL-2026-0041 created."),
            };

            return (app, docs, actions);
        }

        // ════════════════════════════════════════════════════════════════════════
        // 5. Vehicle Loan — REJECTED (15 days ago — low CIBIL + high FOIR)
        // ════════════════════════════════════════════════════════════════════════
        private static (LoanApplication, List<LoanDocument>, List<LoanApprovalAction>)
            App5_VehicleLoan_Rejected(string tenantId, string pfx)
        {
            var id       = G(tenantId, 5);
            var t0       = Anchor.AddDays(-15);   // online application
            var t1       = t0.AddMinutes(10);     // submitted
            var t2       = Anchor.AddDays(-13);   // in review
            var t3       = Anchor.AddDays(-12);   // rejected

            var app = new LoanApplication
            {
                Id                    = id,
                ApplicationNumber     = $"{pfx}-VL-2026-005",
                ProductType           = "VEHICLE_LOAN",
                RequestedAmount       = 8_00_000,
                TenureMonths          = 60,
                InterestRate          = 11.00m,
                Status                = "REJECTED",
                RejectionReason       = "CIBIL score 618 is below the minimum threshold of 650. FOIR 56% exceeds maximum permissible limit of 50%. " +
                                        "Application may be reconsidered after 6 months of consistent credit improvement. " +
                                        "Suggestion: close one active loan to reduce FOIR before reapplying.",
                PurposeOfLoan         = "Purchase of Maruti Suzuki Brezza ZXi+ 2026",

                ApplicantName         = "Sunita Patel",
                DateOfBirth           = new DateTime(1995, 2, 14, 0, 0, 0, DateTimeKind.Utc),
                Gender                = "F",
                MaritalStatus         = "SINGLE",
                PanNumber             = "FKTPS9123B",
                AadhaarLast4          = "6712",
                MobileNumber          = "9512348765",
                Email                 = "sunita.patel@yahoo.com",

                CurrentAddressLine1   = "B-42, Laxmi Nagar",
                CurrentAddressLine2   = "Near Sitaburdi Square",
                CurrentCity           = "Nagpur",
                CurrentState          = "Maharashtra",
                CurrentPinCode        = "440022",
                ResidenceType         = "RENTED",
                SameAsCurrent         = true,

                EmploymentType        = "SALARIED",
                EmployerName          = "Reliance Retail Ltd",
                Designation           = "Store Manager",
                YearsAtCurrentJob     = 2,
                TotalWorkExperienceYears = 4,

                GrossMonthlyIncome    = 35_000,
                NetMonthlyIncome      = 29_000,
                OtherMonthlyIncome    = 0,
                ExistingMonthlyEMI    = 12_000,
                MonthlyObligations    = 12_000,

                CibilScore            = 618,
                CibilBand             = "FAIR",
                FOIRPercent           = 0.56m,
                LTVPercent            = 0.80m,
                RiskGrade             = "C",

                CollateralType        = "VEHICLE",
                CollateralValue       = 10_00_000,
                CollateralDescription = "Maruti Suzuki Brezza ZXi+ 2026 — Invoice value ₹10,00,000",

                CreatedBy             = "online-portal",
                AssignedTo            = "credit.officer@bank.com",
                CreditOfficer         = "Amit Sharma",
                CreatedAt             = t0,
                UpdatedAt             = t3,
            };

            var docs = new List<LoanDocument>
            {
                Doc(id, "PAN_CARD",         "PAN Card",                  true, "UPLOADED", t0, "sunita-pan.pdf",      "sunita.patel@yahoo.com"),
                Doc(id, "AADHAAR",          "Aadhaar Card",              true, "UPLOADED", t0, "sunita-aadhaar.pdf",  "sunita.patel@yahoo.com"),
                Doc(id, "SALARY_SLIP_3M",   "Last 3 Months Salary Slip", true, "UPLOADED", t0, "sunita-salslip.pdf",  "sunita.patel@yahoo.com"),
                Doc(id, "BANK_STATEMENT_6M","6 Months Bank Statement",   true, "UPLOADED", t0, "sunita-bankstmt.pdf", "sunita.patel@yahoo.com"),
                Doc(id, "VEHICLE_RC",       "Vehicle Invoice / Proforma", true, "PENDING"),
                Doc(id, "PHOTO",            "Passport Photo",             true, "PENDING"),
            };

            var actions = new List<LoanApprovalAction>
            {
                Act(id, "CREATED",       "Online application submitted via customer portal",            "sunita.patel@yahoo.com",     "APPLICANT",     null,        "DRAFT",     t0),
                Act(id, "SUBMITTED",     "Application submitted for bank review",                       "sunita.patel@yahoo.com",     "APPLICANT",     "DRAFT",     "SUBMITTED", t1),
                Act(id, "SEND_TO_REVIEW","Application assigned to Credit Team — Vehicle Loan desk",     "credit.officer@bank.com",    "CHECKER",       "SUBMITTED", "IN_REVIEW", t2,
                    "Assigned to Amit Sharma. Preliminary check: CIBIL 618 flagged. Full assessment in progress."),
                Act(id, "REJECT",        "Credit assessment failed — eligibility criteria not met",     "amit.sharma@bank.com",       "CREDIT_OFFICER","IN_REVIEW", "REJECTED",  t3,
                    "Primary: CIBIL score 618 (min required 650). Secondary: FOIR 56% exceeds limit of 50% — existing EMI obligations are high. " +
                    "Rejection letter issued. Customer advised to reduce existing liabilities and improve credit score before reapplication in 6 months."),
            };

            return (app, docs, actions);
        }
    }
}
