using ExpressionBuilderService.Models;
using Microsoft.EntityFrameworkCore;

namespace ExpressionBuilderService.Data;

/// <summary>
/// Seeds the expression database with the active demo expression (EXPR_1755237353842)
/// and 9 pre-built banking rule templates so demos work from a clean DB without manual setup.
/// Seed is idempotent — each record is only inserted if its ExpressionId / TemplateId is absent.
/// </summary>
public class ExpressionSeedService
{
    private readonly ExpressionDbContext _db;
    private readonly ILogger<ExpressionSeedService> _logger;

    // Stable demo-tenant and system-user GUIDs (no real user required for seeding)
    private static readonly Guid DemoTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid SystemUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public ExpressionSeedService(ExpressionDbContext db, ILogger<ExpressionSeedService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedExpressionsAsync(cancellationToken);
        await SeedTemplatesAsync(cancellationToken);
    }

    // ──────────────────────────────────────────────────────────
    // Expression Definitions (live rules called by LoanService)
    // ──────────────────────────────────────────────────────────
    private async Task SeedExpressionsAsync(CancellationToken cancellationToken)
    {
        var seeds = BuildExpressionSeeds();
        int added = 0;

        foreach (var seed in seeds)
        {
            bool exists = await _db.ExpressionDefinitions
                .AnyAsync(e => e.TenantId == DemoTenantId && e.ExpressionId == seed.ExpressionId, cancellationToken);

            if (!exists)
            {
                _db.ExpressionDefinitions.Add(seed);
                added++;
            }
        }

        if (added > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("ExpressionSeedService: inserted {Count} expression definition(s).", added);
        }
        else
        {
            _logger.LogDebug("ExpressionSeedService: all expression definitions already present — skipping.");
        }
    }

