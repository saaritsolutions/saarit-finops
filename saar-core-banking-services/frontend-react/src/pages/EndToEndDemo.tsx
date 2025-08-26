import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
  SmartToy as SmartToyIcon,
  Rule as RuleIcon,
  Assessment as AssessmentIcon,
  AccountBalance as AccountBalanceIcon,
} from '@mui/icons-material';
import { expressionService } from '../services/expressionService';

interface RuleTestResult {
  passed: boolean | null; // null when execution didn't run
  result: any;
  executionTime: number;
  error?: string;
}

interface CustomerScenario {
  id: string;
  name: string;
  age: number;
  accountBalance: number;
  creditScore: number;
  monthlyIncome: number;
  hasExistingLoan: boolean;
  employmentYears: number;
  accountType: string;
  riskCategory: string;
}

const EndToEndDemo: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedRule, setGeneratedRule] = useState('');
  const [ruleExplanation, setRuleExplanation] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [testResults, setTestResults] = useState<RuleTestResult[]>([]);
  const [scenarioResults, setScenarioResults] = useState<any[]>([]);
  const [normalizedRule, setNormalizedRule] = useState('');

  // Infer backend context type from the expression used (Customer/Account/Transaction/Loan)
  const detectContextType = (expr: string): string => {
    if (!expr) return 'Customer';
    const e = expr.toLowerCase();
    if (e.includes('customer.')) return 'Customer';
    if (e.includes('account.')) return 'Account';
    if (e.includes('transaction.')) return 'Transaction';
    if (e.includes('loan.')) return 'Loan';
    return 'Customer'; // safe default for most demos
  };

  const steps = [
    'Define Business Requirement',
    'Generate Rule with AI',
    'Test Rule Logic',
    'Apply to Real Scenarios',
    'View Results & Analysis'
  ];

  // Normalize expression to match backend context expectations
  const normalizeExpression = (expr: string, contextType: string): string => {
    if (!expr) return expr;
    let out = expr.trim();
    if (contextType === 'Customer') {
      // 1) Normalize already-prefixed properties to correct casing
      const customerPropFixes: Array<[RegExp, string]> = [
        [/\bcustomer\.Age\b/g, 'customer.age'],
        [/\bcustomer\.CreditScore\b/g, 'customer.creditScore'],
        [/\bcustomer\.MonthlyIncome\b/g, 'customer.monthlyIncome'],
        [/\bcustomer\.EmploymentYears\b/g, 'customer.employmentYears'],
        [/\bcustomer\.HasExistingLoan\b/g, 'customer.hasExistingLoan']
      ];
      for (const [pattern, repl] of customerPropFixes) out = out.replace(pattern, repl);

      // 2) If not using customer. anywhere, prefix common fields (case-insensitive)
      if (!/\bcustomer\./i.test(out)) {
        const replacements: Array<[RegExp, string]> = [
          [/\bage\b/gi, 'customer.age'],
          [/\bcreditscore\b/gi, 'customer.creditScore'],
          [/\bmonthlyincome\b/gi, 'customer.monthlyIncome'],
          [/\bemploymentyears\b/gi, 'customer.employmentYears'],
          [/\bhasexistingloan\b/gi, 'customer.hasExistingLoan']
        ];
        for (const [pattern, repl] of replacements) out = out.replace(pattern, repl);
      }
    }
    return out;
  };

  const sampleScenarios: CustomerScenario[] = [
    {
      id: 'CUST001',
      name: 'John Smith',
      age: 25,
      accountBalance: 15000,
      creditScore: 720,
      monthlyIncome: 4500,
      hasExistingLoan: false,
      employmentYears: 3,
      accountType: 'Savings',
      riskCategory: 'Low'
    },
    {
      id: 'CUST002',
      name: 'Sarah Johnson',
      age: 17,
      accountBalance: 2500,
      creditScore: 0,
      monthlyIncome: 800,
      hasExistingLoan: false,
      employmentYears: 0,
      accountType: 'Student',
      riskCategory: 'High'
    },
    {
      id: 'CUST003',
      name: 'Michael Brown',
      age: 45,
      accountBalance: 85000,
      creditScore: 680,
      monthlyIncome: 8500,
      hasExistingLoan: true,
      employmentYears: 15,
      accountType: 'Premium',
      riskCategory: 'Medium'
    },
    {
      id: 'CUST004',
      name: 'Emily Davis',
      age: 32,
      accountBalance: 45000,
      creditScore: 750,
      monthlyIncome: 6200,
      hasExistingLoan: false,
      employmentYears: 8,
      accountType: 'Premium',
      riskCategory: 'Low'
    },
    {
      id: 'CUST005',
      name: 'Robert Wilson',
      age: 16,
      accountBalance: 500,
      creditScore: 0,
      monthlyIncome: 0,
      hasExistingLoan: false,
      employmentYears: 0,
      accountType: 'Minor',
      riskCategory: 'High'
    }
  ];

  const businessRequirements = [
    {
      title: 'Age Verification for Banking Services',
      prompt: 'Create a rule to check if a customer is eligible for adult banking services (must be 18 or older)',
      description: 'Essential for compliance with banking regulations and age-restricted services'
    },
    {
      title: 'Loan Eligibility Assessment',
      prompt: 'Create a rule to determine if a customer is eligible for a personal loan based on age, income, credit score, and existing loans',
      description: 'Multi-factor assessment for responsible lending'
    },
    {
      title: 'Premium Account Upgrade',
      prompt: 'Create a rule to check if a customer qualifies for premium account upgrade based on balance and income',
      description: 'Automated account tier management based on customer profile'
    },
    {
      title: 'Risk Assessment',
      prompt: 'Create a rule to calculate customer risk level based on age, employment, and financial indicators',
      description: 'Comprehensive risk evaluation for banking operations'
    }
  ];

  const handleGenerateRule = async () => {
    if (!userPrompt.trim()) return;

    setIsLoading(true);
    try {
  const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const response = await fetch(`${base}/api/aiexpression/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userPrompt
        }),
      });

      const data = await response.json();
      const raw = data.response || 'Unable to generate rule';

      // Try to extract a usable expression from the AI response
      const extractExpression = (text: string): string | null => {
        // 1) Look for fenced code block
        const fenceMatch = text.match(/```([\s\S]*?)```/);
        if (fenceMatch && fenceMatch[1]) {
          const lines = fenceMatch[1]
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
          if (lines.length > 0) return lines[0];
        }
        // 2) Look for inline code
        const inlineMatch = text.match(/`([^`]+)`/);
        if (inlineMatch && inlineMatch[1]) {
          return inlineMatch[1].trim();
        }
        // 3) Heuristic: find first line that looks like an expression
        const candidate = text
          .split('\n')
          .map(l => l.trim())
          .find(l => /customer\.|account\.|transaction\.|loan\.|>=|<=|==|\?|:/.test(l));
        return candidate || null;
      };

      const extracted = extractExpression(raw);
      setGeneratedRule(extracted || raw);
      
      // Extract explanation if available
  const lines = raw.split('\n');
      const explanationIndex = lines.findIndex((line: string) => 
        line.toLowerCase().includes('explanation') || 
        line.toLowerCase().includes('this rule')
      );
      
      if (explanationIndex >= 0) {
        setRuleExplanation(lines.slice(explanationIndex).join('\n'));
      } else {
        setRuleExplanation('This rule evaluates the specified business conditions.');
      }

      setActiveStep(2);
    } catch (error) {
      console.error('Error generating rule:', error);
      setGeneratedRule('Error generating rule. Please try again.');
    }
    setIsLoading(false);
  };

  const handleTestRule = async () => {
    if (!generatedRule) return;

    setIsLoading(true);
    const results: RuleTestResult[] = [];

  const contextType = detectContextType(generatedRule);
  const normalized = normalizeExpression(generatedRule, contextType);
  setNormalizedRule(normalized);

    // Test with different scenarios
    const testCases = [
      { age: 25, name: 'Adult Customer' },
      { age: 17, name: 'Minor Customer' },
      { age: 18, name: 'Exactly 18' },
      { age: 65, name: 'Senior Customer' }
    ];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        const response = await expressionService.testExpression(
          normalized,
          contextType,
          'boolean',
          {
            age: testCase.age,
            customer: { age: testCase.age },
            account: { balance: 0 }
          }
        );
        const executionTime = Date.now() - startTime;
        if (response.execution?.success) {
          const rawResult = response.execution?.result as any;
          const ruleResultBool = typeof rawResult === 'boolean'
            ? rawResult
            : (typeof rawResult === 'string' ? rawResult.toLowerCase() === 'true' : Boolean(rawResult));

          results.push({
            passed: ruleResultBool,
            result: rawResult,
            executionTime,
            error: undefined
          });
        } else {
          results.push({
            passed: null,
            result: 'N/A',
            executionTime,
            error: response.validation.errors?.join(', ') || 'Execution failed'
          });
        }
      } catch (error) {
        results.push({
          passed: null,
          result: 'N/A',
          executionTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setTestResults(results);
    setActiveStep(3);
    setIsLoading(false);
  };

  const handleApplyToScenarios = async () => {
    if (!generatedRule) return;

    setIsLoading(true);
    const results: any[] = [];

  const contextType = detectContextType(generatedRule);
  const normalized = normalizeExpression(generatedRule, contextType);
  setNormalizedRule(normalized);

    for (const scenario of sampleScenarios) {
      try {
        const startTime = Date.now();
        const response = await expressionService.testExpression(
          normalized,
          contextType,
          'boolean',
          {
            // flat names for simpler expressions
            age: scenario.age,
            accountBalance: scenario.accountBalance,
            creditScore: scenario.creditScore,
            monthlyIncome: scenario.monthlyIncome,
            hasExistingLoan: scenario.hasExistingLoan,
            employmentYears: scenario.employmentYears,
            // nested domain objects for dot notation expressions
            customer: {
              age: scenario.age,
              creditScore: scenario.creditScore,
              monthlyIncome: scenario.monthlyIncome,
              employmentYears: scenario.employmentYears,
              hasExistingLoan: scenario.hasExistingLoan,
            },
            account: {
              balance: scenario.accountBalance,
              type: scenario.accountType,
            },
          }
        );
        const executionTime = Date.now() - startTime;
        if (response.execution?.success) {
          const rawResult = response.execution?.result as any;
          const ruleResultBool = typeof rawResult === 'boolean'
            ? rawResult
            : (typeof rawResult === 'string' ? rawResult.toLowerCase() === 'true' : Boolean(rawResult));

          results.push({
            ...scenario,
            ruleResult: ruleResultBool,
            success: true,
            executionTime,
            error: undefined
          });
        } else {
          results.push({
            ...scenario,
            ruleResult: null,
            success: false,
            executionTime,
            error: response.validation.errors?.join(', ') || 'Execution failed'
          });
        }
      } catch (error) {
        results.push({
          ...scenario,
          ruleResult: null,
          success: false,
          executionTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setScenarioResults(results);
    setActiveStep(4);
    setIsLoading(false);
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setGeneratedRule('');
    setRuleExplanation('');
    setUserPrompt('');
    setTestResults([]);
    setScenarioResults([]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        End-to-End Banking Rules Demo
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Complete workflow from business requirement to rule application
      </Typography>

      <Stepper activeStep={activeStep} sx={{ my: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3, mt: 3 }}>
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              <RuleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Step 1: Define Business Requirement
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose a business requirement or create your own custom rule requirement.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              {businessRequirements.map((req, index) => (
                <Card 
                  key={index}
                  sx={{ 
                    flex: '1 1 45%',
                    minWidth: 300,
                    cursor: 'pointer',
                    border: userPrompt === req.prompt ? 2 : 1,
                    borderColor: userPrompt === req.prompt ? 'primary.main' : 'divider',
                    '&:hover': { boxShadow: 3 }
                  }}
                  onClick={() => setUserPrompt(req.prompt)}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {req.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {req.description}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Custom Business Requirement"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              sx={{ mt: 3 }}
              placeholder="Describe your business rule requirement..."
            />

            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!userPrompt.trim()}
                startIcon={<SmartToyIcon />}
              >
                Generate Rule with AI
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              <SmartToyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Step 2: Generate Rule with AI
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              <strong>Business Requirement:</strong> {userPrompt}
            </Alert>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleGenerateRule}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <SmartToyIcon />}
                size="large"
              >
                {isLoading ? 'Generating Rule...' : 'Generate Banking Rule'}
              </Button>
            </Box>

            {generatedRule && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Generated Rule:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                    {generatedRule}
                  </Typography>
                </Paper>
                
                {ruleExplanation && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Rule Explanation:
                    </Typography>
                    <Typography variant="body2">
                      {ruleExplanation}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" onClick={handleNext} startIcon={<AssessmentIcon />}>
                    Test Rule Logic
                  </Button>
                  <Button sx={{ ml: 1 }} onClick={handleBack}>
                    Back
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Step 3: Test Rule Logic
            </Typography>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Generated Rule</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                    {generatedRule}
                  </Typography>
                </Paper>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Normalized Expression (sent to backend)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                    {normalizedRule || '(none)'}
                  </Typography>
                </Paper>
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleTestRule}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              >
                {isLoading ? 'Testing Rule...' : 'Run Tests'}
              </Button>
            </Box>

            {testResults.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Test Results:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {testResults.map((result, index) => (
                    <Card key={index} sx={{ flex: '1 1 23%', minWidth: 200 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          {result.passed === true ? (
                            <CheckCircleIcon color="success" />
                          ) : result.passed === false ? (
                            <CancelIcon color="error" />
                          ) : (
                            <Chip label="N/A" size="small" />
                          )}
                          <Typography variant="subtitle2" sx={{ ml: 1 }}>
                            Test {index + 1}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          Result: {String(result.result)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Time: {result.executionTime}ms
                        </Typography>
                        {result.error && (
                          <Typography variant="body2" color="error">
                            Error: {result.error}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button variant="contained" onClick={handleNext} startIcon={<AccountBalanceIcon />}>
                    Apply to Banking Scenarios
                  </Button>
                  <Button sx={{ ml: 1 }} onClick={handleBack}>
                    Back
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {activeStep === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              <AccountBalanceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Step 4: Apply to Real Banking Scenarios
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Applying your rule to real customer profiles to demonstrate practical usage.
            </Alert>

            <Typography variant="subtitle1" gutterBottom>
              Customer Scenarios:
            </Typography>

            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Age</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell>Credit Score</TableCell>
                    <TableCell>Monthly Income</TableCell>
                    <TableCell>Account Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleScenarios.map((scenario) => (
                    <TableRow key={scenario.id}>
                      <TableCell>{scenario.name}</TableCell>
                      <TableCell>{scenario.age}</TableCell>
                      <TableCell>${scenario.accountBalance.toLocaleString()}</TableCell>
                      <TableCell>{scenario.creditScore || 'N/A'}</TableCell>
                      <TableCell>${scenario.monthlyIncome.toLocaleString()}</TableCell>
                      <TableCell>{scenario.accountType}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleApplyToScenarios}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                size="large"
              >
                {isLoading ? 'Applying Rule to Scenarios...' : 'Apply Rule to All Scenarios'}
              </Button>
              <Button sx={{ ml: 1 }} onClick={handleBack}>
                Back
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              📊 Step 5: Results & Analysis
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 100%' }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Rule Application Results
                  </Typography>
                  
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Customer</TableCell>
                          <TableCell>Age</TableCell>
                          <TableCell>Rule Result</TableCell>
                          <TableCell>Execution Time</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {scenarioResults.map((result, index) => (
                          <TableRow key={result.id}>
                            <TableCell>{result.name}</TableCell>
                            <TableCell>{result.age}</TableCell>
                            <TableCell>
                              <Chip
                                label={result.ruleResult === null ? 'N/A' : String(result.ruleResult)}
                                color={result.ruleResult === true ? 'success' : result.ruleResult === false ? 'error' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{result.executionTime}ms</TableCell>
                            <TableCell>
                              {result.success ? 
                                <CheckCircleIcon color="success" /> : 
                                <CancelIcon color="error" />
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>

              <Box sx={{ flex: '1 1 45%' }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Summary Statistics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary="Total Scenarios Tested" 
                        secondary={scenarioResults.length}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Passed" 
                        secondary={scenarioResults.filter(r => r.ruleResult === true).length}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Failed" 
                        secondary={scenarioResults.filter((r: any) => r.ruleResult === false).length}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Average Execution Time" 
                        secondary={`${scenarioResults.length ? Math.round(scenarioResults.reduce((acc: number, r: any) => acc + (r.executionTime || 0), 0) / scenarioResults.length) : 0}ms`}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Box>

              <Box sx={{ flex: '1 1 45%' }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Business Impact
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Automated Decision Making"
                        secondary="Rules can be applied automatically to thousands of customers"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Compliance Assurance"
                        secondary="Consistent application of business rules ensures regulatory compliance"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Real-time Processing"
                        secondary="Fast execution times enable real-time decision making"
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Box>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleReset} sx={{ mr: 1 }}>
                Start New Demo
              </Button>
              <Button onClick={handleBack}>
                Back
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default EndToEndDemo;
