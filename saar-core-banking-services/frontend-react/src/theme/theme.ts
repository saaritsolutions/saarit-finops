import { createTheme, ThemeOptions } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

// Core Banking Theme Colors
const primaryColor = '#1976d2'; // Professional blue
const secondaryColor = '#dc004e'; // Banking red
const successColor = '#2e7d32'; // Success green
const warningColor = '#ed6c02'; // Warning orange
const errorColor = '#d32f2f'; // Error red
const infoColor = '#0288d1'; // Info blue

// Create custom theme
const createBankingTheme = (mode: 'light' | 'dark' = 'light'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: primaryColor,
      light: alpha(primaryColor, 0.5),
      dark: alpha(primaryColor, 0.9),
      contrastText: '#ffffff',
    },
    secondary: {
      main: secondaryColor,
      light: alpha(secondaryColor, 0.5),
      dark: alpha(secondaryColor, 0.9),
      contrastText: '#ffffff',
    },
    success: {
      main: successColor,
      light: alpha(successColor, 0.5),
      dark: alpha(successColor, 0.9),
    },
    warning: {
      main: warningColor,
      light: alpha(warningColor, 0.5),
      dark: alpha(warningColor, 0.9),
    },
    error: {
      main: errorColor,
      light: alpha(errorColor, 0.5),
      dark: alpha(errorColor, 0.9),
    },
    info: {
      main: infoColor,
      light: alpha(infoColor, 0.5),
      dark: alpha(infoColor, 0.9),
    },
    background: {
      default: mode === 'light' ? '#f5f5f5' : '#121212',
      paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
    },
    text: {
      primary: mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : '#ffffff',
      secondary: mode === 'light' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.125rem',
      fontWeight: 500,
      lineHeight: 1.235,
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.334,
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.6,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
  },
});

export const lightTheme = createTheme(createBankingTheme('light'));
export const darkTheme = createTheme(createBankingTheme('dark'));

export default lightTheme;
