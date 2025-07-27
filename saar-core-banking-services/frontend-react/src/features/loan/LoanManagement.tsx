import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const LoanManagement: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Loan Management
      </Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Loan Management Module
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          This module will handle loan applications, approvals, and loan management.
        </Typography>
      </Paper>
    </Box>
  );
};

export default LoanManagement;
