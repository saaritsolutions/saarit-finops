import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';

export interface EmptyStateProps {
  icon?:          React.ReactNode;
  title:          string;
  description?:   string;
  actionLabel?:   string;
  onAction?:      () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon        = <InboxIcon sx={{ fontSize: 48 }} />,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        py:             8,
        px:             3,
        textAlign:      'center',
        gap:            2,
      }}
    >
      <Box
        sx={{
          width:           72,
          height:          72,
          borderRadius:    18,
          backgroundColor: isDark ? '#1F2937' : '#F1F5F9',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          color:           isDark ? '#475569' : '#94A3B8',
        }}
      >
        {icon}
      </Box>

      <Box>
        <Typography
          sx={{
            fontSize:   '1rem',
            fontWeight: 600,
            color:      isDark ? '#E2E8F0' : '#1E293B',
            mb:         0.5,
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            sx={{
              fontSize:   '0.875rem',
              color:      isDark ? '#64748B' : '#64748B',
              maxWidth:   320,
              lineHeight: 1.6,
            }}
          >
            {description}
          </Typography>
        )}
      </Box>

      {actionLabel && onAction && (
        <Button variant="contained" size="small" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState;
