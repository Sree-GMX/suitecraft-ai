import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import AuthShell from '../components/auth/AuthShell';
import { GradientButton } from '../components/ui';
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
const PASSWORD_TOGGLE_SX = {
  color: SUITECRAFT_TOKENS.colors.primaryLight,
  transition: 'color 0.2s ease, transform 0.2s ease',
  '&:hover': {
    color: SUITECRAFT_TOKENS.colors.secondary,
    backgroundColor: SUITECRAFT_TOKENS.colors.accent.cyanTint,
  },
  '&:active': {
    transform: 'scale(0.96)',
  },
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authToken = localStorage.getItem('access_token');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';

    if (authToken && isAuth) {
      navigate('/releases', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is invalid or incomplete.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword({
        token,
        new_password: password,
      });
      setSuccess(response.data.message || 'Password successfully reset');
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Could not reset your password. Please request a new reset link.';

      if (typeof errorData?.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData?.detail)) {
        errorMessage = errorData.detail.map((item: any) => item.msg).join(', ');
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Reset Access"
      title="Set a new password and get back into the release workspace."
      subtitle="Use the secure reset link from your email to create a new password and return to planning, approval, and execution."
      highlights={[
        'Reset access without losing the release context your team is actively working through.',
        'Use a simple, secure handoff back into the same release workflow your team already knows.',
        'Keep account recovery calm and quick when a release window is already moving.',
      ]}
      footer={
        <Typography variant="body2" sx={{ textAlign: 'center', color: SUITECRAFT_TOKENS.colors.text.secondary }}>
          Back to{' '}
          <Link component={RouterLink} to="/login" sx={AUTH_LINK_SX}>
            Sign in
          </Link>
        </Typography>
      }
    >
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: SUITECRAFT_TOKENS.colors.text.secondary, fontWeight: 700 }}>
          Reset Password
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.75, mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 800 }}>
          Create a new password
        </Typography>
        <Typography variant="body1" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, lineHeight: 1.7 }}>
          Choose a new password for your account. We&apos;ll send you back to sign in once the reset is complete.
        </Typography>
      </Box>

      {!token && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          This reset link is missing a token. Please request a new reset email.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ borderRadius: 3 }}>
          {success} Redirecting to sign in...
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              New Password
            </Typography>
            <TextField
              fullWidth
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !!success || !token}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((value) => !value)} edge="end" sx={PASSWORD_TOGGLE_SX}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Confirm New Password
            </Typography>
            <TextField
              fullWidth
              required
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || !!success || !token}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword((value) => !value)} edge="end" sx={PASSWORD_TOGGLE_SX}>
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD_SX}
            />
          </Box>

          <GradientButton
            fullWidth
            type="submit"
            size="large"
            sx={{ py: 1.4, bgcolor: SUITECRAFT_TOKENS.colors.primary, '&:hover': { bgcolor: SUITECRAFT_TOKENS.colors.primaryDark } }}
            disabled={loading || !!success || !token}
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </GradientButton>
        </Stack>
      </form>
    </AuthShell>
  );
}
