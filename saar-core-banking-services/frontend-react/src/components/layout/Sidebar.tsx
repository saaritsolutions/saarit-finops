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
  Tooltip,
  useTheme,
  useMediaQuery,
  IconButton,
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
  ExpandLess,
  ExpandMore,
  Person as PersonIcon,
  AccountBox as AccountBoxIcon,
  Payment as PaymentIcon,
  TrendingUp as TrendingUpIcon,
  Description as DocumentIcon,
  AccountTree as WorkflowIcon,
  Code as ExpressionBuilderIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  DynamicForm as DynamicFormIcon,
  Diamond as DiamondIcon,
  MonetizationOn as GoldRateIcon,
  Tune as BankConfigIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';
import { selectFeatureFlags, type FeatureFlags } from '../../store/slices/authSlice';
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED, HEADER_HEIGHT } from './Layout';
import VersionDisplay from '../VersionDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id:          string;
  title:       string;
  icon:        React.ReactNode;
  path?:       string;
  children?:   MenuItem[];
  permission?: string;
  featureFlag?: keyof FeatureFlags;
}

interface MenuSection {
  label:    string;
  items:    MenuItem[];
}

// ─── Menu Structure ───────────────────────────────────────────────────────────

const menuSections: MenuSection[] = [
  {
    label: 'Banking',
    items: [
      {
        id:    'dashboard',
        title: 'Dashboard',
        icon:  <DashboardIcon fontSize="small" />,
        path:  '/dashboard',
      },
      {
        id:    'customers',
        title: 'Customers',
        icon:  <CustomersIcon fontSize="small" />,
        children: [
          { id: 'customer-list',   title: 'Customer List', icon: <PersonIcon fontSize="small" />,    path: '/customers',        permission: 'customers.view'   },
          { id: 'customer-create', title: 'New Customer',  icon: <PersonIcon fontSize="small" />,    path: '/customers/create', permission: 'customers.create' },
        ],
      },
      {
        id:    'accounts',
        title: 'Accounts',
        icon:  <AccountsIcon fontSize="small" />,
        children: [
          { id: 'account-list',   title: 'Account List', icon: <AccountBoxIcon fontSize="small" />, path: '/accounts',           permission: 'accounts.view'   },
          { id: 'account-create', title: 'New Account',  icon: <AccountBoxIcon fontSize="small" />, path: '/accounts/create',    permission: 'accounts.create' },
          { id: 'nominees',       title: 'Nominees',     icon: <PersonIcon fontSize="small" />,     path: '/accounts/nominees',  permission: 'accounts.view'   },
          { id: 'passbook',       title: 'Passbook',     icon: <DocumentIcon fontSize="small" />,   path: '/accounts/passbook',  permission: 'accounts.view'   },
        ],
      },
      {
        id:    'transactions',
        title: 'Transactions',
        icon:  <TransactionsIcon fontSize="small" />,
        children: [
          { id: 'transaction-list',   title: 'History',         icon: <PaymentIcon fontSize="small" />, path: '/transactions',        permission: 'transactions.view'   },
          { id: 'transaction-create', title: 'New Transaction', icon: <PaymentIcon fontSize="small" />, path: '/transactions/create', permission: 'transactions.create' },
        ],
      },
    ],
  },
  {
    label: 'Products',
    items: [
      {
        id:    'cards',
        title: 'Cards & ATM',
        icon:  <CardsIcon fontSize="small" />,
        children: [
          { id: 'card-list',       title: 'Card Management', icon: <CardsIcon fontSize="small" />, path: '/cards',     permission: 'cards.view' },
          { id: 'atm-management',  title: 'ATM Management',  icon: <CardsIcon fontSize="small" />, path: '/cards/atm', permission: 'cards.atm'  },
        ],
      },
      {
        id:    'loans',
        title: 'Loans',
        icon:  <LoansIcon fontSize="small" />,
        children: [
          { id: 'loan-list',   title: 'Applications', icon: <LoansIcon fontSize="small" />, path: '/loans',        permission: 'loans.view'   },
          { id: 'loan-create', title: 'New Loan',     icon: <LoansIcon fontSize="small" />, path: '/loans/create', permission: 'loans.create' },
        ],
      },
      {
        id:          'gold-loans',
        title:       'Gold Loans',
        icon:        <DiamondIcon fontSize="small" />,
        featureFlag: 'goldLoan',
        children: [
          { id: 'gold-loan-list',   title: 'Applications', icon: <DiamondIcon fontSize="small" />, path: '/gold-loans',     permission: BANKING_PERMISSIONS.LOAN_VIEW   },
          { id: 'gold-loan-create', title: 'New Gold Loan', icon: <DiamondIcon fontSize="small" />, path: '/gold-loans/new', permission: BANKING_PERMISSIONS.LOAN_CREATE },
        ],
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        id:    'reports',
        title: 'Reports & MIS',
        icon:  <ReportsIcon fontSize="small" />,
        children: [
          { id: 'financial-reports',   title: 'Financial Reports',   icon: <TrendingUpIcon fontSize="small" />, path: '/reports/financial',  permission: 'reports.view'       },
          { id: 'regulatory-reports',  title: 'Regulatory Reports',  icon: <DocumentIcon fontSize="small" />,  path: '/reports/regulatory', permission: 'reports.regulatory' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        id:    'compliance',
        title: 'Compliance',
        icon:  <ComplianceIcon fontSize="small" />,
        children: [
          { id: 'audit-logs',             title: 'Audit Logs',             icon: <DocumentIcon fontSize="small" />,   path: '/compliance/audit',       permission: 'compliance.audit'       },
          { id: 'regulatory-compliance',  title: 'Regulatory Compliance',  icon: <ComplianceIcon fontSize="small" />, path: '/compliance/regulatory',  permission: 'compliance.regulatory'  },
        ],
      },
      {
        id:    'administration',
        title: 'Administration',
        icon:  <SettingsIcon fontSize="small" />,
        children: [
          { id: 'user-management',   title: 'User Management',       icon: <PersonIcon fontSize="small" />,           path: '/admin/users',        permission: 'admin.users'    },
          { id: 'product-config',    title: 'Product Configuration', icon: <SettingsIcon fontSize="small" />,         path: '/admin/products',     permission: 'admin.products' },
          { id: 'workflow',          title: 'Workflow Management',   icon: <WorkflowIcon fontSize="small" />,         path: '/admin/workflow',     permission: 'admin.workflow' },
          { id: 'bank-config',       title: 'Bank Configuration',   icon: <BankConfigIcon fontSize="small" />,        path: '/admin/bank-config',  permission: BANKING_PERMISSIONS.SYSTEM_CONFIG },
          { id: 'expression-builder',title: 'Expression Builder',   icon: <ExpressionBuilderIcon fontSize="small" />,path: '/expressions',        permission: BANKING_PERMISSIONS.EXPRESSION_BUILDER, featureFlag: 'expressions' },
          { id: 'end-to-end-demo',   title: 'End-to-End Demo',      icon: <TrendingUpIcon fontSize="small" />,        path: '/demo',               permission: BANKING_PERMISSIONS.EXPRESSION_BUILDER, featureFlag: 'expressions' },
          { id: 'form-builder',      title: 'Form Builder',         icon: <DynamicFormIcon fontSize="small" />,       path: '/admin/form-builder', permission: BANKING_PERMISSIONS.SYSTEM_CONFIG, featureFlag: 'dynamicForms' },
          { id: 'gold-rate-admin',   title: 'Gold Rate',            icon: <GoldRateIcon fontSize="small" />,          path: '/admin/gold-rate',    permission: BANKING_PERMISSIONS.SYSTEM_CONFIG, featureFlag: 'goldLoan' },
        ],
      },
    ],
  },
];

// ─── Design tokens (inline to avoid import issues) ────────────────────────────
const BLUE_50  = '#EFF6FF';
const BLUE_600 = '#2563EB';
const SLATE_50  = '#F8FAFC';
const SLATE_100 = '#F1F5F9';
const SLATE_200 = '#E2E8F0';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_900 = '#0F172A';

// ─── Component ────────────────────────────────────────────────────────────────

const Sidebar: React.FC = () => {
  const theme     = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'));
  const isDark    = theme.palette.mode === 'dark';

  const sidebarOpen   = useSelector(selectSidebarOpen);
  const featureFlags  = useSelector(selectFeatureFlags);
  const [expandedMenus, setExpandedMenus] = React.useState<string[]>(['dashboard']);

  const handleDrawerClose = () => dispatch(setSidebarOpen(false));

  const handleMenuClick = (item: MenuItem) => {
    if (item.children) {
      if (!sidebarOpen) {
        // Collapsed mode: navigate to first child with a path instead of expanding
        const firstPath = item.children.find(c => c.path)?.path;
        if (firstPath) {
          navigate(firstPath);
          if (isMobile) handleDrawerClose();
        }
      } else {
        setExpandedMenus(prev =>
          prev.includes(item.id)
            ? prev.filter(id => id !== item.id)
            : [...prev, item.id]
        );
      }
    } else if (item.path) {
      navigate(item.path);
      if (isMobile) handleDrawerClose();
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isParentActive = (item: MenuItem): boolean => {
    if (item.path && isActive(item.path)) return true;
    return item.children?.some(c => isActive(c.path)) ?? false;
  };

  // ── Render a single nav item ───────────────────────────────────────────────
  const renderMenuItem = (item: MenuItem, depth = 0): React.ReactNode => {
    // Feature-flag gate: hide item when the feature is explicitly disabled
    if (item.featureFlag && featureFlags?.[item.featureFlag] === false) return null;

    const hasChildren  = (item.children?.length ?? 0) > 0;
    const isExpanded   = expandedMenus.includes(item.id);
    const active       = isActive(item.path);
    const parentActive = !active && isParentActive(item);

    const bg    = isDark ? '#111827' : '#FFFFFF';
    const hoverBg = isDark ? '#1F2937' : SLATE_50;
    const activeBg = isDark ? '#1E3A5F' : BLUE_50;

    const button = (
      <ListItemButton
        onClick={() => handleMenuClick(item)}
        sx={{
          mx:              1,
          mb:              0.25,
          borderRadius:    8,
          px:              sidebarOpen ? 1.5 : 1,
          py:              0.75,
          minHeight:       40,
          justifyContent:  sidebarOpen ? 'flex-start' : 'center',
          backgroundColor: active ? activeBg : 'transparent',
          borderLeft:      active ? `3px solid ${BLUE_600}` : '3px solid transparent',
          transition:      'all 150ms ease',
          '&:hover': {
            backgroundColor: active ? activeBg : hoverBg,
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth:       0,
            mr:             sidebarOpen ? 1.5 : 0,
            color:          active ? BLUE_600 : (parentActive ? BLUE_600 : (isDark ? SLATE_400 : SLATE_500)),
            transition:     'color 150ms ease',
            '& svg':        { fontSize: depth > 0 ? '1rem' : '1.1rem' },
          }}
        >
          {item.icon}
        </ListItemIcon>

        {sidebarOpen && (
          <>
            <ListItemText
              primary={item.title}
              sx={{
                m: 0,
                '& .MuiListItemText-primary': {
                  fontSize:    depth > 0 ? '0.8125rem' : '0.875rem',
                  fontWeight:  active ? 600 : (parentActive ? 600 : 500),
                  color:       active ? BLUE_600 : (isDark ? '#F1F5F9' : SLATE_900),
                  lineHeight:  1.4,
                  transition:  'color 150ms ease',
                },
              }}
            />
            {hasChildren && (
              <Box sx={{ color: isDark ? SLATE_400 : SLATE_400, display: 'flex', ml: 0.5 }}>
                {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </Box>
            )}
          </>
        )}
      </ListItemButton>
    );

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          {!sidebarOpen ? (
            <Tooltip title={item.title} placement="right" arrow>
              {button}
            </Tooltip>
          ) : (
            button
          )}
        </ListItem>

        {hasChildren && sidebarOpen && (
          <Collapse in={isExpanded} timeout={200} unmountOnExit>
            <List disablePadding sx={{ pl: 1.5 }}>
              {item.children?.map(child => renderMenuItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  // ── Drawer contents ────────────────────────────────────────────────────────
  const drawerContents = (
    <Box
      sx={{
        height:         '100%',
        display:        'flex',
        flexDirection:  'column',
        overflow:       'hidden',
      }}
    >
      {/* Brand header */}
      <Box
        sx={{
          height:          HEADER_HEIGHT,
          display:         'flex',
          alignItems:      'center',
          px:              sidebarOpen ? 2 : 1,
          gap:             1.5,
          borderBottom:    `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
          flexShrink:      0,
          justifyContent:  sidebarOpen ? 'flex-start' : 'center',
          transition:      'padding 200ms ease',
        }}
      >
        {/* Logo mark */}
        <Box
          sx={{
            width:           32,
            height:          32,
            borderRadius:    8,
            background:      `linear-gradient(135deg, ${BLUE_600} 0%, #1D4ED8 100%)`,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            flexShrink:      0,
            boxShadow:       '0 2px 8px rgba(37,99,235,0.35)',
          }}
        >
          <Typography sx={{ color: '#FFF', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.02em' }}>
            S
          </Typography>
        </Box>

        {sidebarOpen && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography
              sx={{
                fontWeight:    700,
                fontSize:      '0.9375rem',
                color:         isDark ? '#F1F5F9' : SLATE_900,
                letterSpacing: '-0.02em',
                lineHeight:    1.2,
                whiteSpace:    'nowrap',
              }}
            >
              SaaR CBS
            </Typography>
            <Typography
              sx={{
                fontSize:    '0.6875rem',
                color:       SLATE_400,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight:  500,
                lineHeight:  1.2,
                whiteSpace:  'nowrap',
              }}
            >
              Core Banking
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {menuSections.map((section, sIdx) => (
          <Box key={section.label}>
            {sidebarOpen && (
              <Typography
                sx={{
                  fontSize:      '0.6875rem',
                  fontWeight:    600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:         isDark ? SLATE_500 : SLATE_400,
                  px:            2.5,
                  pt:            sIdx === 0 ? 1 : 1.5,
                  pb:            0.5,
                  userSelect:    'none',
                }}
              >
                {section.label}
              </Typography>
            )}
            {!sidebarOpen && sIdx > 0 && (
              <Divider sx={{ my: 1, mx: 1.5, borderColor: isDark ? '#1F2937' : SLATE_200 }} />
            )}
            <List disablePadding>
              {section.items.map(item => renderMenuItem(item))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          borderTop:   `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
          px:          1,
          py:          1,
          display:     'flex',
          alignItems:  'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          gap:         1,
        }}
      >
        {sidebarOpen && (
          <Box sx={{ px: 1 }}>
            <VersionDisplay variant="tooltip" showBuildTime={false} />
            <Typography variant="caption" sx={{ display: 'block', color: isDark ? SLATE_500 : SLATE_400, mt: 0.25 }}>
              © 2025 SaaR Banking
            </Typography>
          </Box>
        )}

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <Tooltip title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
            <IconButton
              size="small"
              onClick={() => dispatch(setSidebarOpen(!sidebarOpen))}
              sx={{
                width:           32,
                height:          32,
                borderRadius:    8,
                border:          `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
                color:           isDark ? SLATE_400 : SLATE_500,
                backgroundColor: isDark ? '#1F2937' : SLATE_100,
                '&:hover': {
                  backgroundColor: isDark ? '#374151' : SLATE_200,
                  color:           isDark ? '#F1F5F9' : SLATE_900,
                },
              }}
            >
              {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box component="nav">
      {/* Mobile — temporary overlay */}
      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width:    DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContents}
      </Drawer>

      {/* Desktop — permanent, collapses to icon-only */}
      <Drawer
        variant="permanent"
        sx={{
          display:                 { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width:                 sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED,
            boxSizing:             'border-box',
            top:                   0,
            height:                '100vh',
            overflowX:             'hidden',
            transition:            'width 200ms cubic-bezier(0.4,0,0.2,1)',
            zIndex:                theme.zIndex.drawer,
          },
        }}
      >
        {drawerContents}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