    private List<ExpressionDefinition> BuildExpressionSeeds() => new()
    {
        // ── 1. PRIMARY DEMO EXPRESSION — used by LoanService eligibility check ──
        Def(
            expressionId: "EXPR_1755237353842",
            name: "Personal Loan Eligibility Rule",
            description: "Determines if a personal loan applicant is eligible. " +
                         "Requires credit score ≥ 650, monthly income ≥ ₹25,000 and DTI ratio ≤ 0.5.",
            category: "Validation",
            usageType: "Validation",
            returnType: "boolean",
            contextType: "LoanApplication",
            expressionText: "creditScore >= 650 && monthlyIncome >= 25000m && debtToIncomeRatio <= 0.5m",
            tags: new[] { "loan", "eligibility", "personal-loan", "demo" }
        ),

        // ── 2. INTEREST RATE TIER SELECTOR — fetched by LoanService ──
        Def(
            expressionId: "EXPR_INTEREST_RATE_001",
            name: "Personal Loan Interest Rate Tier",
            description: "Returns the applicable annual interest rate (%) based on credit score tier. " +
                         "750+ → 8.5%, 700–749 → 10.0%, 650–699 → 12.0%, <650 → 14.5%.",
            category: "Interest",
            usageType: "Interest",
            returnType: "decimal",
            contextType: "LoanApplication",
            expressionText: "creditScore >= 750 ? 8.5m : creditScore >= 700 ? 10.0m : creditScore >= 650 ? 12.0m : 14.5m",
            tags: new[] { "interest-rate", "personal-loan", "tiered" }
        ),

        // ── 3. EMI CALCULATION ──
        Def(
            expressionId: "EXPR_EMI_CALC_001",
            name: "Monthly EMI Calculation",
            description: "Calculates the equated monthly instalment using P×r(1+r)^n/((1+r)^n−1). " +
                         "Variables: amount = principal (₹), rate = annual rate (%), days = tenure months.",
            category: "Calculation",
            usageType: "Calculation",
            returnType: "decimal",
            contextType: "LoanApplication",
            expressionText: "(amount * (rate / 12m / 100m) * (decimal)Math.Pow((double)(1m + rate / 12m / 100m), days)) / ((decimal)Math.Pow((double)(1m + rate / 12m / 100m), days) - 1m)",
            tags: new[] { "emi", "calculation", "loan" }
        ),

        // ── 4. DAILY TRANSACTION LIMIT CHECK ──
        Def(
            expressionId: "EXPR_TRANSACTION_LIMIT_001",
            name: "Daily Transaction Limit Validator",
            description: "Returns true if the transaction amount is within the daily limit of ₹1,00,000 " +
                         "(PMLA threshold). Variable: amount = transaction value.",
            category: "Validation",
            usageType: "Validation",
            returnType: "boolean",
            contextType: "Transaction",
            expressionText: "amount <= 100000m",
            tags: new[] { "transaction", "limit", "aml", "pmla" }
        ),

        // ── 5. MINIMUM BALANCE VALIDATOR ──
        Def(
            expressionId: "EXPR_MIN_BALANCE_001",
            name: "Minimum Balance Validator",
            description: "Checks if the account balance meets the minimum maintenance balance of ₹500. " +
                         "Variable: amount = current account balance.",
            category: "Validation",
            usageType: "Validation",
            returnType: "boolean",
            contextType: "Account",
            expressionText: "amount >= 500m",
            tags: new[] { "account", "balance", "savings" }
        ),

        // ── 6. SAVINGS ACCOUNT INTEREST RATE ──
        Def(
            expressionId: "EXPR_SAVINGS_INTEREST_001",
            name: "Savings Account Interest Rate",
            description: "Returns the tiered savings interest rate (%) based on average monthly balance. " +
                         "≥10L → 7.0%, ≥1L → 6.5%, otherwise 5.5%.",
            category: "Interest",
            usageType: "Interest",
            returnType: "decimal",
            contextType: "Account",
            expressionText: "amount >= 1000000m ? 7.0m : amount >= 100000m ? 6.5m : 5.5m",
            tags: new[] { "savings", "interest-rate", "tiered" }
        ),

        // ── 7. CUSTOMER RISK SCORE ──
        Def(
            expressionId: "EXPR_RISK_SCORE_001",
            name: "Customer Risk Score",
            description: "Computes a 0–100 risk score from credit score and DTI ratio. " +
                         "Lower score = higher risk. Variables: creditScore, debtToIncomeRatio.",
            category: "Risk",
            usageType: "RiskAssessment",
            returnType: "decimal",
            contextType: "Customer",
            expressionText: "Math.Round(Math.Max(0m, Math.Min(100m, (decimal)(creditScore - 300) / 6m * (1m - debtToIncomeRatio))), 2)",
            tags: new[] { "risk", "credit-score", "customer" }
        ),

        // ── 8. PRIORITY-SECTOR LOAN ELIGIBILITY (RBI) ──
        Def(
            expressionId: "EXPR_PRIORITY_SECTOR_001",
            name: "Priority Sector Loan Eligibility",
            description: "Checks if a loan qualifies as RBI priority-sector lending. " +
                         "Loan amount ≤ ₹10L and monthly income ≤ ₹25,000.",
            category: "Compliance",
            usageType: "Compliance",
            returnType: "boolean",
            contextType: "LoanApplication",
            expressionText: "amount <= 1000000m && monthlyIncome <= 25000m",
            tags: new[] { "rbi", "priority-sector", "compliance" }
        ),

        // ── 9. MAX LOAN TENURE SELECTOR ──
        Def(
            expressionId: "EXPR_LOAN_TENURE_001",
            name: "Maximum Loan Tenure (months)",
            description: "Returns the maximum allowable tenure in months based on credit score. " +
                         "750+ → 60m, 700–749 → 48m, 650–699 → 36m, <650 → 24m.",
            category: "LoanManagement",
            usageType: "Calculation",
            returnType: "integer",
            contextType: "LoanApplication",
            expressionText: "creditScore >= 750 ? 60 : creditScore >= 700 ? 48 : creditScore >= 650 ? 36 : 24",
            tags: new[] { "tenure", "loan", "tiered" }
        ),

        // ── 10. FIXED DEPOSIT INTEREST RATE ──
        Def(
            expressionId: "EXPR_FD_RATE_001",
            name: "Fixed Deposit Interest Rate",
            description: "Returns the FD interest rate (%) based on tenure. " +
                         "≥365 days → 8.0%, ≥180 → 7.5%, ≥90 → 7.0%, <90 → 6.0%. Variable: days = FD term in days.",
            category: "Interest",
            usageType: "Interest",
            returnType: "decimal",
            contextType: "Account",
            expressionText: "days >= 365 ? 8.0m : days >= 180 ? 7.5m : days >= 90 ? 7.0m : 6.0m",
            tags: new[] { "fd", "interest-rate", "deposit" }
        ),

        // ── 11. LOAN ORIGINATION WORKFLOW ROUTING ──
        Def(
            expressionId: "EXPR_ROUTING_LOAN_ORIGINATION",
            name: "Loan Origination Workflow Step Routing",
            description: "Returns the next workflow step for loan origination. " +
                         "START → CREDIT_REVIEW → LEGAL_REVIEW → SANCTION_APPROVAL → COMPLETED. " +
                         "Variable: workflow_currentStep.",
            category: "WorkflowRouting",
            usageType: "WorkflowRouting",
            returnType: "string",
            contextType: "WorkflowInstance",
            expressionText: "workflow_currentStep == \"START\" ? \"CREDIT_REVIEW\" : " +
                            "workflow_currentStep == \"CREDIT_REVIEW\" ? \"LEGAL_REVIEW\" : " +
                            "workflow_currentStep == \"LEGAL_REVIEW\" ? \"SANCTION_APPROVAL\" : \"COMPLETED\"",
            tags: new[] { "workflow", "routing", "loan-origination" }
        ),

        // ── 12. LOAN ORIGINATION APPROVAL ROLE ──
        Def(
            expressionId: "EXPR_APPROVAL_LOAN_ORIGINATION",
            name: "Loan Origination Approval Role",
            description: "Returns the approval role required for loan origination workflow.",
            category: "WorkflowRouting",
            usageType: "WorkflowRouting",
            returnType: "string",
            contextType: "WorkflowInstance",
            expressionText: "\"MANAGER\"",
            tags: new[] { "workflow", "approval", "loan-origination" }
        ),

        // ── 13. ACCOUNT OPENING WORKFLOW ROUTING ──
        Def(
            expressionId: "EXPR_ROUTING_ACCOUNT_OPENING",
            name: "Account Opening Workflow Step Routing",
            description: "Returns the next workflow step for account opening. " +
                         "START → MAKER_REVIEW → CHECKER_APPROVAL → COMPLETED. " +
                         "Variable: workflow_currentStep.",
            category: "WorkflowRouting",
            usageType: "WorkflowRouting",
            returnType: "string",
            contextType: "WorkflowInstance",
            expressionText: "workflow_currentStep == \"START\" ? \"MAKER_REVIEW\" : " +
                            "workflow_currentStep == \"MAKER_REVIEW\" ? \"CHECKER_APPROVAL\" : \"COMPLETED\"",
            tags: new[] { "workflow", "routing", "account-opening" }
        ),

        // ── 14. ACCOUNT OPENING APPROVAL ROLE ──
        Def(
            expressionId: "EXPR_APPROVAL_ACCOUNT_OPENING",
            name: "Account Opening Approval Role",
            description: "Returns the approval role required for account opening workflow.",
            category: "WorkflowRouting",
            usageType: "WorkflowRouting",
            returnType: "string",
            contextType: "WorkflowInstance",
            expressionText: "\"CHECKER\"",
            tags: new[] { "workflow", "approval", "account-opening" }
        ),

        // ── 15. DEPOSIT MATURITY INTEREST CALCULATION ──
        Def(
            expressionId: "EXPR_MATURITY_INTEREST_CALC",
            name: "Deposit Maturity Interest Calculation",
            description: "Calculates the simple interest earned on an FD/RD at maturity. " +
                         "Formula: principal × annualRate / 100 × termMonths / 12. " +
                         "Variables: principal (decimal), annualRate (decimal), termMonths (decimal).",
            category: "Interest",
            usageType: "Calculation",
            returnType: "decimal",
            contextType: "Account",
            expressionText: "Math.Round(principal * annualRate / 100m * termMonths / 12m, 2)",
            tags: new[] { "fd", "rd", "interest", "maturity", "calculation" }
        ),

        // ── 16. PREMATURE CLOSURE INTEREST CALCULATION ──
        Def(
            expressionId: "EXPR_PREMATURE_CLOSURE_PENALTY_CALC",
            name: "Premature Closure Interest (After Penalty)",
            description: "Calculates interest earned on an FD/RD closed before maturity, after applying " +
                         "the premature closure penalty to the rate. " +
                         "Formula: principal × max(0, annualRate − penaltyPercent) / 100 × actualMonths / 12. " +
                         "Variables: principal (decimal), annualRate (decimal), penaltyPercent (decimal), actualMonths (decimal).",
            category: "Interest",
            usageType: "Calculation",
            returnType: "decimal",
            contextType: "Account",
            expressionText: "Math.Round(principal * Math.Max(0m, annualRate - penaltyPercent) / 100m * actualMonths / 12m, 2)",
            tags: new[] { "fd", "rd", "premature-closure", "penalty", "calculation" }
        ),

        // ── 17. LOAN DISBURSAL GL ACCOUNT MAPPING ──
        Def(
            expressionId: "EXPR_GL_MAPPING_LOAN_DISBURSAL",
            name: "Loan Disbursal GL Account Mapping",
            description: "Returns the pipe-separated GL account codes \"debitCode|creditCode\" for a loan disbursal " +
                         "journal entry, based on product type. " +
                         "All loan types: DR 1020 (Loans and Advances) / CR 1010 (Cash and Bank). " +
                         "Variable: productType (PERSONAL_LOAN | HOME_LOAN | BUSINESS_LOAN | GOLD_LOAN | VEHICLE_LOAN).",
            category: "LoanManagement",
            usageType: "Calculation",
            returnType: "string",
            contextType: "LoanApplication",
            expressionText: "productType == \"HOME_LOAN\" ? \"1020|1010\" : " +
                            "productType == \"BUSINESS_LOAN\" ? \"1020|1010\" : " +
                            "productType == \"GOLD_LOAN\" ? \"1020|1010\" : " +
                            "productType == \"VEHICLE_LOAN\" ? \"1020|1010\" : " +
                            "\"1020|1010\"",
            tags: new[] { "gl-mapping", "loan", "disbursal", "double-entry" }
        ),

        // ── 18. DAILY TRANSACTION LIMIT CHECK (SAAR-EXPR-001 / TransactionService) ──
        Def(
            expressionId: "EXPR_DAILY_LIMIT_CHECK",
            name: "Daily Transaction Limit Check (UCB Default)",
            description: "Returns true if the journal debit amount is within the bank's per-transaction limit. " +
                         "UCB default: ₹2,00,000 per transaction. Edit this expression to change the limit " +
                         "without any code deployment. Variable: amount = total debit amount (₹).",
            category: "TransactionLimit",
            usageType: "Validation",
            returnType: "boolean",
            contextType: "Transaction",
            expressionText: "amount <= 200000m",
            tags: new[] { "transaction", "limit", "ucb", "daily-limit", "pmla" }
        ),

        // ── 19. CTR TRIGGER — Cash Transaction Report (SAAR-EXPR-001 / TransactionService) ──
        Def(
            expressionId: "EXPR_CTR_TRIGGER",
            name: "Cash Transaction Report (CTR) Trigger",
            description: "Returns true if the transaction amount triggers an RBI CTR filing requirement. " +
                         "RBI mandate: cash transactions ≥ ₹10,00,000 in a single transaction. " +
                         "Variable: cashAmount = total debit/credit amount (₹).",
            category: "ComplianceTrigger",
            usageType: "Compliance",
            returnType: "boolean",
            contextType: "Transaction",
            expressionText: "cashAmount >= 1000000m",
            tags: new[] { "ctr", "compliance", "rbi", "cash", "pmla", "aml" }
        ),

        // ── 20. ACCOUNT MAINTENANCE CHARGE (SAAR-EXPR-001 / AccountService) ──
        Def(
            expressionId: "EXPR_AMC_FEE_UCB",
            name: "Account Maintenance Charge (UCB Default)",
            description: "Returns the monthly account maintenance fee (₹) based on average balance, " +
                         "account type, and customer segment. Senior citizens and staff are always waived. " +
                         "Accounts above minimum balance threshold are waived. " +
                         "Variables: customerSegment, averageMonthlyBalance, minimumBalanceRequired, accountType.",
            category: "FeeCalculation",
            usageType: "Calculation",
            returnType: "decimal",
            contextType: "Account",
            expressionText: "customerSegment == \"SENIOR_CITIZEN\" || customerSegment == \"STAFF\" ? 0m : " +
                            "averageMonthlyBalance >= minimumBalanceRequired ? 0m : " +
                            "accountType == \"SAVINGS\" ? 50m : 100m",
            tags: new[] { "fee", "amc", "account-maintenance", "savings", "current", "ucb" }
        ),

        // ── 21. NPA CLASSIFICATION — RBI IRACP Norms (SAAR-EXPR-001) ──
        Def(
            expressionId: "EXPR_NPA_CLASSIFICATION",
            name: "NPA Classification (RBI IRACP Norms)",
            description: "Returns the NPA category for an overdue loan account per RBI Income Recognition " +
                         "and Asset Classification (IRACP) norms. " +
                         "Standard → Special Mention (1–30 days) → Sub-Standard (31–90 days) → " +
                         "Doubtful (91–365 days) → Loss (>365 days). " +
                         "Variable: daysOverdue = number of days since payment was due.",
            category: "NPAClassification",
            usageType: "Compliance",
            returnType: "string",
            contextType: "LoanApplication",
            expressionText: "daysOverdue == 0 ? \"STANDARD\" : " +
                            "daysOverdue <= 30 ? \"SPECIAL_MENTION\" : " +
                            "daysOverdue <= 90 ? \"SUB_STANDARD\" : " +
                            "daysOverdue <= 365 ? \"DOUBTFUL\" : \"LOSS\"",
            tags: new[] { "npa", "classification", "rbi", "iracp", "compliance", "loan" }
        ),
    };

