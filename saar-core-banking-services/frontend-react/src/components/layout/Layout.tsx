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
export const DRAWER_WIDTH = 200; // Reduced from 240 to 200
export const HEADER_HEIGHT = 56; // Reduced from 64 to 56
export const FOOTER_HEIGHT = 48; // Reduced from 60 to 48

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
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          width: '100%',
        }}
      >
        {/* Header spacing */}
        <Box sx={{ height: HEADER_HEIGHT }} />
        
        {/* Page Content */}
        <Box
          sx={{
            flexGrow: 1,
            p: { xs: 0.5, sm: 1, md: 1.5 }, // Even more compact padding
            backgroundColor: 'background.default',
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px - ${FOOTER_HEIGHT}px)`,
            // Ensure content doesn't overflow on mobile
            overflow: 'auto',
            // Add max-width and center content for very wide screens
            maxWidth: '100%',
            width: '100%',
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
