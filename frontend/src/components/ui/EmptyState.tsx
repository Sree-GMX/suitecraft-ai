import { Box, Typography, BoxProps } from '@mui/material';
import { ReactNode } from 'react';
import { DESIGN_TOKENS } from '../../styles/theme';

interface EmptyStateProps extends BoxProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/**
 * Empty state component
 * Displays when there's no data to show
 */
export const EmptyState = ({ 
  title, 
  description, 
  icon, 
  action,
  sx,
  ...props 
}: EmptyStateProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: DESIGN_TOKENS.spacing.xxl,
        px: DESIGN_TOKENS.spacing.lg,
        ...sx,
      }}
      {...props}
    >
      {icon && (
        <Box
          sx={{
            mb: DESIGN_TOKENS.spacing.lg,
            opacity: 0.5,
            color: DESIGN_TOKENS.colors.text.tertiary,
          }}
        >
          {icon}
        </Box>
      )}
      
      <Typography
        variant="h6"
        sx={{
          fontWeight: DESIGN_TOKENS.typography.fontWeightSemiBold,
          color: DESIGN_TOKENS.colors.text.primary,
          mb: description ? DESIGN_TOKENS.spacing.sm : 0,
        }}
      >
        {title}
      </Typography>
      
      {description && (
        <Typography
          variant="body2"
          sx={{
            color: DESIGN_TOKENS.colors.text.secondary,
            maxWidth: 400,
            mb: action ? DESIGN_TOKENS.spacing.lg : 0,
          }}
        >
          {description}
        </Typography>
      )}
      
      {action && (
        <Box sx={{ mt: DESIGN_TOKENS.spacing.lg }}>
          {action}
        </Box>
      )}
    </Box>
  );
};
