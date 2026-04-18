import { Card, CardProps } from '@mui/material';
import { SUITECRAFT_STYLES } from '../../styles/theme';

/**
 * Glass Card - Clean frosted glass effect
 * Professional and elegant card component
 */
export const GlassCard = ({ children, sx, ...props }: CardProps) => {
  return (
    <Card
      elevation={0}
      sx={[SUITECRAFT_STYLES.glassCard, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...props}
    >
      {children}
    </Card>
  );
};

// Alias
export const HUDCard = GlassCard;
