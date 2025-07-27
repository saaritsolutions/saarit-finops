import React from 'react';
import { Box, Typography, Link, useTheme } from '@mui/material';

/**
 * Footer component for the banking application
 */
const Footer: React.FC = () => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: 'background.paper',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
        minHeight: 60,
      }}
    >
      {/* Copyright */}
      <Typography variant="body2" color="textSecondary">
        © {currentYear} SaaR Core Banking Solutions. All rights reserved.
      </Typography>

      {/* Links */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Link
          href="#"
          color="textSecondary"
          underline="hover"
          variant="body2"
          sx={{ fontSize: '0.875rem' }}
        >
          Privacy Policy
        </Link>
        <Link
          href="#"
          color="textSecondary"
          underline="hover"
          variant="body2"
          sx={{ fontSize: '0.875rem' }}
        >
          Terms of Service
        </Link>
        <Link
          href="#"
          color="textSecondary"
          underline="hover"
          variant="body2"
          sx={{ fontSize: '0.875rem' }}
        >
          Support
        </Link>
        <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.875rem' }}>
          v2.0.0
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
