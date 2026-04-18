import { Component, ReactNode, ErrorInfo } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';
import { DESIGN_TOKENS } from '../styles/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Container maxWidth="md">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              textAlign: 'center',
              py: DESIGN_TOKENS.spacing.xxl,
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 80,
                color: DESIGN_TOKENS.colors.error,
                mb: DESIGN_TOKENS.spacing.lg,
                opacity: 0.8,
              }}
            />
            
            <Typography
              variant="h4"
              sx={{
                fontWeight: DESIGN_TOKENS.typography.fontWeightBold,
                color: DESIGN_TOKENS.colors.text.primary,
                mb: DESIGN_TOKENS.spacing.md,
              }}
            >
              Oops! Something went wrong
            </Typography>
            
            <Typography
              variant="body1"
              sx={{
                color: DESIGN_TOKENS.colors.text.secondary,
                mb: DESIGN_TOKENS.spacing.xl,
                maxWidth: 600,
              }}
            >
              We're sorry, but something unexpected happened. The error has been logged
              and our team will look into it.
            </Typography>

            {import.meta.env.MODE === 'development' && this.state.error && (
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 800,
                  mb: DESIGN_TOKENS.spacing.xl,
                  p: DESIGN_TOKENS.spacing.lg,
                  bgcolor: '#f5f5f5',
                  borderRadius: DESIGN_TOKENS.borderRadius.md,
                  textAlign: 'left',
                  overflow: 'auto',
                }}
              >
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: DESIGN_TOKENS.colors.error,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', gap: DESIGN_TOKENS.spacing.md }}>
              <Button
                variant="outlined"
                onClick={this.handleReset}
                sx={{
                  textTransform: 'none',
                  fontWeight: DESIGN_TOKENS.typography.fontWeightSemiBold,
                  borderRadius: DESIGN_TOKENS.borderRadius.md,
                  px: DESIGN_TOKENS.spacing.xl,
                }}
              >
                Try Again
              </Button>
              
              <Button
                variant="contained"
                onClick={this.handleReload}
                sx={{
                  textTransform: 'none',
                  fontWeight: DESIGN_TOKENS.typography.fontWeightSemiBold,
                  borderRadius: DESIGN_TOKENS.borderRadius.md,
                  px: DESIGN_TOKENS.spacing.xl,
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.primary} 0%, ${DESIGN_TOKENS.colors.primaryDark} 100%)`,
                }}
              >
                Reload Page
              </Button>
            </Box>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}
