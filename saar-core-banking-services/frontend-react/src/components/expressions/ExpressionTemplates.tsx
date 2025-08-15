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

// Built-in templates
const BUILT_IN_TEMPLATES: ExpressionTemplate[] = [
  {
    id: '1',
    templateId: 'age-validation',
    name: 'Age Validation',
    description: 'Validates customer age within specified range',
    category: 'Validation',
    expressionTemplate: 'customer.Age >= {minAge} && customer.Age <= {maxAge}',
    sampleExpression: 'customer.Age >= 18 && customer.Age <= 65',
    contextType: 'Customer',
    returnType: 'boolean',
    usageInstructions: 'Replace {minAge} and {maxAge} with actual age limits',
    isBuiltIn: true,
    templateVariables: {
      minAge: { type: 'integer', description: 'Minimum age limit', defaultValue: 18 },
      maxAge: { type: 'integer', description: 'Maximum age limit', defaultValue: 65 }
    },
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    templateId: 'balance-check',
    name: 'Minimum Balance Check',
    description: 'Validates account has minimum balance',
    category: 'Validation',
    expressionTemplate: 'banking.GetAccountBalance(account.AccountNumber) >= {minBalance}',
    sampleExpression: 'banking.GetAccountBalance(account.AccountNumber) >= 1000m',
    contextType: 'Account',
    returnType: 'boolean',
    usageInstructions: 'Replace {minBalance} with required minimum balance',
    isBuiltIn: true,
    templateVariables: {
      minBalance: { type: 'decimal', description: 'Minimum balance required', defaultValue: 1000 }
    },
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    templateId: 'simple-interest',
    name: 'Simple Interest Calculation',
    description: 'Calculates simple interest',
    category: 'Calculation',
    expressionTemplate: 'banking.CalculateSimpleInterest({principal}, {rate}, {days})',
    sampleExpression: 'banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)',
    contextType: 'Account',
    returnType: 'decimal',
    usageInstructions: 'Replace parameters with actual values or variables',
    isBuiltIn: true,
    templateVariables: {
      principal: { type: 'decimal', description: 'Principal amount', defaultValue: 10000 },
      rate: { type: 'decimal', description: 'Annual interest rate percentage', defaultValue: 5.5 },
      days: { type: 'integer', description: 'Number of days', defaultValue: 30 }
    },
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const CATEGORIES = ['All', 'Validation', 'Calculation', 'Risk Assessment', 'Loan Management', 'Transaction Processing', 'Compliance'];

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

  const useTemplate = (template: ExpressionTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(template);
    }
  };

  const createFromTemplate = (template: ExpressionTemplate) => {
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
                      onClick={() => useTemplate(template)}
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
                      onClick={() => createFromTemplate(template)}
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
                        onClick={() => useTemplate(template)}
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
                        onClick={() => createFromTemplate(template)}
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
                    useTemplate(selectedTemplate);
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
                    createFromTemplate(selectedTemplate);
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
