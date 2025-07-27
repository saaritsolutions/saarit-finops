import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const UserManagement: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        User Management
      </Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          User Management Module
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          This module will handle user accounts, roles, and permissions.
        </Typography>
      </Paper>
    </Box>
  );
};

export default UserManagement;
