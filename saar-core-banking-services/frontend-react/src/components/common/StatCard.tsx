import React from 'react';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon } from '@mui/icons-material';

export interface StatCardProps {
  title:       string;
  value:       string;
  subtitle?:   string;
  icon:        React.ReactNode;
  trend?:      'up' | 'down';
  trendLabel?: string;
  iconColor?:  string;
  iconBg?:     string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  iconColor = '#2563EB',
  iconBg    = '#EFF6FF',
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Top row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          {/* Icon */}
          <Box
            sx={{
              width:           44,
              height:          44,
              borderRadius:    10,
              backgroundColor: isDark ? `${iconColor}20` : iconBg,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           iconColor,
              flexShrink:      0,
              '& svg':         { fontSize: '1.25rem' },
            }}
          >
            {icon}
          </Box>

          {/* Trend badge */}
          {trend && trendLabel && (
            <Box
              sx={{
                display:         'flex',
                alignItems:      'center',
                gap:             0.25,
                px:              0.75,
                py:              0.375,
                borderRadius:    6,
                backgroundColor: trend === 'up'
                  ? (isDark ? '#064E3B30' : '#ECFDF5')
                  : (isDark ? '#7F1D1D30' : '#FEF2F2'),
              }}
            >
              {trend === 'up'
                ? <TrendingUpIcon sx={{ fontSize: '0.875rem', color: '#10B981' }} />
                : <TrendingDownIcon sx={{ fontSize: '0.875rem', color: '#EF4444' }} />
              }
              <Typography
                sx={{
                  fontSize:  '0.75rem',
                  fontWeight: 600,
                  color:     trend === 'up' ? '#059669' : '#DC2626',
                  lineHeight: 1,
                }}
              >
                {trendLabel}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Value */}
        <Typography
          className="stat-value"
          sx={{
            fontSize:      '1.75rem',
            fontWeight:    700,
            letterSpacing: '-0.03em',
            lineHeight:    1.1,
            color:         isDark ? '#F1F5F9' : '#0F172A',
            mb:            0.5,
          }}
        >
          {value}
        </Typography>

        {/* Title */}
        <Typography
          sx={{
            fontSize:  '0.8125rem',
            fontWeight: 500,
            color:     isDark ? '#64748B' : '#64748B',
            lineHeight: 1.4,
          }}
        >
          {title}
        </Typography>

        {/* Subtitle */}
        {subtitle && (
          <Typography
            sx={{
              fontSize:  '0.75rem',
              color:     isDark ? '#475569' : '#94A3B8',
              mt:        0.375,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
