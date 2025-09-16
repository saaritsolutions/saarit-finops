import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Divider, Paper, Stack, Tab, Tabs, TextField, Typography, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip, Alert } from '@mui/material';
import { Edit, Delete, PlayArrow, Refresh } from '@mui/icons-material';
import StatusBanner from '../components/common/StatusBanner';
import ChatPanel from '../components/common/ChatPanel';
import SchemaForm from '../components/forms/SchemaForm';
import type { FormSchema } from '../services/aiFormService';
import { aiFormService } from '../services/aiFormService';
import expressionService from '../services/expressionService';

export default function AdminConfig() {
  const [workflowJson, setWorkflowJson] = useState('');
    const [schemaJson, setSchemaJson] = useState<string>('{}');
  const [originalSchemaJson, setOriginalSchemaJson] = useState<string>('{}'); // Store original form
  const [schemaModifiedByAI, setSchemaModifiedByAI] = useState<boolean>(false); // Track if AI modified the schema
  const [loading, setLoading] = useState(false);
  const baseUrl = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
  const aiBase = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const workflowType = 'LOAN_ORIGINATION';
  const productType = 'PERSONAL_LOAN';
  const [msg, setMsg] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [exprOutput, setExprOutput] = useState('');
  const [exprMsg, setExprMsg] = useState<string | null>(null);
  const [exprId, setExprId] = useState('EXPR_LOAN_E2E');
  const [expressions, setExpressions] = useState<any[]>([]);
  const [loadingExpressions, setLoadingExpressions] = useState(false);
  const [selectedExpression, setSelectedExpression] = useState<any | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalExpression, setOriginalExpression] = useState('');
  const [syntaxCorrections, setSyntaxCorrections] = useState<string[]>([]);
  const [schemaMsg, setSchemaMsg] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setMsg(null);
    try {
      // Load workflow configuration
      const wf = await fetch(`${baseUrl}/api/admin/config/workflow/${workflowType}`).then(r => r.json());
      setWorkflowJson(JSON.stringify(wf, null, 2));
      
      // Load form schema with better error handling
      const schemaResponse = await fetch(`${baseUrl}/api/admin/config/forms/${productType}`);
      if (!schemaResponse.ok) {
        throw new Error(`Failed to load form schema: ${schemaResponse.status} ${schemaResponse.statusText}`);
      }
      const schema = await schemaResponse.text();
      
      // Validate that we got valid JSON
        try {
          JSON.parse(schema);
          setSchemaJson(schema);
          setOriginalSchemaJson(schema); // Store original schema
          setSchemaModifiedByAI(false); // Reset AI modification flag
          setMsg('Configuration loaded successfully');
        } catch (parseError) {
          console.error('Invalid JSON in form schema:', parseError);
          throw new Error('Form schema contains invalid JSON');
        }    } catch (e:any) {
      console.error('Failed to load config:', e);
      setMsg(e?.message || 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpressions = async () => {
    setLoadingExpressions(true);
    try {
      const response = await fetch(`${aiBase}/api/expressions?page=1&pageSize=50`);
      const data = await response.json();
      setExpressions(data.expressions || []);
    } catch (e: any) {
      console.error('Failed to fetch expressions:', e);
    } finally {
      setLoadingExpressions(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Load expressions when switching to expressions tab
  useEffect(() => {
    if (tab === 2) {
      fetchExpressions();
    }
  }, [tab]);

  // Allow deep linking to a specific tab via ?tab=form|workflow|expressions
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const t = (qs.get('tab') || '').toLowerCase();
      if (t === 'form') setTab(0);
      else if (t === 'workflow') setTab(1);
      else if (t === 'expressions') setTab(2);
    } catch { /* ignore */ }
  }, []);

  const saveWorkflow = async () => {
    setMsg(null);
    await fetch(`${baseUrl}/api/admin/config/workflow/${workflowType}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: workflowJson });
    setMsg('Workflow saved');
  };

  const resetToDefaultForm = async () => {
    setMsg(null);
    setSchemaMsg(null);
    try {
      // Load the default form schema from the source
      const defaultSchema = {
        "productType": "PERSONAL_LOAN",
        "title": "Personal Loan Application",
        "fields": [
          { "name": "fullName", "label": "Full Name", "type": "text", "required": true },
          { "name": "email", "label": "Email", "type": "text", "required": true },
          { "name": "loanAmount", "label": "Loan Amount", "type": "number", "required": true, "min": 10000 },
          { "name": "tenureMonths", "label": "Tenure (Months)", "type": "number", "required": true, "min": 6 },
          { "name": "monthlyIncome", "label": "Monthly Income", "type": "number", "required": true, "min": 0 },
          { "name": "creditScore", "label": "Credit Score", "type": "number", "required": true, "min": 300, "max": 900 }
        ]
      };
      
      const schemaJson = JSON.stringify(defaultSchema, null, 2);
      setSchemaJson(schemaJson);
      setOriginalSchemaJson(schemaJson);
      setSchemaModifiedByAI(false);
      setSchemaMsg('Form reset to default schema');
    } catch (e: any) {
      setSchemaMsg(e?.message || 'Failed to reset form to default');
    }
  };

  const revertAIChanges = () => {
    setSchemaJson(originalSchemaJson);
    setSchemaModifiedByAI(false);
    setSchemaMsg('Reverted to original form schema');
  };

  const saveSchema = async () => {
    setMsg(null);
    if (schemaModifiedByAI) {
      const confirmSave = window.confirm(
        'This form has been modified by AI. Are you sure you want to save these changes? This will permanently replace the original form schema.'
      );
      if (!confirmSave) {
        setMsg('Save cancelled');
        return;
      }
    }
    
    try {
      await fetch(`${baseUrl}/api/admin/config/forms/${productType}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: schemaJson 
      });
      setMsg('Form schema saved');
      setOriginalSchemaJson(schemaJson); // Update original to match saved version
      setSchemaModifiedByAI(false); // Reset AI modification flag
    } catch (e: any) {
      setMsg('Failed to save form schema: ' + (e?.message || 'Unknown error'));
    }
  };

  const chatSchema = async (message: string) => {
    setSchemaMsg(null);
    setLoading(true); // Start loading for forms AI
    try {
      const result = await aiFormService.chatSchema({
        Message: message,
        CurrentSchemaJson: schemaJson,
        Category: 'form',
        FormOnly: true,
      });
      
      if (result) {
        const newSchemaJson = JSON.stringify(result, null, 2);
        setSchemaJson(newSchemaJson);
        setSchemaModifiedByAI(true); // Mark as modified by AI
        setSchemaMsg('Schema updated from AI - Review before saving!');
      } else {
        setSchemaMsg('No schema updates received from AI');
      }
    } catch (e: any) {
      setSchemaMsg(e?.message || 'Failed to update schema from AI');
    } finally {
      setLoading(false); // Stop loading for forms AI
    }
  };

  const chatWorkflow = async (message: string) => {
    setChatMsg(null);
    setLoading(true); // Start loading for workflow AI
    try {
      const res = await fetch(`${aiBase}/api/aiworkflow/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentWorkflowJson: workflowJson, workflowType })
      });
      if (!res.ok) throw new Error(`Chat failed (${res.status})`);
      const text = await res.text();
      JSON.parse(text);
      setWorkflowJson(text);
      setChatMsg('Workflow updated from AI');
    } catch (e:any) {
      setChatMsg(e?.message || 'Failed to update workflow from AI');
    } finally {
      setLoading(false); // Stop loading for workflow AI
    }
  };

  const chatExpression = async (message: string) => {
    setExprOutput('');
    setExprMsg(null);
    setSyntaxCorrections([]); // Clear previous corrections
    setLoading(true); // Start loading for expression AI
    try {
      const res = await fetch(`${aiBase}/api/aiexpression/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, category: 'expression' })
      });
      if (!res.ok) throw new Error(`Expression chat failed (${res.status})`);
      const json = await res.json();
      // Controller returns { response: string | object }
      let content = '';
      const resp = json?.response;
      if (typeof resp === 'string') {
        content = resp;
      } else if (resp && typeof resp === 'object') {
        // Try common keys first
        const maybe = resp.expressionText || resp.expression || resp.content || resp.text;
        if (typeof maybe === 'string' && maybe.trim()) {
          content = maybe;
        } else {
          content = JSON.stringify(resp, null, 2);
        }
      }
      setExprOutput(content);
    } catch (e: any) {
      setExprOutput(e?.message || 'Failed to get expression from AI');
    } finally {
      setLoading(false); // Stop loading for expression AI
    }
  };

  const extractRawExpression = (text: string): string | null => {
    if (!text) return null;
    
    // If JSON-ish, try to parse and pick known fields
    try {
      const obj = JSON.parse(text);
      const maybe = obj?.expressionText || obj?.expression || obj?.content || obj?.text;
      if (typeof maybe === 'string' && maybe.trim()) return maybe.trim();
    } catch { /* ignore */ }
    
    // Try to extract the first fenced code block
    const fence = text.match(/```[a-zA-Z0-9]*\n([\s\S]*?)```/);
    if (fence && fence[1]) return fence[1].trim();
    
    // If it looks like an inline C# ternary we expect, just return trimmed
    if (/\?\s*"APPROVED"\s*:\s*"DECLINED"/i.test(text) || /\bAND\b|&&|\|\|/.test(text)) {
      return text.trim();
    }
    
    // Check if it looks like a simple expression (contains comparison operators, variable names, etc.)
    const trimmed = text.trim();
    if (/^[a-zA-Z_][a-zA-Z0-9_.\s]*\s*[><=!&|+\-*\/()]*\s*[a-zA-Z0-9_.\s"']*$/.test(trimmed)) {
      return trimmed;
    }
    
    // If nothing else works, return the trimmed text if it's not too long and looks expression-like
    if (trimmed.length < 200 && (
      /[><=!&|]/.test(trimmed) || // Contains operators
      /\b(creditScore|monthlyIncome|age|amount|balance)\b/.test(trimmed) || // Contains known variables
      /^\w+$/.test(trimmed) // Single word (could be a simple variable)
    )) {
      return trimmed;
    }
    
    return null;
  };

  const fixExpressionSyntax = (expression: string): string => {
    const corrections: string[] = [];
    let fixed = expression;
    
    // Fix decimal suffix: change 0.4m to 0.4 (remove lowercase m)
    const beforeDecimal = fixed;
    fixed = fixed.replace(/(\d+\.?\d*)[mM]\b/g, '$1');
    if (fixed !== beforeDecimal) {
      corrections.push('Removed decimal suffix "m" (not supported in C# expression compilation)');
    }
    
    // Fix object references for Loan context: Customer.prop -> just use flattened variables
    // Catch ANY customer property, not just specific ones
    const beforeCustomer = fixed;
    fixed = fixed
      .replace(/\bcustomer\.([a-zA-Z][a-zA-Z0-9]*)\b/g, '$1')
      .replace(/\bCustomer\.([a-zA-Z][a-zA-Z0-9]*)\b/g, '$1');
    if (fixed !== beforeCustomer) {
      corrections.push('Changed "customer.property" to flattened variable access for Loan context');
    }
    
    // Fix loan object references too
    const beforeLoan = fixed;
    fixed = fixed
      .replace(/\bloan\.([a-zA-Z][a-zA-Z0-9]*)\b/g, (match, prop) => {
        // Convert common loan properties to their flattened equivalents
        if (prop.toLowerCase() === 'requestedamount') return 'requestedAmount';
        if (prop.toLowerCase() === 'amount') return 'requestedAmount';
        return prop; // Use the property name as-is for others
      })
      .replace(/\bLoan\.([a-zA-Z][a-zA-Z0-9]*)\b/g, (match, prop) => {
        if (prop.toLowerCase() === 'requestedamount') return 'requestedAmount';
        if (prop.toLowerCase() === 'amount') return 'requestedAmount';
        return prop;
      });
    if (fixed !== beforeLoan) {
      corrections.push('Changed "loan.property" to flattened variable access for Loan context');
    }
    
    // Update the corrections state
    setSyntaxCorrections(corrections);
    
    return fixed;
  };

  const getReturnTypeFromExpression = (expression: string): string => {
    // Comparison operators typically return boolean
    if (/[><=!]+|&&|\|\|/.test(expression)) {
      return 'boolean';
    }
    
    // Math operations typically return numbers
    if (/[+\-*\/]/.test(expression) && !/["']/.test(expression)) {
      return 'decimal';
    }
    
    // String concatenation or contains string literals
    if (/["']|\+.*["']|["'].*\+/.test(expression)) {
      return 'string';
    }
    
    // Ternary expressions that return strings
    if (/\?.*["'].*:.*["']/.test(expression)) {
      return 'string';
    }
    
    // Default to boolean for validation expressions
    return 'boolean';
  };

  const getContextTypeFromExpression = (expression: string): string => {
    // Check what objects/properties are being used to determine best context
    if (expression.includes('account.') || expression.includes('Account.')) {
      return 'Account';
    }
    if (expression.includes('transaction.') || expression.includes('Transaction.')) {
      return 'Transaction';
    }
    // For Loan context - check for any customer/loan references or known loan variables
    if (expression.includes('customer.') || expression.includes('Customer.') || 
        expression.includes('loan.') || expression.includes('Loan.') ||
        expression.includes('creditScore') || expression.includes('monthlyIncome') ||
        expression.includes('requestedAmount') || expression.includes('RequestedAmount') ||
        expression.includes('age') || expression.includes('debtToIncomeRatio')) {
      return 'Loan'; // Loan context provides access to both customer and loan properties as flattened variables
    }
    return 'Customer'; // Default fallback
  };

  const saveExpressionFromAI = async () => {
    setExprMsg(null);
    const raw = extractRawExpression(exprOutput);
    if (!raw) {
      setExprMsg('Could not parse expression from AI response. Ask for "expression only".');
      return;
    }
    
    // Fix syntax issues automatically
    const fixedExpression = fixExpressionSyntax(raw);
    const shouldShowFix = fixedExpression !== raw;
    
    try {
      // Check if we're editing an existing expression or creating new
      if (isEditMode && selectedExpression) {
        // Update existing expression
        await expressionService.updateExpression(selectedExpression.id, { 
          expressionText: fixedExpression,
          name: selectedExpression.name + (fixedExpression !== originalExpression ? ' (Modified)' : ''),
          description: selectedExpression.description + (fixedExpression !== originalExpression ? ' - AI Modified' : '')
        });
        setExprMsg(`✅ Expression ${selectedExpression.expressionId} updated successfully.${shouldShowFix ? ' (Syntax auto-fixed)' : ''}`);
        // Refresh the expressions list
        fetchExpressions();
      } else {
        // Create new expression
        let existing: any | null = null;
        try {
          existing = await expressionService.getExpressionByExpressionId(exprId);
        } catch { existing = null; }

        if (existing && existing.id) {
          // For expressions with different return types, we need to recreate rather than update
          // because the update endpoint doesn't support changing returnType/contextType
          const contextType = selectedExpression?.contextType || getContextTypeFromExpression(fixedExpression);
          const returnType = selectedExpression?.returnType || getReturnTypeFromExpression(fixedExpression);
          
          // If return type changed, delete and recreate
          if (existing.returnType !== returnType || existing.contextType !== contextType) {
            await expressionService.deleteExpression(existing.id);
            await expressionService.createExpression({
              expressionId: exprId,
              name: existing.name,
              description: existing.description,
              category: existing.category,
              subCategory: existing.subCategory,
              expressionText: fixedExpression,
              returnType: returnType,
              contextType: contextType,
              usageType: existing.usageType || 'Validation',
              tags: existing.tags || [],
              variables: existing.variables || {}
            });
          } else {
            // Safe to update if types haven't changed
            await expressionService.updateExpression(existing.id, { 
              expressionText: fixedExpression
            });
          }
          setExprMsg(`✅ Expression ${exprId} updated.${shouldShowFix ? ' (Syntax auto-fixed)' : ''}`);
        } else {
          // Determine context type and return type intelligently
          const contextType = selectedExpression?.contextType || getContextTypeFromExpression(fixedExpression);
          const returnType = selectedExpression?.returnType || getReturnTypeFromExpression(fixedExpression);
          const category = selectedExpression?.category || 'Validation';
          
          await expressionService.createExpression({
            expressionId: exprId,
            name: isEditMode ? `${selectedExpression.name} (New Version)` : 'AI Generated Rule',
            description: isEditMode ? `Modified from ${selectedExpression.expressionId}` : 'Generated via Admin Config AI',
            category: category,
            subCategory: selectedExpression?.subCategory || 'Loan',
            expressionText: fixedExpression,
            returnType: returnType,
            contextType: contextType,
            usageType: selectedExpression?.usageType || 'Validation',
            tags: [...(selectedExpression?.tags || []), 'ai', 'generated'],
            variables: selectedExpression?.variables || {}
          });
          setExprMsg(`New expression ${exprId} created successfully.`);
          // Refresh the expressions list
          fetchExpressions();
        }
      }
    } catch (e: any) {
      console.error('Expression save error:', e);
      let errorMsg = 'Failed to save expression';
      
      // Provide specific guidance for common errors
      if (e?.message?.includes('does not exist in the current context')) {
        // Try to auto-fix the expression if it has object references
        const autoFixed = fixExpressionSyntax(fixedExpression);
        if (autoFixed !== fixedExpression) {
          setExprOutput(autoFixed);
          errorMsg = '❌ Auto-fixed: Changed object references to flattened variables. Try saving again.';
        } else {
          errorMsg = '❌ Context Error: Use flattened variables (creditScore, monthlyIncome, requestedAmount) for Loan context, not object.property syntax.';
        }
      } else if (e?.message?.includes('validation failed')) {
        errorMsg = '❌ Validation Error: Check expression syntax. For Loan context, use: creditScore >= 700 && monthlyIncome >= 100000 && requestedAmount <= monthlyIncome * 12';
      } else if (e?.message?.includes('0.4m')) {
        errorMsg = '❌ Syntax Error: Use 0.4 or 0.4M instead of 0.4m for decimal literals';
      } else if (e?.response?.data?.error) {
        errorMsg = `❌ ${e.response.data.error}`;
      } else if (e?.message) {
        errorMsg = `❌ ${e.message}`;
      }
      
      setExprMsg(errorMsg);
    }
  };

  const loadExpressionForEditing = (expr: any) => {
    setSelectedExpression(expr);
    setExprId(expr.expressionId);
    setExprOutput(expr.expressionText);
    setOriginalExpression(expr.expressionText);
    setIsEditMode(true);
    setExprMsg(`Loaded ${expr.expressionId} for editing`);
  };

  const createNewExpression = () => {
    setSelectedExpression(null);
    setExprId('EXPR_NEW_' + Date.now());
    setExprOutput('');
    setOriginalExpression('');
    setIsEditMode(false);
    setSyntaxCorrections([]); // Clear any previous corrections
    setExprMsg('Ready to create new expression');
  };

  const manualSyntaxCheck = () => {
    if (!exprOutput.trim()) {
      setExprMsg('Please enter an expression first');
      return;
    }
    
    const originalExpression = exprOutput;
    const correctedExpression = fixExpressionSyntax(originalExpression);
    
    if (correctedExpression !== originalExpression) {
      setExprOutput(correctedExpression);
      setExprMsg('✅ Expression auto-corrected! Check the corrections shown above.');
    } else {
      setExprMsg('✅ Expression syntax looks good - no corrections needed.');
      setSyntaxCorrections([]); // Clear any previous corrections
    }
  };

  const chatExpressionWithContext = async (message: string) => {
    setExprOutput('');
    setExprMsg(null);
    setLoading(true);
    try {
      // Add context about current rule if editing
      let contextualMessage = message;
      if (isEditMode && selectedExpression) {
        contextualMessage = `Current rule: "${selectedExpression.expressionText}". ${message}. Return expression only.`;
      } else {
        contextualMessage = `${message}. Return expression only.`;
      }

      const res = await fetch(`${aiBase}/api/aiexpression/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contextualMessage, category: 'expression' })
      });
      if (!res.ok) throw new Error(`Expression chat failed (${res.status})`);
      const json = await res.json();
      
      let content = '';
      const resp = json?.response;
      if (typeof resp === 'string') {
        content = resp;
      } else if (resp && typeof resp === 'object') {
        const maybe = resp.expressionText || resp.expression || resp.content || resp.text;
        if (typeof maybe === 'string' && maybe.trim()) {
          content = maybe;
        } else {
          content = JSON.stringify(resp, null, 2);
        }
      }
      setExprOutput(content);
    } catch (e: any) {
      setExprOutput(e?.message || 'Failed to get expression from AI');
    } finally {
      setLoading(false);
    }
  };

  const parsedSchema: FormSchema | null = useMemo(() => {
    try { return JSON.parse(schemaJson); } catch { return null; }
  }, [schemaJson]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin Config</Typography>
      <StatusBanner message={`LoanService: ${baseUrl} | ExpressionBuilderService (AI): ${aiBase}`} severity="info" />
      <StatusBanner message={msg} severity="info" />
      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Admin Config Tabs" variant="scrollable" scrollButtons="auto">
          <Tab label={`Form (${productType})`} />
          <Tab label={`Workflow (${workflowType})`} />
          <Tab label="Expressions" data-testid="tab-expressions" />
        </Tabs>
        <Divider sx={{ mb: 2 }} />

        {tab === 0 && (
          <Box>
            <Stack spacing={2}>
              <Card variant="outlined" sx={{ border: schemaModifiedByAI ? '2px solid #ff9800' : '1px solid #e0e0e0' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1">Form Schema JSON</Typography>
                    {schemaModifiedByAI && (
                      <Chip 
                        label="AI Modified" 
                        color="warning" 
                        size="small" 
                        icon={<span>🤖</span>}
                      />
                    )}
                  </Stack>
                  {schemaModifiedByAI && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>⚠️ Schema updated from AI - Review before saving!</strong>
                        <br />
                        The form schema has been modified by AI assistance. Please review the changes carefully before saving to ensure they meet your requirements.
                      </Typography>
                    </Alert>
                  )}
                  <TextField multiline minRows={12} value={schemaJson} onChange={(e) => setSchemaJson(e.target.value)} fullWidth spellCheck={false} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button 
                      variant="contained" 
                      onClick={saveSchema} 
                      disabled={loading}
                      color={schemaModifiedByAI ? "warning" : "primary"}
                      startIcon={schemaModifiedByAI ? <span>⚠️</span> : undefined}
                    >
                      {schemaModifiedByAI ? "Save AI Changes" : "Save Schema"}
                    </Button>
                    <Button variant="outlined" onClick={fetchAll} disabled={loading}>Reload</Button>
                    <Button variant="outlined" onClick={resetToDefaultForm} disabled={loading}>Reset to Default</Button>
                    {schemaModifiedByAI && (
                      <Button 
                        variant="outlined" 
                        onClick={revertAIChanges} 
                        disabled={loading}
                        color="secondary"
                        startIcon={<span>↶</span>}
                      >
                        Revert AI Changes
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <ChatPanel
                title="AI Assistant (Form Schema)"
                placeholder="e.g., Add fields mobileNumber (text, required), dateOfBirth (date), or Remove middleName field"
                helperText={!process.env.REACT_APP_EXPRESSION_API_URL ? 'REACT_APP_EXPRESSION_API_URL is not set; using default http://localhost:5004' : undefined}
                sending={loading}
                onSend={chatSchema}
                actionLabel="Update Schema"
              />
              <StatusBanner message={schemaMsg} severity="info" />

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Live Preview</Typography>
                  {parsedSchema ? (
                    <SchemaForm schema={parsedSchema} values={{}} onChange={() => {}} />
                  ) : (
                    <Typography color="text.secondary">Invalid JSON. Fix the schema to preview.</Typography>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        )}

        {tab === 1 && (
          <Box>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Workflow Definition</Typography>
                  <Typography variant="body2" color="text.secondary">Use conditionExpressionId to link steps with Expression IDs (e.g., EXPR_IS_HIGH_RISK). Save to apply instantly.</Typography>
                  <TextField multiline minRows={12} value={workflowJson} onChange={(e) => setWorkflowJson(e.target.value)} fullWidth spellCheck={false} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button variant="contained" onClick={saveWorkflow} disabled={loading}>Save Workflow</Button>
                    <Button variant="outlined" onClick={fetchAll} disabled={loading}>Reload</Button>
                  </Stack>
                </CardContent>
              </Card>

              <ChatPanel
                title="AI Assistant (Workflow)"
                placeholder="e.g., Add required action KYC_VERIFY to KYC; Insert step Risk Assessment before Credit Check"
                helperText={!process.env.REACT_APP_EXPRESSION_API_URL ? 'REACT_APP_EXPRESSION_API_URL is not set; using default http://localhost:5004' : undefined}
                sending={loading}
                onSend={chatWorkflow}
                actionLabel="Apply"
              />
              <StatusBanner message={chatMsg} severity="info" />
            </Stack>
          </Box>
        )}

        {tab === 2 && (
          <Box>
            <Stack spacing={2}>
              {/* Rule Management Header */}
              <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" color="primary">
                        {isEditMode && selectedExpression 
                          ? `Editing: ${selectedExpression.name}` 
                          : 'Create New Business Rule'
                        }
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {isEditMode && selectedExpression 
                          ? `ID: ${selectedExpression.expressionId} | Context: ${selectedExpression.contextType}`
                          : 'Use AI to generate or modify business rules'
                        }
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={isEditMode ? "outlined" : "contained"}
                        onClick={createNewExpression}
                        size="small"
                      >
                        New Rule
                      </Button>
                      {isEditMode && (
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setIsEditMode(false);
                            setSelectedExpression(null);
                            setExprOutput('');
                            setExprMsg('');
                          }}
                          size="small"
                        >
                          Cancel Edit
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* AI Assistant */}
              <ChatPanel
                title={isEditMode ? "AI Assistant (Modify Rule)" : "AI Assistant (Create Rule)"}
                placeholder={isEditMode 
                  ? "e.g., Make it more strict by requiring credit score >= 800, or Add age validation >= 25"
                  : "e.g., Create a loan eligibility rule for credit score >= 750 and income >= 60000"
                }
                sending={loading}
                onSend={chatExpressionWithContext}
                actionLabel={isEditMode ? "Modify" : "Generate"}
              />
              
              {/* Syntax Guide */}
              <Card variant="outlined" sx={{ mb: 2, backgroundColor: 'info.light', borderColor: 'info.main' }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="subtitle2" color="info.dark" gutterBottom>
                    💡 Expression Syntax Guide:
                  </Typography>
                  <Typography variant="body2" color="info.dark" sx={{ fontSize: '0.875rem' }}>
                    <strong>Loan Context:</strong> Use flattened variables: <code>creditScore</code>, <code>monthlyIncome</code>, <code>requestedAmount</code>, <code>age</code><br/>
                    <strong>❌ Wrong:</strong> <code>customer.creditScore {'>'}= 700</code><br/>
                    <strong>✅ Correct:</strong> <code>creditScore {'>'}= 700 && monthlyIncome {'>'}= 100000 && requestedAmount {'<'}= monthlyIncome * 12</code>
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">
                      {isEditMode ? "Modified Expression" : "Generated Expression"}
                    </Typography>
                    {isEditMode && selectedExpression && (
                      <Chip 
                        label={exprOutput !== originalExpression ? "Modified" : "Original"}
                        color={exprOutput !== originalExpression ? "warning" : "default"}
                        size="small"
                      />
                    )}
                  </Stack>
                  
                  {/* Show syntax corrections applied */}
                  {syntaxCorrections.length > 0 && (
                    <Card variant="outlined" sx={{ mb: 2, backgroundColor: 'warning.light', borderColor: 'warning.main' }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Typography variant="subtitle2" color="warning.dark" gutterBottom>
                          Auto-corrected Syntax Issues:
                        </Typography>
                        {syntaxCorrections.map((correction, index) => (
                          <Typography key={index} variant="body2" color="warning.dark" sx={{ fontSize: '0.875rem' }}>
                            • {correction}
                          </Typography>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  <TextField 
                    value={exprOutput} 
                    onChange={(e) => setExprOutput(e.target.value)} 
                    multiline 
                    minRows={6} 
                    fullWidth 
                    spellCheck={false} 
                    inputProps={{ 'data-testid': 'ai-expression-output' }}
                    helperText={isEditMode 
                      ? "Modify the expression manually or use AI to make changes"
                      : "Generated expression - you can edit before saving"
                    }
                    sx={{ fontFamily: 'monospace' }}
                  />
                  
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                    <TextField
                      label="Expression ID"
                      value={exprId}
                      onChange={(e) => setExprId(e.target.value)}
                      inputProps={{ 'data-testid': 'expression-id-input' }}
                      size="small"
                      disabled={isEditMode}
                    />
                    <Button 
                      variant="contained" 
                      onClick={saveExpressionFromAI} 
                      data-testid="save-ai-expression"
                      disabled={!exprOutput.trim()}
                    >
                      {isEditMode ? 'Update Rule' : 'Save New Rule'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={manualSyntaxCheck}
                      disabled={!exprOutput.trim()}
                      color="secondary"
                    >
                      Fix Syntax
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (exprOutput.trim()) {
                          navigator.clipboard.writeText(exprOutput.trim());
                          setExprMsg('Expression copied to clipboard');
                        }
                      }}
                      disabled={!exprOutput.trim()}
                    >
                      Copy
                    </Button>
                    {isEditMode && originalExpression && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setExprOutput(originalExpression);
                          setExprMsg('Reverted to original expression');
                        }}
                        disabled={exprOutput === originalExpression}
                      >
                        Revert
                      </Button>
                    )}
                  </Stack>
                  
                  {exprMsg && (
                    <Typography 
                      variant="body2" 
                      color={exprMsg.includes('created') || exprMsg.includes('updated') || exprMsg.includes('copied') ? 'success.main' : 'text.secondary'} 
                      sx={{ mt: 1 }}
                    >
                      {exprMsg}
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Expression Tester</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Test your expression with sample data
                  </Typography>
                  
                  <Stack spacing={2}>
                    <TextField
                      label="Test Expression ID"
                      value={exprId}
                      onChange={(e) => setExprId(e.target.value)}
                      size="small"
                      fullWidth
                    />
                    
                    <TextField
                      label="Test Variables (JSON)"
                      multiline
                      minRows={4}
                      fullWidth
                      placeholder='{"customer": {"creditScore": 780, "monthlyIncome": 75000, "debtToIncomeRatio": 0.25}}'
                      defaultValue='{"customer": {"creditScore": 780, "monthlyIncome": 75000, "debtToIncomeRatio": 0.25}}'
                      id="test-variables"
                    />
                    
                    <Button
                      variant="outlined"
                      onClick={async () => {
                        try {
                          const varsInput = document.getElementById('test-variables') as HTMLTextAreaElement;
                          const variables = JSON.parse(varsInput.value);
                          
                          const response = await fetch(`${aiBase}/api/expressions/execute`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              ExpressionId: exprId,
                              Variables: variables
                            })
                          });
                          
                          const result = await response.json();
                          if (result.success) {
                            setExprMsg(`✅ Test Result: ${result.result} (${result.resultType}) - Executed in ${result.executionTimeMs}ms`);
                          } else {
                            setExprMsg(`❌ Test Failed: ${result.errorMessage || 'Unknown error'}`);
                          }
                        } catch (e: any) {
                          setExprMsg(`❌ Test Error: ${e.message}`);
                        }
                      }}
                    >
                      Test Expression
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>Quick Templates</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Common expression patterns for banking rules
                  </Typography>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setExprOutput('customer.creditScore >= 750 && customer.monthlyIncome >= 60000')}
                    >
                      Basic Loan Eligibility
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setExprOutput('customer.age >= 18 && customer.status == "ACTIVE"')}
                    >
                      KYC Validation
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setExprOutput('transaction.amount > customer.averageMonthlySpending * 3 ? "HIGH_RISK" : "LOW_RISK"')}
                    >
                      Risk Assessment
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setExprOutput('account.balance >= 1000 && account.accountType == "SAVINGS"')}
                    >
                      Account Validation
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1">Business Rules Library</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={fetchExpressions}
                        disabled={loadingExpressions}
                      >
                        Refresh
                      </Button>
                    </Stack>
                  </Stack>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rule ID</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Context</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expressions.slice(0, 15).map((expr) => (
                          <TableRow 
                            key={expr.id} 
                            hover
                            selected={selectedExpression?.id === expr.id}
                            sx={{ 
                              bgcolor: selectedExpression?.id === expr.id ? 'action.selected' : 'inherit',
                              cursor: 'pointer'
                            }}
                            onClick={() => loadExpressionForEditing(expr)}
                          >
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace">
                                {expr.expressionId}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" noWrap>
                                {expr.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {expr.description}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={expr.contextType} 
                                size="small" 
                                variant="outlined"
                                color={expr.contextType === 'Loan' ? 'primary' : expr.contextType === 'Customer' ? 'secondary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={expr.category} 
                                size="small" 
                                variant="filled"
                                color="default"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={expr.status} 
                                size="small" 
                                color={expr.status === 'Active' ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Tooltip title="Edit this rule">
                                  <IconButton
                                    size="small"
                                    color={selectedExpression?.id === expr.id ? 'primary' : 'default'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadExpressionForEditing(expr);
                                    }}
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Quick test">
                                  <IconButton
                                    size="small"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const testVars = expr.contextType === 'Customer' 
                                          ? { customer: { creditScore: 780, monthlyIncome: 75000, debtToIncomeRatio: 0.25, age: 30 } }
                                          : expr.contextType === 'Loan'
                                          ? { creditScore: 780, age: 30, monthlyIncome: 75000, RequestedAmount: 50000, Balance: 20000 }
                                          : { account: { Balance: 10000, AccountType: "CHECKING" } };
                                        
                                        const response = await fetch(`${aiBase}/api/expressions/execute`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            ExpressionId: expr.expressionId,
                                            Variables: testVars
                                          })
                                        });
                                        
                                        const result = await response.json();
                                        if (result.success) {
                                          setExprMsg(`✅ ${expr.expressionId}: ${result.result} (${result.executionTimeMs}ms)`);
                                        } else {
                                          setExprMsg(`❌ ${expr.expressionId}: ${result.errorMessage}`);
                                        }
                                      } catch (e: any) {
                                        setExprMsg(`❌ ${expr.expressionId}: ${e.message}`);
                                      }
                                    }}
                                  >
                                    <PlayArrow />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click on any rule to edit it • Showing {Math.min(15, expressions.length)} of {expressions.length} rules
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
