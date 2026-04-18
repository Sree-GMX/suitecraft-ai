import { Button, ButtonProps } from '@mui/material';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

/**
 * Secondary Button - Secondary action button
 * Clean glass effect with border
 */
export const OutlinedButton = ({ children, sx, ...props }: ButtonProps) => {
  return (
    <Button
      variant="outlined"
      sx={[
        {
          background: 'transparent',
          color: SUITECRAFT_TOKENS.colors.primary,
          borderRadius: SUITECRAFT_TOKENS.borderRadius.md,
          px: SUITECRAFT_TOKENS.spacing.xl,
          py: SUITECRAFT_TOKENS.spacing.md,
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
          textTransform: 'none',
          border: `2px solid ${SUITECRAFT_TOKENS.colors.primary}`,
          transition: SUITECRAFT_TOKENS.transitions.normal,
          '&:hover': {
            background: `${SUITECRAFT_TOKENS.colors.primary}10`,
            border: `2px solid ${SUITECRAFT_TOKENS.colors.primaryDark}`,
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
export const OutlineButton = OutlinedButton;
