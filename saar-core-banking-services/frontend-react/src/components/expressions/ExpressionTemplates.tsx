import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Chip,
  InputAdornment,
  Button,
  Grid,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  ContentCopy as ContentCopyIcon,
  Preview as PreviewIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Article as TemplateIcon
} from '@mui/icons-material';
import { expressionService } from '../../services/expressionService';
import { ExpressionTemplate } from '../../types/expression';

interface ExpressionTemplatesProps {
  onUseTemplate?: (template: ExpressionTemplate) => void;
  onCreateFromTemplate?: (template: ExpressionTemplate) => void;
}

const NOW = new Date().toISOString();

// Built-in templates — mirrors ExpressionSeedService.cs (10 banking rules)
const BUILT_IN_TEMPLATES: ExpressionTemplate[] = [
  {
    id: 'bi-1', templateId: 'loan-eligibility',
    name: 'Loan Eligibility Check',
    description: 'Determines personal loan eligibility from credit score, monthly income and DTI ratio.',
    category: 'Loan Management',
    expressionTemplate: 'creditScore >= {minCreditScore} && monthlyIncome >= {minIncome}m && debtToIncomeRatio <= {maxDTI}m',
    sampleExpression: 'creditScore >= 650 && monthlyIncome >= 25000m && debtToIncomeRatio <= 0.5m',
    contextType: 'LoanApplication', returnType: 'boolean', isBuiltIn: true,
    usageInstructions: 'Set minCreditScore (e.g. 650), minIncome (e.g. 25000), maxDTI (e.g. 0.5). Variables are auto-bound from the loan context.',
    templateVariables: {
      minCreditScore: { type: 'integer', description: 'Minimum credit score', defaultValue: 650 },
      minIncome:      { type: 'decimal', description: 'Minimum monthly income (₹)', defaultValue: 25000 },
      maxDTI:         { type: 'decimal', description: 'Maximum debt-to-income ratio', defaultValue: 0.5 },
    },
    sortOrder: 1, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-2', templateId: 'interest-rate-tier',
    name: 'Interest Rate Tier Selector',
    description: 'Returns the applicable annual interest rate (%) based on credit score tier.',
    category: 'Loan Management',
    expressionTemplate: 'creditScore >= 750 ? {rate750}m : creditScore >= 700 ? {rate700}m : {rateDefault}m',
    sampleExpression: 'creditScore >= 750 ? 8.5m : creditScore >= 700 ? 10.0m : 12.0m',
    contextType: 'LoanApplication', returnType: 'decimal', isBuiltIn: true,
    usageInstructions: 'Adjust rate values for each credit-score tier. Returns a decimal % p.a.',
    templateVariables: {
      rate750:      { type: 'decimal', description: 'Rate for score ≥ 750', defaultValue: 8.5 },
      rate700:      { type: 'decimal', description: 'Rate for score ≥ 700', defaultValue: 10.0 },
      rateDefault:  { type: 'decimal', description: 'Rate for score < 700', defaultValue: 12.0 },
    },
    sortOrder: 2, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-3', templateId: 'emi-calculation',
    name: 'Monthly EMI Calculation',
    description: 'Computes the equated monthly instalment using P×r(1+r)^n/((1+r)^n−1). Variables: amount=principal, rate=% p.a., days=tenure months.',
    category: 'Calculation',
    expressionTemplate: '(amount * (rate/12m/100m) * (decimal)Math.Pow((double)(1m+rate/12m/100m),days)) / ((decimal)Math.Pow((double)(1m+rate/12m/100m),days)-1m)',
    sampleExpression: '(amount * (rate/12m/100m) * (decimal)Math.Pow((double)(1m+rate/12m/100m),24)) / ((decimal)Math.Pow((double)(1m+rate/12m/100m),24)-1m)',
    contextType: 'LoanApplication', returnType: 'decimal', isBuiltIn: true,
    usageInstructions: 'Pass amount (principal ₹), rate (annual % e.g. 10.5), and days (tenure in months) as variables.',
    templateVariables: {
      amount: { type: 'decimal', description: 'Loan principal (₹)', defaultValue: 500000 },
      rate:   { type: 'decimal', description: 'Annual interest rate (%)', defaultValue: 10.5 },
      days:   { type: 'integer', description: 'Tenure in months', defaultValue: 24 },
    },
    sortOrder: 3, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-4', templateId: 'txn-limit-check',
    name: 'Daily Transaction Limit Validator',
    description: 'Returns true if the transaction amount is within the daily PMLA cash-transaction limit of ₹1,00,000.',
    category: 'Transaction Processing',
    expressionTemplate: 'amount <= {dailyLimit}m',
    sampleExpression: 'amount <= 100000m',
    contextType: 'Transaction', returnType: 'boolean', isBuiltIn: true,
    usageInstructions: 'Set dailyLimit to your bank\'s daily transaction ceiling. Variable: amount = transaction value.',
    templateVariables: {
      dailyLimit: { type: 'decimal', description: 'Daily transaction ceiling (₹)', defaultValue: 100000 },
    },
    sortOrder: 4, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-5', templateId: 'min-balance',
    name: 'Minimum Balance Validator',
    description: 'Returns true if the account balance meets the minimum maintenance balance.',
    category: 'Validation',
    expressionTemplate: 'amount >= {minBalance}m',
    sampleExpression: 'amount >= 500m',
    contextType: 'Account', returnType: 'boolean', isBuiltIn: true,
    usageInstructions: 'Set minBalance to your product\'s minimum required balance. Variable: amount = current balance.',
    templateVariables: {
      minBalance: { type: 'decimal', description: 'Minimum required balance (₹)', defaultValue: 500 },
    },
    sortOrder: 5, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-6', templateId: 'savings-rate',
    name: 'Savings Account Interest Rate',
    description: 'Returns the tiered savings interest rate (%) based on average monthly balance.',
    category: 'Calculation',
    expressionTemplate: 'amount >= {highBalance}m ? {highRate}m : amount >= {midBalance}m ? {midRate}m : {baseRate}m',
    sampleExpression: 'amount >= 1000000m ? 7.0m : amount >= 100000m ? 6.5m : 5.5m',
    contextType: 'Account', returnType: 'decimal', isBuiltIn: true,
    usageInstructions: 'Adjust balance tiers and corresponding rates. Variable: amount = average monthly balance.',
    templateVariables: {
      highBalance: { type: 'decimal', description: 'High-tier balance threshold (₹)', defaultValue: 1000000 },
      midBalance:  { type: 'decimal', description: 'Mid-tier balance threshold (₹)', defaultValue: 100000 },
      highRate:    { type: 'decimal', description: 'Rate for high-tier (%)', defaultValue: 7.0 },
      midRate:     { type: 'decimal', description: 'Rate for mid-tier (%)', defaultValue: 6.5 },
      baseRate:    { type: 'decimal', description: 'Base rate (%)', defaultValue: 5.5 },
    },
    sortOrder: 6, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-7', templateId: 'risk-score',
    name: 'Customer Risk Score',
    description: 'Computes a 0–100 risk score from credit score and DTI ratio. Lower = higher risk. Variables: creditScore, debtToIncomeRatio.',
    category: 'Risk Assessment',
    expressionTemplate: 'Math.Round(Math.Max(0m, Math.Min(100m, (decimal)(creditScore-300)/6m*(1m-debtToIncomeRatio))),2)',
    sampleExpression: 'Math.Round(Math.Max(0m, Math.Min(100m, (decimal)(creditScore-300)/6m*(1m-debtToIncomeRatio))),2)',
    contextType: 'Customer', returnType: 'decimal', isBuiltIn: true,
    usageInstructions: 'No placeholders — uses creditScore and debtToIncomeRatio directly from context.',
    templateVariables: {},
    sortOrder: 7, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-8', templateId: 'priority-sector',
    name: 'Priority Sector Loan Flag',
    description: 'Returns true if the loan qualifies as RBI priority-sector lending (amount ≤ ₹10L, income ≤ ₹25K).',
    category: 'Compliance',
    expressionTemplate: 'amount <= {maxAmount}m && monthlyIncome <= {maxIncome}m',
    sampleExpression: 'amount <= 1000000m && monthlyIncome <= 25000m',
    contextType: 'LoanApplication', returnType: 'boolean', isBuiltIn: true,
    usageInstructions: 'Adjust thresholds per current RBI priority-sector guidelines. Variables: amount = loan amount, monthlyIncome = applicant income.',
    templateVariables: {
      maxAmount: { type: 'decimal', description: 'Maximum loan amount (₹)', defaultValue: 1000000 },
      maxIncome: { type: 'decimal', description: 'Maximum monthly income (₹)', defaultValue: 25000 },
    },
    sortOrder: 8, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-9', templateId: 'max-tenure',
    name: 'Maximum Loan Tenure',
    description: 'Returns the maximum allowable tenure in months based on credit score tier. 750+ → 60m, 700–749 → 48m, 650–699 → 36m, <650 → 24m.',
    category: 'Loan Management',
    expressionTemplate: 'creditScore >= 750 ? 60 : creditScore >= 700 ? 48 : creditScore >= 650 ? 36 : 24',
    sampleExpression: 'creditScore >= 750 ? 60 : creditScore >= 700 ? 48 : creditScore >= 650 ? 36 : 24',
    contextType: 'LoanApplication', returnType: 'integer', isBuiltIn: true,
    usageInstructions: 'No placeholders — adjust the ternary values to match your product\'s tenure policy.',
    templateVariables: {},
    sortOrder: 9, createdAt: NOW, updatedAt: NOW,
  },
  {
    id: 'bi-10', templateId: 'fd-rate',
    name: 'Fixed Deposit Interest Rate',
    description: 'Returns the FD interest rate (%) based on the deposit term. Variable: days = FD tenure in days.',
    category: 'Calculation',
    expressionTemplate: 'days >= {days365} ? {rate365}m : days >= {days180} ? {rate180}m : {rateMin}m',
    sampleExpression: 'days >= 365 ? 8.0m : days >= 180 ? 7.5m : days >= 90 ? 7.0m : 6.0m',
    contextType: 'Account', returnType: 'decimal', isBuiltIn: true,
    usageInstructions: 'Adjust day thresholds and corresponding rates for your FD product schedule.',
    templateVariables: {
      days365:  { type: 'integer', description: '1-year threshold (days)', defaultValue: 365 },
      days180:  { type: 'integer', description: '6-month threshold (days)', defaultValue: 180 },
      rate365:  { type: 'decimal', description: 'Rate for ≥ 1 year (%)', defaultValue: 8.0 },
      rate180:  { type: 'decimal', description: 'Rate for ≥ 6 months (%)', defaultValue: 7.5 },
      rateMin:  { type: 'decimal', description: 'Base rate (%)', defaultValue: 6.0 },
    },
    sortOrder: 10, createdAt: NOW, updatedAt: NOW,
  },
];

