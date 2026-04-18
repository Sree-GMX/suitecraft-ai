import { Dialog, DialogProps } from '@mui/material';
import { SUITECRAFT_STYLES } from '../../styles/theme';

/**
 * Glass Dialog - Clean frosted glass dialog
 * Professional and elegant dialog component
 */
export const GlassDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog
      PaperProps={{
        sx: SUITECRAFT_STYLES.glassDialog,
      }}
      {...props}
    >
      {children}
    </Dialog>
  );
};

// Alias
export const HUDDialog = GlassDialog;
