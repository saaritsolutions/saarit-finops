import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';

import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

export const DRAWER_WIDTH           = 260;
export const DRAWER_WIDTH_COLLAPSED = 68;
export const HEADER_HEIGHT          = 64;
export const FOOTER_HEIGHT          = 48;

const Layout: React.FC = () => {
  const theme     = useTheme();
  const dispatch  = useDispatch();
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarOpen = useSelector(selectSidebarOpen);

  React.useEffect(() => {
    if (isMobile && sidebarOpen) {
      dispatch(setSidebarOpen(false));
    }
  }, [isMobile, sidebarOpen, dispatch]);

  const sidebarWidth = isMobile ? 0 : (sidebarOpen ? DRAWER_WIDTH : DRAWER_WIDTH_COLLAPSED);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Header />
      <Sidebar />

      {/* Main content — shifts right of the permanent sidebar on desktop */}
      <Box
        sx={{
          display:        'flex',
          flexDirection:  'column',
          flex:           1,
          minWidth:       0,
          marginLeft:     { md: `${sidebarWidth}px` },
          transition:     'margin-left 200ms cubic-bezier(0.4,0,0.2,1)',
          width:          { xs: '100%', md: `calc(100% - ${sidebarWidth}px)` },
        }}
      >
        {/* Spacer for fixed header */}
        <Box sx={{ height: HEADER_HEIGHT, flexShrink: 0 }} />

        {/* Page Content */}
        <Box
          sx={{
            flexGrow:        1,
            p:               { xs: 2, sm: 2.5, md: 3 },
            backgroundColor: 'background.default',
            minHeight:       `calc(100vh - ${HEADER_HEIGHT}px - ${FOOTER_HEIGHT}px)`,
            overflow:        'auto',
          }}
        >
          <Outlet />
        </Box>

        <Footer />
      </Box>
    </Box>
  );
};

export default Layout;
