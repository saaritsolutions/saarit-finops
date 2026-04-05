import { createTheme, ThemeOptions } from '@mui/material/styles';

// ─── Design Tokens ────────────────────────────────────────────────────────────

// Slate scale (neutral foundation)
const SLATE_50  = '#F8FAFC';
const SLATE_100 = '#F1F5F9';
const SLATE_200 = '#E2E8F0';
const SLATE_300 = '#CBD5E1';
const SLATE_400 = '#94A3B8';
const SLATE_500 = '#64748B';
const SLATE_600 = '#475569';
const SLATE_700 = '#334155';
const SLATE_800 = '#1E293B';
const SLATE_900 = '#0F172A';

// Blue scale (premium banking blue)
const BLUE_50  = '#EFF6FF';
const BLUE_100 = '#DBEAFE';
const BLUE_500 = '#3B82F6';
const BLUE_600 = '#2563EB';
const BLUE_700 = '#1D4ED8';
const BLUE_800 = '#1E40AF';

// Semantic colors
const EMERALD_50  = '#ECFDF5';
const EMERALD_500 = '#10B981';
const EMERALD_600 = '#059669';
const AMBER_50    = '#FFFBEB';
const AMBER_500   = '#F59E0B';
const AMBER_600   = '#D97706';
const RED_50      = '#FEF2F2';
const RED_500     = '#EF4444';
const RED_600     = '#DC2626';
const PURPLE_500  = '#8B5CF6';
const SKY_500     = '#0EA5E9';

// Shadow system
const SHADOW_SM  = '0 1px 2px rgba(0,0,0,0.05)';
const SHADOW_MD  = '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)';
const SHADOW_LG  = '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)';
const SHADOW_XL  = '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.03)';

// Dark mode tokens
const DARK_BG    = '#0B1120';
const DARK_PAPER = '#111827';
const DARK_CARD  = '#1F2937';
const DARK_BORDER = '#1F2937';

