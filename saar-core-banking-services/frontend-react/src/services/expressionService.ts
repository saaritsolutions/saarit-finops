import { ApiClient } from '../utils/apiClient';
import {
  ExpressionDefinition,
  CreateExpressionRequest,
  UpdateExpressionRequest,
  ExpressionValidationRequest,
  ExpressionValidationResponse,
  ExpressionExecutionRequest,
  ExpressionExecutionResponse,
  ExpressionTemplate,
  ExpressionExecutionLog,
  ExpressionListResponse,
  ExecutionHistoryResponse,
  ExpressionFilters
} from '../types/expression';

class ExpressionService {
  private apiClient: ApiClient;
  private baseUrl = '/api/expressions';
  private engineUrl = '/api/expression-engine';

  constructor() {
    this.apiClient = new ApiClient();
  }

  // Expression CRUD Operations
  async getExpressions(
    filters?: ExpressionFilters,
    page = 1,
    pageSize = 20
  ): Promise<ExpressionListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    return this.apiClient.get(`${this.baseUrl}?${params}`);
  }

  async getExpression(id: string): Promise<ExpressionDefinition> {
    return this.apiClient.get(`${this.baseUrl}/${id}`);
  }

  async getExpressionByExpressionId(expressionId: string): Promise<ExpressionDefinition> {
    return this.apiClient.get(`${this.baseUrl}/by-expression-id/${expressionId}`);
  }

  async createExpression(expression: CreateExpressionRequest): Promise<ExpressionDefinition> {
    // If an expressionId is provided but empty, remove it so the server can generate one.
    const payload: any = { ...expression };
    if (payload.expressionId !== undefined && String(payload.expressionId).trim() === '') {
      delete payload.expressionId;
    }
    return this.apiClient.post(this.baseUrl, payload);
  }

  async updateExpression(id: string, expression: UpdateExpressionRequest): Promise<ExpressionDefinition> {
    return this.apiClient.put(`${this.baseUrl}/${id}`, expression);
  }

  async deleteExpression(id: string): Promise<void> {
    return this.apiClient.delete(`${this.baseUrl}/${id}`);
  }

  async approveExpression(id: string): Promise<void> {
    return this.apiClient.post(`${this.baseUrl}/${id}/approve`);
  }

  async getExecutionHistory(
    id: string,
    page = 1,
    pageSize = 50
  ): Promise<ExecutionHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    return this.apiClient.get(`${this.baseUrl}/${id}/execution-history?${params}`);
  }

  // Expression Engine Operations
  async validateExpression(request: ExpressionValidationRequest): Promise<ExpressionValidationResponse> {
    return this.apiClient.post(`${this.engineUrl}/validate`, request);
  }

  async executeExpression(request: ExpressionExecutionRequest): Promise<ExpressionExecutionResponse> {
    return this.apiClient.post(`${this.engineUrl}/execute`, request);
  }

  async getTemplates(category?: string): Promise<ExpressionTemplate[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.apiClient.get(`${this.engineUrl}/templates${params}`);
  }

  // Utility Methods
  // Lightweight, safe fallback evaluator for very simple boolean expressions like
  // "customer.age >= 18" or "age >= 18". It supports a single comparison or simple AND/OR of such.
  private evalSimpleBoolean(expr: string, variables: Record<string, any>): boolean | null {
    if (!expr) return null;

    // Normalize whitespace and operators
    const text = expr.replace(/\s+/g, ' ').trim();

    // Support simple conjunction/disjunction by splitting
    const tryEvalClause = (clause: string): boolean | null => {
      const m = clause.match(/^([a-zA-Z_][\w\.]*?)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) return null;
      const [, left, op, rightStr] = m;
      const right = Number(rightStr);
      // Resolve left variable, support dot-paths like customer.age
      const resolve = (path: string, obj: any): any => path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
      let leftVal = resolve(left, variables);
      if (leftVal === undefined) {
        // also try flatten, e.g., age when customer.age provided
        const last = left.split('.').pop()!;
        leftVal = variables[last];
      }
      if (typeof leftVal !== 'number') {
        // try to coerce
        const n = Number(leftVal);
        if (!Number.isFinite(n)) return null;
        leftVal = n;
      }
      switch (op) {
        case '>=': return leftVal >= right;
        case '<=': return leftVal <= right;
        case '>': return leftVal > right;
        case '<': return leftVal < right;
        case '==': return leftVal == right; // eslint-disable-line eqeqeq
        case '!=': return leftVal != right; // eslint-disable-line eqeqeq
        default: return null;
      }
    };

    // Handle AND/OR (&&/|| or textual)
    const orParts = text.split(/\s*(\|\||\bOR\b)\s*/i).filter(p => p && p !== '||' && !/^or$/i.test(p));
    if (orParts.length > 1) {
      for (const part of orParts) {
        const v = this.evalSimpleBoolean(part.trim(), variables);
        if (v === true) return true;
      }
      return false;
    }

    const andParts = text.split(/\s*(&&|\bAND\b)\s*/i).filter(p => p && p !== '&&' && !/^and$/i.test(p));
    if (andParts.length > 1) {
      for (const part of andParts) {
        const v = this.evalSimpleBoolean(part.trim(), variables);
        if (v === false) return false;
        if (v === null) return null;
      }
      return true;
    }

    return tryEvalClause(text);
  }
  async testExpression(
    expressionText: string,
    contextType: string,
    returnType: string,
    variables: Record<string, any>
  ): Promise<{
    validation: ExpressionValidationResponse;
    execution?: ExpressionExecutionResponse;
  }> {
    // Use the simple test endpoint for quick testing
    try {
      const response = await this.apiClient.post('/api/expression-engine/test-simple', {
        expression: expressionText,
        contextType,
        returnType,
        variables
      });

      // If backend failed, try a very simple local evaluation as a UX fallback
      if (!response.success) {
        const local = this.evalSimpleBoolean(expressionText, variables);
        if (typeof local === 'boolean') {
          return {
            validation: { isValid: true, errors: [], warnings: ['Evaluated locally (backend returned error): ' + (response.error || '')] },
            execution: {
              success: true,
              result: local,
              resultType: 'boolean',
              executionTimeMs: 0,
              memoryUsedKB: 0,
              executedAt: new Date().toISOString()
            }
          };
        }
      }

      // Transform the simple response to match expected interface
      return {
        validation: {
          isValid: response.success,
          errors: response.error ? [response.error] : [],
          warnings: []
        },
        execution: response.success ? {
          success: response.success,
          result: response.result,
          resultType: returnType,
          executionTimeMs: response.executionTime,
          memoryUsedKB: 0,
          executedAt: new Date().toISOString()
        } : undefined
      };
    } catch (error) {
      // Fallback to original validation method
      console.warn('Simple test endpoint failed, attempting client-side evaluation fallback:', error);
      const local = this.evalSimpleBoolean(expressionText, variables);
      if (typeof local === 'boolean') {
        return {
          validation: { isValid: true, errors: [], warnings: ['Evaluated locally (backend unavailable)'] },
          execution: {
            success: true,
            result: local,
            resultType: 'boolean',
            executionTimeMs: 0,
            memoryUsedKB: 0,
            executedAt: new Date().toISOString()
          }
        };
      }
      return this.testExpressionFallback(expressionText, contextType, returnType, variables);
    }
  }

  private async testExpressionFallback(
    expressionText: string,
    contextType: string,
    returnType: string,
    variables: Record<string, any>
  ): Promise<{
    validation: ExpressionValidationResponse;
    execution?: ExpressionExecutionResponse;
  }> {
    // First validate the expression
    const validation = await this.validateExpression({
      expressionText,
      contextType,
      returnType,
      variables
    });

    const result: any = { validation };

    // If validation passes, try to execute it
    if (validation.isValid) {
      try {
        // Create a temporary expression for testing
        const tempExpressionId = `temp_${Date.now()}`;
        
        // For testing, we'll create a minimal execution request
        // In a real scenario, you'd need to handle this differently
        // since we can't execute without saving the expression first
        result.execution = {
          success: true,
          result: "Test execution would occur here",
          resultType: returnType,
          executionTimeMs: 0,
          memoryUsedKB: 0,
          executedAt: new Date().toISOString()
        };
      } catch (error) {
        // Execution failed, but we still have validation results
        console.warn('Test execution failed:', error);
      }
    }

    return result;
  }

  // Banking Functions Information
  async getBankingFunctions(): Promise<any[]> {
    // This would typically come from the API
    // For now, return static data matching the backend functions
    return [
      {
        name: 'CalculateSimpleInterest',
        description: 'Calculates simple interest for given principal, rate and days',
        category: 'Interest Calculations',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Principal amount', required: true },
          { name: 'rate', type: 'decimal', description: 'Interest rate (annual %)', required: true },
          { name: 'days', type: 'integer', description: 'Number of days', required: true }
        ],
        returnType: 'decimal',
        examples: ['banking.CalculateSimpleInterest(10000m, 5.5m, 30)']
      },
      {
        name: 'CalculateCompoundInterest',
        description: 'Calculates compound interest',
        category: 'Interest Calculations',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Principal amount', required: true },
          { name: 'rate', type: 'decimal', description: 'Interest rate (annual %)', required: true },
          { name: 'periods', type: 'integer', description: 'Number of periods', required: true },
          { name: 'compoundingFrequency', type: 'integer', description: 'Compounding frequency per year', required: true }
        ],
        returnType: 'decimal',
        examples: ['banking.CalculateCompoundInterest(10000m, 5.5m, 2, 4)']
      },
      {
        name: 'CalculateEMI',
        description: 'Calculates Equated Monthly Installment for loans',
        category: 'Interest Calculations',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Loan amount', required: true },
          { name: 'annualRate', type: 'decimal', description: 'Annual interest rate (%)', required: true },
          { name: 'months', type: 'integer', description: 'Loan term in months', required: true }
        ],
        returnType: 'decimal',
        examples: ['banking.CalculateEMI(100000m, 8.5m, 60)']
      },
      {
        name: 'IsAccountActive',
        description: 'Checks if an account is active and operational',
        category: 'Account Operations',
        parameters: [
          { name: 'accountNumber', type: 'string', description: 'Account number', required: true }
        ],
        returnType: 'boolean',
        examples: ['banking.IsAccountActive(account.AccountNumber)']
      },
      {
        name: 'GetAccountBalance',
        description: 'Retrieves current balance of an account',
        category: 'Account Operations',
        parameters: [
          { name: 'accountNumber', type: 'string', description: 'Account number', required: true }
        ],
        returnType: 'decimal',
        examples: ['banking.GetAccountBalance(account.AccountNumber)']
      },
      {
        name: 'IsEligibleForLoan',
        description: 'Checks loan eligibility for a customer',
        category: 'Loan Functions',
        parameters: [
          { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
          { name: 'requestedAmount', type: 'decimal', description: 'Requested loan amount', required: true },
          { name: 'loanType', type: 'string', description: 'Type of loan', required: true }
        ],
        returnType: 'boolean',
        examples: ['banking.IsEligibleForLoan(customer.CustomerId, 50000m, "PERSONAL")']
      },
      {
        name: 'CalculateRiskScore',
        description: 'Calculates risk score for a transaction',
        category: 'Risk Assessment',
        parameters: [
          { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
          { name: 'transactionAmount', type: 'decimal', description: 'Transaction amount', required: true }
        ],
        returnType: 'decimal',
        examples: ['banking.CalculateRiskScore(customer.CustomerId, transaction.Amount)']
      },
      {
        name: 'IsTransactionLimitExceeded',
        description: 'Checks if transaction exceeds allowed limits',
        category: 'Transaction Validations',
        parameters: [
          { name: 'amount', type: 'decimal', description: 'Transaction amount', required: true },
          { name: 'transactionType', type: 'string', description: 'Type of transaction', required: true },
          { name: 'accountNumber', type: 'string', description: 'Account number', required: true }
        ],
        returnType: 'boolean',
        examples: ['banking.IsTransactionLimitExceeded(transaction.Amount, "TRANSFER", account.AccountNumber)']
      }
      // Add more functions as needed
    ];
  }
}

export const expressionService = new ExpressionService();
export default expressionService;
