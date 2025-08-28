// Expression Builder Types
export interface ExpressionDefinition {
  id: string;
  expressionId: string;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  expressionText: string;
  returnType: string;
  contextType: string;
  usageType: string;
  version: string;
  status: string;
  isGlobal: boolean;
  isTemplate: boolean;
  tags: string[];
  dependencies: string[];
  variables: Record<string, any>;
  functions: string[];
  averageExecutionTimeMs: number;
  totalExecutions: number;
  createdAt: string;
  updatedAt: string;
  lastCompiledAt?: string;
}

export interface CreateExpressionRequest {
  expressionId?: string;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  expressionText: string;
  returnType: string;
  contextType: string;
  usageType: string;
  tags: string[];
  variables: Record<string, any>;
}

export interface UpdateExpressionRequest {
  name?: string;
  description?: string;
  expressionText?: string;
  category?: string;
  subCategory?: string;
  tags?: string[];
  variables?: Record<string, any>;
}

export interface ExpressionValidationRequest {
  expressionText: string;
  contextType: string;
  returnType: string;
  variables?: Record<string, any>;
}

export interface ValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  usedFunctions: string[];
  dependencies: string[];
}

export interface ExecutionRequest {
  expressionText: string;
  variables: Record<string, any>;
  contextType: string;
  returnType: string;
}

export interface ExecutionResponse {
  success: boolean;
  result: any;
  resultType: string;
  executionTimeMs: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface ExpressionValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: ExpressionMetadata;
}

export interface ExpressionMetadata {
  variables: string[];
  functions: string[];
  bankingFunctions: string[];
  dependencies: string[];
  variableCount: number;
  methodCallCount: number;
  conditionalCount: number;
  complexityLevel: string;
}

export interface ExpressionExecutionRequest {
  expressionId: string;
  variables: Record<string, any>;
  executionContext?: string;
  contextEntityId?: string;
}

export interface ExpressionExecutionResponse {
  success: boolean;
  result?: any;
  resultType?: string;
  executionTimeMs: number;
  memoryUsedKB: number;
  errorMessage?: string;
  executedAt: string;
}

export interface ExpressionTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;
  expressionTemplate: string;
  sampleExpression: string;
  contextType: string;
  returnType: string;
  usageInstructions?: string;
  isBuiltIn: boolean;
  sortOrder: number;
  templateVariables: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpressionExecutionLog {
  id: string;
  expressionDefinitionId: string;
  tenantId: string;
  userId?: string;
  executionContext: string;
  contextEntityId?: string;
  resultType: string;
  executionStartTime: string;
  executionEndTime: string;
  executionTimeMs: number;
  memoryUsedKB: number;
  success: boolean;
  errorMessage?: string;
  stackTrace?: string;
  executedAt: string;
  userAgent?: string;
  ipAddress?: string;
  inputVariables: Record<string, any>;
  executionResult: Record<string, any>;
}

export interface BankingFunction {
  name: string;
  description: string;
  category: string;
  parameters: BankingFunctionParameter[];
  returnType: string;
  examples: string[];
}

export interface BankingFunctionParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
}

// Expression Builder UI State
export interface ExpressionBuilderState {
  expressions: ExpressionDefinition[];
  templates: ExpressionTemplate[];
  bankingFunctions: BankingFunction[];
  currentExpression?: ExpressionDefinition;
  isLoading: boolean;
  error?: string;
  validationResult?: ExpressionValidationResponse;
  executionResult?: ExpressionExecutionResponse;
}

// API Response Types
export interface ExpressionListResponse {
  expressions: ExpressionDefinition[];
  pagination: {
    page: number;
    pageSize: number;
    hasNext: boolean;
    total: number;
  };
}

export interface ExecutionHistoryResponse {
  executionLogs: ExpressionExecutionLog[];
  pagination: {
    page: number;
    pageSize: number;
    hasNext: boolean;
  };
}

// Filter and Search Types
export interface ExpressionFilters {
  category?: string;
  status?: string;
  contextType?: string;
  usageType?: string;
  tags?: string[];
  search?: string;
}

export interface ExpressionSortOptions {
  field: 'name' | 'category' | 'createdAt' | 'updatedAt' | 'totalExecutions';
  direction: 'asc' | 'desc';
}

// Constants
export const EXPRESSION_CATEGORIES = [
  'Validation',
  'Calculation',
  'Risk Assessment',
  'Loan Management',
  'Account Management',
  'Transaction Processing',
  'Compliance',
  'Reporting',
  'Customer Management'
] as const;

export const CONTEXT_TYPES = [
  'Customer',
  'Account',
  'Transaction',
  'Loan',
  'General'
] as const;

export const RETURN_TYPES = [
  'boolean',
  'decimal',
  'integer',
  'string',
  'datetime',
  'object'
] as const;

export const USAGE_TYPES = [
  'Validation',
  'Calculation',
  'Transform',
  'Filter',
  'Decision'
] as const;

export const EXPRESSION_STATUSES = [
  'Draft',
  'Active',
  'Approved',
  'Inactive',
  'Deleted'
] as const;

export type ExpressionCategory = typeof EXPRESSION_CATEGORIES[number];
export type ContextType = typeof CONTEXT_TYPES[number];
export type ReturnType = typeof RETURN_TYPES[number];
export type UsageType = typeof USAGE_TYPES[number];
export type ExpressionStatus = typeof EXPRESSION_STATUSES[number];
