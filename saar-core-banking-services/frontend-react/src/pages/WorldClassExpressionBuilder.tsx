import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Fade,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Drawer,
  AppBar,
  Toolbar,
  Badge,
  Tab,
  Tabs,
  Autocomplete,
  InputAdornment,
  useTheme,
  alpha,
  TextareaAutosize,
  Stack
} from '@mui/material';

import {
  Code as CodeIcon,
  SmartToy as SmartToyIcon,
  Send as SendIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  BookmarkBorder as TemplateIcon,
  Lightbulb as SuggestionIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  AutoAwesome as AIIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Cached as RefreshIcon,
  Psychology as BrainIcon,
  Star as StarIcon,
  Bookmark as BookmarkIcon,
  Description as DocIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type?: 'suggestion' | 'warning' | 'success' | 'error';
}

interface Expression {
  id: string;
  name: string;
  code: string;
  contextType: string;
  usageType: string;
  isActive: boolean;
  createdAt: Date;
  lastTested?: Date;
  testResults?: {
    passed: boolean;
    message: string;
  };
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
  tags: string[];
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
}

const WorldClassExpressionBuilder: React.FC = () => {
  const theme = useTheme();
  
  // Main state
  const [selectedTab, setSelectedTab] = useState(0);
  const [expressionName, setExpressionName] = useState('');
  const [description, setDescription] = useState('');
  const [contextType, setContextType] = useState('Customer');
  const [usageType, setUsageType] = useState('Validation');
  const [expressionCode, setExpressionCode] = useState('');
  
  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '👋 Hi! I\'m your AI assistant for building banking expressions. I can help you create complex business rules using natural language. What would you like to build today?',
      isUser: false,
      timestamp: new Date(),
      type: 'success'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Other state
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);
  
  // Chat scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const templates: Template[] = [
    {
      id: '1',
      name: 'Age Verification',
      description: 'Check if customer is above minimum age',
      category: 'Customer Validation',
      code: 'IF (customer.Age >= 18) THEN true ELSE false',
      tags: ['age', 'validation', 'basic'],
      difficulty: 'Basic'
    },
    {
      id: '2',
      name: 'Income Assessment',
      description: 'Evaluate customer income for loan eligibility',
      category: 'Financial Assessment',
      code: 'IF (customer.MonthlyIncome >= 50000 AND customer.CreditScore >= 650) THEN "APPROVED" ELSE "NEEDS_REVIEW"',
      tags: ['income', 'loan', 'credit'],
      difficulty: 'Intermediate'
    },
    {
      id: '3',
      name: 'Risk Calculation',
      description: 'Calculate transaction risk score',
      category: 'Risk Management',
      code: 'IF (transaction.Amount > customer.AverageMonthlySpending * 3 AND transaction.IsInternational = true) THEN "HIGH_RISK" ELSE IF (transaction.Amount > customer.AverageMonthlySpending * 2) THEN "MEDIUM_RISK" ELSE "LOW_RISK"',
      tags: ['risk', 'transaction', 'fraud'],
      difficulty: 'Advanced'
    }
  ];

  useEffect(() => {
    // Don't scroll on initial load, only when new messages are added
    if (!isInitialLoad.current) {
      scrollToBottom();
    } else {
      isInitialLoad.current = false;
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: chatInput,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    try {
      // Call real Gemini AI API through backend
  const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const response = await fetch(`${base}/api/aiexpression/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chatInput
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || 'I received your message but couldn\'t generate a proper response. Please try again.',
          isUser: false,
          timestamp: new Date(),
          type: 'suggestion'
        };
        
        setMessages(prev => [...prev, aiResponse]);
      } else {
        // Fallback to simulated response if API fails
        throw new Error('API call failed');
      }
    } catch (error) {
      console.error('AI API Error:', error);
      
      // Fallback to enhanced simulated response
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(chatInput),
        isUser: false,
        timestamp: new Date(),
        type: 'suggestion'
      };
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateAIResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('age') || lowerInput.includes('minimum age')) {
      return '🎯 I can help you create an age verification expression! Here\'s a suggestion:\n\n`IF (customer.Age >= 18) THEN "ELIGIBLE" ELSE "NOT_ELIGIBLE"`\n\nThis checks if the customer is 18 or older. Would you like me to customize the age limit or add additional conditions?';
    }
    
    if (lowerInput.includes('loan') || lowerInput.includes('credit')) {
      return '💰 For loan eligibility, I recommend considering multiple factors. Here\'s a comprehensive expression:\n\n`IF (customer.MonthlyIncome >= 50000 AND customer.CreditScore >= 650 AND customer.DebtToIncomeRatio <= 0.4) THEN "APPROVED" ELSE IF (customer.MonthlyIncome >= 30000 AND customer.CreditScore >= 600) THEN "MANUAL_REVIEW" ELSE "DECLINED"`\n\nThis considers income, credit score, and debt-to-income ratio. Need adjustments?';
    }
    
    if (lowerInput.includes('risk') || lowerInput.includes('fraud')) {
      return '🛡️ Risk assessment is crucial! Here\'s a multi-level risk evaluation:\n\n`IF (transaction.Amount > customer.AverageMonthlySpending * 3 AND transaction.IsInternational = true) THEN "HIGH_RISK" ELSE IF (transaction.Amount > customer.AverageMonthlySpending * 2 OR transaction.IsUnusualLocation = true) THEN "MEDIUM_RISK" ELSE "LOW_RISK"`\n\nThis considers amount, location, and spending patterns. Want to add more criteria?';
    }
    
    return '🤖 I understand you\'re looking to create an expression. Could you provide more details about:\n\n• What business rule you want to implement\n• Which data fields you need to check\n• What conditions should trigger different outcomes\n\nI can then generate a custom expression for your specific needs!';
  };

  const handleValidateExpression = async () => {
    if (!expressionCode.trim()) return;
    
    setIsValidating(true);
    
    try {
  const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  const response = await fetch(`${base}/api/expressions/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: expressionName || 'Test Expression',
          description: description || 'Test validation',
          code: expressionCode,
          contextType,
          usageType,
          isActive: true
        }),
      });

      const result = await response.json();
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: 'Failed to connect to Expression Builder Service'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveExpression = async () => {
    if (!expressionName.trim() || !expressionCode.trim()) {
      alert('Please provide both expression name and code');
      return;
    }

    try {
  const base = process.env.REACT_APP_EXPRESSION_API_URL || 'http://localhost:5004';
  // Build payload matching server CreateExpressionRequest DTO
  // Build a sensible expression id (slug) but map demo credit-score expressions to the
  // legacy demo id used by LoanService so the runtime evaluation picks up the new rule.
  let computedExpressionId = expressionName.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || `expr-${Date.now()}`;

  // Do not force a demo expression id here; allow server or user to provide expressionId.
  // If an integration needs a specific id wired into LoanService, configure that outside
  // of the UI. Keep computedExpressionId as a friendly slug by default.

  const payload = {
    ExpressionId: computedExpressionId,
    Name: expressionName,
    Description: description,
    // Use the selected usageType as the Category when saving so backend services
    // that currently filter by category (e.g. LoanService) will find the expression.
    Category: usageType || 'General',
    ExpressionText: expressionCode,
    ReturnType: 'boolean',
    ContextType: contextType,
    UsageType: usageType,
    Tags: [],
    Variables: {},
    IsActive: true
  };

  const response = await fetch(`${base}/api/expressions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

    if (response.ok) {
    const newExpression = await response.json();
    setExpressions(prev => [newExpression, ...prev]);

    // Clear form
    setExpressionName('');
    setDescription('');
    setExpressionCode('');
    setValidationResult(null);

    // Add success message to chat
    const successMessage: Message = {
      id: Date.now().toString(),
      text: '✅ Expression saved successfully! You can find it in your expressions history.',
      isUser: false,
      timestamp: new Date(),
      type: 'success'
    };
    setMessages(prev => [...prev, successMessage]);

    // Expose save status for UI automation/tests and include the saved expression id
    const savedId = newExpression?.expressionId || newExpression?.ExpressionId || computedExpressionId;
    setSaveStatus({ ok: true, message: `Expression saved successfully (id: ${savedId})` });
    console.log('Saved expression id:', savedId);
  } else {
    // Try to extract error message from response
    let errText = 'Failed to save expression';
    try {
      const err = await response.json();
      if (err && (err.error || err.errors || err.message)) {
        errText = err.error || (Array.isArray(err.errors) ? err.errors.join('; ') : err.errors) || err.message;
      } else if (typeof err === 'string') {
        errText = err;
      }
    } catch (e) {
      // fallback to status text
      errText = response.statusText || errText;
    }
    console.error('Expression save failed:', response.status, errText);
    setSaveStatus({ ok: false, message: `Save failed: ${errText}` });
  }
    } catch (error) {
      console.error('Error saving expression:', error);
  setSaveStatus({ ok: false, message: 'Failed to save expression' });
    }
  };

  const handleUseTemplate = (template: Template) => {
    setExpressionCode(template.code);
    setExpressionName(template.name);
    setDescription(template.description);
    setSelectedTab(0); // Switch back to builder tab
  };

  const renderBuilderContent = () => (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Expression Metadata */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <InfoIcon sx={{ mr: 1, color: 'primary.main' }} />
            Expression Details
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Expression Name"
              value={expressionName}
              onChange={(e) => setExpressionName(e.target.value)}
              placeholder="e.g., Loan Eligibility Check"
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this expression does..."
            />
            <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
              <FormControl fullWidth>
                <InputLabel>Context Type</InputLabel>
                <Select
                  value={contextType}
                  onChange={(e) => setContextType(e.target.value)}
                  label="Context Type"
                >
                  <MenuItem value="Customer">Customer</MenuItem>
                  <MenuItem value="Transaction">Transaction</MenuItem>
                  <MenuItem value="Account">Account</MenuItem>
                  <MenuItem value="Loan">Loan</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Usage Type</InputLabel>
                <Select
                  value={usageType}
                  onChange={(e) => setUsageType(e.target.value)}
                  label="Usage Type"
                >
                  <MenuItem value="Validation">Validation</MenuItem>
                  <MenuItem value="Calculation">Calculation</MenuItem>
                  <MenuItem value="Classification">Classification</MenuItem>
                  <MenuItem value="Decision">Decision</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Expression Code Editor */}
      <Card elevation={2}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <CodeIcon sx={{ mr: 1, color: 'primary.main' }} />
            Expression Code
          </Typography>
          <TextareaAutosize
            id="expression-textarea"
            name="expression-text"
            data-testid="expression-editor"
            minRows={8}
            maxRows={15}
            value={expressionCode}
            onChange={(e) => setExpressionCode(e.target.value)}
            placeholder={`Enter your expression code here...
Example: IF (customer.Age >= 18 AND customer.Income > 50000) THEN 'APPROVED' ELSE 'DECLINED'`}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
          
          {/* Action Buttons */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              id="btn-validate"
              name="validate"
              data-testid="btn-validate"
              variant="outlined"
              startIcon={isValidating ? <CircularProgress size={16} /> : <PlayIcon />}
              onClick={handleValidateExpression}
              disabled={isValidating || !expressionCode.trim()}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </Button>
            <Button
              id="btn-save"
              name="save"
              data-testid="btn-save"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveExpression}
              disabled={!expressionName.trim() || !expressionCode.trim()}
            >
              Save Expression
            </Button>
            <Button
              id="btn-clear"
              name="clear"
              data-testid="btn-clear"
              variant="text"
              startIcon={<ClearIcon />}
              onClick={() => {
                setExpressionCode('');
                setValidationResult(null);
              }}
            >
              Clear
            </Button>
          </Box>

          {/* Save feedback for automation */}
          {saveStatus && (
            <Box sx={{ mt: 2 }}>
              <Alert severity={saveStatus.ok ? 'success' : 'error'} data-testid="save-success">
                {saveStatus.message}
              </Alert>
            </Box>
          )}

          {/* Validation Results */}
          {validationResult && (
            <Box sx={{ mt: 2 }}>
              <Alert 
                severity={validationResult.isValid ? 'success' : 'error'}
                icon={validationResult.isValid ? <ValidIcon /> : <ErrorIcon />}
              >
                <Typography variant="body2">
                  {validationResult.message || (validationResult.isValid ? 'Expression is valid!' : 'Expression validation failed')}
                </Typography>
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  const renderTemplatesContent = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <TemplateIcon sx={{ mr: 1, color: 'primary.main' }} />
        Expression Templates
      </Typography>
      
      <Stack spacing={2}>
        {templates.map((template) => (
          <Card key={template.id} elevation={2} sx={{ transition: 'all 0.2s ease-in-out', '&:hover': { elevation: 4 } }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start" mb={2} flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
                <Box flex={1}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {template.description}
                  </Typography>
                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    <Chip 
                      label={template.category} 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                    />
                    <Chip 
                      label={template.difficulty} 
                      size="small" 
                      color={
                        template.difficulty === 'Basic' ? 'success' :
                        template.difficulty === 'Intermediate' ? 'warning' : 'error'
                      }
                    />
                    {template.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleUseTemplate(template)}
                  startIcon={<BookmarkIcon />}
                  sx={{ minWidth: 'fit-content' }}
                >
                  Use Template
                </Button>
              </Box>
              
              <Box sx={{ 
                bgcolor: 'grey.50', 
                p: 2, 
                borderRadius: 1, 
                border: '1px solid', 
                borderColor: 'grey.200' 
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {template.code}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );

  const renderHistoryContent = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
        Expression History
      </Typography>
      
      {expressions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
          <Typography color="text.secondary">
            No expressions saved yet. Create and save your first expression to see it here!
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {expressions.map((expr) => (
            <Card key={expr.id} elevation={2}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box flex={1}>
                    <Typography variant="h6" color="primary" gutterBottom>
                      {expr.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Context: {expr.contextType} | Usage: {expr.usageType}
                    </Typography>
                    <Box sx={{ 
                      bgcolor: 'grey.50', 
                      p: 2, 
                      borderRadius: 1, 
                      border: '1px solid', 
                      borderColor: 'grey.200',
                      mb: 2
                    }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {expr.code}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Created: {expr.createdAt.toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip 
                    label={expr.isActive ? 'Active' : 'Inactive'} 
                    size="small" 
                    color={expr.isActive ? 'success' : 'default'}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );

  const renderAIChat = () => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          mb: 2,
          p: 2,
          bgcolor: 'rgba(255,255,255,0.5)',
          borderRadius: 2,
          border: '1px solid rgba(0,0,0,0.1)',
          minHeight: '300px'
        }}
      >
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              justifyContent: message.isUser ? 'flex-end' : 'flex-start',
              mb: 2
            }}
          >
            <Paper
              elevation={2}
              sx={{
                p: 2,
                maxWidth: '80%',
                bgcolor: message.isUser 
                  ? theme.palette.primary.main 
                  : message.type === 'success' ? alpha(theme.palette.success.main, 0.1)
                  : message.type === 'warning' ? alpha(theme.palette.warning.main, 0.1)
                  : message.type === 'error' ? alpha(theme.palette.error.main, 0.1)
                  : 'white',
                color: message.isUser ? 'white' : 'text.primary',
                borderRadius: message.isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {message.text}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                {message.timestamp.toLocaleTimeString()}
              </Typography>
            </Paper>
          </Box>
        ))}
        
        {isTyping && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Paper elevation={2} sx={{ p: 2, bgcolor: 'white', borderRadius: '18px 18px 18px 4px' }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                <BrainIcon sx={{ mr: 1, color: 'primary.main' }} />
                AI is thinking...
                <CircularProgress size={16} sx={{ ml: 1 }} />
              </Typography>
            </Paper>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Chat Input */}
      <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask me to create an expression... e.g., 'Create a loan eligibility check for customers with minimum income of $50,000'"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          multiline
          maxRows={3}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AIIcon color="primary" />
              </InputAdornment>
            ),
          }}
        />
        <IconButton 
          color="primary" 
          onClick={handleSendMessage}
          disabled={!chatInput.trim() || isTyping}
          sx={{ alignSelf: 'flex-end' }}
        >
          <SendIcon />
        </IconButton>
      </Box>

      {/* Quick Suggestions */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {[
          'Age validation rule',
          'Income assessment',
          'Risk calculation',
          'Credit score check'
        ].map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            size="small"
            variant="outlined"
            clickable
            onClick={() => setChatInput(suggestion)}
            icon={<SuggestionIcon />}
          />
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 50%, rgba(255, 255, 255, 0.1) 100%)',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }
    }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', minHeight: '56px' }}>
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: '56px !important' }}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
              <CodeIcon />
            </Avatar>
            <Typography variant="h5" fontWeight={600} color="primary">
              SaaR Expression Builder
            </Typography>
            <Chip 
              label="Enterprise" 
              size="small" 
              sx={{ ml: 2, bgcolor: theme.palette.primary.main, color: 'white' }}
            />
          </Box>
          
          <Box display="flex" alignItems="center" gap={2}>
            <Tooltip title="Performance optimized">
              <Chip icon={<SpeedIcon />} label="Fast" size="small" color="success" />
            </Tooltip>
            <Tooltip title="Enterprise security">
              <Chip icon={<SecurityIcon />} label="Secure" size="small" color="info" />
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ p: { xs: 0.5, sm: 1 }, position: 'relative', zIndex: 1 }}>
        <Box display="flex" gap={1.5} minHeight="85vh" flexDirection={{ xs: 'column', lg: 'row' }}>
          
          {/* Left Panel - Expression Builder */}
          <Box flex={1} minWidth={0}>
            <Card 
              elevation={12} 
              sx={{ 
                background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.5)',
                height: '100%'
              }}
            >
              {/* Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={selectedTab} 
                  onChange={(_, newValue) => setSelectedTab(newValue)}
                  sx={{ px: 3 }}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="Builder" icon={<CodeIcon />} />
                  <Tab label="Templates" icon={<TemplateIcon />} />
                  <Tab label="History" icon={<HistoryIcon />} />
                </Tabs>
              </Box>

              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, height: 'calc(100% - 48px)', overflow: 'auto' }}>
                {selectedTab === 0 && renderBuilderContent()}
                {selectedTab === 1 && renderTemplatesContent()}
                {selectedTab === 2 && renderHistoryContent()}
              </CardContent>
            </Card>
          </Box>

          {/* Right Panel - AI Assistant */}
          <Box width={{ xs: '100%', lg: '350px' }} minWidth={0}>
            <Card 
              elevation={12}
              sx={{ 
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: 4,
                border: '1px solid rgba(99, 102, 241, 0.2)',
                height: '100%'
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" mb={3}>
                  <Avatar sx={{ 
                    background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)', 
                    mr: 2,
                    animation: 'pulse 2s infinite'
                  }}>
                    <SmartToyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight={600}>
                      AI Assistant
                      <Chip 
                        label="GPT-Powered" 
                        size="small" 
                        sx={{ ml: 1, fontSize: '0.7rem' }}
                        color="primary"
                      />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Natural language to business rules
                    </Typography>
                  </Box>
                </Box>
                
                {renderAIChat()}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Custom animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </Box>
  );
};

export default WorldClassExpressionBuilder;