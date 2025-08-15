-- Expression Builder Service Database Schema
-- PostgreSQL 12+

-- Create database (run this separately as postgres superuser)
-- CREATE DATABASE saar_banking_expressions;

-- Connect to the database and run the following:

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS expressions;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO expressions, public;

-- Expression Definitions Table
CREATE TABLE expressions.expression_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    expression_id VARCHAR(200) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    expression_text TEXT NOT NULL,
    return_type VARCHAR(100) NOT NULL,
    context_type VARCHAR(100) NOT NULL,
    compiled_code TEXT,
    usage_type VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    is_global BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    
    -- Performance metrics
    average_execution_time_ms INTEGER DEFAULT 0,
    total_executions BIGINT DEFAULT 0,
    successful_executions BIGINT DEFAULT 0,
    last_execution_at TIMESTAMP WITH TIME ZONE,
    
    -- JSON columns for flexible data
    tags JSONB DEFAULT '[]'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    variables JSONB DEFAULT '{}'::jsonb,
    functions JSONB DEFAULT '[]'::jsonb,
    integration_points JSONB DEFAULT '[]'::jsonb,
    
    -- Audit fields
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_compiled_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT uk_expression_definitions_tenant_expression UNIQUE (tenant_id, expression_id),
    CONSTRAINT ck_expression_definitions_status CHECK (status IN ('Draft', 'Active', 'Approved', 'Inactive', 'Deleted')),
    CONSTRAINT ck_expression_definitions_return_type CHECK (return_type IN ('boolean', 'decimal', 'integer', 'string', 'datetime', 'object')),
    CONSTRAINT ck_expression_definitions_context_type CHECK (context_type IN ('Customer', 'Account', 'Transaction', 'Loan', 'General')),
    CONSTRAINT ck_expression_definitions_usage_type CHECK (usage_type IN ('Validation', 'Calculation', 'Transform', 'Filter', 'Decision'))
);

-- Expression Execution Logs Table
CREATE TABLE expressions.expression_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expression_definition_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID,
    execution_context VARCHAR(500) NOT NULL,
    context_entity_id UUID,
    result_type VARCHAR(100) NOT NULL,
    execution_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    execution_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    memory_used_kb BIGINT DEFAULT 0,
    success BOOLEAN NOT NULL,
    error_message VARCHAR(2000),
    stack_trace TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(500),
    ip_address INET,
    
    -- JSON columns
    input_variables JSONB DEFAULT '{}'::jsonb,
    execution_result JSONB DEFAULT '{}'::jsonb,
    
    -- Foreign key
    CONSTRAINT fk_execution_logs_expression FOREIGN KEY (expression_definition_id) 
        REFERENCES expressions.expression_definitions(id) ON DELETE CASCADE
);

-- Expression Templates Table
CREATE TABLE expressions.expression_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id VARCHAR(200) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    template_expression TEXT NOT NULL,
    sample_expression TEXT NOT NULL,
    context_type VARCHAR(100) NOT NULL,
    return_type VARCHAR(100) NOT NULL,
    usage_instructions TEXT,
    is_built_in BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    -- JSON column
    template_variables JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT ck_expression_templates_return_type CHECK (return_type IN ('boolean', 'decimal', 'integer', 'string', 'datetime', 'object')),
    CONSTRAINT ck_expression_templates_context_type CHECK (context_type IN ('Customer', 'Account', 'Transaction', 'Loan', 'General'))
);

-- Indexes for performance
CREATE INDEX idx_expression_definitions_tenant_id ON expressions.expression_definitions(tenant_id);
CREATE INDEX idx_expression_definitions_category ON expressions.expression_definitions(category);
CREATE INDEX idx_expression_definitions_status ON expressions.expression_definitions(status);
CREATE INDEX idx_expression_definitions_created_at ON expressions.expression_definitions(created_at);
CREATE INDEX idx_expression_definitions_tags ON expressions.expression_definitions USING GIN(tags);
CREATE INDEX idx_expression_definitions_functions ON expressions.expression_definitions USING GIN(functions);

CREATE INDEX idx_execution_logs_expression_id ON expressions.expression_execution_logs(expression_definition_id);
CREATE INDEX idx_execution_logs_tenant_id ON expressions.expression_execution_logs(tenant_id);
CREATE INDEX idx_execution_logs_executed_at ON expressions.expression_execution_logs(executed_at);
CREATE INDEX idx_execution_logs_success ON expressions.expression_execution_logs(success);
CREATE INDEX idx_execution_logs_tenant_executed_at ON expressions.expression_execution_logs(tenant_id, executed_at);

CREATE INDEX idx_expression_templates_category ON expressions.expression_templates(category);
CREATE INDEX idx_expression_templates_built_in ON expressions.expression_templates(is_built_in);
CREATE INDEX idx_expression_templates_sort_order ON expressions.expression_templates(sort_order);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_expression_definitions_updated_at
    BEFORE UPDATE ON expressions.expression_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expression_templates_updated_at
    BEFORE UPDATE ON expressions.expression_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample expression templates
