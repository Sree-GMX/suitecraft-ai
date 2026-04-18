import React from 'react';
import { Box, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { Logo } from '../Logo';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../../styles/theme';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: string[];
  children: React.ReactNode;
  sideNote?: string;
  footer?: React.ReactNode;
}

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  highlights,
  children,
  sideNote,
  footer,
}: AuthShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: SUITECRAFT_TOKENS.colors.background.authGradient,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 56%, rgba(200,106,75,0.06) 100%)',
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
          opacity: 0.48,
          backgroundImage: `
            linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.24) 46%, rgba(255,255,255,0) 100%),
            radial-gradient(circle at 18% 70%, rgba(56,213,219,0.16) 0 2px, transparent 2.5px),
            radial-gradient(circle at 72% 76%, rgba(200,106,75,0.14) 0 1.5px, transparent 2px),
            linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 68%, rgba(255,255,255,0.22) 100%)
          `,
          backgroundSize: '100% 100%, 152px 152px, 204px 204px, 100% 100%',
          backgroundPosition: '0 0, 0 0, 40px 20px, 0 0',
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
          height: '30vh',
          minHeight: 200,
          maxHeight: 320,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.7,
          backgroundImage: `
            radial-gradient(circle at 50% 10%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 18%, rgba(255,255,255,0) 44%),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 28px),
            repeating-linear-gradient(0deg, rgba(56,213,219,0.07) 0 1px, transparent 1px 22px),
            linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(244,248,249,0.42) 34%, rgba(228,238,241,0.76) 100%)
          `,
          borderTop: '1px solid rgba(255,255,255,0.30)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
          maskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.28) 22%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.28) 22%, rgba(0,0,0,1) 100%)',
        }}
      />

      <Container
        maxWidth="lg"
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          py: { xs: 3, md: 5 },
        }}
      >
        <Stack spacing={3.5} sx={{ width: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1.05,
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.58)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.68) 0%, rgba(246,251,251,0.42) 100%)',
                backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                boxShadow: '0 20px 44px rgba(13, 28, 33, 0.08), 0 2px 10px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.76)',
              }}
            >
              <Logo size="small" />
                <Chip
                  label="QA Release Workspace"
                  size="small"
                  sx={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(248,251,252,0.20) 100%)',
                    color: SUITECRAFT_TOKENS.colors.primaryLight,
                    fontWeight: 700,
                    border: `1px solid ${SUITECRAFT_TOKENS.colors.border.light}`,
                    px: 0.5,
                    backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                  }}
                />
              </Box>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              overflow: 'hidden',
              position: 'relative',
              ...SUITECRAFT_STYLES.glassDialog,
              borderRadius: 6,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(246,250,251,0.34) 100%)',
              boxShadow: '0 28px 72px rgba(13, 28, 33, 0.10), 0 6px 18px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.72)',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,0.08)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
                minHeight: { lg: 640 },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  p: { xs: 3, md: 4, lg: 4.5 },
                  background: 'rgba(255,255,255,0.05)',
                  borderRight: { lg: '1px solid rgba(255, 255, 255, 0.18)' },
                }}
              >
                <Stack spacing={3} sx={{ maxWidth: 520 }}>
                  <Box>
                    <Typography
                      variant="overline"
                      sx={{ letterSpacing: '0.1em', color: '#64748B', fontWeight: 700 }}
                    >
                      {eyebrow}
                    </Typography>
                    <Typography
                      variant="h2"
                      sx={{
                        mt: 1,
                        mb: 1.5,
                        color: SUITECRAFT_TOKENS.colors.text.primary,
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                      }}
                    >
                      {title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, lineHeight: 1.75, maxWidth: 520 }}>
                      {subtitle}
                    </Typography>
                  </Box>

                  <Stack spacing={1.25}>
                    {highlights.map((highlight) => (
                      <Box
                        key={highlight}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.25,
                          p: 1.25,
                          borderRadius: 3,
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(248,251,252,0.38) 100%)',
                          backdropFilter: SUITECRAFT_TOKENS.effects.glass.sm,
                          WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.sm,
                          border: '1px solid rgba(255, 255, 255, 0.50)',
                          boxShadow: '0 10px 24px rgba(13, 28, 33, 0.04), inset 0 1px 0 rgba(255,255,255,0.68)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            mt: '7px',
                            bgcolor: SUITECRAFT_TOKENS.colors.info,
                            boxShadow: '0 0 0 6px rgba(56, 213, 219, 0.14)',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="body2" sx={{ color: SUITECRAFT_TOKENS.colors.text.primary, lineHeight: 1.7 }}>
                          {highlight}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  {sideNote && (
                    <Paper
                      elevation={0}
                    sx={{
                      p: 2.25,
                      borderRadius: 4,
                      background: 'linear-gradient(180deg, rgba(21, 47, 56, 0.76) 0%, rgba(21, 47, 56, 0.62) 100%)',
                      backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                      WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#F8FAFC',
                      maxWidth: 460,
                      boxShadow: '0 18px 40px rgba(13,28,33,0.16), inset 0 1px 0 rgba(255,255,255,0.12)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(56,213,219,0.10) 0%, rgba(255,255,255,0) 58%, rgba(200,106,75,0.10) 100%)',
                          pointerEvents: 'none',
                        }}
                      />
                      <Typography variant="body2" sx={{ mt: 1.5, color: 'rgba(226,232,240,0.82)', lineHeight: 1.6, position: 'relative' }}>
                        {sideNote}
                      </Typography>
                    </Paper>
                  )}
                </Stack>
              </Box>

              <Box
                sx={{
                  p: { xs: 3, md: 4, lg: 4.5 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255,255,255,0.05)',
                    pointerEvents: 'none',
                  }}
                />
                <Stack spacing={3} sx={{ width: '100%', maxWidth: 480 }}>
                  {children}
                  {footer}
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
