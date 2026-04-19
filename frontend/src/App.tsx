import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress, GlobalStyles, Stack, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReleaseProvider } from './contexts/ReleaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SUITECRAFT_TOKENS, SUITECRAFT_GLOBAL_STYLES, SUITECRAFT_STYLES } from './styles/theme';

const MainLayout = lazy(() => import('./components/MainLayout'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ReleaseOverviewDashboard = lazy(() => import('./pages/ReleaseOverviewDashboard'));
const Releases = lazy(() => import('./pages/Releases'));
const UnifiedReleaseWorkflow = lazy(() => import('./pages/UnifiedReleaseWorkflow'));
const TestExecution = lazy(() => import('./pages/TestExecution'));
const TestRunDetail = lazy(() => import('./pages/TestRunDetail'));

// SuiteCraft.AI Professional Theme - Clean AI Tool Aesthetic
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: SUITECRAFT_TOKENS.colors.primary,
      dark: SUITECRAFT_TOKENS.colors.primaryDark,
      light: SUITECRAFT_TOKENS.colors.primaryLight,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: SUITECRAFT_TOKENS.colors.secondary,
      dark: SUITECRAFT_TOKENS.colors.secondaryDark,
      light: SUITECRAFT_TOKENS.colors.secondaryLight,
      contrastText: '#FFFFFF',
    },
    success: {
      main: SUITECRAFT_TOKENS.colors.success,
      dark: '#18765A',
      light: '#4CB892',
    },
    warning: {
      main: SUITECRAFT_TOKENS.colors.warning,
      dark: '#916B2D',
      light: '#D3B06A',
    },
    error: {
      main: SUITECRAFT_TOKENS.colors.error,
      dark: '#963D3E',
      light: '#D97879',
    },
    info: {
      main: SUITECRAFT_TOKENS.colors.info,
      dark: '#249CA3',
      light: '#B7F1F2',
    },
    background: {
      default: SUITECRAFT_TOKENS.colors.background.main,
      paper: SUITECRAFT_TOKENS.colors.background.elevated,
    },
    text: {
      primary: SUITECRAFT_TOKENS.colors.text.primary,
      secondary: SUITECRAFT_TOKENS.colors.text.secondary,
      disabled: SUITECRAFT_TOKENS.colors.text.disabled,
    },
    divider: SUITECRAFT_TOKENS.colors.border.default,
  },
  typography: {
    fontFamily: SUITECRAFT_TOKENS.typography.fontFamily,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      letterSpacing: '0',
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '0.9375rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          minHeight: '100%',
          background: SUITECRAFT_TOKENS.colors.background.platformGradient,
          backgroundAttachment: 'fixed',
        },
        body: {
          background: SUITECRAFT_TOKENS.colors.background.platformGradient,
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
        },
        '#root': {
          minHeight: '100vh',
          background: 'transparent',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableRipple: false,
        disableFocusRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:focus': {
            outline: 'none',
          },
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          background: SUITECRAFT_TOKENS.colors.primary,
          color: 'white',
          boxShadow: SUITECRAFT_TOKENS.effects.shadow.md,
          '&:hover': {
            background: SUITECRAFT_TOKENS.colors.primaryDark,
            boxShadow: SUITECRAFT_TOKENS.effects.shadow.lg,
          },
        },
        outlined: {
          border: `1.5px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
          '&:hover': {
            borderColor: SUITECRAFT_TOKENS.colors.info,
            color: SUITECRAFT_TOKENS.colors.info,
            backgroundColor: SUITECRAFT_TOKENS.colors.accent.cyanTint,
          },
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        disableRipple: false,
        disableFocusRipple: true,
      },
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease',
          '&:focus': {
            outline: 'none',
          },
          '&:hover': {
            backgroundColor: SUITECRAFT_TOKENS.colors.accent.cyanTint,
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          '&:focus': {
            outline: 'none',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover': {
              '& fieldset': {
                borderColor: SUITECRAFT_TOKENS.colors.border.dark,
              },
            },
            '&:focus-within': {
              outline: 'none',
            },
              '&.Mui-focused': {
                outline: 'none',
                '& fieldset': {
                  borderColor: SUITECRAFT_TOKENS.colors.info,
                  borderWidth: '2px',
                },
              },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none',
          border: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: SUITECRAFT_TOKENS.effects.shadow.sm,
            borderColor: 'rgba(56, 213, 219, 0.22)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
          fontSize: '0.8125rem',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: SUITECRAFT_TOKENS.colors.background.elevated,
          boxShadow: SUITECRAFT_TOKENS.effects.shadow.sm,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(255,255,255,0.76)',
          backdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
          WebkitBackdropFilter: SUITECRAFT_TOKENS.effects.glass.md,
          borderBottom: `1px solid ${SUITECRAFT_TOKENS.colors.border.light}`,
          boxShadow: '0 8px 24px rgba(13, 28, 33, 0.08)',
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function AppLoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        background: SUITECRAFT_TOKENS.colors.background.platformGradient,
        backgroundAttachment: 'fixed',
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{
          p: 4,
          minWidth: { xs: '100%', sm: 360 },
          maxWidth: 460,
          ...SUITECRAFT_STYLES.floatingGlass,
          borderRadius: 4,
        }}
      >
        <CircularProgress />
        <Typography variant="h6" fontWeight={800} sx={{ color: SUITECRAFT_TOKENS.colors.text.primary }}>
          Loading Suitecraft workspace
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.7 }}>
          Pulling in the next screen so the workflow feels lighter after the first load.
        </Typography>
      </Stack>
    </Box>
  );
}

function LegacyWorkflowRedirect() {
  const { releaseId } = useParams();
  return <Navigate to={`/unified-workflow/${releaseId}`} replace />;
}

function LegacyReleaseDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/release-overview/${id}`} replace />;
}

function LegacyExecutionRedirect() {
  const { releaseId } = useParams();
  return <Navigate to={`/unified-workflow/${releaseId}`} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={SUITECRAFT_GLOBAL_STYLES} />
          <ReleaseProvider>
            <Suspense fallback={<AppLoadingFallback />}>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/releases" replace />} />
                    <Route path="releases" element={<Releases />} />
                    <Route path="releases/:id" element={<LegacyReleaseDetailRedirect />} />
                    <Route path="release-overview/:releaseId" element={<ReleaseOverviewDashboard />} />
                    <Route path="release-workflow/:releaseId" element={<LegacyWorkflowRedirect />} />
                    <Route path="unified-workflow/:releaseId" element={<UnifiedReleaseWorkflow />} />
                    <Route path="dashboard/:releaseId" element={<Dashboard />} />
                    <Route path="test-execution/:releaseId" element={<TestExecution />} />
                    <Route path="test-execution/:releaseId/run/:testRunId" element={<TestRunDetail />} />
                    <Route path="test-execution/:releaseId/run/:testRunId/execute/:executionId" element={<LegacyExecutionRedirect />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </Suspense>
          </ReleaseProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
