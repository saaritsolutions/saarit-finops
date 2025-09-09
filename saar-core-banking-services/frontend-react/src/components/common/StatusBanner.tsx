import React from 'react';
import { Alert, AlertColor, Collapse } from '@mui/material';

export interface StatusBannerProps {
  message?: string | null;
  severity?: AlertColor;
  show?: boolean;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ message, severity = 'info', show }) => {
  const visible = show ?? !!message;
  if (!visible || !message) return null;
  return (
    <Collapse in={visible} timeout={250}>
      <Alert severity={severity} sx={{ mb: 2 }}>
        {message}
      </Alert>
    </Collapse>
  );
};

export default StatusBanner;
