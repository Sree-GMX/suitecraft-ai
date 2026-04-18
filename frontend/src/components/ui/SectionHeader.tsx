import { Typography, TypographyProps } from '@mui/material';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

/**
 * Section Header - Clean section title
 * Professional header component
 */
export const SectionHeader = ({ children, sx, ...props }: TypographyProps) => {
  return (
    <Typography
      variant="h5"
      sx={[
        {
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightBold,
          color: SUITECRAFT_TOKENS.colors.text.primary,
          mb: SUITECRAFT_TOKENS.spacing.lg,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      {children}
    </Typography>
  );
};

// Alias
export const ProtocolHeader = SectionHeader;
