import { Box, Typography, BoxProps } from '@mui/material';
import { getRiskColor, RiskLevel } from '../../utils/colorHelpers';
import { SUITECRAFT_TOKENS } from '../../styles/theme';

interface RiskBadgeProps extends BoxProps {
  risk: RiskLevel;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Risk Badge - Risk level indicator
 * Clean and professional risk display
 */
export const RiskBadge = ({ risk, size = 'medium', sx, ...props }: RiskBadgeProps) => {
  const riskColor = getRiskColor(risk);
  
  const sizeStyles = {
    small: {
      px: 1.5,
      py: 0.5,
      fontSize: '0.75rem',
    },
    medium: {
      px: 2,
      py: 0.75,
      fontSize: '0.8125rem',
    },
    large: {
      px: 2.5,
      py: 1,
      fontSize: '0.875rem',
    },
  };
  
  const styles = sizeStyles[size];
  
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: SUITECRAFT_TOKENS.borderRadius.sm,
        bgcolor: `${riskColor}15`,
        border: `1px solid ${riskColor}30`,
        fontWeight: SUITECRAFT_TOKENS.typography.fontWeightSemiBold,
        textTransform: 'capitalize',
        ...styles,
        ...sx,
      }}
      {...props}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: riskColor,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          color: riskColor,
          fontWeight: 'inherit',
          fontSize: 'inherit',
        }}
      >
        {risk}
      </Typography>
    </Box>
  );
};

// Alias
export const ThreatLevel = RiskBadge;