// ─── Theme Factory ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createBankingTheme = (mode: 'light' | 'dark' = 'light'): any => {
  const isLight = mode === 'light';

  return {
    palette: {
      mode,
      primary: {
        main:          BLUE_600,
        light:         BLUE_500,
        dark:          BLUE_700,
        contrastText:  '#FFFFFF',
      },
      secondary: {
        main:          PURPLE_500,
        contrastText:  '#FFFFFF',
      },
      success: {
        main:          EMERALD_500,
        light:         EMERALD_50,
        dark:          EMERALD_600,
        contrastText:  '#FFFFFF',
      },
      warning: {
        main:          AMBER_500,
        light:         AMBER_50,
        dark:          AMBER_600,
        contrastText:  '#FFFFFF',
      },
      error: {
        main:          RED_500,
        light:         RED_50,
        dark:          RED_600,
        contrastText:  '#FFFFFF',
      },
      info: {
        main:          SKY_500,
        contrastText:  '#FFFFFF',
      },
      background: {
        default: isLight ? SLATE_50    : DARK_BG,
        paper:   isLight ? '#FFFFFF'   : DARK_PAPER,
      },
      text: {
        primary:   isLight ? SLATE_900 : '#F1F5F9',
        secondary: isLight ? SLATE_500 : SLATE_400,
        disabled:  isLight ? SLATE_300 : SLATE_600,
      },
      divider: isLight ? SLATE_200 : DARK_BORDER,
    },

    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize:      '2rem',
        fontWeight:    700,
        lineHeight:    1.2,
        letterSpacing: '-0.025em',
        color:         isLight ? SLATE_900 : '#F1F5F9',
      },
      h2: {
        fontSize:      '1.5rem',
        fontWeight:    700,
        lineHeight:    1.25,
        letterSpacing: '-0.025em',
        color:         isLight ? SLATE_900 : '#F1F5F9',
      },
      h3: {
        fontSize:      '1.25rem',
        fontWeight:    600,
        lineHeight:    1.333,
        letterSpacing: '-0.02em',
      },
      h4: {
        fontSize:      '1.125rem',
        fontWeight:    600,
        lineHeight:    1.4,
        letterSpacing: '-0.015em',
      },
      h5: {
        fontSize:      '1rem',
        fontWeight:    600,
        lineHeight:    1.5,
      },
      h6: {
        fontSize:      '0.875rem',
        fontWeight:    600,
        lineHeight:    1.57,
      },
      subtitle1: {
        fontSize:      '0.9375rem',
        fontWeight:    500,
        lineHeight:    1.5,
        letterSpacing: '-0.01em',
      },
      subtitle2: {
        fontSize:      '0.8125rem',
        fontWeight:    500,
        lineHeight:    1.57,
        color:         isLight ? SLATE_500 : SLATE_400,
      },
      body1: {
        fontSize:      '0.9375rem',
        lineHeight:    1.6,
        letterSpacing: '-0.01em',
      },
      body2: {
        fontSize:      '0.8125rem',
        lineHeight:    1.5,
        color:         isLight ? SLATE_600 : SLATE_400,
      },
      caption: {
        fontSize:      '0.75rem',
        lineHeight:    1.5,
        color:         isLight ? SLATE_500 : SLATE_400,
        letterSpacing: '0.01em',
      },
      overline: {
        fontSize:      '0.6875rem',
        fontWeight:    600,
        lineHeight:    1.5,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color:         isLight ? SLATE_400 : SLATE_500,
      },
      button: {
        fontWeight:    600,
        letterSpacing: '-0.01em',
        textTransform: 'none' as const,
      },
    },

    shape: {
      borderRadius: 10,
    },

    shadows: [
      'none',
      SHADOW_SM,
      SHADOW_MD,
      SHADOW_LG,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
      SHADOW_XL,
    ],

    components: {
      // ── AppBar ──────────────────────────────────────────────────────────────
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#FFFFFF' : DARK_PAPER,
            borderBottom:    `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            boxShadow:       'none',
            color:           isLight ? SLATE_900 : '#F1F5F9',
          },
        },
      },

      // ── Drawer / Sidebar ────────────────────────────────────────────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#FFFFFF' : DARK_PAPER,
            borderRight:     `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            boxShadow:       'none',
            borderRadius:    0,
          },
        },
      },

      // ── Card ────────────────────────────────────────────────────────────────
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#FFFFFF' : DARK_CARD,
            border:          `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            borderRadius:    12,
            boxShadow:       SHADOW_SM,
            transition:      'box-shadow 200ms ease, transform 200ms ease',
            '&:hover': {
              boxShadow: SHADOW_MD,
            },
          },
        },
      },

      // ── Paper ───────────────────────────────────────────────────────────────
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            border:    `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            boxShadow: SHADOW_SM,
          },
          elevation2: {
            border:    `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            boxShadow: SHADOW_MD,
          },
          elevation3: {
            boxShadow: SHADOW_LG,
          },
        },
      },

      // ── Button ──────────────────────────────────────────────────────────────
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius:  8,
            fontWeight:    600,
            fontSize:      '0.875rem',
            letterSpacing: '-0.01em',
            lineHeight:    1.5,
            transition:    'all 150ms ease',
          },
          contained: {
            background:   `linear-gradient(135deg, ${BLUE_600} 0%, ${BLUE_700} 100%)`,
            boxShadow:    SHADOW_SM,
            padding:      '8px 18px',
            '&:hover': {
              background:  `linear-gradient(135deg, ${BLUE_500} 0%, ${BLUE_600} 100%)`,
              boxShadow:   SHADOW_MD,
              transform:   'translateY(-1px)',
            },
            '&:active': {
              transform:   'translateY(0)',
              boxShadow:   SHADOW_SM,
            },
          },
          outlined: {
            borderColor: isLight ? SLATE_300 : SLATE_600,
            padding:     '7px 17px',
            '&:hover': {
              borderColor:     BLUE_600,
              backgroundColor: BLUE_50,
              color:           BLUE_600,
            },
          },
          text: {
            color: isLight ? SLATE_600 : SLATE_400,
            '&:hover': {
              backgroundColor: isLight ? SLATE_100 : DARK_CARD,
              color:           isLight ? SLATE_900 : '#F1F5F9',
            },
          },
          sizeSmall: {
            padding:   '5px 12px',
            fontSize:  '0.8125rem',
            borderRadius: 6,
          },
          sizeLarge: {
            padding:   '10px 24px',
            fontSize:  '0.9375rem',
          },
        },
      },

      // ── IconButton ──────────────────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius:  8,
            transition:    'all 150ms ease',
            '&:hover': {
              backgroundColor: isLight ? SLATE_100 : DARK_CARD,
              transform:       'scale(1.05)',
            },
          },
        },
      },

      // ── TextField / Input ───────────────────────────────────────────────────
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
          size:    'small',
        },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius:    8,
              backgroundColor: isLight ? '#FFFFFF' : DARK_CARD,
              fontSize:        '0.875rem',
              transition:      'box-shadow 150ms ease',
              '& fieldset': {
                borderColor: isLight ? SLATE_300 : SLATE_600,
                transition:  'border-color 150ms ease',
              },
              '&:hover fieldset': {
                borderColor: isLight ? SLATE_400 : SLATE_500,
              },
              '&.Mui-focused fieldset': {
                borderColor: BLUE_600,
                borderWidth: '1.5px',
              },
              '&.Mui-focused': {
                boxShadow: `0 0 0 3px ${BLUE_100}`,
              },
            },
            '& .MuiInputLabel-root': {
              fontSize: '0.875rem',
              color:    isLight ? SLATE_500 : SLATE_400,
            },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },

      // ── Select ──────────────────────────────────────────────────────────────
      MuiSelect: {
        styleOverrides: {
          select: {
            fontSize: '0.875rem',
          },
        },
      },

      // ── Chip ────────────────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius:  6,
            fontWeight:    500,
            fontSize:      '0.75rem',
            height:        24,
            letterSpacing: '0.01em',
          },
          filled: {
            '&.MuiChip-colorSuccess': {
              backgroundColor: EMERALD_50,
              color:           EMERALD_600,
              border:          `1px solid ${EMERALD_500}20`,
            },
            '&.MuiChip-colorWarning': {
              backgroundColor: AMBER_50,
              color:           AMBER_600,
              border:          `1px solid ${AMBER_500}20`,
            },
            '&.MuiChip-colorError': {
              backgroundColor: RED_50,
              color:           RED_600,
              border:          `1px solid ${RED_500}20`,
            },
            '&.MuiChip-colorInfo': {
              backgroundColor: BLUE_50,
              color:           BLUE_700,
              border:          `1px solid ${BLUE_600}20`,
            },
          },
        },
      },

      // ── Table ───────────────────────────────────────────────────────────────
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: isLight ? SLATE_50 : DARK_CARD,
              color:           isLight ? SLATE_600 : SLATE_400,
              fontWeight:      600,
              fontSize:        '0.75rem',
              letterSpacing:   '0.05em',
              textTransform:   'uppercase',
              borderBottom:    `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
              padding:         '10px 16px',
            },
          },
        },
      },

      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root': {
              transition: 'background-color 100ms ease',
              '&:hover': {
                backgroundColor: isLight ? SLATE_50 : `${DARK_CARD}80`,
              },
            },
            '& .MuiTableCell-body': {
              borderBottom: `1px solid ${isLight ? SLATE_100 : DARK_BORDER}`,
              fontSize:     '0.875rem',
              padding:      '12px 16px',
              color:        isLight ? SLATE_700 : SLATE_300,
            },
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child .MuiTableCell-body': {
              borderBottom: 'none',
            },
          },
        },
      },

      // ── Tabs ────────────────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight:    500,
            fontSize:      '0.875rem',
            letterSpacing: '-0.01em',
            minHeight:     44,
            color:         isLight ? SLATE_500 : SLATE_400,
            '&.Mui-selected': {
              color:      BLUE_600,
              fontWeight: 600,
            },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: {
            height:      2,
            borderRadius: 2,
          },
        },
      },

      // ── Dialog ──────────────────────────────────────────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius:    16,
            boxShadow:       SHADOW_XL,
            border:          `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            backgroundImage: 'none',
          },
        },
      },

      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontSize:    '1rem',
            fontWeight:  600,
            padding:     '20px 24px 12px',
            color:       isLight ? SLATE_900 : '#F1F5F9',
          },
        },
      },

      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: '8px 24px 20px',
          },
        },
      },

      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding:    '12px 24px 20px',
            borderTop:  `1px solid ${isLight ? SLATE_100 : DARK_BORDER}`,
            gap:        8,
          },
        },
      },

      // ── Tooltip ─────────────────────────────────────────────────────────────
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isLight ? SLATE_900 : SLATE_700,
            color:           '#FFFFFF',
            fontSize:        '0.75rem',
            fontWeight:      500,
            borderRadius:    6,
            padding:         '6px 10px',
            boxShadow:       SHADOW_MD,
          },
          arrow: {
            color: isLight ? SLATE_900 : SLATE_700,
          },
        },
      },

      // ── Alert ───────────────────────────────────────────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontSize:     '0.875rem',
            fontWeight:   500,
            border:       '1px solid transparent',
          },
          standardSuccess: {
            backgroundColor: EMERALD_50,
            color:           EMERALD_600,
            borderColor:     `${EMERALD_500}30`,
          },
          standardWarning: {
            backgroundColor: AMBER_50,
            color:           AMBER_600,
            borderColor:     `${AMBER_500}30`,
          },
          standardError: {
            backgroundColor: RED_50,
            color:           RED_600,
            borderColor:     `${RED_500}30`,
          },
          standardInfo: {
            backgroundColor: BLUE_50,
            color:           BLUE_700,
            borderColor:     `${BLUE_600}30`,
          },
        },
      },

      // ── Snackbar ────────────────────────────────────────────────────────────
      MuiSnackbar: {
        defaultProps: {
          anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        },
      },

      // ── List ────────────────────────────────────────────────────────────────
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius:    8,
            margin:          '1px 8px',
            padding:         '8px 12px',
            transition:      'all 150ms ease',
            '&:hover': {
              backgroundColor: isLight ? SLATE_100 : DARK_CARD,
            },
            '&.Mui-selected': {
              backgroundColor: BLUE_50,
              color:           BLUE_600,
              '&:hover': {
                backgroundColor: BLUE_100,
              },
              '& .MuiListItemIcon-root': {
                color: BLUE_600,
              },
              '& .MuiListItemText-primary': {
                fontWeight: 600,
                color:      BLUE_600,
              },
            },
          },
        },
      },

      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth:  36,
            color:     isLight ? SLATE_500 : SLATE_400,
          },
        },
      },

      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize:  '0.875rem',
            fontWeight: 500,
          },
        },
      },

      // ── Avatar ──────────────────────────────────────────────────────────────
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize:   '0.875rem',
          },
          colorDefault: {
            backgroundColor: BLUE_100,
            color:           BLUE_700,
          },
        },
      },

      // ── Divider ─────────────────────────────────────────────────────────────
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isLight ? SLATE_200 : DARK_BORDER,
          },
        },
      },

      // ── Breadcrumbs ─────────────────────────────────────────────────────────
      MuiBreadcrumbs: {
        styleOverrides: {
          root: {
            fontSize:  '0.8125rem',
            color:     isLight ? SLATE_500 : SLATE_400,
          },
          separator: {
            color: isLight ? SLATE_300 : SLATE_600,
          },
        },
      },

      // ── LinearProgress ──────────────────────────────────────────────────────
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            height:       6,
            backgroundColor: isLight ? SLATE_200 : DARK_BORDER,
          },
          bar: {
            borderRadius: 4,
          },
        },
      },

      // ── Skeleton ────────────────────────────────────────────────────────────
      MuiSkeleton: {
        defaultProps: {
          animation: 'wave',
        },
        styleOverrides: {
          root: {
            backgroundColor: isLight ? SLATE_100 : DARK_CARD,
          },
          wave: {
            '&::after': {
              background: `linear-gradient(90deg, transparent, ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)'}, transparent)`,
            },
          },
        },
      },

      // ── Stepper ─────────────────────────────────────────────────────────────
      MuiStepLabel: {
        styleOverrides: {
          label: {
            fontSize:  '0.8125rem',
            fontWeight: 500,
            '&.Mui-active': {
              fontWeight: 600,
              color:      BLUE_600,
            },
            '&.Mui-completed': {
              color: EMERALD_500,
            },
          },
        },
      },

      MuiStepIcon: {
        styleOverrides: {
          root: {
            color: isLight ? SLATE_200 : SLATE_700,
            '&.Mui-active': {
              color: BLUE_600,
            },
            '&.Mui-completed': {
              color: EMERALD_500,
            },
          },
          text: {
            fontSize:   '0.6875rem',
            fontWeight: 600,
          },
        },
      },

      // ── Badge ───────────────────────────────────────────────────────────────
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontSize:   '0.6875rem',
            fontWeight: 600,
            minWidth:   18,
            height:     18,
            padding:    '0 4px',
          },
        },
      },

      // ── Menu ────────────────────────────────────────────────────────────────
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            boxShadow:    SHADOW_LG,
            border:       `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            backgroundImage: 'none',
            minWidth:     180,
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize:   '0.875rem',
            fontWeight: 500,
            padding:    '8px 14px',
            borderRadius: 6,
            margin:     '2px 6px',
            '&:hover': {
              backgroundColor: isLight ? SLATE_100 : DARK_CARD,
            },
            '&.Mui-selected': {
              backgroundColor: BLUE_50,
              color:           BLUE_600,
              '&:hover': {
                backgroundColor: BLUE_100,
              },
            },
          },
        },
      },

      // ── Popover ─────────────────────────────────────────────────────────────
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow:    SHADOW_LG,
            border:       `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            backgroundImage: 'none',
          },
        },
      },

      // ── FormControl ─────────────────────────────────────────────────────────
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            fontSize:   '0.75rem',
            marginLeft: 0,
            marginTop:  4,
          },
        },
      },

      MuiFormLabel: {
        styleOverrides: {
          root: {
            fontSize:  '0.875rem',
            fontWeight: 500,
            color:     isLight ? SLATE_700 : SLATE_300,
          },
        },
      },

      // ── DataGrid (MUI X) ─────────────────────────────────────────────────────
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border:      `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
            borderRadius: 12,
            fontSize:    '0.875rem',
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: isLight ? SLATE_50 : DARK_CARD,
              borderBottom:    `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
              minHeight:       '44px !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight:    600,
              fontSize:      '0.75rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color:         isLight ? SLATE_500 : SLATE_400,
            },
            '& .MuiDataGrid-row': {
              transition: 'background-color 100ms ease',
              '&:hover': {
                backgroundColor: isLight ? SLATE_50 : `${DARK_CARD}80`,
              },
            },
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${isLight ? SLATE_100 : DARK_BORDER}`,
              padding:      '0 16px',
              color:        isLight ? SLATE_700 : SLATE_300,
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop:       `1px solid ${isLight ? SLATE_200 : DARK_BORDER}`,
              backgroundColor: isLight ? SLATE_50 : DARK_CARD,
              minHeight:       '48px',
            },
          } as any,
        },
      } as any,
    },
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const lightTheme = createTheme(createBankingTheme('light'));
export const darkTheme  = createTheme(createBankingTheme('dark'));

export default lightTheme;

// Re-export tokens for use in components
export {
  SLATE_50, SLATE_100, SLATE_200, SLATE_300, SLATE_400,
  SLATE_500, SLATE_600, SLATE_700, SLATE_800, SLATE_900,
  BLUE_50, BLUE_100, BLUE_500, BLUE_600, BLUE_700, BLUE_800,
  EMERALD_50, EMERALD_500, EMERALD_600,
  AMBER_50, AMBER_500, AMBER_600,
  RED_50, RED_500, RED_600,
  PURPLE_500, SKY_500,
  SHADOW_SM, SHADOW_MD, SHADOW_LG, SHADOW_XL,
  DARK_BG, DARK_PAPER, DARK_CARD, DARK_BORDER,
};
