import { Chip, ChipProps } from '@mui/material';
import { getStatusColor, TestStatus } from '../../utils/colorHelpers';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

interface StatusIndicatorProps extends Omit<ChipProps, 'color'> {
  status: TestStatus;
}

/**
 * Status Chip - Test execution status
 * Clean and professional status indicator
 */
export const StatusChip = ({ status, sx, ...props }: StatusIndicatorProps) => {
  const statusColor = getStatusColor(status);
  
  return (
    <Chip
      label={status}
      size="small"
      sx={[
        {
          borderRadius: SUITECRAFT_TOKENS.borderRadius.sm,
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightMedium,
          fontSize: '0.75rem',
          bgcolor: `${statusColor}15`,
          color: statusColor,
          border: `1px solid ${statusColor}30`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
};

// Alias
export const StatusIndicator = StatusChip;