    // ──────────────────────────────────────────────────────────
    // Expression Templates (shown in the React template picker)
    // ──────────────────────────────────────────────────────────
    private async Task SeedTemplatesAsync(CancellationToken cancellationToken)
    {
        var seeds = BuildTemplateSeed();
        int added = 0;

        foreach (var seed in seeds)
        {
            bool exists = await _db.ExpressionTemplates
                .AnyAsync(t => t.TemplateId == seed.TemplateId, cancellationToken);

            if (!exists)
            {
                _db.ExpressionTemplates.Add(seed);
                added++;
            }
        }

        if (added > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("ExpressionSeedService: inserted {Count} expression template(s).", added);
        }
    }

    private List<ExpressionTemplate> BuildTemplateSeed() => new()
    {
        Template("loan-eligibility",   "Loan Eligibility Check",        "Validates applicant eligibility based on credit score, income and DTI ratio.",          "Loan Management",        "creditScore >= {minCreditScore} && monthlyIncome >= {minIncome}m && debtToIncomeRatio <= {maxDTI}m", "creditScore >= 650 && monthlyIncome >= 25000m && debtToIncomeRatio <= 0.5m",  "LoanApplication", "boolean", 1),
        Template("interest-rate-tier", "Interest Rate Tier Selector",   "Returns tiered annual interest rate based on credit score.",                            "Loan Management",        "creditScore >= 750 ? {rate750}m : creditScore >= 700 ? {rate700}m : {rateDefault}m",               "creditScore >= 750 ? 8.5m : creditScore >= 700 ? 10.0m : 12.0m",            "LoanApplication", "decimal", 2),
        Template("emi-calculation",    "EMI Monthly Calculation",        "P×r(1+r)^n/((1+r)^n−1) — equated monthly instalment. amount=principal, rate=% p.a., days=months.", "Calculation", "(amount * (rate/12m/100m) * (decimal)Math.Pow((double)(1m+rate/12m/100m),days)) / ((decimal)Math.Pow((double)(1m+rate/12m/100m),days)-1m)", "(amount * (rate/12m/100m) * (decimal)Math.Pow((double)(1m+rate/12m/100m),24)) / ((decimal)Math.Pow((double)(1m+rate/12m/100m),24)-1m)", "LoanApplication", "decimal", 3),
        Template("txn-limit-check",    "Transaction Limit Validator",   "Returns true if transaction is within daily PMLA cash-transaction limit.",              "Transaction Processing", "amount <= {dailyLimit}m",                                                                              "amount <= 100000m",                                                          "Transaction",     "boolean", 4),
        Template("min-balance",        "Minimum Balance Check",          "Validates account maintains minimum required balance.",                                  "Validation",             "amount >= {minBalance}m",                                                                              "amount >= 500m",                                                             "Account",         "boolean", 5),
        Template("savings-rate",       "Savings Account Interest Rate",  "Tiered interest rate based on average monthly balance.",                                 "Calculation",            "amount >= {highBalance}m ? {highRate}m : amount >= {midBalance}m ? {midRate}m : {baseRate}m",          "amount >= 1000000m ? 7.0m : amount >= 100000m ? 6.5m : 5.5m",               "Account",         "decimal", 6),
        Template("risk-score",         "Customer Risk Score",            "0–100 risk score derived from credit score and DTI ratio. Lower = higher risk.",        "Risk Assessment",        "Math.Round(Math.Max(0m, Math.Min(100m, (decimal)(creditScore-300)/6m*(1m-debtToIncomeRatio))),2)",   "Math.Round(Math.Max(0m, Math.Min(100m, (decimal)(creditScore-300)/6m*(1m-debtToIncomeRatio))),2)", "Customer", "decimal", 7),
        Template("priority-sector",    "Priority Sector Loan Flag",      "Returns true if loan qualifies as RBI priority-sector lending (amount ≤ ₹10L, income ≤ ₹25K).", "Compliance", "amount <= {maxAmount}m && monthlyIncome <= {maxIncome}m",                                              "amount <= 1000000m && monthlyIncome <= 25000m",                               "LoanApplication", "boolean", 8),
        Template("max-tenure",         "Maximum Loan Tenure",            "Returns max allowable tenure in months based on credit score tier.",                    "Loan Management",        "creditScore >= 750 ? 60 : creditScore >= 700 ? 48 : creditScore >= 650 ? 36 : 24",                   "creditScore >= 750 ? 60 : creditScore >= 700 ? 48 : creditScore >= 650 ? 36 : 24", "LoanApplication", "integer", 9),
        Template("fd-rate",            "Fixed Deposit Interest Rate",    "FD interest rate by tenor: ≥365d → 8.0%, ≥180d → 7.5%, ≥90d → 7.0%, else 6.0%.",      "Calculation",            "days >= {days365} ? {rate365}m : days >= {days180} ? {rate180}m : {rateMin}m",                       "days >= 365 ? 8.0m : days >= 180 ? 7.5m : days >= 90 ? 7.0m : 6.0m",        "Account",         "decimal", 10),
    };