INSERT INTO expressions.expression_templates (
    template_id, name, description, category, template_expression, sample_expression,
    context_type, return_type, usage_instructions, sort_order
) VALUES 
-- Validation Templates
('age-validation', 'Age Validation', 'Validates customer age within specified range', 'Validation', 
 'customer.Age >= {minAge} && customer.Age <= {maxAge}', 
 'customer.Age >= 18 && customer.Age <= 65', 
 'Customer', 'boolean', 'Replace {minAge} and {maxAge} with actual age limits', 1),

('balance-check', 'Minimum Balance Check', 'Validates account has minimum balance', 'Validation',
 'banking.GetAccountBalance(account.AccountNumber) >= {minBalance}',
 'banking.GetAccountBalance(account.AccountNumber) >= 1000m',
 'Account', 'boolean', 'Replace {minBalance} with required minimum balance', 2),

-- Calculation Templates
('simple-interest', 'Simple Interest Calculation', 'Calculates simple interest', 'Calculation',
 'banking.CalculateSimpleInterest({principal}, {rate}, {days})',
 'banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)',
 'Account', 'decimal', 'Replace parameters with actual values or variables', 3),

('emi-calculation', 'EMI Calculation', 'Calculates EMI for loans', 'Calculation',
 'banking.CalculateEMI({principal}, {rate}, {months})',
 'banking.CalculateEMI(loan.Amount, loan.Rate, loan.Term)',
 'Loan', 'decimal', 'Use for loan EMI calculations', 4),

-- Risk Assessment Templates
('transaction-risk', 'Transaction Risk Assessment', 'Assesses transaction risk', 'Risk Assessment',
 'banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) > {riskThreshold}',
 'banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) > 75m',
 'Transaction', 'boolean', 'Higher score indicates higher risk', 5),

('loan-eligibility', 'Loan Eligibility Check', 'Comprehensive loan eligibility validation', 'Loan Management',
 'customer.Age >= 21 && customer.Age <= 65 && banking.IsEligibleForLoan(customer.CustomerId, {amount}, "{loanType}") && !banking.IsLoanDefaulter(customer.CustomerId)',
 'customer.Age >= 21 && customer.Age <= 65 && banking.IsEligibleForLoan(customer.CustomerId, 50000m, "PERSONAL") && !banking.IsLoanDefaulter(customer.CustomerId)',
 'Customer', 'boolean', 'Comprehensive loan eligibility check including age, eligibility, and default history', 6),

-- Transaction Validation Templates
('daily-limit-check', 'Daily Transaction Limit', 'Validates daily transaction limits', 'Transaction Processing',
 '!banking.IsTransactionLimitExceeded(transaction.Amount, "{transactionType}", account.AccountNumber)',
 '!banking.IsTransactionLimitExceeded(transaction.Amount, "TRANSFER", account.AccountNumber)',
 'Transaction', 'boolean', 'Checks if transaction exceeds daily limits', 7),

('business-hours', 'Business Hours Validation', 'Validates transaction during business hours', 'Compliance',
 'banking.IsTransactionTimeValid(DateTime.UtcNow)',
 'banking.IsTransactionTimeValid(DateTime.UtcNow)',
 'General', 'boolean', 'Ensures transactions occur during business hours', 8);

-- Create sample tenant and user data for development
-- (In production, this would be managed by your user management system)
INSERT INTO expressions.expression_definitions (
    tenant_id, expression_id, name, description, category, expression_text,
    return_type, context_type, usage_type, created_by, status
) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'adult-customer-validation', 'Adult Customer Validation', 
 'Validates that customer is an adult (18+)', 'Validation',
 'customer.Age >= 18', 'boolean', 'Customer', 'Validation',
 '550e8400-e29b-41d4-a716-446655440001', 'Active'),

('550e8400-e29b-41d4-a716-446655440000', 'high-value-transaction-check', 'High Value Transaction Check',
 'Identifies high value transactions requiring approval', 'Risk Assessment',
 'transaction.Amount > 100000m || banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) > 80m',
 'boolean', 'Transaction', 'Decision',
 '550e8400-e29b-41d4-a716-446655440001', 'Active'),

('550e8400-e29b-41d4-a716-446655440000', 'monthly-interest-calculation', 'Monthly Interest Calculation',
 'Calculates monthly interest for savings account', 'Calculation',
 'banking.CalculateSimpleInterest(banking.GetAccountBalance(account.AccountNumber), 3.5m, 30)',
 'decimal', 'Account', 'Calculation',
 '550e8400-e29b-41d4-a716-446655440001', 'Active');

-- Grant permissions (adjust according to your user management)
-- GRANT USAGE ON SCHEMA expressions TO expression_builder_service;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA expressions TO expression_builder_service;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA expressions TO expression_builder_service;

-- Create read-only user for reporting
-- CREATE USER expression_reader WITH PASSWORD 'reader_password';
-- GRANT USAGE ON SCHEMA expressions TO expression_reader;
-- GRANT SELECT ON ALL TABLES IN SCHEMA expressions TO expression_reader;

COMMENT ON TABLE expressions.expression_definitions IS 'Stores expression definitions with metadata and performance metrics';
COMMENT ON TABLE expressions.expression_execution_logs IS 'Audit log of all expression executions with performance data';
COMMENT ON TABLE expressions.expression_templates IS 'Pre-built expression templates for common banking scenarios';

-- Verify the setup
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'expressions'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
