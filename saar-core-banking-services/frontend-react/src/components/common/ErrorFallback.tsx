import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Error fallback component for the banking application
 * Displays user-friendly error messages and recovery options
 */
const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      padding={3}
      bgcolor="background.default"
    >
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            textAlign="center"
            gap={3}
          >
            <ErrorOutline color="error" sx={{ fontSize: 64 }} />
            
            <Typography variant="h4" color="error" gutterBottom>
              Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary">
              We apologize for the inconvenience. An unexpected error has occurred
              in the banking application.
            </Typography>

            {isDevelopment && (
              <Alert severity="error" sx={{ textAlign: 'left', width: '100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Development Error Details:
                </Typography>
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </Typography>
              </Alert>
            )}

            <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={resetErrorBoundary}
                size="large"
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => window.location.href = '/'}
                size="large"
              >
                Go to Dashboard
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" maxWidth="400px">
              If this problem persists, please contact your system administrator
              or IT support team. Include the timestamp and any actions you were
              performing when this error occurred.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ErrorFallback;