    // ──────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────
    private ExpressionDefinition Def(
        string expressionId, string name, string description,
        string category, string usageType, string returnType,
        string contextType, string expressionText, string[] tags) => new()
    {
        ExpressionId   = expressionId,
        TenantId       = DemoTenantId,
        Name           = name,
        Description    = description,
        Category       = category,
        SubCategory    = null,
        ExpressionText = expressionText,
        ReturnType     = returnType,
        ContextType    = contextType,
        UsageType      = usageType,
        Version        = "1.0",
        Status         = "Active",
        IsGlobal       = true,
        IsTemplate     = false,
        Tags           = tags.ToList(),
        Dependencies   = new List<string>(),
        Variables      = new Dictionary<string, object>(),
        Functions      = new List<string>(),
        IntegrationPoints = new List<string>(),
        CreatedBy      = SystemUserId,
        CreatedAt      = DateTime.UtcNow,
        UpdatedAt      = DateTime.UtcNow,
    };

    private static ExpressionTemplate Template(
        string templateId, string name, string description,
        string category, string templateExpr, string sampleExpr,
        string contextType, string returnType, int sortOrder) => new()
    {
        TemplateId         = templateId,
        Name               = name,
        Description        = description,
        Category           = category,
        TemplateExpression = templateExpr,
        SampleExpression   = sampleExpr,
        ContextType        = contextType,
        ReturnType         = returnType,
        UsageInstructions  = $"Adjust placeholder values to match your bank's policy. Context: {contextType}.",
        IsBuiltIn          = true,
        SortOrder          = sortOrder,
        TemplateVariables  = new Dictionary<string, object>(),
        CreatedAt          = DateTime.UtcNow,
        UpdatedAt          = DateTime.UtcNow,
    };
}
