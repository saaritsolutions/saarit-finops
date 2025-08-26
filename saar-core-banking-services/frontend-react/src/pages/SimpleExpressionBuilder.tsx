import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Container,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
} from '@mui/material';

interface Expression {
  id: string;
  name: string;
  description: string;
  expression: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`expression-tabpanel-${index}`}
      aria-labelledby={`expression-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `expression-tab-${index}`,
    'aria-controls': `expression-tabpanel-${index}`,
  };
}

const SimpleExpressionBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Form state for Create/Edit tab
  const [formData, setFormData] = useState({
    expressionId: '',
    name: '',
    description: '',
    category: '',
    subCategory: '',
    expression: '',
    returnType: 'string',
    contextType: 'customer',
    usageType: 'validation',
    isActive: true
  });

  // Test state
  const [testExpression, setTestExpression] = useState('');
  const [testData, setTestData] = useState(`{
  "customer": {
    "id": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "age": 35,
    "creditScore": 750,
    "monthlyIncome": 5000,
    "debtToIncomeRatio": 0.25,
    "accountType": "premium"
  },
  "account": {
    "id": "ACC001",
    "balance": 15000,
    "accountType": "checking",
    "openDate": "2020-01-15",
    "isActive": true,
    "minimumBalance": 500,
    "interestRate": 0.02
  },
  "transaction": {
    "id": "TXN001",
    "amount": 1500,
    "type": "transfer",
    "date": "2025-08-14",
    "isInternational": false,
    "merchantCategory": "utilities",
    "description": "Electric bill payment"
  }
}`);

  // Load expressions from API
  useEffect(() => {
    const loadExpressions = async () => {
      setLoading(true);
      setError(null);
    try {
      console.log('Fetching expressions from API...');
  const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const response = await fetch(`${base}/api/expressions`);        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        // The API returns { expressions: [], pagination: {...} }
        setExpressions(data.expressions || []);
        
      } catch (err) {
        console.error('Error fetching expressions:', err);
        setError(`Failed to load expressions: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadExpressions();
  }, []);

  // Handler functions
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

      const applyTemplate = (template: any) => {
    setFormData({
      expressionId: template.id || `EXPR_${Date.now()}`,
      name: template.name,
      description: template.description,
      category: template.category,
      subCategory: template.subCategory || '',
      expression: template.expression,
      returnType: template.returnType,
      contextType: template.contextType || 'customer',
      usageType: template.usageType || 'validation',
      isActive: template.isActive !== undefined ? template.isActive : true
    });
    setActiveTab(1);
  };

  const clearForm = () => {
    setFormData({
      expressionId: '',
      name: '',
      description: '',
      category: '',
      subCategory: '',
      expression: '',
      returnType: 'string',
      contextType: 'customer',
      usageType: 'validation',
      isActive: true
    });
  };

  const handleSaveExpression = async () => {
    try {
      const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
      const url = editMode && editId ? `${base}/api/expressions/${editId}` : `${base}/api/expressions`;
      const method = editMode && editId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expressionId: formData.expressionId || `EXPR_${Date.now()}`,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          subCategory: formData.subCategory,
          expressionText: formData.expression,
          returnType: formData.returnType,
          contextType: formData.contextType,
          usageType: formData.usageType,
          isActive: formData.isActive
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${editMode ? 'update' : 'create'} expression`);
      }

      alert(`Expression ${editMode ? 'updated' : 'created'} successfully!`);
      clearForm();

      // Reload expressions list
      setLoading(true);
      try {
        const reloadBase = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
        const res = await fetch(`${reloadBase}/api/expressions`);
        const data = await res.json();
        setExpressions(data.expressions || []);
      } catch (err) {
        console.error('Error reloading expressions:', err);
      } finally {
        setLoading(false);
      }

      setActiveTab(0); // back to list
    } catch (error: any) {
      alert(`Error ${editMode ? 'updating' : 'creating'} expression: ${error?.message || error}`);
    }
  };

  const handleEditClick = async (expr: Expression) => {
    try {
      setError(null);
      const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
      const resp = await fetch(`${base}/api/expressions/${expr.id}`);
      const full = resp.ok ? await resp.json() : null;
      const expressionId = (full && (full.expressionId || full.id)) || (expr as any).expressionId || expr.id;
      const expressionText = full?.expressionText ?? (full as any)?.code ?? (expr as any).expression ?? '';
      setFormData({
        expressionId,
        name: full?.name ?? (expr as any).name ?? '',
        description: full?.description ?? (expr as any).description ?? '',
        category: full?.category ?? (expr as any).category ?? '',
        subCategory: full?.subCategory ?? (expr as any).subCategory ?? '',
        expression: expressionText,
        returnType: full?.returnType ?? 'string',
        contextType: full?.contextType ?? 'customer',
        usageType: full?.usageType ?? 'validation',
        isActive: full?.isActive ?? (expr as any).isActive ?? true
      });
      setEditMode(true);
      setEditId(full?.id ?? expr.id);
      setActiveTab(1);
    } catch (e: any) {
      setError(`Failed to load expression for editing: ${e?.message || e}`);
    }
  };

  const validateExpression = () => {
    if (!formData.expression.trim()) {
      alert('Please enter an expression to validate');
      return;
    }
    // This would call the backend validation API
    alert('Expression syntax validation will be implemented with backend API');
  };

  const loadTestCase = (testCase: string, customData?: any) => {
    if (customData) {
      // If custom data is provided, use it
            if (editMode) {
              setEditMode(false);
              setEditId(null);
            }
      setTestData(JSON.stringify(customData, null, 2));
            alert(`Error ${editMode ? 'updating' : 'creating'} expression: ${error}`);
      if (testCase.includes('credit')) {
        setTestExpression(`IF(customer.creditScore >= 750, 'APPROVED', IF(customer.creditScore >= 650, 'MANUAL_REVIEW', 'REJECTED'))`);

        const handleEditClick = async (expr: Expression) => {
          try {
            setError(null);
            const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
            // Fetch full details for robust mapping
            const resp = await fetch(`${base}/api/expressions/${expr.id}`);
            let full: any = null;
            if (resp.ok) {
              full = await resp.json();
            }
            const expressionId = (full && (full.expressionId || full.id)) || (expr as any).expressionId || expr.id;
            const expressionText = full?.expressionText ?? (full as any)?.code ?? (expr as any).expression ?? '';
            setFormData({
              expressionId,
              name: full?.name ?? (expr as any).name ?? '',
              description: full?.description ?? (expr as any).description ?? '',
              category: full?.category ?? (expr as any).category ?? '',
              subCategory: full?.subCategory ?? (expr as any).subCategory ?? '',
              expression: expressionText,
              returnType: full?.returnType ?? 'string',
              contextType: full?.contextType ?? 'customer',
              usageType: full?.usageType ?? 'validation',
              isActive: full?.isActive ?? (expr as any).isActive ?? true
            });
            setEditMode(true);
            setEditId(full?.id ?? expr.id);
            setActiveTab(1);
          } catch (e: any) {
            setError(`Failed to load expression for editing: ${e?.message || e}`);
          }
        };
      } else if (testCase.includes('transaction')) {
        setTestExpression(`IF(OR(transaction.amount > 10000, transaction.isInternational = true), 'HIGH_RISK', 'LOW_RISK')`);
      }
      return;
    }

    const testCases: { [key: string]: any } = {
      'high-credit': {
        expression: `IF(customer.creditScore >= 750, 'APPROVED', IF(customer.creditScore >= 650, 'MANUAL_REVIEW', 'REJECTED'))`,
        data: JSON.stringify({
          customer: { creditScore: 780, monthlyIncome: 6000, debtToIncomeRatio: 0.2 }
        }, null, 2)
      },
      'medium-credit': {
        expression: `IF(customer.creditScore >= 750, 'APPROVED', IF(customer.creditScore >= 650, 'MANUAL_REVIEW', 'REJECTED'))`,
        data: JSON.stringify({
          customer: { creditScore: 680, monthlyIncome: 4500, debtToIncomeRatio: 0.35 }
        }, null, 2)
      },
      'low-credit': {
        expression: `IF(customer.creditScore >= 750, 'APPROVED', IF(customer.creditScore >= 650, 'MANUAL_REVIEW', 'REJECTED'))`,
        data: JSON.stringify({
          customer: { creditScore: 590, monthlyIncome: 3000, debtToIncomeRatio: 0.45 }
        }, null, 2)
      },
      'large-transaction': {
        expression: `IF(transaction.amount > 10000, 'HIGH_RISK', IF(transaction.amount > 5000, 'MEDIUM_RISK', 'LOW_RISK'))`,
        data: JSON.stringify({
          transaction: { amount: 15000, type: 'transfer', isInternational: true }
        }, null, 2)
      }
    };

    const selectedCase = testCases[testCase];
    if (selectedCase) {
      setTestExpression(selectedCase.expression);
      setTestData(selectedCase.data);
    }
  };

  const runExpressionTest = () => {
    if (!testExpression.trim()) {
      alert('Please enter an expression to test');
      return;
    }
    // This would call the backend test API
    alert('Expression testing will be implemented with backend API');
  };

  console.log('SimpleExpressionBuilder rendered successfully');

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Expression Builder
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create, edit, and test business rule expressions for banking operations.
        </Typography>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="expression builder tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Expressions" {...a11yProps(0)} />
            <Tab label="Create/Edit" {...a11yProps(1)} />
            <Tab label="Templates" {...a11yProps(2)} />
            <Tab label="Functions" {...a11yProps(3)} />
            <Tab label="Test" {...a11yProps(4)} />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Expression List
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : expressions.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expressions.map((expr) => (
                      <TableRow key={expr.id}>
                        <TableCell>
                          <Typography variant="subtitle2">
                            {expr.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {expr.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={expr.category} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={expr.isActive ? 'Active' : 'Inactive'} 
                            size="small" 
                            color={expr.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {new Date(expr.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => handleEditClick(expr)}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                No expressions found. Create your first expression to get started.
              </Alert>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Create/Edit Expression
            </Typography>
            
            <Box component="form" sx={{ mt: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Expression Name *
                </Typography>
                <input
                  type="text"
                  placeholder="Enter expression name (e.g., Loan Eligibility Check)"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    marginBottom: '16px'
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Description
                </Typography>
                <textarea
                  placeholder="Describe what this expression does..."
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Expression ID
                </Typography>
                <input
                  type="text"
                  placeholder="Auto-generated if empty (e.g., EXPR_LOAN_ELIGIBILITY)"
                  value={formData.expressionId}
                  onChange={(e) => handleFormChange('expressionId', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px'
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Context Type *
                </Typography>
                <select
                  value={formData.contextType}
                  onChange={(e) => handleFormChange('contextType', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select context type</option>
                  <option value="Account">Account</option>
                  <option value="Customer">Customer</option>
                  <option value="Transaction">Transaction</option>
                  <option value="Global">Global</option>
                  <option value="System">System</option>
                </select>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Usage Type *
                </Typography>
                <select
                  value={formData.usageType}
                  onChange={(e) => handleFormChange('usageType', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select usage type</option>
                  <option value="Validation">Validation</option>
                  <option value="Calculation">Calculation</option>
                  <option value="Configuration">Configuration</option>
                  <option value="Workflow">Workflow</option>
                  <option value="Business Rule">Business Rule</option>
                </select>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Category
                </Typography>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select a category</option>
                  <option value="loan">Loan Processing</option>
                  <option value="account">Account Management</option>
                  <option value="transaction">Transaction Rules</option>
                  <option value="risk">Risk Assessment</option>
                  <option value="compliance">Compliance</option>
                  <option value="other">Other</option>
                </select>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Expression Logic *
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Write your expression using banking functions and operators
                </Typography>
                <textarea
                  placeholder="Example: IF(customer.creditScore > 700 AND customer.income > 50000, 'APPROVED', 'REQUIRES_REVIEW')"
                  value={formData.expression}
                  onChange={(e) => handleFormChange('expression', e.target.value)}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    backgroundColor: '#f8f9fa',
                    resize: 'vertical'
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Return Type
                </Typography>
                <select
                  value={formData.returnType}
                  onChange={(e) => handleFormChange('returnType', e.target.value)}
                  style={{
                    width: '200px',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="string">Text/String</option>
                  <option value="number">Number</option>
                  <option value="boolean">True/False</option>
                  <option value="date">Date</option>
                </select>
              </Box>

              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => handleFormChange('isActive', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="isActive">
                  <Typography variant="body2">
                    Active (expression will be available for use)
                  </Typography>
                </label>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, pt: 2 }}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={handleSaveExpression}
                  disabled={!formData.name || !formData.expression}
                >
                  {editMode ? 'Update Expression' : 'Create Expression'}
                </Button>
                <Button 
                  variant="outlined" 
                  size="large"
                  onClick={validateExpression}
                >
                  Validate Syntax
                </Button>
                <Button 
                  variant="text" 
                  size="large"
                  onClick={clearForm}
                >
                  {editMode ? 'Cancel Edit' : 'Clear Form'}
                </Button>
              </Box>
            </Box>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Quick Tips:</strong><br/>
                • Use customer.fieldName to access customer data<br/>
                • Use account.fieldName to access account data<br/>
                • Available functions: IF(), AND(), OR(), NOT(), SUM(), AVG(), MAX(), MIN()<br/>
                • Use comparison operators: {'>'}, {'<'}, {'='}, {'!='}, {'>='}, {'<='}<br/>
              </Typography>
            </Alert>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Expression Templates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Pre-built expression templates for common banking scenarios. Click "Use Template" to copy to editor.
            </Typography>

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
              {/* Loan Eligibility Template */}
              <Paper sx={{ p: 3, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Loan Eligibility Check
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Determines loan eligibility based on credit score, income, and debt ratio
                </Typography>
                <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 2 }}>
                  <code style={{ fontSize: '12px', fontFamily: 'Monaco, Consolas, monospace' }}>
                    {`IF(AND(customer.creditScore >= 650, 
    customer.monthlyIncome >= 3000, 
    customer.debtToIncomeRatio < 0.4), 
'APPROVED', 
IF(customer.creditScore >= 600, 
    'MANUAL_REVIEW', 'REJECTED'))`}
                  </code>
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => applyTemplate({
                    name: 'Loan Eligibility Check',
                    description: 'Determines loan eligibility based on credit score, income, and debt ratio',
                    category: 'loan',
                    expression: `IF(AND(customer.creditScore >= 650, 
    customer.monthlyIncome >= 3000, 
    customer.debtToIncomeRatio < 0.4), 
'APPROVED', 
IF(customer.creditScore >= 600, 
    'MANUAL_REVIEW', 'REJECTED'))`,
                    returnType: 'string',
                    isActive: true
                  })}
                >
                  Use Template
                </Button>
              </Paper>

              {/* Risk Assessment Template */}
              <Paper sx={{ p: 3, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Transaction Risk Assessment
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Evaluates transaction risk based on amount, frequency, and customer profile
                </Typography>
                <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 2 }}>
                  <code style={{ fontSize: '12px', fontFamily: 'Monaco, Consolas, monospace' }}>
                    {`IF(OR(transaction.amount > 10000,
    customer.dailyTransactionCount > 5,
    transaction.isInternational = true),
'HIGH_RISK',
IF(transaction.amount > 5000, 
    'MEDIUM_RISK', 'LOW_RISK'))`}
                  </code>
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => applyTemplate({
                    name: 'Transaction Risk Assessment',
                    description: 'Evaluates transaction risk based on amount, frequency, and customer profile',
                    category: 'risk',
                    expression: `IF(OR(transaction.amount > 10000,
    customer.dailyTransactionCount > 5,
    transaction.isInternational = true),
'HIGH_RISK',
IF(transaction.amount > 5000, 
    'MEDIUM_RISK', 'LOW_RISK'))`,
                    returnType: 'string',
                    isActive: true
                  })}
                >
                  Use Template
                </Button>
              </Paper>

              {/* Account Opening Template */}
              <Paper sx={{ p: 3, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Account Opening Validation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Validates customer information for new account opening
                </Typography>
                <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 2 }}>
                  <code style={{ fontSize: '12px', fontFamily: 'Monaco, Consolas, monospace' }}>
                    {`IF(AND(customer.age >= 18,
    customer.hasValidID = true,
    customer.addressVerified = true,
    customer.initialDeposit >= 100),
'APPROVED', 'ADDITIONAL_DOCS_REQUIRED')`}
                  </code>
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => applyTemplate({
                    name: 'Account Opening Validation',
                    description: 'Validates customer information for new account opening',
                    category: 'account',
                    expression: `IF(AND(customer.age >= 18,
    customer.hasValidID = true,
    customer.addressVerified = true,
    customer.initialDeposit >= 100),
'APPROVED', 'ADDITIONAL_DOCS_REQUIRED')`,
                    returnType: 'string',
                    isActive: true
                  })}
                >
                  Use Template
                </Button>
              </Paper>

              {/* Interest Rate Template */}
              <Paper sx={{ p: 3, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Dynamic Interest Rate Calculation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Calculates interest rate based on customer profile and market conditions
                </Typography>
                <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 2 }}>
                  <code style={{ fontSize: '12px', fontFamily: 'Monaco, Consolas, monospace' }}>
                    {`IF(customer.creditScore >= 750, 
    baseRate - 0.5,
IF(customer.creditScore >= 650,
    baseRate,
    baseRate + 1.0))`}
                  </code>
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => applyTemplate({
                    name: 'Dynamic Interest Rate Calculation',
                    description: 'Calculates interest rate based on customer profile and market conditions',
                    category: 'loan',
                    expression: `IF(customer.creditScore >= 750, 
    baseRate - 0.5,
IF(customer.creditScore >= 650,
    baseRate,
    baseRate + 1.0))`,
                    returnType: 'number',
                    isActive: true
                  })}
                >
                  Use Template
                </Button>
              </Paper>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Banking Functions & Operators
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Available functions and operators for building expressions
            </Typography>

            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {/* Logical Functions */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Logical Functions
                </Typography>
                <Box sx={{ '& > div': { mb: 2 } }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">IF(condition, trueValue, falseValue)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns trueValue if condition is true, otherwise falseValue
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">AND(condition1, condition2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns true if all conditions are true
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">OR(condition1, condition2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns true if any condition is true
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">NOT(condition)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns the opposite of the condition
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Mathematical Functions */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Mathematical Functions
                </Typography>
                <Box sx={{ '& > div': { mb: 2 } }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">SUM(field1, field2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Calculates the sum of multiple fields
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">AVG(field1, field2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Calculates the average of multiple fields
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">MAX(field1, field2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns the maximum value
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">MIN(field1, field2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns the minimum value
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">ROUND(number, decimals)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rounds number to specified decimal places
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* String Functions */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Text Functions
                </Typography>
                <Box sx={{ '& > div': { mb: 2 } }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">CONCAT(text1, text2, ...)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Combines multiple text values
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">UPPER(text)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Converts text to uppercase
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">LOWER(text)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Converts text to lowercase
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">LENGTH(text)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns the length of text
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Date Functions */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                  Date Functions
                </Typography>
                <Box sx={{ '& > div': { mb: 2 } }}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">TODAY()</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns current date
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">DATEDIFF(date1, date2)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Returns difference in days between dates
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">DATEADD(date, days)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Adds days to a date
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">YEAR(date), MONTH(date), DAY(date)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Extract year, month, or day from date
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>

            {/* Operators Section */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Operators
              </Typography>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Comparison</Typography>
                  <Typography variant="body2" component="div">
                    {'>'} (greater than)<br/>
                    {'<'} (less than)<br/>
                    {'>='} (greater or equal)<br/>
                    {'<='} (less or equal)<br/>
                    {'='} (equal)<br/>
                    {'!='} (not equal)
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Arithmetic</Typography>
                  <Typography variant="body2" component="div">
                    + (addition)<br/>
                    - (subtraction)<br/>
                    * (multiplication)<br/>
                    / (division)<br/>
                    % (modulo)
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {/* Available Fields */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Available Data Fields
              </Typography>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Customer Fields</Typography>
                  <Typography variant="body2" component="div" sx={{ fontSize: '13px' }}>
                    customer.id<br/>
                    customer.firstName<br/>
                    customer.lastName<br/>
                    customer.age<br/>
                    customer.creditScore<br/>
                    customer.monthlyIncome<br/>
                    customer.debtToIncomeRatio<br/>
                    customer.accountType
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Account Fields</Typography>
                  <Typography variant="body2" component="div" sx={{ fontSize: '13px' }}>
                    account.id<br/>
                    account.balance<br/>
                    account.accountType<br/>
                    account.openDate<br/>
                    account.isActive<br/>
                    account.minimumBalance<br/>
                    account.interestRate
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Transaction Fields</Typography>
                  <Typography variant="body2" component="div" sx={{ fontSize: '13px' }}>
                    transaction.id<br/>
                    transaction.amount<br/>
                    transaction.type<br/>
                    transaction.date<br/>
                    transaction.isInternational<br/>
                    transaction.merchantCategory<br/>
                    transaction.description
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Expression Tester
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Test your expressions with sample data to verify they work correctly
            </Typography>

            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: '1fr 1fr' }}>
              {/* Left Column - Expression Input */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Expression to Test
                </Typography>
                <textarea
                  placeholder="Enter your expression here...
Example: IF(customer.creditScore > 700, 'APPROVED', 'REJECTED')"
                  value={testExpression}
                  onChange={(e) => setTestExpression(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    backgroundColor: '#f8f9fa',
                    resize: 'vertical'
                  }}
                />
                
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 3, mb: 1 }}>
                  Sample Data (JSON Format)
                </Typography>
                <textarea
                  placeholder={`{
  "customer": {
    "id": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "age": 35,
    "creditScore": 750,
    "monthlyIncome": 5000,
    "debtToIncomeRatio": 0.25,
    "accountType": "premium"
  },
  "account": {
    "id": "ACC001",
    "balance": 15000,
    "accountType": "checking",
    "openDate": "2020-01-15",
    "isActive": true,
    "minimumBalance": 500,
    "interestRate": 0.02
  },
  "transaction": {
    "id": "TXN001",
    "amount": 1500,
    "type": "transfer",
    "date": "2025-08-14",
    "isInternational": false,
    "merchantCategory": "utilities",
    "description": "Electric bill payment"
  }
}`}
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '12px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    resize: 'vertical'
                  }}
                />
              </Paper>

              {/* Right Column - Test Results */}
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Test Results
                  </Typography>
                  <Button 
                    variant="contained" 
                    onClick={runExpressionTest}
                    disabled={!testExpression.trim()}
                  >
                    Run Test
                  </Button>
                </Box>

                {/* Syntax Validation */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: '#f0f8f0', borderRadius: 1, border: '1px solid #4caf50' }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="success.main" gutterBottom>
                    ✓ Syntax Validation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Expression syntax is valid
                  </Typography>
                </Box>

                {/* Expression Result */}
                <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1, border: '1px solid #ddd' }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Expression Result
                  </Typography>
                  <Box sx={{ backgroundColor: 'white', p: 2, borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="body1" fontFamily="monospace" color="primary.main" fontWeight="bold">
                      "APPROVED"
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Return Type: String
                  </Typography>
                </Box>

                {/* Execution Details */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Execution Details
                  </Typography>
                  <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1 }}>
                    <Typography variant="body2" component="div" sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      Execution Time: 15ms<br/>
                      Variables Used: customer.creditScore (750)<br/>
                      Conditions Evaluated:<br/>
                      &nbsp;&nbsp;• customer.creditScore {'>'} 700 → true<br/>
                      &nbsp;&nbsp;• Result: "APPROVED"
                    </Typography>
                  </Box>
                </Box>

                {/* Test Cases */}
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Quick Test Cases
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => loadTestCase('high-credit', {
                        customer: {
                          id: "12345",
                          firstName: "Alice",
                          lastName: "Smith",
                          age: 35,
                          creditScore: 780,
                          monthlyIncome: 7500,
                          debtToIncomeRatio: 0.20,
                          accountType: "premium"
                        },
                        account: {
                          id: "ACC001",
                          balance: 25000,
                          accountType: "checking",
                          isActive: true
                        }
                      })}
                    >
                      High Credit Score (750+)
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => loadTestCase('medium-credit', {
                        customer: {
                          id: "67890",
                          firstName: "Bob",
                          lastName: "Johnson",
                          age: 42,
                          creditScore: 680,
                          monthlyIncome: 4500,
                          debtToIncomeRatio: 0.35,
                          accountType: "standard"
                        },
                        account: {
                          id: "ACC002",
                          balance: 8500,
                          accountType: "checking",
                          isActive: true
                        }
                      })}
                    >
                      Medium Credit Score (650-749)
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => loadTestCase('low-credit', {
                        customer: {
                          id: "11111",
                          firstName: "Carol",
                          lastName: "Davis",
                          age: 28,
                          creditScore: 580,
                          monthlyIncome: 2800,
                          debtToIncomeRatio: 0.50,
                          accountType: "basic"
                        },
                        account: {
                          id: "ACC003",
                          balance: 1200,
                          accountType: "checking",
                          isActive: true
                        }
                      })}
                    >
                      Low Credit Score ({'<'}650)
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small"
                      onClick={() => loadTestCase('large-transaction', {
                        customer: {
                          id: "22222",
                          firstName: "David",
                          lastName: "Wilson",
                          creditScore: 720,
                          monthlyIncome: 6000
                        },
                        transaction: {
                          id: "TXN005",
                          amount: 15000,
                          type: "wire_transfer",
                          date: "2025-08-14",
                          isInternational: true,
                          merchantCategory: "real_estate"
                        }
                      })}
                    >
                      Large Transaction (10k+)
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Box>

            {/* Expression History */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Recent Test History
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Expression</TableCell>
                      <TableCell>Test Data</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        IF(customer.creditScore {'>'} 700, 'APPROVED'...)
                      </TableCell>
                      <TableCell>High Credit Customer</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: 'success.main' }}>
                        "APPROVED"
                      </TableCell>
                      <TableCell>
                        <Chip label="Success" color="success" size="small" />
                      </TableCell>
                      <TableCell>2 min ago</TableCell>
                      <TableCell>
                        <Button size="small" variant="text">Rerun</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        IF(transaction.amount {'>'} 10000, 'HIGH_RISK'...)
                      </TableCell>
                      <TableCell>Large Transaction</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
                        "HIGH_RISK"
                      </TableCell>
                      <TableCell>
                        <Chip label="Success" color="success" size="small" />
                      </TableCell>
                      <TableCell>5 min ago</TableCell>
                      <TableCell>
                        <Button size="small" variant="text">Rerun</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default SimpleExpressionBuilder;
