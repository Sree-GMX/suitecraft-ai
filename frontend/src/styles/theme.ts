import { SxProps, Theme } from '@mui/material';

/**
 * SuiteCraft.AI Design System
 * Enterprise glass system with a deep-ocean, ember, and electric-cyan palette.
 */

export const SUITECRAFT_TOKENS = {
  colors: {
    brand: {
      ink: '#152F38',
      trench: '#0E2329',
      ocean: '#2A4A55',
      ember: '#C86A4B',
      emberSoft: '#E5B29F',
      cyan: '#38D5DB',
      cyanSoft: '#B7F1F2',
    },

    primary: '#152F38',
    primaryDark: '#0E2329',
    primaryLight: '#2A4A55',

    secondary: '#C86A4B',
    secondaryDark: '#A9573D',
    secondaryLight: '#E5B29F',

    background: {
      main: '#F2F7F7',
      elevated: '#FFFFFF',
      glass: 'rgba(255, 255, 255, 0.44)',
      glassHover: 'rgba(255, 255, 255, 0.56)',
      overlay: 'rgba(244, 249, 249, 0.82)',
      platformGradient:
        'radial-gradient(circle at 50% 14%, rgba(138, 201, 214, 0.16) 0%, rgba(226, 239, 242, 0.74) 34%, rgba(242, 247, 246, 0.92) 68%, rgba(236, 243, 240, 1) 100%), linear-gradient(135deg, #eaf4f6 0%, #f7fbfb 46%, #edf5f2 100%)',
      authGradient:
        'radial-gradient(circle at 50% 15%, rgba(145, 207, 216, 0.16) 0%, rgba(228, 240, 243, 0.76) 34%, rgba(243, 248, 247, 0.94) 70%, rgba(238, 244, 242, 1) 100%), linear-gradient(135deg, #ebf5f6 0%, #f8fbfb 46%, #eef5f2 100%)',
    },

    status: {
      passed: '#1D9A74',
      failed: '#B4494A',
      blocked: '#B88A3B',
      skipped: '#99AAB0',
      running: '#38D5DB',
      pending: '#C8D6DB',
    },

    risk: {
      critical: '#B4494A',
      high: '#C86A4B',
      medium: '#B88A3B',
      low: '#1D9A74',
      none: '#99AAB0',
    },

    success: '#1D9A74',
    warning: '#B88A3B',
    error: '#B4494A',
    info: '#38D5DB',

    text: {
      primary: '#16252C',
      secondary: '#5B7078',
      tertiary: '#8DA1A9',
      disabled: '#C8D6DB',
    },

    border: {
      light: 'rgba(255, 255, 255, 0.64)',
      default: 'rgba(21, 47, 56, 0.12)',
      dark: 'rgba(21, 47, 56, 0.22)',
    },

    accent: {
      orange: '#C86A4B',
      orangeLight: '#E5B29F',
      orangeDark: '#A9573D',
      violet: '#79959E',
      violetLight: '#B9CDD3',
      violetDark: '#4F6A73',
      slate: '#152F38',
      amber: '#E5B29F',
      teal: '#2A4A55',
      cyan: '#38D5DB',
      lime: '#1F6F78',
      orangeTint: 'rgba(200, 106, 75, 0.10)',
      violetTint: 'rgba(121, 149, 158, 0.10)',
      limeTint: 'rgba(31, 111, 120, 0.10)',
      cyanTint: 'rgba(56, 213, 219, 0.12)',
    },
  },

  spacing: {
    xs: 0.5,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
    xxl: 6,
  },

  borderRadius: {
    sm: 1,
    md: 1.5,
    lg: 2,
    xl: 3,
  },

  typography: {
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightSemiBold: 600,
    fontWeightBold: 700,
  },

  effects: {
    glass: {
      sm: 'blur(8px) saturate(135%)',
      md: 'blur(14px) saturate(150%)',
      lg: 'blur(20px) saturate(165%)',
    },
    shadow: {
      sm: '0 10px 24px rgba(13, 28, 33, 0.06)',
      md: '0 16px 36px rgba(13, 28, 33, 0.10)',
      lg: '0 24px 52px rgba(13, 28, 33, 0.14)',
      xl: '0 34px 84px rgba(13, 28, 33, 0.18)',
    },
  },

  transitions: {
    fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const SUITECRAFT_STYLES = {
  glassCard: {
    position: 'relative',
    overflow: 'hidden',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(246,251,252,0.24) 100%)',
    backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    border: '1px solid rgba(255,255,255,0.62)',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.lg,
    boxShadow:
      '0 18px 42px rgba(13, 28, 33, 0.08), 0 3px 10px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.84), inset 0 -1px 0 rgba(255,255,255,0.10)',
    transition: SUITECRAFT_TOKENS.transitions.normal,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 24%, rgba(255,255,255,0) 52%), radial-gradient(circle at top left, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 28%, transparent 54%)',
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: '1px',
      borderRadius: 'inherit',
      border: '1px solid rgba(255,255,255,0.22)',
      pointerEvents: 'none',
      maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.2))',
      WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.2))',
    },
    '&:hover': {
      boxShadow:
        '0 24px 56px rgba(13, 28, 33, 0.10), 0 4px 14px rgba(13, 28, 33, 0.05), inset 0 1px 0 rgba(255,255,255,0.88), inset 0 -1px 0 rgba(255,255,255,0.12)',
      borderColor: 'rgba(145, 208, 221, 0.42)',
      transform: 'translateY(-1px)',
    },
  } as SxProps<Theme>,

  primaryButton: {
    background: SUITECRAFT_TOKENS.colors.primary,
    color: 'white',
    fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
    textTransform: 'none',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.md,
    px: SUITECRAFT_TOKENS.spacing.lg,
    py: 1.25,
    boxShadow: '0 14px 28px rgba(21, 47, 56, 0.18)',
    transition: SUITECRAFT_TOKENS.transitions.normal,
    '&:hover': {
      background: SUITECRAFT_TOKENS.colors.primaryDark,
      boxShadow: '0 18px 34px rgba(21, 47, 56, 0.22)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
    },
    '&:disabled': {
      background: SUITECRAFT_TOKENS.colors.text.disabled,
      color: 'white',
      boxShadow: 'none',
    },
  } as SxProps<Theme>,

  secondaryButton: {
    background: 'rgba(255,255,255,0.42)',
    color: SUITECRAFT_TOKENS.colors.primary,
    fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
    textTransform: 'none',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.md,
    border: '1.5px solid rgba(255,255,255,0.50)',
    px: SUITECRAFT_TOKENS.spacing.lg,
    py: 1.25,
    transition: SUITECRAFT_TOKENS.transitions.normal,
    '&:hover': {
      background: SUITECRAFT_TOKENS.colors.accent.cyanTint,
      borderColor: SUITECRAFT_TOKENS.colors.info,
      color: SUITECRAFT_TOKENS.colors.info,
    },
  } as SxProps<Theme>,

  glassDialog: {
    position: 'relative',
    overflow: 'hidden',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(245,250,251,0.28) 100%)',
    backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    border: '1px solid rgba(255, 255, 255, 0.66)',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.xl,
    boxShadow:
      '0 28px 68px rgba(13, 28, 33, 0.12), 0 6px 20px rgba(13, 28, 33, 0.05), inset 0 1px 0 rgba(255,255,255,0.84)',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.08) 22%, rgba(255,255,255,0) 54%)',
      pointerEvents: 'none',
    },
  } as SxProps<Theme>,

  metricCard: {
    position: 'relative',
    overflow: 'hidden',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(247,251,252,0.22) 100%)',
    backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    border: '1px solid rgba(255, 255, 255, 0.60)',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.lg,
    boxShadow:
      '0 14px 32px rgba(13, 28, 33, 0.08), 0 2px 8px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.82)',
    p: SUITECRAFT_TOKENS.spacing.lg,
    textAlign: 'center',
    transition: SUITECRAFT_TOKENS.transitions.normal,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 28%, rgba(255,255,255,0) 56%)',
      pointerEvents: 'none',
    },
    '&:hover': {
      boxShadow: '0 12px 32px rgba(13, 28, 33, 0.12)',
      transform: 'translateY(-2px)',
    },
  } as SxProps<Theme>,

  inputField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(247,250,252,0.22) 100%)',
      backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
      WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
      boxShadow:
        '0 8px 20px rgba(13, 28, 33, 0.05), inset 0 1px 0 rgba(255,255,255,0.82), inset 0 -1px 0 rgba(255,255,255,0.08)',
      '& fieldset': {
        borderColor: 'rgba(255,255,255,0.58)',
      },
      '&:hover fieldset': {
        borderColor: SUITECRAFT_TOKENS.colors.info,
      },
      '&.Mui-focused fieldset': {
        borderColor: SUITECRAFT_TOKENS.colors.info,
        borderWidth: '2px',
      },
    },
    '& .MuiOutlinedInput-input:focus, & .MuiOutlinedInput-input:focus-visible': {
      outline: 'none',
      boxShadow: 'none',
    },
  } as SxProps<Theme>,

  floatingGlass: {
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.46) 0%, rgba(248,251,252,0.24) 100%)',
    backdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.lg,
    border: '1px solid rgba(255,255,255,0.64)',
    boxShadow:
      '0 18px 42px rgba(13, 28, 33, 0.09), 0 2px 10px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.86)',
  } as SxProps<Theme>,

  sectionHeader: {
    fontWeight: SUITECRAFT_TOKENS.typography.fontWeightBold,
    fontSize: '1.5rem',
    color: SUITECRAFT_TOKENS.colors.text.primary,
    mb: SUITECRAFT_TOKENS.spacing.lg,
  } as SxProps<Theme>,

  tableHeader: {
    fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
    color: SUITECRAFT_TOKENS.colors.text.secondary,
    fontSize: '0.875rem',
    borderBottom: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
    background: 'rgba(255, 255, 255, 0.42)',
    backdropFilter: 'blur(10px)',
  } as SxProps<Theme>,

  statusChip: {
    fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
    fontSize: '0.8125rem',
    borderRadius: SUITECRAFT_TOKENS.borderRadius.sm,
    px: 1.5,
    py: 0.5,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
  } as SxProps<Theme>,
} as const;

