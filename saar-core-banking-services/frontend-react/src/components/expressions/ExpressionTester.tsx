import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { JsonEditor } from '../common/JsonEditor';
import { CodeEditor } from '../common/CodeEditor';
import { expressionService } from '../../services/expressionService';
import {
  ExpressionDefinition,
  ExecutionRequest,
  ExecutionResponse,
  ValidationResponse
} from '../../types/expression';

interface ExpressionTesterProps {
  expression?: ExpressionDefinition;
}

export const ExpressionTester: React.FC<ExpressionTesterProps> = ({ expression }) => {
  const [testExpression, setTestExpression] = useState<string>(expression?.expressionText || '');
  const [inputVariables, setInputVariables] = useState<Record<string, any>>({});
  const [executionResult, setExecutionResult] = useState<ExecutionResponse | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResponse[]>([]);

  // Sample context data for different types
  const getSampleContext = (contextType: string) => {
    switch (contextType) {
      case 'Customer':
        return {
          customer: {
            customerId: 'CUST001',
            age: 35,
            kycStatus: 'COMPLETED',
            accountOpenDate: '2020-01-15',
            totalRelationshipValue: 150000,
            riskRating: 'LOW',
            isVip: false,
            monthlyIncome: 75000,
            employmentType: 'SALARIED'
          }
        };
      case 'Account':
        return {
          account: {
            accountNumber: 'ACC123456789',
            accountType: 'SAVINGS',
            balance: 25000,
            minimumBalance: 5000,
            openDate: '2020-03-01',
            status: 'ACTIVE',
            interestRate: 3.5,
            lastTransactionDate: '2024-01-20'
          }
        };
      case 'Transaction':
        return {
          transaction: {
            transactionId: 'TXN001',
            amount: 15000,
            transactionType: 'TRANSFER',
            fromAccount: 'ACC123456789',
            toAccount: 'ACC987654321',
            timestamp: '2024-01-20T14:30:00Z',
            description: 'Fund Transfer',
            channel: 'MOBILE'
          },
          customer: {
            customerId: 'CUST001',
            age: 35,
            riskRating: 'LOW'
          }
        };
      case 'Loan':
        return {
          loan: {
            loanId: 'LOAN001',
            amount: 500000,
            rate: 8.5,
            term: 240,
            loanType: 'HOME_LOAN',
            status: 'ACTIVE',
            disbursementDate: '2023-06-01',
            nextDueDate: '2024-02-01',
            outstandingAmount: 485000
          },
          customer: {
            customerId: 'CUST001',
            age: 35,
            monthlyIncome: 75000
          }
        };
      default:
        return {};
    }
  };

  const loadSampleData = () => {
    const contextType = expression?.contextType || 'General';
    const sampleData = getSampleContext(contextType);
    setInputVariables(sampleData);
  };

  const validateExpression = async () => {
    if (!testExpression.trim()) return;

    setIsValidating(true);
    try {
      const result = await expressionService.validateExpression({
        expressionText: testExpression,
        contextType: expression?.contextType || 'General',
        returnType: expression?.returnType || 'boolean',
        variables: inputVariables
      });
      
      // Map to our internal ValidationResponse type
      setValidationResult({
        isValid: result.isValid,
        errors: result.errors || [],
        warnings: result.warnings || [],
        usedFunctions: [], // Not provided by current API
        dependencies: [] // Not provided by current API
      });
    } catch (error) {
      setValidationResult({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: [],
        usedFunctions: [],
        dependencies: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  const executeExpression = async () => {
    if (!testExpression.trim()) return;

    setIsExecuting(true);
    try {
      const request = {
        expressionId: 'test-expression',
        variables: inputVariables
      };

      const result = await expressionService.executeExpression(request);
      
      // Map to our internal ExecutionResponse type
      const mappedResult: ExecutionResponse = {
        success: result.success,
        result: result.result || null,
        resultType: result.resultType || 'unknown',
        executionTimeMs: result.executionTimeMs || 0,
        errorMessage: result.errorMessage
      };
      
      setExecutionResult(mappedResult);
      
      // Add to history
      setExecutionHistory(prev => [mappedResult, ...prev.slice(0, 4)]); // Keep last 5
    } catch (error) {
      const errorResult: ExecutionResponse = {
        success: false,
        result: null,
        resultType: 'error',
        executionTimeMs: 0,
        errorMessage: error instanceof Error ? error.message : 'Execution failed',
        stackTrace: error instanceof Error ? error.stack : undefined
      };
      setExecutionResult(errorResult);
    } finally {
      setIsExecuting(false);
    }
  };

  const copyResult = () => {
    if (executionResult?.result !== undefined) {
      navigator.clipboard.writeText(JSON.stringify(executionResult.result, null, 2));
    }
  };

  const clearResults = () => {
    setExecutionResult(null);
    setValidationResult(null);
  };

  React.useEffect(() => {
    if (testExpression.trim()) {
      const timeoutId = setTimeout(validateExpression, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [testExpression]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Expression Tester
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Test expressions with sample data or custom input variables. 
        Validation runs automatically as you type.
      </Typography>

      {/* Expression Input */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Expression</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <CodeEditor
            value={testExpression}
            onChange={setTestExpression}
            language="csharp"
            height="120px"
            placeholder="Enter your C# expression here..."
          />
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Validate Expression">
              <IconButton 
                onClick={validateExpression} 
                disabled={isValidating || !testExpression.trim()}
                color="primary"
              >
                {isValidating ? <CircularProgress size={20} /> : <PlayIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Execute Expression">
              <IconButton 
                onClick={executeExpression} 
                disabled={isExecuting || !testExpression.trim() || (validationResult?.isValid === false)}
                color="success"
              >
                {isExecuting ? <CircularProgress size={20} /> : <PlayIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Clear Results">
              <IconButton onClick={clearResults}>
                <ClearIcon />
              </IconButton>
            </Tooltip>

            <Box sx={{ ml: 'auto' }}>
              <Chip 
                label={expression?.contextType || 'General'} 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={expression?.returnType || 'boolean'} 
                size="small" 
                variant="outlined" 
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Validation Results */}
      {validationResult && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Validation Results</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Alert 
              severity={validationResult.isValid ? 'success' : 'error'}
              sx={{ mb: 2 }}
            >
              {validationResult.isValid ? 'Expression is valid' : 'Expression has errors'}
            </Alert>

            {validationResult.errors.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="error">Errors:</Typography>
                {validationResult.errors.map((error, index) => (
                  <Typography key={index} variant="body2" color="error" sx={{ ml: 1 }}>
                    • {error}
                  </Typography>
                ))}
              </Box>
            )}

            {validationResult.warnings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="warning.main">Warnings:</Typography>
                {validationResult.warnings.map((warning, index) => (
                  <Typography key={index} variant="body2" color="warning.main" sx={{ ml: 1 }}>
                    • {warning}
                  </Typography>
                ))}
              </Box>
            )}

            {validationResult.usedFunctions.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Banking Functions Used:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {validationResult.usedFunctions.map((func, index) => (
                    <Chip key={index} label={func} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Input Variables */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Input Variables</Typography>
          <Tooltip title="Load Sample Data">
            <IconButton onClick={loadSampleData} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ p: 2 }}>
          <JsonEditor
            value={inputVariables}
            onChange={setInputVariables}
            height="200px"
            placeholder="Enter input variables as JSON..."
          />
        </Box>
      </Paper>

      {/* Execution Results */}
      {executionResult && (
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Execution Result</Typography>
            <Tooltip title="Copy Result">
              <IconButton onClick={copyResult} size="small">
                <CopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ p: 2 }}>
            <Alert 
              severity={executionResult.success ? 'success' : 'error'}
              sx={{ mb: 2 }}
            >
              {executionResult.success ? 'Expression executed successfully' : 'Execution failed'}
            </Alert>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip 
                label={`Time: ${executionResult.executionTimeMs}ms`} 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={`Type: ${executionResult.resultType}`} 
                size="small" 
                variant="outlined" 
              />
            </Box>

            {executionResult.success ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Result:</Typography>
                <CodeEditor
                  value={JSON.stringify(executionResult.result, null, 2)}
                  language="json"
                  height="100px"
                  readOnly={true}
                />
              </Box>
            ) : (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error: {executionResult.errorMessage}
                </Typography>
                {executionResult.stackTrace && (
                  <CodeEditor
                    value={executionResult.stackTrace}
                    language="text"
                    height="120px"
                    readOnly={true}
                  />
                )}
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Recent Executions</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {executionHistory.map((result, index) => (
              <Box key={index} sx={{ mb: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip 
                    label={result.success ? 'Success' : 'Failed'} 
                    size="small" 
                    color={result.success ? 'success' : 'error'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {result.executionTimeMs}ms
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Result: {JSON.stringify(result.result)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ExpressionTester;
