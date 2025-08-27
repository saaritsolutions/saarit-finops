import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Autocomplete,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  useTheme,
  alpha,
  Badge,
  Avatar,
  Tab,
  Tabs
} from '@mui/material';
import {
  ExpandMore,
  Save,
  Cancel,
  Code,
  PlayArrow,
  Help,
  Lightbulb,
  Settings,
  Visibility,
  VisibilityOff,
  ContentCopy,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Info,
  Timeline,
  Description,
  Category,
  Label,
  Functions,
  Speed,
  Psychology,
  Security,
  DataObject,
  Transform,
  Build,
  AutoAwesome,
  RocketLaunch,
  TrendingUp,
  Analytics
} from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';

import {
  ExpressionDefinition,
  CreateExpressionRequest,
  UpdateExpressionRequest,
  BankingFunction,
  ExpressionTemplate,
  EXPRESSION_CATEGORIES,
  CONTEXT_TYPES,
  RETURN_TYPES,
  USAGE_TYPES
} from '../../types/expression';

import { expressionService } from '../../services/expressionService';

interface ExpressionEditorProps {
  expression?: ExpressionDefinition | null;
  isEditing: boolean;
  bankingFunctions: BankingFunction[];
  templates: ExpressionTemplate[];
  onSave: (expression: CreateExpressionRequest | UpdateExpressionRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

const ExpressionEditor: React.FC<ExpressionEditorProps> = ({
  expression,
  isEditing,
  bankingFunctions,
  templates,
  onSave,
  onCancel,
  loading
}) => {
  const [formData, setFormData] = useState({
    expressionId: '',
    name: '',
    description: '',
    category: '',
    subCategory: '',
    expressionText: '',
    returnType: 'boolean',
    contextType: 'Customer',
    usageType: 'Validation',
    tags: [] as string[],
    variables: {} as Record<string, any>
  });

  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<BankingFunction | null>(null);

  useEffect(() => {
    if (expression && isEditing) {
      setFormData({
        expressionId: expression.expressionId,
        name: expression.name,
        description: expression.description || '',
        category: expression.category,
        subCategory: expression.subCategory || '',
        expressionText: expression.expressionText,
        returnType: expression.returnType,
        contextType: expression.contextType,
        usageType: expression.usageType,
        tags: expression.tags || [],
        variables: expression.variables || {}
      });
    } else if (!isEditing) {
      // Reset form for new expression
      setFormData({
        expressionId: '',
        name: '',
        description: '',
        category: '',
        subCategory: '',
        expressionText: '',
        returnType: 'boolean',
        contextType: 'Customer',
        usageType: 'Validation',
        tags: [],
        variables: {}
      });
    }
  }, [expression, isEditing]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleValidateExpression = async () => {
    if (!formData.expressionText.trim()) return;

    setValidating(true);
    try {
      const result = await expressionService.validateExpression({
        expressionText: formData.expressionText,
        contextType: formData.contextType,
        returnType: formData.returnType,
        variables: formData.variables
      });
      setValidationResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        errors: ['Validation service unavailable'],
        warnings: []
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = () => {
    const expressionData = {
      expressionId: formData.expressionId,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      subCategory: formData.subCategory,
      expressionText: formData.expressionText,
      returnType: formData.returnType,
      contextType: formData.contextType,
      usageType: formData.usageType,
      tags: formData.tags,
      variables: formData.variables
    };

    if (expression && isEditing) {
      // Remove expressionId for update (it shouldn't change)
      const { expressionId, ...updateData } = expressionData;
      onSave(updateData);
    } else {
      onSave(expressionData);
    }
  };

  const insertFunctionAtCursor = (functionCall: string) => {
    const textarea = document.getElementById('expression-text') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.expressionText;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + functionCall + after;
      
      handleInputChange('expressionText', newText);
      
      // Set cursor position after the inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + functionCall.length, start + functionCall.length);
      }, 0);
    }
  };

  const getFunctionCall = (func: BankingFunction) => {
    const params = func.parameters.map(p => {
      switch (p.type) {
        case 'string':
          return `"${p.defaultValue || 'value'}"`;
        case 'decimal':
          return `${p.defaultValue || '0'}m`;
        case 'integer':
          return `${p.defaultValue || '0'}`;
        case 'boolean':
          return `${p.defaultValue || 'true'}`;
        default:
          return p.defaultValue || 'value';
      }
    }).join(', ');

    return `banking.${func.name}(${params})`;
  };

  const isFormValid = () => {
    return formData.name.trim() && 
           formData.expressionText.trim() && 
           formData.category && 
           (!expression || formData.expressionId.trim());
  };

  if (!isEditing && !expression) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Select an expression to view or click "Create Expression" to add a new one.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          {expression && isEditing ? 'Edit Expression' : 
           expression ? 'View Expression' : 'Create Expression'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            id="btn-help"
            name="help"
            data-testid="btn-help"
            startIcon={<Help />}
            onClick={() => setShowHelp(true)}
            variant="outlined"
            size="small"
          >
            Help
          </Button>
          {isEditing && (
            <>
              <LoadingButton
                id="btn-validate"
                name="validate"
                data-testid="btn-validate"
                startIcon={<PlayArrow />}
                onClick={handleValidateExpression}
                loading={validating}
                variant="outlined"
                size="small"
              >
                Validate
              </LoadingButton>
              <Button
                id="btn-cancel"
                name="cancel"
                data-testid="btn-cancel"
                onClick={onCancel}
                variant="outlined"
                size="small"
                startIcon={<Cancel />}
              >
                Cancel
              </Button>
              <LoadingButton
                id="btn-save"
                name="save"
                data-testid="btn-save"
                onClick={handleSave}
                loading={loading}
                variant="contained"
                size="small"
                disabled={!isFormValid()}
                startIcon={<Save />}
              >
                Save
              </LoadingButton>
            </>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Main Form */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3 }}>
            {/* Basic Information */}
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              {!expression && (
                <TextField
                  label="Expression ID"
                  value={formData.expressionId}
                  onChange={(e) => handleInputChange('expressionId', e.target.value)}
                  disabled={!isEditing}
                  required
                  helperText="Unique identifier for this expression"
                  fullWidth
                />
              )}
              
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!isEditing}
                required
                fullWidth
              />
              
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={!isEditing}
                multiline
                rows={2}
                fullWidth
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    disabled={!isEditing}
                    label="Category"
                    required
                  >
                    {EXPRESSION_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  label="Sub Category"
                  value={formData.subCategory}
                  onChange={(e) => handleInputChange('subCategory', e.target.value)}
                  disabled={!isEditing}
                  fullWidth
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Context Type</InputLabel>
                  <Select
                    value={formData.contextType}
                    onChange={(e) => handleInputChange('contextType', e.target.value)}
                    disabled={!isEditing}
                    label="Context Type"
                  >
                    {CONTEXT_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel>Return Type</InputLabel>
                  <Select
                    value={formData.returnType}
                    onChange={(e) => handleInputChange('returnType', e.target.value)}
                    disabled={!isEditing}
                    label="Return Type"
                  >
                    {RETURN_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl fullWidth>
                  <InputLabel>Usage Type</InputLabel>
                  <Select
                    value={formData.usageType}
                    onChange={(e) => handleInputChange('usageType', e.target.value)}
                    disabled={!isEditing}
                    label="Usage Type"
                  >
                    {USAGE_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              <Autocomplete
                multiple
                options={[
                  'validation', 'calculation', 'risk', 'loan', 'account', 
                  'transaction', 'customer', 'compliance', 'reporting'
                ]}
                value={formData.tags}
                onChange={(_, newValue) => handleInputChange('tags', newValue)}
                disabled={!isEditing}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Add tags..."
                  />
                )}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Expression Code */}
            <Typography variant="h6" gutterBottom>
              Expression Code
            </Typography>
            
            <TextField
              id="expression-text"
              label="Expression Code"
              value={formData.expressionText}
              onChange={(e) => handleInputChange('expressionText', e.target.value)}
              disabled={!isEditing}
              multiline
              rows={8}
              fullWidth
              required
              inputProps={{
                'data-testid': 'expression-editor',
                name: 'expression-text'
              }}
              sx={{ 
                mb: 2,
                '& .MuiInputBase-input': { 
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  fontSize: '14px'
                }
              }}
              helperText="Write your C# expression using available context properties and banking functions"
            />

            {/* Validation Result */}
            {validationResult && (
              <Box sx={{ mb: 2 }}>
                {validationResult.isValid ? (
                  <Alert severity="success">
                    Expression is valid!
                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" fontWeight="bold">Warnings:</Typography>
                        <ul>
                          {validationResult.warnings.map((warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </Box>
                    )}
                  </Alert>
                ) : (
                  <Alert severity="error">
                    <Typography variant="body2" fontWeight="bold">Validation Errors:</Typography>
                    <ul>
                      {validationResult.errors?.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </Box>
            )}
          </Paper>
        </Box>

        {/* Banking Functions Panel */}
        {isEditing && (
          <Box sx={{ width: 350 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Banking Functions
              </Typography>
              
              <List dense>
                {bankingFunctions.slice(0, 10).map((func) => (
                  <ListItem key={func.name} disablePadding>
                    <ListItemButton
                      onClick={() => insertFunctionAtCursor(getFunctionCall(func))}
                    >
                      <ListItemText
                        primary={func.name}
                        secondary={func.description}
                        primaryTypographyProps={{ fontSize: '0.875rem' }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              
              <Button
                fullWidth
                size="small"
                onClick={() => setShowHelp(true)}
                startIcon={<Lightbulb />}
                sx={{ mt: 1 }}
              >
                View All Functions
              </Button>
            </Paper>
          </Box>
        )}
      </Box>

      {/* Help Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>Expression Builder Help</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Available Context Properties
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Customer:</strong> customer.CustomerId, customer.Age, customer.Name<br />
            <strong>Account:</strong> account.AccountNumber, account.Balance, account.Type<br />
            <strong>Transaction:</strong> transaction.Amount, transaction.Type, transaction.Date<br />
            <strong>Loan:</strong> loan.Amount, loan.Term, loan.Rate
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Expression Examples
          </Typography>
          <Box component="pre" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, fontSize: '0.875rem' }}>
            {`// Simple validation
customer.Age >= 18 && customer.Age <= 65

// Loan eligibility
banking.IsEligibleForLoan(customer.CustomerId, 50000m, "PERSONAL") && 
customer.Age >= 21

// Risk assessment
banking.CalculateRiskScore(customer.CustomerId, transaction.Amount) < 75m

// Interest calculation
banking.CalculateSimpleInterest(account.Balance, 5.5m, 30)`}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExpressionEditor;
