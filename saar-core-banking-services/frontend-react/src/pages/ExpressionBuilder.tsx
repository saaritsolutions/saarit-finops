import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Container,
  Alert,
  Snackbar
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Components
import ExpressionList from '../components/expressions/ExpressionList';
import ExpressionEditor from '../components/expressions/ExpressionEditor';
import ExpressionTester from '../components/expressions/ExpressionTester';
import ExpressionTemplates from '../components/expressions/ExpressionTemplates';
import BankingFunctions from '../components/expressions/BankingFunctions';

// Services and Types
import { expressionService } from '../services/expressionService';
import {
  ExpressionDefinition,
  CreateExpressionRequest,
  UpdateExpressionRequest,
  ExpressionFilters
} from '../types/expression';

// Hooks
import { useAuth } from '../hooks/useAuth';

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

const ExpressionBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedExpression, setSelectedExpression] = useState<ExpressionDefinition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filters, setFilters] = useState<ExpressionFilters>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch expressions
  const {
    data: expressionsData,
    isLoading: expressionsLoading,
    error: expressionsError,
    refetch: refetchExpressions
  } = useQuery({
    queryKey: ['expressions', filters],
    queryFn: () => expressionService.getExpressions(filters),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch templates
  const {
    data: templates,
    isLoading: templatesLoading,
  } = useQuery({
    queryKey: ['expression-templates'],
    queryFn: () => expressionService.getTemplates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch banking functions
  const {
    data: bankingFunctions,
    isLoading: functionsLoading,
  } = useQuery({
    queryKey: ['banking-functions'],
    queryFn: () => expressionService.getBankingFunctions(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Create expression mutation
  const createExpressionMutation = useMutation({
    mutationFn: (expression: CreateExpressionRequest) => 
      expressionService.createExpression(expression),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expressions'] });
      setSelectedExpression(data);
      setIsEditing(false);
      setActiveTab(0); // Switch to list view
      showSnackbar('Expression created successfully', 'success');
    },
    onError: (error: any) => {
      showSnackbar(
        error.response?.data?.error || 'Failed to create expression',
        'error'
      );
    }
  });

  // Update expression mutation
  const updateExpressionMutation = useMutation({
    mutationFn: ({ id, expression }: { id: string; expression: UpdateExpressionRequest }) =>
      expressionService.updateExpression(id, expression),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expressions'] });
      setSelectedExpression(data);
      setIsEditing(false);
      showSnackbar('Expression updated successfully', 'success');
    },
    onError: (error: any) => {
      showSnackbar(
        error.response?.data?.error || 'Failed to update expression',
        'error'
      );
    }
  });

  // Delete expression mutation
  const deleteExpressionMutation = useMutation({
    mutationFn: (id: string) => expressionService.deleteExpression(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expressions'] });
      setSelectedExpression(null);
      showSnackbar('Expression deleted successfully', 'success');
    },
    onError: (error: any) => {
      showSnackbar(
        error.response?.data?.error || 'Failed to delete expression',
        'error'
      );
    }
  });

  // Approve expression mutation
  const approveExpressionMutation = useMutation({
    mutationFn: (id: string) => expressionService.approveExpression(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expressions'] });
      showSnackbar('Expression approved successfully', 'success');
    },
    onError: (error: any) => {
      showSnackbar(
        error.response?.data?.error || 'Failed to approve expression',
        'error'
      );
    }
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCreateNew = () => {
    setSelectedExpression(null);
    setIsEditing(true);
    setActiveTab(1); // Switch to editor
  };

  const handleEditExpression = (expression: ExpressionDefinition) => {
    setSelectedExpression(expression);
    setIsEditing(true);
    setActiveTab(1); // Switch to editor
  };

  const handleViewExpression = (expression: ExpressionDefinition) => {
    setSelectedExpression(expression);
    setIsEditing(false);
    setActiveTab(1); // Switch to editor (view mode)
  };

  const handleSaveExpression = (expressionData: CreateExpressionRequest | UpdateExpressionRequest) => {
    if (selectedExpression && isEditing) {
      // Update existing expression
      updateExpressionMutation.mutate({
        id: selectedExpression.id,
        expression: expressionData as UpdateExpressionRequest
      });
    } else if (!selectedExpression) {
      // Create new expression
      createExpressionMutation.mutate(expressionData as CreateExpressionRequest);
    }
  };

  const handleDeleteExpression = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expression?')) {
      deleteExpressionMutation.mutate(id);
    }
  };

  const handleApproveExpression = (id: string) => {
    if (window.confirm('Are you sure you want to approve this expression?')) {
      approveExpressionMutation.mutate(id);
    }
  };

  const handleTestExpression = (expression: ExpressionDefinition) => {
    setSelectedExpression(expression);
    setActiveTab(2); // Switch to tester
  };

  const handleUseTemplate = (template: any) => {
    const newExpression: Partial<ExpressionDefinition> = {
      name: `${template.name} - Copy`,
      description: template.description,
      category: template.category,
      expressionText: template.sampleExpression,
      returnType: template.returnType,
      contextType: template.contextType,
      usageType: 'Validation', // Default usage type
      tags: [],
      variables: template.templateVariables || {}
    };
    
    setSelectedExpression(newExpression as ExpressionDefinition);
    setIsEditing(true);
    setActiveTab(1); // Switch to editor
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Expression Builder
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Build, test, and manage dynamic business rules using C# expressions with banking functions.
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="expression builder tabs">
            <Tab label="Expressions" id="expression-tab-0" />
            <Tab label="Editor" id="expression-tab-1" />
            <Tab label="Tester" id="expression-tab-2" />
            <Tab label="Templates" id="expression-tab-3" />
            <Tab label="Functions" id="expression-tab-4" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <ExpressionList
            expressions={expressionsData?.expressions || []}
            loading={expressionsLoading}
            error={expressionsError}
            filters={filters}
            onFiltersChange={setFilters}
            onCreateNew={handleCreateNew}
            onEdit={handleEditExpression}
            onView={handleViewExpression}
            onDelete={handleDeleteExpression}
            onApprove={handleApproveExpression}
            onTest={handleTestExpression}
            onRefresh={refetchExpressions}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <ExpressionEditor
            expression={selectedExpression}
            isEditing={isEditing}
            bankingFunctions={bankingFunctions || []}
            templates={templates || []}
            onSave={handleSaveExpression}
            onCancel={() => {
              setSelectedExpression(null);
              setIsEditing(false);
              setActiveTab(0);
            }}
            loading={createExpressionMutation.isPending || updateExpressionMutation.isPending}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <ExpressionTester
            expression={selectedExpression ?? undefined}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <ExpressionTemplates
            onUseTemplate={handleUseTemplate}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <BankingFunctions
          />
        </TabPanel>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ExpressionBuilder;
