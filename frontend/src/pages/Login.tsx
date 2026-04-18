import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';

    if (token && isAuth) {
      navigate('/releases', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(formData.email, formData.password);
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/releases', { replace: true });
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Invalid email or password';

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
      eyebrow="Welcome"
      title="Review releases with confidence before the first test starts."
      subtitle="Sign in to scope the release, review linked coverage, and keep QA decisions clear from planning through execution."
      highlights={[
        'Use the same release workflow your team uses to turn change sets into focused test plans.',
        'Keep linked TestRail coverage, AI suggestions, and approvals in one place instead of spreading the work across tabs.',
        'Make sign-off decisions with a workflow that surfaces risk before it becomes a release surprise.',
      ]}
      footer={
        <Typography variant="body2" sx={{ textAlign: 'center', color: SUITECRAFT_TOKENS.colors.text.secondary }}>
          Don&apos;t have an account yet?{' '}
          <Link component={RouterLink} to="/register" sx={AUTH_LINK_SX}>
            Create one
          </Link>
        </Typography>
      }
    >
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: SUITECRAFT_TOKENS.colors.text.secondary, fontWeight: 700 }}>
          Sign In
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.75, mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 800 }}>
          Access your release workspace
        </Typography>
        <Typography variant="body1" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, lineHeight: 1.7 }}>
          Continue to the release cockpit where scope, coverage, and execution stay connected.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Work Email
            </Typography>
            <TextField
              fullWidth
              type="email"
              required
              placeholder="username@suitecraft.ai"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={loading}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Password
            </Typography>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={PASSWORD_TOGGLE_SX}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={FIELD_SX}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link component={RouterLink} to="/forgot-password" sx={AUTH_LINK_SX}>
              Forgot Password?
            </Link>
          </Box>

          <GradientButton
            type="submit"
            fullWidth
            disabled={loading}
            sx={{ py: 1.4, bgcolor: SUITECRAFT_TOKENS.colors.primary, '&:hover': { bgcolor: SUITECRAFT_TOKENS.colors.primaryDark } }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </GradientButton>
        </Stack>
      </form>
    </AuthShell>
  );
}
