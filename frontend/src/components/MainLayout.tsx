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
} from '@mui/material';
import {
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';
import { Logo } from './Logo';
import { QABotWidget } from './qabot/QABotWidget';

export default function MainLayout() {
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
      overflow: 'hidden',
      background: SUITECRAFT_TOKENS.colors.background.platformGradient,
    }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 58%, rgba(200,106,75,0.06) 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.5,
          backgroundImage: `
            linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0) 100%),
            radial-gradient(circle at 20% 72%, rgba(56,213,219,0.18) 0 2px, transparent 2.5px),
            radial-gradient(circle at 68% 78%, rgba(200,106,75,0.16) 0 1.5px, transparent 2px),
            linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 68%, rgba(255,255,255,0.22) 100%)
          `,
          backgroundSize: '100% 100%, 160px 160px, 210px 210px, 100% 100%',
          backgroundPosition: '0 0, 0 0, 48px 24px, 0 0',
          maskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.88) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.88) 100%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '34vh',
          minHeight: 220,
          maxHeight: 360,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.75,
          backgroundImage: `
            radial-gradient(circle at 50% 8%, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.18) 18%, rgba(255,255,255,0) 46%),
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
              onClick={handleLogout}
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

      <QABotWidget />
    </Box>
  );
}
