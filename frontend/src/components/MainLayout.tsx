import { Outlet } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  IconButton,
  Stack,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useState } from 'react';
import {
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';
import { Logo } from './Logo';
import { QABotWidget } from './qabot/QABotWidget';

export default function MainLayout() {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    // Clear only authentication-related data, preserve workflow progress
    const keysToRemove = ['access_token', 'user', 'isAuthenticated'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.href = '/login';
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden',
      background: SUITECRAFT_TOKENS.colors.background.platformGradient,
    }}>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 58%, rgba(200,106,75,0.06) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.62,
          backgroundImage: `
            linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0) 100%),
            radial-gradient(circle at 18% 24%, rgba(255, 96, 156, 0.18) 0 120px, transparent 280px),
            radial-gradient(circle at 84% 18%, rgba(255, 166, 77, 0.18) 0 120px, transparent 280px),
            radial-gradient(circle at 20% 72%, rgba(56,213,219,0.18) 0 140px, transparent 320px),
            radial-gradient(circle at 68% 78%, rgba(200,106,75,0.16) 0 130px, transparent 300px),
            radial-gradient(circle at 78% 64%, rgba(138, 92, 246, 0.14) 0 120px, transparent 290px),
            linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 68%, rgba(255,255,255,0.22) 100%)
          `,
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%',
          backgroundPosition: 'center, center, center, center, center, center, center',
          maskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.88) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.88) 100%)',
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: '42vh',
          minHeight: 260,
          maxHeight: 440,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.86,
          backgroundImage: `
            radial-gradient(circle at 18% 88%, rgba(255, 96, 156, 0.16) 0%, rgba(255, 96, 156, 0.08) 16%, transparent 36%),
            radial-gradient(circle at 50% 8%, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.18) 18%, rgba(255,255,255,0) 46%),
            radial-gradient(circle at 78% 82%, rgba(56, 213, 219, 0.14) 0%, rgba(56, 213, 219, 0.06) 16%, transparent 34%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 32px),
            repeating-linear-gradient(0deg, rgba(56,213,219,0.08) 0 1px, transparent 1px 24px),
            linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(244,248,249,0.48) 34%, rgba(228,238,241,0.82) 100%)
          `,
          borderTop: '1px solid rgba(255,255,255,0.34)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          maskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 22%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 22%, rgba(0,0,0,1) 100%)',
        }}
      />
      
      <AppBar 
        position="sticky" 
        elevation={0}
        sx={{ 
          top: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(247,251,252,0.44) 100%)',
          backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
          WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
          borderBottom: '1px solid rgba(255, 255, 255, 0.58)',
          boxShadow: '0 16px 36px rgba(13, 28, 33, 0.07), 0 2px 8px rgba(13, 28, 33, 0.04)',
          position: 'sticky',
          zIndex: 30,
        }}
      >
        <Container maxWidth="xl">
          <Toolbar
            sx={{
              minHeight: { xs: 72, md: 78 },
              px: { xs: 0.5, md: 0 },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.25,
                  py: 0.85,
                  borderRadius: 999,
                  border: '1px solid rgba(255, 255, 255, 0.58)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(247,251,252,0.42) 100%)',
                  backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                  WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                  boxShadow: '0 16px 34px rgba(13, 28, 33, 0.07), 0 2px 8px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.76)',
                }}
              >
                <Logo size="small" />
                <Chip
                  label="Release Workspace"
                  size="small"
                  sx={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(248,251,252,0.20) 100%)',
                    color: SUITECRAFT_TOKENS.colors.primaryLight,
                    fontWeight: 700,
                    border: `1px solid ${SUITECRAFT_TOKENS.colors.border.light}`,
                    backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                  }}
                />
              </Box>

              <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, letterSpacing: '0.08em' }}>
                  QA OPERATIONS
                </Typography>
                <Typography variant="body2" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Release planning, approval, and execution in one workflow.
                </Typography>
              </Box>
            </Stack>
            
            <IconButton 
              onClick={() => setShowLogoutDialog(true)}
              sx={{ 
                width: 46,
                height: 46,
                color: SUITECRAFT_TOKENS.colors.text.secondary,
                ...SUITECRAFT_STYLES.floatingGlass,
                borderRadius: '16px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(247,251,252,0.20) 100%)',
                '&:hover': {
                  color: SUITECRAFT_TOKENS.colors.error,
                  borderColor: 'rgba(255, 90, 54, 0.28)',
                  background: 'linear-gradient(180deg, rgba(255,245,242,0.92) 0%, rgba(255,238,233,0.62) 100%)',
                },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Container 
        maxWidth="xl" 
        sx={{ 
          flex: 1, 
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Outlet />
      </Container>

      <Dialog
        open={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          elevation: 0,
          sx: {
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.54)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(247,251,252,0.78) 100%)',
            backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0F172A' }}>
          Log out?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            You’ll be signed out of SuiteCraft, but your local workflow progress will stay available on this machine.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setShowLogoutDialog(false)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogout}
            variant="contained"
            color="error"
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 999 }}
          >
            Log Out
          </Button>
        </DialogActions>
      </Dialog>

      <QABotWidget />
    </Box>
  );
}
