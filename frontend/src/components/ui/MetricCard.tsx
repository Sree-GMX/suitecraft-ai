import { Box, Typography, BoxProps } from '@mui/material';
import { ReactNode } from 'react';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../../styles/theme';

interface HUDMetricProps extends BoxProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  status?: 'active' | 'warning' | 'critical' | 'normal';
  loading?: boolean;
}

/**
 * Metric Card - Key metrics display
 * Clean and professional metric card
 */
export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color,
  status = 'normal',
  loading = false,
  sx,
  ...props 
}: HUDMetricProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'active': return SUITECRAFT_TOKENS.colors.primary;
      case 'warning': return SUITECRAFT_TOKENS.colors.warning;
      case 'critical': return SUITECRAFT_TOKENS.colors.error;
      default: return color || SUITECRAFT_TOKENS.colors.primary;
    }
  };

  const statusColor = getStatusColor();

  return (
    <Box
      sx={[
        SUITECRAFT_STYLES.metricCard,
        { p: 3 },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {icon && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: SUITECRAFT_TOKENS.spacing.sm,
            color: statusColor,
          }}
        >
          {icon}
        </Box>
      )}
      
      <Typography
        variant="body2"
        sx={{
          color: SUITECRAFT_TOKENS.colors.text.secondary,
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightMedium,
          mb: SUITECRAFT_TOKENS.spacing.xs,
        }}
      >
        {title}
      </Typography>
      
      <Typography
        variant="h3"
        sx={{
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightBold,
          color: statusColor,
          mb: subtitle ? SUITECRAFT_TOKENS.spacing.xs : 0,
        }}
      >
        {loading ? '...' : value}
      </Typography>
      
      {subtitle && (
        <Typography
          variant="caption"
          sx={{
            color: SUITECRAFT_TOKENS.colors.text.tertiary,
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

// Alias
export const HUDMetric = MetricCard;
