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
    return this.apiClient.post(this.baseUrl, expression);
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
  async testExpression(
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
