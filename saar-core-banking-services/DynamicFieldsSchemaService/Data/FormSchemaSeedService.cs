using DynamicFieldsSchemaService.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace DynamicFieldsSchemaService.Data
{
    /// <summary>
    /// Seeds 5 default form schemas (TenantId="public", IsDefault=true) on startup
    /// into EVERY provisioned tenant schema so authenticated UCB/NBFC users can read defaults.
    /// Idempotent — skips seeding if any record with (FormType, TenantId="public") already exists
    /// in that tenant's schema.
    /// </summary>
    public class FormSchemaSeedService : IHostedService
    {
        private static readonly string[] KnownTenants = { "public", "ucb_demo", "nbfc_demo" };

        private readonly IServiceProvider _services;
        private readonly ILogger<FormSchemaSeedService> _logger;

        public FormSchemaSeedService(IServiceProvider services, ILogger<FormSchemaSeedService> logger)
        {
            _services = services;
            _logger   = logger;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            foreach (var tenantId in KnownTenants)
                await SeedSchemaAsync(tenantId, cancellationToken);
        }

        private async Task SeedSchemaAsync(string tenantId, CancellationToken cancellationToken)
        {
            using var scope = _services.CreateScope();
            var baseOptions = scope.ServiceProvider.GetRequiredService<DbContextOptions<DynamicFormsDbContext>>();

            // Build a tenant-specific connection string (same pattern as TenantSchemaProvisioner)
            string tenantConnStr;
            using (var tmp = new DynamicFormsDbContext(baseOptions, new StaticTenantService(tenantId)))
                tenantConnStr = new NpgsqlConnectionStringBuilder(
                    tmp.Database.GetConnectionString()!) { SearchPath = tenantId }.ToString();

            var opts = new DbContextOptionsBuilder<DynamicFormsDbContext>()
                .UseNpgsql(tenantConnStr)
                .Options;
            using var db = new DynamicFormsDbContext(opts, new StaticTenantService(tenantId));

            var seeded = false;
            foreach (var seed in BuildSeeds())
            {
                var exists = db.FormSchemas.Any(s =>
                    s.FormType == seed.FormType && s.TenantId == "public");
                if (exists) continue;

                db.FormSchemas.Add(seed);
                seeded = true;
                _logger.LogInformation("[DFS Seed] Inserted '{FormType}' into schema '{Schema}'",
                    seed.FormType, tenantId);
            }

            if (seeded) await db.SaveChangesAsync(cancellationToken);
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        // ── Seed definitions ──────────────────────────────────────────────────

        private static FormSchema MakeDefault(string formType, string schemaJson) => new()
        {
            Id        = Guid.NewGuid(),
            FormType  = formType,
            TenantId  = "public",
            Version   = 1,
            SchemaJson = schemaJson,
            IsActive  = true,
            IsDefault = true,
            CreatedBy = "system",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Notes     = "Default seed schema"
        };

        private static IEnumerable<FormSchema> BuildSeeds()
        {
            yield return MakeDefault("PERSONAL_LOAN", """
{
  "title": "Personal Loan Application",
  "sections": [
    { "key": "applicant",   "title": "Applicant Details",     "fields": ["fullName","dateOfBirth","mobileNumber","panNumber"] },
    { "key": "employment",  "title": "Employment & Income",   "fields": ["employmentType","employerName","monthlyIncome","workExperienceYears"] },
    { "key": "loan",        "title": "Loan Details",          "fields": ["loanAmount","tenureMonths","purposeOfLoan","existingLoanEMI"] }
  ],
  "fields": [
    { "name":"fullName",          "label":"Full Name",                    "type":"text",   "required":true,  "maxLength":100,  "section":"applicant" },
    { "name":"dateOfBirth",       "label":"Date of Birth",                "type":"date",   "required":true,                   "section":"applicant" },
    { "name":"mobileNumber",      "label":"Mobile Number",                "type":"text",   "required":true,  "validationRegex":"^[6-9]\\d{9}$", "section":"applicant" },
    { "name":"panNumber",         "label":"PAN Number",                   "type":"text",   "required":true,  "validationRegex":"^[A-Z]{5}[0-9]{4}[A-Z]$", "section":"applicant" },
    { "name":"employmentType",    "label":"Employment Type",              "type":"select", "required":true,  "options":[{"value":"SALARIED","label":"Salaried"},{"value":"SELF_EMPLOYED","label":"Self Employed"},{"value":"BUSINESS","label":"Business Owner"}], "section":"employment" },
    { "name":"employerName",      "label":"Employer / Business Name",    "type":"text",   "required":true,  "maxLength":100,  "section":"employment" },
    { "name":"monthlyIncome",     "label":"Monthly Income (₹)",          "type":"number", "required":true,  "min":10000,      "section":"employment" },
    { "name":"workExperienceYears","label":"Work Experience (years)",     "type":"number", "required":true,  "min":0, "max":50, "section":"employment" },
    { "name":"loanAmount",        "label":"Loan Amount (₹)",             "type":"number", "required":true,  "min":50000, "max":5000000, "section":"loan" },
    { "name":"tenureMonths",      "label":"Tenure (months)",             "type":"number", "required":true,  "min":12, "max":60, "section":"loan" },
    { "name":"purposeOfLoan",     "label":"Purpose of Loan",             "type":"select", "required":true,  "options":[{"value":"HOME_RENOVATION","label":"Home Renovation"},{"value":"EDUCATION","label":"Education"},{"value":"MEDICAL","label":"Medical"},{"value":"WEDDING","label":"Wedding"},{"value":"OTHER","label":"Other"}], "section":"loan" },
    { "name":"existingLoanEMI",   "label":"Existing Loan EMI (₹/month)","type":"number", "required":false, "min":0, "description":"Total monthly EMI of all existing loans", "section":"loan" }
  ]
}
""");

            yield return MakeDefault("GOLD_LOAN", """
{
  "title": "Gold Loan Application",
  "sections": [
    { "key": "applicant", "title": "Applicant Details", "fields": ["fullName","mobileNumber","panNumber"] },
    { "key": "loan",      "title": "Loan Details",      "fields": ["loanScheme","loanAmount","tenureMonths","purposeOfLoan"] },
    { "key": "pledge",    "title": "Pledge Details",    "fields": ["goldPurity","estimatedWeight","numberOfItems"] }
  ],
  "fields": [
    { "name":"fullName",        "label":"Full Name",            "type":"text",   "required":true,  "maxLength":100, "section":"applicant" },
    { "name":"mobileNumber",    "label":"Mobile Number",        "type":"text",   "required":true,  "validationRegex":"^[6-9]\\d{9}$", "section":"applicant" },
    { "name":"panNumber",       "label":"PAN Number",           "type":"text",   "required":true,  "validationRegex":"^[A-Z]{5}[0-9]{4}[A-Z]$", "section":"applicant" },
    { "name":"loanScheme",      "label":"Loan Scheme",          "type":"select", "required":true,  "options":[{"value":"BULLET","label":"Bullet (lump sum at maturity)"},{"value":"EMI","label":"EMI (monthly instalment)"},{"value":"INTEREST_ONLY","label":"Interest Only"},{"value":"OVERDRAFT","label":"Overdraft"}], "section":"loan" },
    { "name":"loanAmount",      "label":"Loan Amount (₹)",      "type":"number", "required":true,  "min":5000, "max":5000000, "section":"loan" },
    { "name":"tenureMonths",    "label":"Tenure (months)",      "type":"number", "required":true,  "min":1, "max":12, "section":"loan" },
    { "name":"purposeOfLoan",   "label":"Purpose of Loan",      "type":"select", "required":false, "options":[{"value":"AGRICULTURE","label":"Agriculture"},{"value":"BUSINESS","label":"Business"},{"value":"PERSONAL","label":"Personal"},{"value":"EDUCATION","label":"Education"},{"value":"MEDICAL","label":"Medical"}], "section":"loan" },
    { "name":"goldPurity",      "label":"Gold Purity",          "type":"select", "required":true,  "options":[{"value":"24K","label":"24 Karat"},{"value":"22K","label":"22 Karat"},{"value":"18K","label":"18 Karat"},{"value":"14K","label":"14 Karat"}], "section":"pledge" },
    { "name":"estimatedWeight", "label":"Estimated Weight (grams)", "type":"number","required":true, "min":1, "description":"Total estimated weight of gold ornaments/coins", "section":"pledge" },
    { "name":"numberOfItems",   "label":"Number of Items",      "type":"number", "required":true,  "min":1, "max":50, "description":"Total number of gold ornaments or coins to be pledged", "section":"pledge" }
  ]
}
""");

            yield return MakeDefault("ACCOUNT_OPENING_SB", """
{
  "title": "Savings Bank Account Opening",
  "sections": [
    { "key": "customer", "title": "Customer Details",  "fields": ["fullName","dateOfBirth","mobileNumber","aadhaarNumber"] },
    { "key": "account",  "title": "Account Details",   "fields": ["accountCategory","modeOfOperation","nomineeRelationship"] },
    { "key": "kyc",      "title": "KYC & Income",      "fields": ["panNumber","kycType","annualIncome"] }
  ],
  "fields": [
    { "name":"fullName",           "label":"Full Name",             "type":"text",   "required":true,  "maxLength":100, "section":"customer" },
    { "name":"dateOfBirth",        "label":"Date of Birth",         "type":"date",   "required":true,                  "section":"customer" },
    { "name":"mobileNumber",       "label":"Mobile Number",         "type":"text",   "required":true,  "validationRegex":"^[6-9]\\d{9}$", "section":"customer" },
    { "name":"aadhaarNumber",      "label":"Aadhaar Number",        "type":"text",   "required":false, "validationRegex":"^\\d{12}$", "description":"12-digit Aadhaar number", "section":"customer" },
    { "name":"accountCategory",    "label":"Account Category",      "type":"select", "required":true,  "options":[{"value":"REGULAR","label":"Regular"},{"value":"BSBD","label":"Basic Savings (BSBD)"},{"value":"SENIOR_CITIZEN","label":"Senior Citizen"},{"value":"MINOR","label":"Minor"},{"value":"NRI","label":"NRI"}], "section":"account" },
    { "name":"modeOfOperation",    "label":"Mode of Operation",     "type":"select", "required":true,  "options":[{"value":"SINGLE","label":"Single"},{"value":"JOINTLY","label":"Jointly"},{"value":"EITHER_OR_SURVIVOR","label":"Either or Survivor"},{"value":"ANYONE_OR_SURVIVOR","label":"Anyone or Survivor"}], "section":"account" },
    { "name":"nomineeRelationship","label":"Nominee Relationship",  "type":"select", "required":false, "options":[{"value":"SPOUSE","label":"Spouse"},{"value":"CHILD","label":"Child"},{"value":"PARENT","label":"Parent"},{"value":"SIBLING","label":"Sibling"},{"value":"OTHER","label":"Other"}], "section":"account" },
    { "name":"panNumber",          "label":"PAN Number",            "type":"text",   "required":true,  "validationRegex":"^[A-Z]{5}[0-9]{4}[A-Z]$", "section":"kyc" },
    { "name":"kycType",            "label":"KYC Type",              "type":"select", "required":true,  "options":[{"value":"AADHAAR_EKYC","label":"Aadhaar eKYC"},{"value":"IN_PERSON_VERIFICATION","label":"In-Person Verification"},{"value":"SIMPLIFIED_KYC","label":"Simplified KYC"}], "section":"kyc" },
    { "name":"annualIncome",       "label":"Annual Income (₹)",     "type":"number", "required":true,  "min":0, "section":"kyc" }
  ]
}
""");

            yield return MakeDefault("ACCOUNT_OPENING_FD", """
{
  "title": "Fixed Deposit Opening",
  "sections": [
    { "key": "deposit",   "title": "Deposit Details",  "fields": ["depositAmount","tenureMonths","interestPayoutMode","autoRenewal"] },
    { "key": "applicant", "title": "Applicant Details","fields": ["fullName","mobileNumber","panNumber","nomineeRelationship"] }
  ],
  "fields": [
    { "name":"depositAmount",       "label":"Deposit Amount (₹)",       "type":"number", "required":true,  "min":10000, "section":"deposit" },
    { "name":"tenureMonths",        "label":"Tenure (months)",           "type":"number", "required":true,  "min":1, "max":120, "section":"deposit" },
    { "name":"interestPayoutMode",  "label":"Interest Payout Mode",      "type":"select", "required":true,  "options":[{"value":"CUMULATIVE","label":"Cumulative (at maturity)"},{"value":"MONTHLY","label":"Monthly"},{"value":"QUARTERLY","label":"Quarterly"},{"value":"HALF_YEARLY","label":"Half Yearly"},{"value":"ANNUALLY","label":"Annually"}], "section":"deposit" },
    { "name":"autoRenewal",         "label":"Auto-Renew at Maturity",    "type":"boolean","required":false, "description":"Automatically renew the FD at the same tenure and prevailing rate", "section":"deposit" },
    { "name":"fullName",            "label":"Full Name",                 "type":"text",   "required":true,  "maxLength":100, "section":"applicant" },
    { "name":"mobileNumber",        "label":"Mobile Number",             "type":"text",   "required":true,  "validationRegex":"^[6-9]\\d{9}$", "section":"applicant" },
    { "name":"panNumber",           "label":"PAN Number",                "type":"text",   "required":true,  "validationRegex":"^[A-Z]{5}[0-9]{4}[A-Z]$", "section":"applicant" },
    { "name":"nomineeRelationship", "label":"Nominee Relationship",      "type":"select", "required":false, "options":[{"value":"SPOUSE","label":"Spouse"},{"value":"CHILD","label":"Child"},{"value":"PARENT","label":"Parent"},{"value":"SIBLING","label":"Sibling"},{"value":"OTHER","label":"Other"}], "section":"applicant" }
  ]
}
""");

            yield return MakeDefault("KYC_INDIVIDUAL", """
{
  "title": "Individual KYC Verification",
  "sections": [
    { "key": "identity", "title": "Identity Details", "fields": ["fullName","dateOfBirth","panNumber","aadhaarNumber"] },
    { "key": "address",  "title": "Address Details",  "fields": ["addressLine1","city","state","pincode"] }
  ],
  "fields": [
    { "name":"fullName",    "label":"Full Name",     "type":"text", "required":true,  "maxLength":100, "section":"identity" },
    { "name":"dateOfBirth", "label":"Date of Birth", "type":"date", "required":true,                  "section":"identity" },
    { "name":"panNumber",   "label":"PAN Number",    "type":"text", "required":true,  "validationRegex":"^[A-Z]{5}[0-9]{4}[A-Z]$", "section":"identity" },
    { "name":"aadhaarNumber","label":"Aadhaar Number","type":"text","required":true,  "validationRegex":"^\\d{12}$", "section":"identity" },
    { "name":"addressLine1","label":"Address Line 1","type":"text", "required":true,  "maxLength":200, "section":"address" },
    { "name":"city",        "label":"City",          "type":"text", "required":true,  "maxLength":50,  "section":"address" },
    { "name":"state",       "label":"State",         "type":"select","required":true, "options":[{"value":"AN","label":"Andaman & Nicobar"},{"value":"AP","label":"Andhra Pradesh"},{"value":"AR","label":"Arunachal Pradesh"},{"value":"AS","label":"Assam"},{"value":"BR","label":"Bihar"},{"value":"CH","label":"Chandigarh"},{"value":"CG","label":"Chhattisgarh"},{"value":"DN","label":"Dadra & Nagar Haveli"},{"value":"DD","label":"Daman & Diu"},{"value":"DL","label":"Delhi"},{"value":"GA","label":"Goa"},{"value":"GJ","label":"Gujarat"},{"value":"HR","label":"Haryana"},{"value":"HP","label":"Himachal Pradesh"},{"value":"JK","label":"Jammu & Kashmir"},{"value":"JH","label":"Jharkhand"},{"value":"KA","label":"Karnataka"},{"value":"KL","label":"Kerala"},{"value":"LA","label":"Ladakh"},{"value":"LD","label":"Lakshadweep"},{"value":"MP","label":"Madhya Pradesh"},{"value":"MH","label":"Maharashtra"},{"value":"MN","label":"Manipur"},{"value":"ML","label":"Meghalaya"},{"value":"MZ","label":"Mizoram"},{"value":"NL","label":"Nagaland"},{"value":"OD","label":"Odisha"},{"value":"PY","label":"Puducherry"},{"value":"PB","label":"Punjab"},{"value":"RJ","label":"Rajasthan"},{"value":"SK","label":"Sikkim"},{"value":"TN","label":"Tamil Nadu"},{"value":"TG","label":"Telangana"},{"value":"TR","label":"Tripura"},{"value":"UP","label":"Uttar Pradesh"},{"value":"UK","label":"Uttarakhand"},{"value":"WB","label":"West Bengal"}], "section":"address" },
    { "name":"pincode",     "label":"Pincode",       "type":"text", "required":true,  "validationRegex":"^\\d{6}$", "section":"address" }
  ]
}
""");
        }
    }
}
