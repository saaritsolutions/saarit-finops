import React from 'react';
import { Box, Typography, Link, useTheme } from '@mui/material';

const Footer: React.FC = () => {
  const theme     = useTheme();
  const isDark    = theme.palette.mode === 'dark';
  const year      = new Date().getFullYear();
  const border    = isDark ? '#1F2937' : '#E2E8F0';
  const textColor = isDark ? '#475569' : '#94A3B8';

  return (
    <Box
      component="footer"
      sx={{
        py:              1.25,
        px:              3,
        borderTop:       `1px solid ${border}`,
        backgroundColor: isDark ? '#0B1120' : '#F8FAFC',
        display:         'flex',
        justifyContent:  'space-between',
        alignItems:      'center',
        flexWrap:        'wrap',
        gap:             1,
        minHeight:       48,
      }}
    >
      <Typography sx={{ fontSize: '0.75rem', color: textColor, letterSpacing: '0.01em' }}>
        © {year} SaaR Banking Solutions · RBI Compliant CBS
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {['Privacy Policy', 'Terms', 'Support'].map(label => (
          <Link
            key={label}
            href="#"
            underline="hover"
            sx={{ fontSize: '0.75rem', color: textColor, '&:hover': { color: '#2563EB' }, transition: 'color 150ms ease' }}
          >
            {label}
          </Link>
        ))}
        <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#374151' : '#CBD5E1' }}>
          v2.0.2
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
