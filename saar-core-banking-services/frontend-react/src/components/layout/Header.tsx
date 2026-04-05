import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
  ListItemIcon,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  ExpandMore as ChevronDownIcon,
  Circle as DotIcon,
  AccountCircle as ProfileIcon,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectSidebarOpen, setSidebarOpen, selectTheme, setTheme } from '../../store/slices/uiSlice';
import { selectUser, logoutUser } from '../../store/slices/authSlice';
import { HEADER_HEIGHT } from './Layout';
import AboutDialog from '../dialogs/AboutDialog';

// ─── Design tokens ─────────────────────────────────────────────────────────
const BLUE_50   = '#EFF6FF';
const BLUE_600  = '#2563EB';
const BLUE_700  = '#1D4ED8';
const SLATE_100 = '#F1F5F9';
const SLATE_200 = '#E2E8F0';
const SLATE_300 = '#CBD5E1';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_900 = '#0F172A';

// Tenant accent colors
const TENANT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ucb_demo:  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  nbfc_demo: { bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
  public:    { bg: '#F8FAFC', text: '#475569', dot: '#94A3B8' },
};

function getTenantStyle(tenantId?: string) {
  const key = tenantId?.toLowerCase() ?? 'public';
  return TENANT_COLORS[key] ?? { bg: BLUE_50, text: BLUE_700, dot: BLUE_600 };
}

// Sample notifications
const NOTIFICATIONS = [
  { id: 1, title: 'New Transaction Alert',   body: 'Account #12345 — ₹1,50,000 transfer completed',  time: '2 min ago',  unread: true  },
  { id: 2, title: 'Loan Application Review', body: 'Application #LA2026001 requires your approval',  time: '18 min ago', unread: true  },
  { id: 3, title: 'Scheduled Maintenance',   body: 'System maintenance tonight at 11 PM IST',         time: '1 hr ago',   unread: false },
];

// ─── Component ──────────────────────────────────────────────────────────────

