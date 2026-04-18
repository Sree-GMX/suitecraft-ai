import { Button, ButtonProps } from '@mui/material';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

/**
 * Primary Button - Main action button
 * Clean and professional design
 */
export const GradientButton = ({ children, sx, ...props }: ButtonProps) => {
  return (
    <Button
      variant="contained"
      sx={[
        {
          background: SUITECRAFT_TOKENS.colors.primary,
          color: 'white',
          borderRadius: SUITECRAFT_TOKENS.borderRadius.md,
          px: SUITECRAFT_TOKENS.spacing.xl,
          py: SUITECRAFT_TOKENS.spacing.md,
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
          textTransform: 'none',
          boxShadow: SUITECRAFT_TOKENS.effects.shadow.md,
          border: 'none',
          transition: SUITECRAFT_TOKENS.transitions.normal,
          '&:hover': {
            background: SUITECRAFT_TOKENS.colors.primaryDark,
            boxShadow: SUITECRAFT_TOKENS.effects.shadow.lg,
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      {children}
    </Button>
  );
};

// Alias
export const GlowButton = GradientButton;
