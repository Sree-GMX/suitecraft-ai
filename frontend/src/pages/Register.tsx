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

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        full_name: formData.fullName || undefined,
      });

      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/releases', { replace: true });
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Registration failed. Please try again.';

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
      eyebrow="Create Account"
      title="Start your release workflow in a space built for QA decisions."
      subtitle="Create an account to move from release scope to execution readiness with the same guided experience your team uses every day."
      highlights={[
        'Bring release tickets, linked regression coverage, and AI-supported gap analysis into one coordinated workspace.',
        'Standardize how your team plans, approves, and executes release testing without relying on spreadsheets and side notes.',
        'Create a clear record of why each release plan exists and how coverage decisions were made.',
      ]}
      footer={
        <Typography variant="body2" sx={{ textAlign: 'center', color: SUITECRAFT_TOKENS.colors.text.secondary }}>
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" sx={AUTH_LINK_SX}>
            Sign in
          </Link>
        </Typography>
      }
    >
      <Box>
        <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: SUITECRAFT_TOKENS.colors.text.secondary, fontWeight: 700 }}>
          Register
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.75, mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 800 }}>
          Create your release workspace
        </Typography>
        <Typography variant="body1" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, lineHeight: 1.7 }}>
          Set up your account and start building release plans with more confidence and less chaos.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack spacing={2.25}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Full Name
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Username
            </Typography>
            <TextField
              fullWidth
              required
              placeholder="Choose a username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Work Email
            </Typography>
            <TextField
              fullWidth
              required
              type="email"
              placeholder="username@suitecraft.ai"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Password
            </Typography>
            <TextField
              fullWidth
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: SUITECRAFT_TOKENS.colors.text.primary, fontWeight: 700 }}>
              Confirm Password
            </Typography>
            <TextField
              fullWidth
              required
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={PASSWORD_TOGGLE_SX}>
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
            disabled={loading}
            sx={{ py: 1.4, mt: 0.5, bgcolor: SUITECRAFT_TOKENS.colors.primary, '&:hover': { bgcolor: SUITECRAFT_TOKENS.colors.primaryDark } }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </GradientButton>
        </Stack>
      </form>
    </AuthShell>
  );
}
