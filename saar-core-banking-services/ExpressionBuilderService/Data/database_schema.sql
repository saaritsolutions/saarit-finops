-- Expression Builder Service Database Schema
-- PostgreSQL Database Creation Script

-- Create the database (run as superuser)
-- CREATE DATABASE saar_banking_expressions;

-- Use the database
-- \c saar_banking_expressions;

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Expression Definitions Table
CREATE TABLE "ExpressionDefinitions" (
    "Id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "TenantId" UUID NOT NULL,
    "ExpressionId" VARCHAR(200) NOT NULL,
    "Name" VARCHAR(500) NOT NULL,
    "Description" VARCHAR(2000),
    "Category" VARCHAR(100) NOT NULL,
    "SubCategory" VARCHAR(100),
    "ExpressionText" TEXT NOT NULL,
    "ReturnType" VARCHAR(100) NOT NULL,
    "ContextType" VARCHAR(100) NOT NULL,
    "CompiledCode" TEXT,
    "UsageType" VARCHAR(100) NOT NULL,
    "Version" VARCHAR(50) NOT NULL DEFAULT '1.0',
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Draft',
    "IsGlobal" BOOLEAN NOT NULL DEFAULT FALSE,
    "IsTemplate" BOOLEAN NOT NULL DEFAULT FALSE,
    "AverageExecutionTimeMs" INTEGER NOT NULL DEFAULT 0,
    "TotalExecutions" BIGINT NOT NULL DEFAULT 0,
    "SuccessfulExecutions" BIGINT NOT NULL DEFAULT 0,
    "LastExecutionAt" TIMESTAMP,
    "CreatedBy" UUID NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "LastCompiledAt" TIMESTAMP,
    "ApprovedBy" UUID,
    "ApprovedAt" TIMESTAMP,
    "Tags" JSONB NOT NULL DEFAULT '[]',
    "Dependencies" JSONB NOT NULL DEFAULT '[]',
    "Variables" JSONB NOT NULL DEFAULT '{}',
    "Functions" JSONB NOT NULL DEFAULT '[]',
    "IntegrationPoints" JSONB NOT NULL DEFAULT '[]'
);

-- Create indexes for ExpressionDefinitions
CREATE UNIQUE INDEX "IX_ExpressionDefinitions_TenantId_ExpressionId" 
ON "ExpressionDefinitions" ("TenantId", "ExpressionId");

CREATE INDEX "IX_ExpressionDefinitions_TenantId" 
ON "ExpressionDefinitions" ("TenantId");

CREATE INDEX "IX_ExpressionDefinitions_Category" 
ON "ExpressionDefinitions" ("Category");

CREATE INDEX "IX_ExpressionDefinitions_Status" 
ON "ExpressionDefinitions" ("Status");

CREATE INDEX "IX_ExpressionDefinitions_CreatedAt" 
ON "ExpressionDefinitions" ("CreatedAt");

