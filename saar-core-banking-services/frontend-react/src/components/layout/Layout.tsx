import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';

// Layout components
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

// Shared constants
export const DRAWER_WIDTH = 280;
export const HEADER_HEIGHT = 64;
export const FOOTER_HEIGHT = 60;

/**
 * Main layout component for the banking application
 * Provides the shell structure with header, sidebar, and content area
 */
const Layout: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarOpen = useSelector(selectSidebarOpen);

  // Auto-close sidebar on mobile
  React.useEffect(() => {
    if (isMobile && sidebarOpen) {
      dispatch(setSidebarOpen(false));
    }
  }, [isMobile, sidebarOpen, dispatch]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Header */}
      <Header />
      
      {/* Sidebar Navigation */}
      <Sidebar />
      
      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          // On desktop, account for sidebar width when open
          ml: { 
            xs: 0, 
            md: sidebarOpen ? `${DRAWER_WIDTH}px` : 0 
          },
          // Smooth transition when sidebar opens/closes
          transition: theme.transitions.create(['margin'], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        {/* Header spacing */}
        <Box sx={{ height: HEADER_HEIGHT }} />
        
        {/* Page Content */}
        <Box
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 }, // Responsive padding
            backgroundColor: 'background.default',
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px - ${FOOTER_HEIGHT}px)`,
            // Ensure content doesn't overflow on mobile
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Box>
        
        {/* Footer */}
        <Footer />
      </Box>
    </Box>
  );
};

export default Layout;
