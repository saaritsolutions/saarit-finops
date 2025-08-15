import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const TestExpressions: React.FC = () => {
  console.log('TestExpressions component rendered');
  
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Test Expression Builder Page
        </Typography>
        <Typography variant="body1">
          If you can see this, the routing is working correctly.
          The issue might be with the original ExpressionBuilder component.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TestExpressions;
