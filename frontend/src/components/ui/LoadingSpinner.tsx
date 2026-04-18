import { Box, CircularProgress, Typography, BoxProps } from '@mui/material';
import { DESIGN_TOKENS } from '../../styles/theme';

interface LoadingSpinnerProps extends BoxProps {
  message?: string;
  size?: number;
}

/**
 * Loading spinner component
 * Centered loading indicator with optional message
 */
export const LoadingSpinner = ({ 
  message = 'Loading...', 
  size = 40, 
  sx,
  ...props 
}: LoadingSpinnerProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.md,
        py: DESIGN_TOKENS.spacing.xl,
        ...sx,
      }}
      {...props}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography
          variant="body2"
          sx={{
            color: DESIGN_TOKENS.colors.text.secondary,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};
