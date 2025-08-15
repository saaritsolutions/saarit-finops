import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Chip,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon,
  Help as HelpIcon,
  Functions as FunctionsIcon
} from '@mui/icons-material';

// Banking function definitions
const BANKING_FUNCTIONS = [
  {
    category: 'Account Operations',
    functions: [
      {
        name: 'GetAccountBalance',
        signature: 'GetAccountBalance(string accountNumber)',
        description: 'Retrieves the current balance for the specified account',
        returnType: 'decimal',
        example: 'banking.GetAccountBalance("ACC123456")',
        parameters: [
          { name: 'accountNumber', type: 'string', description: 'The account number to check' }
        ]
      },
      {
        name: 'IsAccountActive',
        signature: 'IsAccountActive(string accountNumber)',
        description: 'Checks if the account is active and operational',
        returnType: 'boolean',
        example: 'banking.IsAccountActive(account.AccountNumber)',
        parameters: [
          { name: 'accountNumber', type: 'string', description: 'The account number to check' }
        ]
      },
      {
        name: 'GetAccountType',
        signature: 'GetAccountType(string accountNumber)',
        description: 'Returns the type of the account (SAVINGS, CURRENT, etc.)',
        returnType: 'string',
        example: 'banking.GetAccountType(account.AccountNumber)',
        parameters: [
          { name: 'accountNumber', type: 'string', description: 'The account number to check' }
        ]
      }
    ]
  },
  {
    category: 'Interest Calculations',
    functions: [
      {
        name: 'CalculateSimpleInterest',
        signature: 'CalculateSimpleInterest(decimal principal, decimal rate, int days)',
        description: 'Calculates simple interest for given principal, rate, and days',
        returnType: 'decimal',
        example: 'banking.CalculateSimpleInterest(10000m, 5.5m, 30)',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Principal amount' },
          { name: 'rate', type: 'decimal', description: 'Annual interest rate percentage' },
          { name: 'days', type: 'int', description: 'Number of days' }
        ]
      },
      {
        name: 'CalculateCompoundInterest',
        signature: 'CalculateCompoundInterest(decimal principal, decimal rate, int periods)',
        description: 'Calculates compound interest',
        returnType: 'decimal',
        example: 'banking.CalculateCompoundInterest(10000m, 5.5m, 12)',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Principal amount' },
          { name: 'rate', type: 'decimal', description: 'Annual interest rate percentage' },
          { name: 'periods', type: 'int', description: 'Number of compounding periods per year' }
        ]
      },
      {
        name: 'CalculateEMI',
        signature: 'CalculateEMI(decimal principal, decimal rate, int months)',
        description: 'Calculates EMI for loan',
        returnType: 'decimal',
        example: 'banking.CalculateEMI(500000m, 8.5m, 60)',
        parameters: [
          { name: 'principal', type: 'decimal', description: 'Loan amount' },
          { name: 'rate', type: 'decimal', description: 'Annual interest rate percentage' },
          { name: 'months', type: 'int', description: 'Loan tenure in months' }
        ]
      }
    ]
  },
  {
    category: 'Risk Assessment',
    functions: [
      {
        name: 'CalculateRiskScore',
        signature: 'CalculateRiskScore(Guid customerId, decimal amount)',
        description: 'Calculates risk score for customer and transaction amount',
        returnType: 'decimal',
        example: 'banking.CalculateRiskScore(customer.CustomerId, 50000m)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' },
          { name: 'amount', type: 'decimal', description: 'Transaction amount' }
        ]
      },
      {
        name: 'IsHighRiskCustomer',
        signature: 'IsHighRiskCustomer(Guid customerId)',
        description: 'Checks if customer is flagged as high risk',
        returnType: 'boolean',
        example: 'banking.IsHighRiskCustomer(customer.CustomerId)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' }
        ]
      },
      {
        name: 'GetCreditScore',
        signature: 'GetCreditScore(Guid customerId)',
        description: 'Retrieves customer credit score',
        returnType: 'int',
        example: 'banking.GetCreditScore(customer.CustomerId)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' }
        ]
      }
    ]
  },
  {
    category: 'Loan Management',
    functions: [
      {
        name: 'IsEligibleForLoan',
        signature: 'IsEligibleForLoan(Guid customerId, decimal amount, string loanType)',
        description: 'Checks loan eligibility for customer',
        returnType: 'boolean',
        example: 'banking.IsEligibleForLoan(customer.CustomerId, 100000m, "PERSONAL")',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' },
          { name: 'amount', type: 'decimal', description: 'Requested loan amount' },
          { name: 'loanType', type: 'string', description: 'Type of loan (PERSONAL, HOME, AUTO, etc.)' }
        ]
      },
      {
        name: 'IsLoanDefaulter',
        signature: 'IsLoanDefaulter(Guid customerId)',
        description: 'Checks if customer has any loan defaults',
        returnType: 'boolean',
        example: 'banking.IsLoanDefaulter(customer.CustomerId)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' }
        ]
      },
      {
        name: 'GetOutstandingLoans',
        signature: 'GetOutstandingLoans(Guid customerId)',
        description: 'Gets total outstanding loan amount for customer',
        returnType: 'decimal',
        example: 'banking.GetOutstandingLoans(customer.CustomerId)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' }
        ]
      }
    ]
  },
  {
    category: 'Transaction Validation',
    functions: [
      {
        name: 'IsTransactionLimitExceeded',
        signature: 'IsTransactionLimitExceeded(decimal amount, string transactionType, string accountNumber)',
        description: 'Checks if transaction exceeds daily/monthly limits',
        returnType: 'boolean',
        example: 'banking.IsTransactionLimitExceeded(25000m, "TRANSFER", account.AccountNumber)',
        parameters: [
          { name: 'amount', type: 'decimal', description: 'Transaction amount' },
          { name: 'transactionType', type: 'string', description: 'Type of transaction' },
          { name: 'accountNumber', type: 'string', description: 'Account number' }
        ]
      },
      {
        name: 'IsTransactionTimeValid',
        signature: 'IsTransactionTimeValid(DateTime transactionTime)',
        description: 'Validates transaction timing against business hours',
        returnType: 'boolean',
        example: 'banking.IsTransactionTimeValid(DateTime.UtcNow)',
        parameters: [
          { name: 'transactionTime', type: 'DateTime', description: 'Transaction timestamp' }
        ]
      },
      {
        name: 'ValidateTransactionChannel',
        signature: 'ValidateTransactionChannel(string channel, decimal amount)',
        description: 'Validates if transaction channel supports the amount',
        returnType: 'boolean',
        example: 'banking.ValidateTransactionChannel("ATM", 10000m)',
        parameters: [
          { name: 'channel', type: 'string', description: 'Transaction channel (ATM, INTERNET, MOBILE, etc.)' },
          { name: 'amount', type: 'decimal', description: 'Transaction amount' }
        ]
      }
    ]
  },
  {
    category: 'Compliance & Regulatory',
    functions: [
      {
        name: 'IsKYCCompliant',
        signature: 'IsKYCCompliant(Guid customerId)',
        description: 'Checks if customer KYC is complete and valid',
        returnType: 'boolean',
        example: 'banking.IsKYCCompliant(customer.CustomerId)',
        parameters: [
          { name: 'customerId', type: 'Guid', description: 'Customer unique identifier' }
        ]
      },
      {
        name: 'RequiresAMLCheck',
        signature: 'RequiresAMLCheck(decimal amount, string transactionType)',
        description: 'Checks if transaction requires AML verification',
        returnType: 'boolean',
        example: 'banking.RequiresAMLCheck(50000m, "CASH_DEPOSIT")',
        parameters: [
          { name: 'amount', type: 'decimal', description: 'Transaction amount' },
          { name: 'transactionType', type: 'string', description: 'Type of transaction' }
        ]
      },
      {
        name: 'GetRegulatoryLimit',
        signature: 'GetRegulatoryLimit(string limitType, string customerType)',
        description: 'Gets regulatory limits for customer type',
        returnType: 'decimal',
        example: 'banking.GetRegulatoryLimit("DAILY_CASH_WITHDRAWAL", "INDIVIDUAL")',
        parameters: [
          { name: 'limitType', type: 'string', description: 'Type of limit' },
          { name: 'customerType', type: 'string', description: 'Customer type (INDIVIDUAL, CORPORATE, etc.)' }
        ]
      }
    ]
  }
];

