import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { BANKING_PERMISSIONS } from '../../router/ProtectedRoute';
import {
  Dashboard as DashboardIcon,
  People as CustomersIcon,
  AccountBalance as AccountsIcon,
  CreditCard as CardsIcon,
  MonetizationOn as LoansIcon,
  Receipt as TransactionsIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  Security as ComplianceIcon,
  Notifications as NotificationsIcon,
  ExpandLess,
  ExpandMore,
  Person as PersonIcon,
  AccountBox as AccountBoxIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  Description as DocumentIcon,
  AccountTree as WorkflowIcon,
  Code as ExpressionBuilderIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';
import { selectUser } from '../../store/slices/authSlice';
import { DRAWER_WIDTH, HEADER_HEIGHT } from './Layout';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItem[];
  permission?: string;
}

/**
 * Banking application navigation menu items
 */
const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
  },
  {
    id: 'customers',
    title: 'Customer Management',
    icon: <CustomersIcon />,
    children: [
      {
        id: 'customer-list',
        title: 'Customer List',
        icon: <PersonIcon />,
        path: '/customers',
        permission: 'customers.view',
      },
      {
        id: 'customer-create',
        title: 'New Customer',
        icon: <PersonIcon />,
        path: '/customers/create',
        permission: 'customers.create',
      },
    ],
  },
  {
    id: 'accounts',
    title: 'Account Management',
    icon: <AccountsIcon />,
    children: [
      {
        id: 'account-list',
        title: 'Account List',
        icon: <AccountBoxIcon />,
        path: '/accounts',
        permission: 'accounts.view',
      },
      {
        id: 'account-create',
        title: 'New Account',
        icon: <AccountBoxIcon />,
        path: '/accounts/create',
        permission: 'accounts.create',
      },
      {
        id: 'nominees',
        title: 'Nominees',
        icon: <PersonIcon />,
        path: '/accounts/nominees',
        permission: 'accounts.view',
      },
      {
        id: 'passbook',
        title: 'Passbook',
        icon: <DocumentIcon />,
        path: '/accounts/passbook',
        permission: 'accounts.view',
      },
    ],
  },
  {
    id: 'transactions',
    title: 'Transactions',
    icon: <TransactionsIcon />,
    children: [
      {
        id: 'transaction-list',
        title: 'Transaction History',
        icon: <PaymentIcon />,
        path: '/transactions',
        permission: 'transactions.view',
      },
      {
        id: 'transaction-create',
        title: 'New Transaction',
        icon: <PaymentIcon />,
        path: '/transactions/create',
        permission: 'transactions.create',
      },
    ],
  },
  {
    id: 'cards',
    title: 'Cards & ATM',
    icon: <CardsIcon />,
    children: [
      {
        id: 'card-list',
        title: 'Card Management',
        icon: <CardsIcon />,
        path: '/cards',
        permission: 'cards.view',
      },
      {
        id: 'atm-management',
        title: 'ATM Management',
        icon: <CardsIcon />,
        path: '/cards/atm',
        permission: 'cards.atm',
      },
    ],
  },
  {
    id: 'loans',
    title: 'Loan Management',
    icon: <LoansIcon />,
    children: [
      {
        id: 'loan-list',
        title: 'Loan Applications',
        icon: <LoansIcon />,
        path: '/loans',
        permission: 'loans.view',
      },
      {
        id: 'loan-create',
        title: 'New Loan',
        icon: <LoansIcon />,
        path: '/loans/create',
        permission: 'loans.create',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & MIS',
    icon: <ReportsIcon />,
    children: [
      {
        id: 'financial-reports',
        title: 'Financial Reports',
        icon: <TrendingUpIcon />,
        path: '/reports/financial',
        permission: 'reports.view',
      },
      {
        id: 'regulatory-reports',
        title: 'Regulatory Reports',
        icon: <DocumentIcon />,
        path: '/reports/regulatory',
        permission: 'reports.regulatory',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: <ComplianceIcon />,
    children: [
      {
        id: 'audit-logs',
        title: 'Audit Logs',
        icon: <DocumentIcon />,
        path: '/compliance/audit',
        permission: 'compliance.audit',
      },
      {
        id: 'regulatory-compliance',
        title: 'Regulatory Compliance',
        icon: <ComplianceIcon />,
        path: '/compliance/regulatory',
        permission: 'compliance.regulatory',
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: <SettingsIcon />,
    children: [
      {
        id: 'user-management',
        title: 'User Management',
        icon: <PersonIcon />,
        path: '/admin/users',
        permission: 'admin.users',
      },
      {
        id: 'product-config',
        title: 'Product Configuration',
        icon: <SettingsIcon />,
        path: '/admin/products',
        permission: 'admin.products',
      },
      {
        id: 'workflow',
        title: 'Workflow Management',
        icon: <WorkflowIcon />,
        path: '/admin/workflow',
        permission: 'admin.workflow',
      },
      {
        id: 'expression-builder',
        title: 'Expression Builder',
        icon: <ExpressionBuilderIcon />,
        path: '/expressions',
        permission: BANKING_PERMISSIONS.EXPRESSION_BUILDER,
      },
    ],
  },
];

/**
 * Sidebar navigation component
 */
const Sidebar: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Redux state
  const sidebarOpen = useSelector(selectSidebarOpen);
  const currentUser = useSelector(selectUser);
  
  // Local state for submenu expansion
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['dashboard']);

  const handleDrawerClose = () => {
    dispatch(setSidebarOpen(false));
  };

  const handleMenuClick = (menuItem: MenuItem) => {
    if (menuItem.children) {
      // Toggle submenu
      setExpandedMenus(prev => 
        prev.includes(menuItem.id) 
          ? prev.filter(id => id !== menuItem.id)
          : [...prev, menuItem.id]
      );
    } else if (menuItem.path) {
      // Navigate to path
      navigate(menuItem.path);
      if (isMobile) {
        handleDrawerClose();
      }
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    // For now, return true for all permissions - will be implemented with proper auth
    return true;
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    const active = isActive(item.path);

    if (!hasPermission(item.permission)) {
      return null;
    }

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            onClick={() => handleMenuClick(item)}
            sx={{
              minHeight: 48,
              justifyContent: sidebarOpen ? 'initial' : 'center',
              px: 2.5,
              pl: depth > 0 ? 4 : 2.5,
              backgroundColor: active ? 'action.selected' : 'transparent',
              borderRight: active ? `3px solid ${theme.palette.primary.main}` : 'none',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: sidebarOpen ? 3 : 'auto',
                justifyContent: 'center',
                color: active ? 'primary.main' : 'text.secondary',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.title}
              sx={{
                opacity: sidebarOpen ? 1 : 0,
                color: active ? 'primary.main' : 'text.primary',
                '& .MuiListItemText-primary': {
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                },
              }}
            />
            {hasChildren && sidebarOpen && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>

        {/* Submenu items */}
        {hasChildren && (
          <Collapse in={isExpanded && sidebarOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map(child => renderMenuItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawer = (
    <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sidebar Header */}
      <Box
        sx={{
          p: 2,
          textAlign: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sidebarOpen && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main' }}>
            Banking Portal
          </Typography>
        )}
      </Box>

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, py: 1 }}>
        {menuItems.map(item => renderMenuItem(item))}
      </List>

      {/* Sidebar Footer */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        {sidebarOpen && (
          <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', display: 'block' }}>
            v2.0.0 | © 2024 SaaR Banking
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={handleDrawerClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: DRAWER_WIDTH,
            backgroundColor: 'background.paper',
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => dispatch(setSidebarOpen(false))}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            backgroundColor: 'background.paper',
            borderRight: `1px solid ${theme.palette.divider}`,
            top: HEADER_HEIGHT, // Account for header height
            height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
