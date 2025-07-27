import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const TransactionManagement: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        Transaction Management
      </Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Transaction Management Module
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          This module will handle all banking transactions and transaction history.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TransactionManagement;
