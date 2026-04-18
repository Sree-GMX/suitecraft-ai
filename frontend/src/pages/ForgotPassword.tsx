import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { GradientButton } from '../components/ui';
import AuthShell from '../components/auth/AuthShell';
import { authService } from '../services/api';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';

const FIELD_SX = SUITECRAFT_STYLES.inputField;
const AUTH_LINK_SX = {
  color: SUITECRAFT_TOKENS.colors.info,
  fontWeight: 700,
  textDecoration: 'none',
  transition: 'color 0.2s ease',
  '&:hover': {
    color: SUITECRAFT_TOKENS.colors.secondary,
  },
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';

    if (token && isAuth) {
      navigate('/releases', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await authService.forgotPassword({ email });
      setSubmitted(true);
    } catch {
      setError('We could not process the reset request right now. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="Get back into your release workspace without losing momentum."
      subtitle="Recover access quickly so release planning, review, and sign-off don’t stall while your team is trying to move."
      highlights={[
        'Reset access without breaking the flow of release planning and execution.',
        'Keep your workspace secure while still making recovery feel calm and straightforward.',
        'Use the same polished environment across login, recovery, and release operations.',
      ]}
      footer={
        <Typography variant="body2" sx={{ textAlign: 'center', color: SUITECRAFT_TOKENS.colors.text.secondary }}>
          Remembered your password?{' '}
          <Link component={RouterLink} to="/login" sx={AUTH_LINK_SX}>
            Back to sign in
          </Link>
        </Typography>
      }
    >
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: SUITECRAFT_TOKENS.colors.text.secondary, fontWeight: 700 }}>
          Forgot Password
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.75, mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 800 }}>
          Reset your access
        </Typography>
        <Typography variant="body1" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, lineHeight: 1.7 }}>
          Enter your email address and we&apos;ll send instructions to help you get back in.
        </Typography>
      </Box>

      {submitted ? (
        <Stack spacing={2.5}>
          <Alert severity="success" sx={{ borderRadius: 3 }}>
            Password reset instructions have been sent to <strong>{email}</strong>. Check your inbox and follow the link to continue.
          </Alert>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
                Work Email
              </Typography>
              <TextField
                fullWidth
                required
                type="email"
                placeholder="username@suitecraft.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={FIELD_SX}
              />
            </Box>

            <GradientButton
              fullWidth
              type="submit"
              size="large"
              sx={{ py: 1.4, bgcolor: SUITECRAFT_TOKENS.colors.primary, '&:hover': { bgcolor: SUITECRAFT_TOKENS.colors.primaryDark } }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending Instructions...' : 'Send Reset Instructions'}
            </GradientButton>
          </Stack>
        </form>
      )}
    </AuthShell>
  );
}
