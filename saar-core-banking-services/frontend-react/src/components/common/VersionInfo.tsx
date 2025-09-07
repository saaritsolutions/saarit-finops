import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { getAppVersion, getBuildTime } from '../../utils/version';

interface VersionInfoProps {
  variant?: 'compact' | 'detailed';
  showBuildTime?: boolean;
}

const VersionInfo: React.FC<VersionInfoProps> = ({ 
  variant = 'compact', 
  showBuildTime = true 
}) => {
  const appVersion = getAppVersion();
  const buildTime = getBuildTime();
  const buildDate = buildTime ? new Date(buildTime).toLocaleDateString() : null;

  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip 
          icon={<InfoIcon fontSize="small" />}
          label={`v${appVersion}`}
          size="small"
          variant="outlined"
          color="primary"
        />
        {showBuildTime && buildDate && (
          <Typography variant="caption" color="textSecondary">
            Built: {buildDate}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 400 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          Application Information
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="textSecondary">
              Version:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {appVersion}
            </Typography>
          </Box>
          
          {buildTime && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="textSecondary">
                Build Date:
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {buildDate}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="textSecondary">
              Application:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              SaaR Core Banking
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="textSecondary">
              Copyright:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              © 2024 SaaR Banking
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default VersionInfo;