interface BankingFunction {
  name: string;
  signature: string;
  description: string;
  returnType: string;
  example: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

interface BankingFunctionCategory {
  category: string;
  functions: BankingFunction[];
}

interface BankingFunctionsProps {
  onInsertFunction?: (functionCall: string) => void;
}

export const BankingFunctions: React.FC<BankingFunctionsProps> = ({ onInsertFunction }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFunction, setSelectedFunction] = React.useState<BankingFunction | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = React.useState(false);

  const filteredFunctions = React.useMemo(() => {
    if (!searchQuery) return BANKING_FUNCTIONS;

    return BANKING_FUNCTIONS.map(category => ({
      ...category,
      functions: category.functions.filter(func =>
        func.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        func.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(category => category.functions.length > 0);
  }, [searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const insertFunction = (func: BankingFunction) => {
    if (onInsertFunction) {
      onInsertFunction(func.example);
    }
  };

  const openFunctionHelp = (func: BankingFunction) => {
    setSelectedFunction(func);
    setHelpDialogOpen(true);
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <FunctionsIcon color="primary" />
        <Typography variant="h6">Banking Functions Library</Typography>
      </Box>

      <TextField
        fullWidth
        placeholder="Search functions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
        sx={{ mb: 3 }}
      />

      {filteredFunctions.map((category) => (
        <Accordion key={category.category} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" color="primary">
              {category.category}
            </Typography>
            <Chip 
              label={category.functions.length} 
              size="small" 
              sx={{ ml: 2 }}
            />
          </AccordionSummary>
          <AccordionDetails>
            <Box display="flex" flexDirection="column" gap={2}>
              {category.functions.map((func) => (
                <Card key={func.name} variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" color="primary">
                        {func.name}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Tooltip title="Copy example">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(func.example)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View details">
                          <IconButton 
                            size="small" 
                            onClick={() => openFunctionHelp(func)}
                          >
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {func.description}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Typography variant="caption" color="text.secondary">
                        Returns:
                      </Typography>
                      <Chip label={func.returnType} size="small" variant="outlined" />
                    </Box>

                    <Box 
                      sx={{ 
                        backgroundColor: 'grey.100', 
                        p: 1.5, 
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        mb: 2
                      }}
                    >
                      {func.signature}
                    </Box>

                    <Box 
                      sx={{ 
                        backgroundColor: 'primary.50', 
                        p: 1.5, 
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        mb: 2
                      }}
                    >
                      {func.example}
                    </Box>

                    {onInsertFunction && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => insertFunction(func)}
                        startIcon={<ContentCopyIcon />}
                      >
                        Insert Function
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Function Details Dialog */}
      <Dialog 
        open={helpDialogOpen} 
        onClose={() => setHelpDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedFunction?.name} - Function Details
        </DialogTitle>
        <DialogContent>
          {selectedFunction && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {selectedFunction.description}
              </Typography>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Signature
              </Typography>
              <Box 
                sx={{ 
                  backgroundColor: 'grey.100', 
                  p: 2, 
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {selectedFunction.signature}
              </Box>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Parameters
              </Typography>
              {selectedFunction.parameters.map((param) => (
                <Box key={param.name} sx={{ mb: 1 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="bold">
                      {param.name}
                    </Typography>
                    <Chip label={param.type} size="small" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {param.description}
                  </Typography>
                </Box>
              ))}

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Example Usage
              </Typography>
              <Box 
                sx={{ 
                  backgroundColor: 'primary.50', 
                  p: 2, 
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {selectedFunction.example}
              </Box>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Return Type
              </Typography>
              <Chip label={selectedFunction.returnType} variant="outlined" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedFunction && onInsertFunction && (
            <Button
              variant="contained"
              onClick={() => {
                insertFunction(selectedFunction);
                setHelpDialogOpen(false);
              }}
              startIcon={<ContentCopyIcon />}
            >
              Insert Function
            </Button>
          )}
          <Button onClick={() => setHelpDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {filteredFunctions.length === 0 && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">
            No functions found matching "{searchQuery}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default BankingFunctions;
