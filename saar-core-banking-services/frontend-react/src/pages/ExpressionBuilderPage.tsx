import React from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Container,
  Paper,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  Functions as FunctionsIcon,
  List as ListIcon,
  Edit as EditIcon,
  PlayArrow as TestIcon,
  Article as TemplateIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { ExpressionTemplates } from '../components/expressions/ExpressionTemplates';
import { BankingFunctions } from '../components/expressions/BankingFunctions';

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
      id={`expression-tabpanel-${index}`}
      aria-labelledby={`expression-tab-${index}`}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const ExpressionBuilderPage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = React.useState(0);
  const [selectedExpression, setSelectedExpression] = React.useState<ExpressionDefinition | null>(null);
  const [editorMode, setEditorMode] = React.useState<'create' | 'edit'>('create');

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditExpression = (expression: ExpressionDefinition) => {
    setSelectedExpression(expression);
    setEditorMode('edit');
    setTabValue(1); // Switch to editor tab
  };

  const handleCreateFromTemplate = (template: ExpressionTemplate) => {
    // Create a new expression from template
    const newExpression: Partial<ExpressionDefinition> = {
      name: `${template.name} - Copy`,
      description: template.description,
      category: template.category,
      expressionText: template.sampleExpression,
      contextType: template.contextType,
      returnType: template.returnType,
      status: 'Draft'
    };
    
    setSelectedExpression(newExpression as ExpressionDefinition);
    setEditorMode('create');
    setTabValue(1); // Switch to editor tab
  };

  const handleTestExpression = (expression: ExpressionDefinition) => {
    setSelectedExpression(expression);
    setTabValue(2); // Switch to tester tab
  };

  const handleInsertFunction = (functionCall: string) => {
    // This would be handled by the editor component
    console.log('Insert function:', functionCall);
    setTabValue(1); // Switch to editor tab
  };

  const handleUseTemplate = (template: ExpressionTemplate) => {
    // This would copy the template to clipboard or insert into editor
    navigator.clipboard.writeText(template.sampleExpression);
    setTabValue(1); // Switch to editor tab
  };

  const handleExpressionSaved = () => {
    // Refresh the list and switch back to list view
    setTabValue(0);
    setSelectedExpression(null);
  };

  const tabs = [
    { label: 'Expression List', icon: <ListIcon /> },
    { label: 'Editor', icon: <EditIcon /> },
    { label: 'Tester', icon: <TestIcon /> },
    { label: 'Templates', icon: <TemplateIcon /> },
    { label: 'Functions', icon: <FunctionsIcon /> }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HomeIcon fontSize="small" />
          Dashboard
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FunctionsIcon fontSize="small" />
          Expression Builder
        </Typography>
      </Breadcrumbs>

      {/* Page Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Expression Builder
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create, manage, and test dynamic business rules and calculations for your banking operations.
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="body2" color="text.secondary">
            Welcome, {user?.name || 'User'}
          </Typography>
        </Box>
      </Box>

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="expression builder tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                id={`expression-tab-${index}`}
                aria-controls={`expression-tabpanel-${index}`}
              />
            ))}
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box p={3}>
            <ExpressionList
              onEdit={handleEditExpression}
              onTest={handleTestExpression}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box p={3}>
            <ExpressionEditor
              expression={selectedExpression || undefined}
              onSave={handleExpressionSaved}
              onCancel={() => {
                setSelectedExpression(null);
                setTabValue(0);
              }}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box p={3}>
            <ExpressionTester
              expression={selectedExpression}
              onCreateExpression={(expressionText) => {
                const newExpression: Partial<ExpressionDefinition> = {
                  name: 'New Expression from Test',
                  description: 'Created from expression tester',
                  category: 'General',
                  expressionText,
                  contextType: 'General',
                  returnType: 'boolean',
                  status: 'Draft'
                };
                setSelectedExpression(newExpression as ExpressionDefinition);
                setEditorMode('create');
                setTabValue(1);
              }}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box p={3}>
            <ExpressionTemplates
              onUseTemplate={handleUseTemplate}
              onCreateFromTemplate={handleCreateFromTemplate}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box p={3}>
            <BankingFunctions
              onInsertFunction={handleInsertFunction}
            />
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default ExpressionBuilderPage;
