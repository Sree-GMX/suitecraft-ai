import { Chip, ChipProps } from '@mui/material';
import { getPriorityColor, Priority } from '../../utils/colorHelpers';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

interface PriorityIndicatorProps extends Omit<ChipProps, 'color'> {
  priority: Priority;
}

/**
 * Priority Chip - Task priority level
 * Clean and professional priority indicator
 */
export const PriorityChip = ({ priority, sx, ...props }: PriorityIndicatorProps) => {
  const priorityColor = getPriorityColor(priority);
  
  return (
    <Chip
      label={priority}
      size="small"
      sx={[
        {
          borderRadius: SUITECRAFT_TOKENS.borderRadius.sm,
          fontWeight: SUITECRAFT_TOKENS.typography.fontWeightMedium,
          fontSize: '0.75rem',
          bgcolor: `${priorityColor}15`,
          color: priorityColor,
          border: `1px solid ${priorityColor}30`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  );
};

// Alias
export const PriorityIndicator = PriorityChip;
