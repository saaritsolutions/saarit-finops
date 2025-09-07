import React from 'react';
import { Typography, Box, Tooltip } from '@mui/material';
import { getAppVersion, getBuildTime } from '../utils/version';

interface VersionDisplayProps {
  variant?: 'text' | 'chip' | 'tooltip';
  size?: 'small' | 'medium' | 'large';
  showBuildTime?: boolean;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({
  variant = 'text',
  size = 'small',
  showBuildTime = false
}) => {
  const version = getAppVersion();
  const buildTime = getBuildTime();
  const buildDate = buildTime ? new Date(buildTime).toLocaleDateString() : null;

  const versionText = `v${version}`;
  const fullText = showBuildTime && buildDate ? `${versionText} (${buildDate})` : versionText;

  const getTypographyVariant = () => {
    switch (size) {
      case 'large':
        return 'body1';
      case 'medium':
        return 'body2';
      case 'small':
      default:
        return 'caption';
    }
  };

  if (variant === 'tooltip') {
    return (
      <Tooltip 
        title={buildDate ? `Build Date: ${buildDate}` : 'Version Information'}
        arrow
      >
        <Typography 
          variant={getTypographyVariant()} 
          color="textSecondary"
          sx={{ cursor: 'help' }}
        >
          {versionText}
        </Typography>
      </Tooltip>
    );
  }

  return (
    <Box>
      <Typography variant={getTypographyVariant()} color="textSecondary">
        {fullText}
      </Typography>
    </Box>
  );
};

export default VersionDisplay;