const Header: React.FC = () => {
  const theme    = useTheme();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark   = theme.palette.mode === 'dark';

  const sidebarOpen = useSelector(selectSidebarOpen);
  const themeMode   = useSelector(selectTheme);
  const currentUser = useSelector(selectUser);
  const tenantId    = (currentUser as any)?.tenantId ?? 'public';
  const tenantName  = (currentUser as any)?.tenantName ?? 'SaaR CBS';
  const tenantStyle = getTenantStyle(tenantId);

  const [userMenuAnchor,         setUserMenuAnchor]         = React.useState<null | HTMLElement>(null);
  const [notificationMenuAnchor, setNotificationMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [aboutDialogOpen,        setAboutDialogOpen]        = React.useState(false);

  const unreadCount = NOTIFICATIONS.filter(n => n.unread).length;

  const handleThemeToggle = () => dispatch(setTheme(themeMode === 'dark' ? 'light' : 'dark'));
  const handleLogout      = () => { dispatch(logoutUser() as any); setUserMenuAnchor(null); };
  const handleAboutOpen   = () => { setAboutDialogOpen(true);      setUserMenuAnchor(null); };

  const initials = [currentUser?.firstName, currentUser?.lastName]
    .filter(Boolean)
    .map(s => s!.charAt(0).toUpperCase())
    .join('') || 'U';

  return (
    <>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: theme.zIndex.drawer + 1, height: HEADER_HEIGHT, justifyContent: 'center' }}>
        <Toolbar sx={{ minHeight: `${HEADER_HEIGHT}px !important`, px: { xs: 1.5, md: 2.5 }, gap: 1 }}>

          {/* Hamburger */}
          <Tooltip title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}>
            <IconButton
              onClick={() => dispatch(setSidebarOpen(!sidebarOpen))}
              size="small"
              edge="start"
              sx={{ color: isDark ? SLATE_400 : SLATE_500 }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Brand */}
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight:    600,
              fontSize:      '0.9375rem',
              color:         isDark ? '#F1F5F9' : SLATE_900,
              letterSpacing: '-0.02em',
              display:       { xs: 'none', sm: 'block' },
              mr:            1,
            }}
          >
            SaaR Core Banking
          </Typography>

          {/* Search bar (decorative) */}
          <Box
            sx={{
              flex:            '1 1 auto',
              maxWidth:        380,
              mx:              'auto',
              display:         { xs: 'none', md: 'flex' },
              alignItems:      'center',
              gap:             1,
              px:              1.5,
              py:              0.625,
              borderRadius:    8,
              border:          `1px solid ${isDark ? '#1F2937' : SLATE_200}`,
              backgroundColor: isDark ? '#1F2937' : SLATE_100,
              cursor:          'text',
              transition:      'all 150ms ease',
              '&:hover': { borderColor: isDark ? '#374151' : SLATE_300, backgroundColor: isDark ? '#374151' : '#F8FAFC' },
            }}
          >
            <SearchIcon sx={{ fontSize: 16, color: isDark ? SLATE_500 : SLATE_400, flexShrink: 0 }} />
            <Typography sx={{ flex: 1, fontSize: '0.8125rem', color: isDark ? SLATE_500 : SLATE_400, userSelect: 'none' }}>
              Search customers, accounts, loans…
            </Typography>
            <Box
              sx={{
                display:         'flex',
                alignItems:      'center',
                px:              0.75,
                py:              0.25,
                borderRadius:    5,
                border:          `1px solid ${isDark ? '#374151' : SLATE_200}`,
                backgroundColor: isDark ? '#111827' : '#FFFFFF',
              }}
            >
              <Typography sx={{ fontSize: '0.6875rem', color: isDark ? SLATE_500 : SLATE_400, fontWeight: 500 }}>⌘K</Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Theme toggle */}
          <Tooltip title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton size="small" onClick={handleThemeToggle} sx={{ color: isDark ? SLATE_400 : SLATE_500 }}>
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton
              size="small"
              onClick={(e) => setNotificationMenuAnchor(e.currentTarget)}
              sx={{ color: isDark ? SLATE_400 : SLATE_500 }}
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { fontSize: '0.625rem', minWidth: 16, height: 16, padding: '0 3px' } }}
              >
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Tenant chip */}
          <Chip
            size="small"
            label={tenantName}
            icon={<DotIcon sx={{ fontSize: '8px !important', color: `${tenantStyle.dot} !important`, ml: '6px !important' }} />}
            sx={{
              display:         { xs: 'none', sm: 'flex' },
              backgroundColor: tenantStyle.bg,
              color:           tenantStyle.text,
              border:          `1px solid ${tenantStyle.text}20`,
              fontWeight:      500,
              fontSize:        '0.75rem',
              height:          26,
              cursor:          'default',
              '& .MuiChip-label': { px: 1 },
            }}
          />

          {/* User avatar */}
          <Box
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            sx={{
              display:         'flex',
              alignItems:      'center',
              gap:             0.75,
              pl:              0.5,
              pr:              1,
              py:              0.5,
              borderRadius:    8,
              cursor:          'pointer',
              transition:      'background-color 150ms ease',
              '&:hover': { backgroundColor: isDark ? '#1F2937' : SLATE_100 },
            }}
          >
            <Avatar
              sx={{
                width:    32,
                height:   32,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: `linear-gradient(135deg, ${BLUE_600} 0%, #1D4ED8 100%)`,
              }}
            >
              {initials}
            </Avatar>
            {!isMobile && (
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900, letterSpacing: '-0.01em', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.firstName ?? 'Admin'}
              </Typography>
            )}
            <ChevronDownIcon sx={{ fontSize: 16, color: SLATE_400 }} />
          </Box>
        </Toolbar>
      </AppBar>

      {/* User dropdown */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        onClick={() => setUserMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ elevation: 0, sx: { mt: 1, minWidth: 220 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900 }}>
            {currentUser?.firstName} {currentUser?.lastName}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: isDark ? SLATE_400 : SLATE_500, mt: 0.25 }}>
            {(currentUser as any)?.email ?? 'admin@saar.in'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem sx={{ gap: 1.5, mt: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 0 }}><ProfileIcon fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem sx={{ gap: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 0 }}><SettingsIcon fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={handleAboutOpen} sx={{ gap: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 0 }}><InfoIcon fontSize="small" /></ListItemIcon>
          About
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ gap: 1.5, mb: 0.5, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 0, color: 'error.main' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      {/* Notification panel */}
      <Menu
        anchorEl={notificationMenuAnchor}
        open={Boolean(notificationMenuAnchor)}
        onClose={() => setNotificationMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ elevation: 0, sx: { mt: 1, minWidth: 340, maxWidth: 380 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900 }}>
            Notifications
          </Typography>
          <Chip size="small" label={`${unreadCount} new`} sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: BLUE_50, color: BLUE_700 }} />
        </Box>
        <Divider />
        {NOTIFICATIONS.map(n => (
          <MenuItem
            key={n.id}
            onClick={() => setNotificationMenuAnchor(null)}
            sx={{ px: 2, py: 1.5, alignItems: 'flex-start', gap: 1.5, backgroundColor: n.unread ? (isDark ? '#1E3A5F20' : `${BLUE_50}80`) : 'transparent' }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: n.unread ? BLUE_600 : 'transparent', mt: 0.75, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F1F5F9' : SLATE_900 }}>{n.title}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: SLATE_500, mt: 0.25, whiteSpace: 'normal', lineHeight: 1.4 }}>{n.body}</Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: SLATE_400, mt: 0.5 }}>{n.time}</Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.8125rem', color: BLUE_600, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            View all notifications
          </Typography>
        </Box>
      </Menu>

      <AboutDialog open={aboutDialogOpen} onClose={() => setAboutDialogOpen(false)} />
    </>
  );
};

export default Header;