const CATEGORIES = ['All', 'Loan Management', 'Calculation', 'Validation', 'Transaction Processing', 'Risk Assessment', 'Compliance'];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

export const ExpressionTemplates: React.FC<ExpressionTemplatesProps> = ({
  onUseTemplate,
  onCreateFromTemplate
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [selectedTemplate, setSelectedTemplate] = React.useState<ExpressionTemplate | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [customTemplates, setCustomTemplates] = React.useState<ExpressionTemplate[]>([]);
  const [tabValue, setTabValue] = React.useState(0);

  // Load custom templates on mount
  React.useEffect(() => {
    loadCustomTemplates();
  }, []);

  const loadCustomTemplates = async () => {
    try {
      const templates = await expressionService.getTemplates();
      setCustomTemplates(templates.filter(t => !t.isBuiltIn));
    } catch (error) {
      console.error('Failed to load custom templates:', error);
    }
  };

  const allTemplates = React.useMemo(() => {
    return [...BUILT_IN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  const filteredTemplates = React.useMemo(() => {
    let templates = allTemplates;

    // Filter by tab (built-in vs custom)
    if (tabValue === 0) {
      templates = templates.filter(t => t.isBuiltIn);
    } else {
      templates = templates.filter(t => !t.isBuiltIn);
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      templates = templates.filter(t => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return templates;
  }, [allTemplates, tabValue, selectedCategory, searchQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleUseTemplate = (template: ExpressionTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(template);
    }
  };

  const handleCreateFromTemplate = (template: ExpressionTemplate) => {
    if (onCreateFromTemplate) {
      onCreateFromTemplate(template);
    }
  };

  const previewTemplate = (template: ExpressionTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const generateExpression = (template: ExpressionTemplate, variables: Record<string, any>) => {
    let expression = template.expressionTemplate;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'string' ? `"${value}"` : value.toString();
      expression = expression.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return expression;
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <TemplateIcon color="primary" />
        <Typography variant="h6">Expression Templates</Typography>
      </Box>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab label={`Built-in Templates (${BUILT_IN_TEMPLATES.length})`} />
        <Tab label={`Custom Templates (${customTemplates.length})`} />
      </Tabs>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          fullWidth
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ flex: 2 }}
        />
        
        <FormControl sx={{ flex: 1, minWidth: 120 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            label="Category"
            onChange={(e) => setSelectedCategory(e.target.value as string)}
          >
            {CATEGORIES.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box 
          display="grid" 
          gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" 
          gap={3}
        >
          {filteredTemplates.map((template) => (
            <Card key={template.id} variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" color="primary" noWrap>
                    {template.name}
                  </Typography>
                  <Box display="flex" gap={0.5}>
                    <Tooltip title="Preview template">
                      <IconButton 
                        size="small" 
                        onClick={() => previewTemplate(template)}
                      >
                        <PreviewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy sample">
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(template.sampleExpression)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {template.description}
                </Typography>

                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  <Chip label={template.category} size="small" color="primary" variant="outlined" />
                  <Chip label={template.contextType} size="small" variant="outlined" />
                  <Chip label={template.returnType} size="small" variant="outlined" />
                  {template.isBuiltIn && (
                    <Chip label="Built-in" size="small" color="success" variant="outlined" />
                  )}
                </Box>

                <Box 
                  sx={{ 
                    backgroundColor: 'grey.50', 
                    p: 1, 
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={template.sampleExpression}
                >
                  {template.sampleExpression}
                </Box>
              </CardContent>

              <Box p={2} pt={0}>
                <Box display="flex" gap={1}>
                  {onUseTemplate && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleUseTemplate(template)}
                      startIcon={<ContentCopyIcon />}
                      fullWidth
                    >
                      Use Template
                    </Button>
                  )}
                  {onCreateFromTemplate && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleCreateFromTemplate(template)}
                      startIcon={<AddIcon />}
                      fullWidth
                    >
                      Create Expression
                    </Button>
                  )}
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {customTemplates.length === 0 ? (
          <Box textAlign="center" py={8}>
            <TemplateIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Custom Templates
            </Typography>
            <Typography color="text.secondary">
              Create your first custom template by saving an expression as a template.
            </Typography>
          </Box>
        ) : (
          <Box 
            display="grid" 
            gridTemplateColumns="repeat(auto-fill, minmax(300px, 1fr))" 
            gap={3}
          >
            {filteredTemplates.map((template) => (
              <Card key={template.id} variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" color="primary" noWrap>
                      {template.name}
                    </Typography>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="Edit template">
                        <IconButton size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Preview template">
                        <IconButton 
                          size="small" 
                          onClick={() => previewTemplate(template)}
                        >
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy sample">
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(template.sampleExpression)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.description}
                  </Typography>

                  <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                    <Chip label={template.category} size="small" color="primary" variant="outlined" />
                    <Chip label={template.contextType} size="small" variant="outlined" />
                    <Chip label={template.returnType} size="small" variant="outlined" />
                    <Chip label="Custom" size="small" color="secondary" variant="outlined" />
                  </Box>

                  <Box 
                    sx={{ 
                      backgroundColor: 'grey.50', 
                      p: 1, 
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={template.sampleExpression}
                  >
                    {template.sampleExpression}
                  </Box>
                </CardContent>

                <Box p={2} pt={0}>
                  <Box display="flex" gap={1}>
                    {onUseTemplate && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleUseTemplate(template)}
                        startIcon={<ContentCopyIcon />}
                        fullWidth
                      >
                        Use Template
                      </Button>
                    )}
                    {onCreateFromTemplate && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleCreateFromTemplate(template)}
                        startIcon={<AddIcon />}
                        fullWidth
                      >
                        Create Expression
                      </Button>
                    )}
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Template Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTemplate?.name} - Template Preview
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {selectedTemplate.description}
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={1} my={2}>
                <Chip label={selectedTemplate.category} size="small" color="primary" />
                <Chip label={`Context: ${selectedTemplate.contextType}`} size="small" />
                <Chip label={`Returns: ${selectedTemplate.returnType}`} size="small" />
              </Box>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Template
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
                {selectedTemplate.expressionTemplate}
              </Box>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Sample Expression
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
                {selectedTemplate.sampleExpression}
              </Box>

              {selectedTemplate.usageInstructions && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    Usage Instructions
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedTemplate.usageInstructions}
                  </Typography>
                </>
              )}

              {selectedTemplate.templateVariables && Object.keys(selectedTemplate.templateVariables).length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                    Template Variables
                  </Typography>
                  {Object.entries(selectedTemplate.templateVariables).map(([key, variable]) => (
                    <Box key={key} sx={{ mb: 1 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="bold">
                          {key}
                        </Typography>
                        <Chip label={variable.type} size="small" variant="outlined" />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {variable.description} (Default: {variable.defaultValue})
                      </Typography>
                    </Box>
                  ))}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {selectedTemplate && (
            <>
              {onUseTemplate && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    handleUseTemplate(selectedTemplate);
                    setPreviewDialogOpen(false);
                  }}
                  startIcon={<ContentCopyIcon />}
                >
                  Use Template
                </Button>
              )}
              {onCreateFromTemplate && (
                <Button
                  variant="contained"
                  onClick={() => {
                    handleCreateFromTemplate(selectedTemplate);
                    setPreviewDialogOpen(false);
                  }}
                  startIcon={<AddIcon />}
                >
                  Create Expression
                </Button>
              )}
            </>
          )}
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {filteredTemplates.length === 0 && searchQuery && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">
            No templates found matching "{searchQuery}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ExpressionTemplates;