export const SUITECRAFT_GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&display=swap');

  html {
    min-height: 100%;
  }

  body {
    position: relative;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      radial-gradient(circle at 18% 24%, rgba(152, 210, 220, 0.18) 0%, transparent 26%),
      radial-gradient(circle at 82% 22%, rgba(255,255,255,0.72) 0%, transparent 24%),
      radial-gradient(circle at 52% 78%, rgba(196, 222, 220, 0.18) 0%, transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0.16) 100%);
    opacity: 0.9;
  }

  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px);
    background-size: 32px 32px, 32px 32px;
    mask-image: radial-gradient(circle at center, rgba(0,0,0,0.34), transparent 78%);
    -webkit-mask-image: radial-gradient(circle at center, rgba(0,0,0,0.34), transparent 78%);
    opacity: 0.22;
  }

  #root {
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  *:focus,
  *:focus-visible {
    outline: none !important;
  }
  
  button:focus-visible,
  a:focus-visible,
  [role="button"]:focus-visible,
  [tabindex]:focus-visible {
    box-shadow: 0 0 0 2px rgba(56, 213, 219, 0.22) !important;
    transition: box-shadow 0.15s ease-in-out;
  }
  
  .MuiButton-root:focus,
  .MuiIconButton-root:focus,
  .MuiButtonBase-root:focus {
    outline: none !important;
  }
  
  .MuiOutlinedInput-root:focus-within {
    outline: none !important;
  }

  input[type="date"] {
    min-height: 56px;
    font-size: 1rem;
    cursor: pointer;
  }

  input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    font-size: 1.5rem;
    padding: 10px;
    opacity: 0.7;
  }

  input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }

  input[type="date"]::-webkit-datetime-edit {
    font-size: 1rem;
    padding: 4px;
  }

  input[type="date"]::-webkit-datetime-edit-fields-wrapper {
    padding: 4px;
  }
`;

export const mergeSuitecraftStyles = (...styles: (SxProps<Theme> | undefined)[]) => {
  return styles.filter(Boolean);
};

export const DESIGN_TOKENS = SUITECRAFT_TOKENS;
export const SHARED_STYLES = SUITECRAFT_STYLES;
export const JARVIS_TOKENS = SUITECRAFT_TOKENS;
export const JARVIS_STYLES = SUITECRAFT_STYLES;
export const JARVIS_ANIMATIONS = SUITECRAFT_GLOBAL_STYLES;
