import React from 'react';
import { Box, Typography, Breadcrumbs, Link, useTheme } from '@mui/material';
import { NavigateNext as ArrowIcon } from '@mui/icons-material';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  breadcrumbs?: BreadcrumbItem[];
  actions?:     React.ReactNode;
  icon?:        React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, actions }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            2,
        mb:             3,
        flexWrap:       'wrap',
      }}
    >
      <Box>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs
            separator={<ArrowIcon sx={{ fontSize: 14 }} />}
            sx={{ mb: 0.75 }}
          >
            {breadcrumbs.map((crumb, i) =>
              crumb.href ? (
                <Link
                  key={i}
                  href={crumb.href}
                  underline="hover"
                  sx={{
                    fontSize:   '0.8125rem',
                    fontWeight: 500,
                    color:      isDark ? '#64748B' : '#94A3B8',
                    '&:hover':  { color: '#2563EB' },
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <Typography
                  key={i}
                  sx={{
                    fontSize:   '0.8125rem',
                    fontWeight: 500,
                    color:      isDark ? '#94A3B8' : '#64748B',
                  }}
                >
                  {crumb.label}
                </Typography>
              )
            )}
          </Breadcrumbs>
        )}

        <Typography
          variant="h4"
          sx={{
            fontWeight:    700,
            letterSpacing: '-0.025em',
            lineHeight:    1.2,
            color:         isDark ? '#F1F5F9' : '#0F172A',
          }}
        >
          {title}
        </Typography>

        {subtitle && (
          <Typography
            sx={{
              fontSize:  '0.9375rem',
              color:     isDark ? '#64748B' : '#64748B',
              mt:        0.5,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, mt: { xs: 0, sm: 0.5 } }}>
          {actions}
        </Box>
      )}
    </Box>
  );
};

export default PageHeader;