-- Expression Execution Logs Table
CREATE TABLE "ExpressionExecutionLogs" (
    "Id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ExpressionDefinitionId" UUID NOT NULL,
    "TenantId" UUID NOT NULL,
    "UserId" UUID,
    "ExecutionContext" VARCHAR(500) NOT NULL,
    "ContextEntityId" UUID,
    "ResultType" VARCHAR(100) NOT NULL,
    "ExecutionStartTime" TIMESTAMP NOT NULL,
    "ExecutionEndTime" TIMESTAMP NOT NULL,
    "ExecutionTimeMs" INTEGER NOT NULL,
    "MemoryUsedKB" INTEGER NOT NULL DEFAULT 0,
    "Success" BOOLEAN NOT NULL,
    "ErrorMessage" VARCHAR(2000),
    "StackTrace" TEXT,
    "ExecutedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UserAgent" VARCHAR(500),
    "IPAddress" VARCHAR(45),
    "InputVariables" JSONB NOT NULL DEFAULT '{}',
    "ExecutionResult" JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for ExpressionExecutionLogs
CREATE INDEX "IX_ExpressionExecutionLogs_ExpressionDefinitionId" 
ON "ExpressionExecutionLogs" ("ExpressionDefinitionId");

CREATE INDEX "IX_ExpressionExecutionLogs_TenantId" 
ON "ExpressionExecutionLogs" ("TenantId");

CREATE INDEX "IX_ExpressionExecutionLogs_ExecutedAt" 
ON "ExpressionExecutionLogs" ("ExecutedAt");

CREATE INDEX "IX_ExpressionExecutionLogs_Success" 
ON "ExpressionExecutionLogs" ("Success");

CREATE INDEX "IX_ExpressionExecutionLogs_TenantId_ExecutedAt" 
ON "ExpressionExecutionLogs" ("TenantId", "ExecutedAt");

-- Expression Templates Table
CREATE TABLE "ExpressionTemplates" (
    "Id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "TemplateId" VARCHAR(200) NOT NULL UNIQUE,
    "Name" VARCHAR(500) NOT NULL,
    "Description" VARCHAR(2000) NOT NULL,
    "Category" VARCHAR(100) NOT NULL,
    "ExpressionTemplate" TEXT NOT NULL,
    "SampleExpression" TEXT NOT NULL,
    "ContextType" VARCHAR(100) NOT NULL,
    "ReturnType" VARCHAR(100) NOT NULL,
    "UsageInstructions" TEXT,
    "IsBuiltIn" BOOLEAN NOT NULL DEFAULT TRUE,
    "SortOrder" INTEGER NOT NULL DEFAULT 0,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "TemplateVariables" JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for ExpressionTemplates
CREATE UNIQUE INDEX "IX_ExpressionTemplates_TemplateId" 
ON "ExpressionTemplates" ("TemplateId");

CREATE INDEX "IX_ExpressionTemplates_Category" 
ON "ExpressionTemplates" ("Category");

CREATE INDEX "IX_ExpressionTemplates_IsBuiltIn" 
ON "ExpressionTemplates" ("IsBuiltIn");

CREATE INDEX "IX_ExpressionTemplates_SortOrder" 
ON "ExpressionTemplates" ("SortOrder");

-- Add foreign key constraint
ALTER TABLE "ExpressionExecutionLogs" 
ADD CONSTRAINT "FK_ExpressionExecutionLogs_ExpressionDefinitions_ExpressionDefinitionId" 
FOREIGN KEY ("ExpressionDefinitionId") 
REFERENCES "ExpressionDefinitions" ("Id") ON DELETE CASCADE;

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_expression_definitions_updated_at 
    BEFORE UPDATE ON "ExpressionDefinitions" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expression_templates_updated_at 
    BEFORE UPDATE ON "ExpressionTemplates" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample expression templates
INSERT INTO "ExpressionTemplates" (
    "TemplateId", "Name", "Description", "Category", "ExpressionTemplate", 
    "SampleExpression", "ContextType", "ReturnType", "UsageInstructions", "SortOrder"
) VALUES 
(
    'interest-simple', 
    'Simple Interest Calculation', 
    'Calculate simple interest for loans and deposits', 
    'Interest Calculations',
    'banking.CalculateSimpleInterest({principal}, {rate}, {days})',
    'banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)',
    'Account',
    'decimal',
    'Use this template to calculate simple interest. Replace {principal} with the principal amount, {rate} with annual interest rate, and {days} with the number of days.',
    1
),
(
    'loan-eligibility', 
    'Loan Eligibility Check', 
    'Check if customer is eligible for a specific loan amount and type', 
    'Loan Management',
    'banking.IsEligibleForLoan(customer.CustomerId, {loanAmount}, "{loanType}")',
    'banking.IsEligibleForLoan(customer.CustomerId, 100000m, "HOME")',
    'Customer',
    'boolean',
    'Use this to check loan eligibility. Replace {loanAmount} with requested amount and {loanType} with loan type (HOME, AUTO, PERSONAL, etc.).',
    2
),
(
    'transaction-limit', 
    'Transaction Limit Validation', 
    'Validate if transaction amount exceeds allowed limits', 
    'Transaction Validation',
    'banking.IsTransactionLimitExceeded({amount}, "{transactionType}", account.AccountNumber)',
    'banking.IsTransactionLimitExceeded(transaction.Amount, "TRANSFER", account.AccountNumber)',
    'Transaction',
    'boolean',
    'Check if transaction exceeds limits. Replace {amount} with transaction amount and {transactionType} with type (TRANSFER, WITHDRAWAL, etc.).',
    3
),
(
    'risk-score', 
    'Risk Score Calculation', 
    'Calculate risk score for transactions', 
    'Risk Management',
    'banking.CalculateRiskScore(customer.CustomerId, {transactionAmount})',
    'banking.CalculateRiskScore(customer.CustomerId, transaction.Amount)',
    'Transaction',
    'decimal',
    'Calculate transaction risk score. Replace {transactionAmount} with the transaction amount.',
    4
),
(
    'account-balance-check', 
    'Account Balance Validation', 
    'Check if account has sufficient balance for transaction', 
    'Account Management',
    'banking.GetAccountBalance(account.AccountNumber) >= {requiredAmount}',
    'banking.GetAccountBalance(account.AccountNumber) >= transaction.Amount',
    'Account',
    'boolean',
    'Check account balance sufficiency. Replace {requiredAmount} with the minimum required amount.',
    5
),
(
    'emi-calculation', 
    'EMI Calculation', 
    'Calculate Equated Monthly Installment for loans', 
    'Interest Calculations',
    'banking.CalculateEMI({principal}, {annualRate}, {months})',
    'banking.CalculateEMI(loan.Amount, loan.InterestRate, loan.TenureMonths)',
    'Loan',
    'decimal',
    'Calculate EMI amount. Replace {principal} with loan amount, {annualRate} with annual interest rate, and {months} with loan tenure.',
    6
),
(
    'business-days', 
    'Business Days Calculation', 
    'Calculate number of business days between dates', 
    'Date Utilities',
    'banking.CalculateBusinessDays({startDate}, {endDate})',
    'banking.CalculateBusinessDays(loan.StartDate, DateTime.UtcNow)',
    'Loan',
    'integer',
    'Calculate business days between two dates. Replace {startDate} and {endDate} with appropriate date values.',
    7
),
(
    'currency-conversion', 
    'Currency Conversion', 
    'Convert amount from one currency to another', 
    'Currency Operations',
    'banking.ConvertCurrency({amount}, "{fromCurrency}", "{toCurrency}")',
    'banking.ConvertCurrency(transaction.Amount, "USD", "EUR")',
    'Transaction',
    'decimal',
    'Convert currency amounts. Replace {amount}, {fromCurrency}, and {toCurrency} with appropriate values.',
    8
),
(
    'aml-compliance', 
    'AML Compliance Check', 
    'Check Anti-Money Laundering compliance', 
    'Compliance',
    'banking.IsAMLCompliant(customer.CustomerId, {transactionAmount})',
    'banking.IsAMLCompliant(customer.CustomerId, transaction.Amount)',
    'Customer',
    'boolean',
    'Check AML compliance for customer and transaction. Replace {transactionAmount} with the transaction amount.',
    9
),
(
    'conditional-approval', 
    'Conditional Approval Logic', 
    'Complex approval logic with multiple conditions', 
    'Business Rules',
    'customer.Age >= {minAge} && banking.GetCustomerRiskCategory(customer.CustomerId) != "High" && {amount} <= banking.GetCustomerCreditLimit(customer.CustomerId)',
    'customer.Age >= 21 && banking.GetCustomerRiskCategory(customer.CustomerId) != "High" && loan.Amount <= banking.GetCustomerCreditLimit(customer.CustomerId)',
    'Customer',
    'boolean',
    'Complex approval logic combining multiple criteria. Adjust {minAge} and {amount} as needed.',
    10
);

-- Create a default tenant for testing (UUID v4)
INSERT INTO "ExpressionDefinitions" (
    "TenantId", "ExpressionId", "Name", "Description", "Category", 
    "ExpressionText", "ReturnType", "ContextType", "UsageType", "CreatedBy", "Status"
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'sample-interest-calc',
    'Sample Interest Calculator',
    'A sample expression to calculate simple interest',
    'Interest Calculations',
    'banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)',
    'decimal',
    'Account',
    'Validation',
    '550e8400-e29b-41d4-a716-446655440001',
    'Active'
);

-- Add more sample expressions for demonstration
INSERT INTO "ExpressionDefinitions" (
    "TenantId", "ExpressionId", "Name", "Description", "Category", 
    "ExpressionText", "ReturnType", "ContextType", "UsageType", "CreatedBy", "Status"
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440000',
    'loan-approval-rule',
    'Basic Loan Approval Rule',
    'Check basic loan approval criteria',
    'Loan Management',
    'customer.Age >= 21 && customer.Age <= 65 && banking.IsEligibleForLoan(customer.CustomerId, 50000m, "PERSONAL") && !banking.IsLoanDefaulter(customer.CustomerId)',
    'boolean',
    'Customer',
    'Validation',
    '550e8400-e29b-41d4-a716-446655440001',
    'Active'
),
(
    '550e8400-e29b-41d4-a716-446655440000',
    'transaction-approval',
    'Transaction Approval Logic',
    'Comprehensive transaction approval with risk checks',
    'Transaction Validation',
    '!banking.IsTransactionLimitExceeded(transaction.Amount, transaction.Type, account.AccountNumber) && banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) < 75m && banking.IsTransactionTimeValid(DateTime.UtcNow)',
    'boolean',
    'Transaction',
    'Validation',
    '550e8400-e29b-41d4-a716-446655440001',
    'Active'
),
(
    '550e8400-e29b-41d4-a716-446655440000',
    'fee-calculation',
    'Dynamic Fee Calculation',
    'Calculate transaction fees based on amount and type',
    'Fee Calculation',
    'transaction.Amount > 10000m ? banking.Percentage(transaction.Amount, 0.5m) : 5m',
    'decimal',
    'Transaction',
    'Calculation',
    '550e8400-e29b-41d4-a716-446655440001',
    'Active'
);

COMMIT;
