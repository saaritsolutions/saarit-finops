import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Settings
      </Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Settings Module
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          This module will handle system settings and configuration.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Settings;
