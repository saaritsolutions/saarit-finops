import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Unauthorized
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
          You don't have permission to access this resource.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Go to Dashboard
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </Paper>
    </Box>
  );
};

export default Unauthorized;
