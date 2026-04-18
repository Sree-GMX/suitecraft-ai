import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Cloud as ServerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { orgService, QAOrg } from '../services/api';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';

export default function Organizations() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrg, setNewOrg] = useState({
    org_name: '',
    release_version: '',
    org_url: '',
    enabled_features: '',
    data_sets_available: '',
    stability_score: 0.8,
    known_issues: '',
  });

  const { data: orgs, isLoading, isError, refetch } = useQuery({
    queryKey: ['orgs'],
    queryFn: async () => {
      const response = await orgService.getAll();
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => orgService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgs'] });
      setShowCreateForm(false);
      setNewOrg({
        org_name: '',
        release_version: '',
        org_url: '',
        enabled_features: '',
        data_sets_available: '',
        stability_score: 0.8,
        known_issues: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const orgData = {
      ...newOrg,
      enabled_features: newOrg.enabled_features
        .split(',')
        .map(f => f.trim())
        .filter(f => f),
      data_sets_available: newOrg.data_sets_available
        .split(',')
        .map(d => d.trim())
        .filter(d => d),
      known_issues: newOrg.known_issues
        .split(',')
        .map(i => i.trim())
        .filter(i => i),
    };

    createMutation.mutate(orgData);
  };

  const getStabilityColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: 420,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Card elevation={0} sx={{ width: '100%', maxWidth: 480, ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={52} />
            <Typography variant="h6" fontWeight={700} sx={{ mt: 2 }}>
              Loading organizations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pulling environment and stability details into the workspace.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100%', background: 'transparent' }}>
      {/* Header */}
      <Card elevation={0} sx={{ mb: 4, ...SUITECRAFT_STYLES.glassCard }}>
        <CardContent
          sx={{
            p: { xs: 3, md: 4 },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
          }}
        >
        <Box>
          <Typography variant="overline" sx={{ color: SUITECRAFT_TOKENS.colors.text.secondary, letterSpacing: '0.08em', fontWeight: 700 }}>
            QA ENVIRONMENTS
          </Typography>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            QA Organizations
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage test environments and organizations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateForm(true)}
          size="large"
          sx={SUITECRAFT_STYLES.primaryButton}
        >
          New Organization
        </Button>
        </CardContent>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog 
        open={showCreateForm} 
        onClose={() => setShowCreateForm(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            ...SUITECRAFT_STYLES.glassDialog,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(245,249,250,0.56) 100%)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Create New QA Organization
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2.5}>
              <Grid xs={12} sm={6}>
                <TextField
                  label="Organization Name"
                  placeholder="e.g., UCP-QA-ORG-5"
                  value={newOrg.org_name}
                  onChange={(e) => setNewOrg({...newOrg, org_name: e.target.value})}
                  required
                  fullWidth
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  label="Release Version"
                  placeholder="e.g., v2024.1"
                  value={newOrg.release_version}
                  onChange={(e) => setNewOrg({...newOrg, release_version: e.target.value})}
                  fullWidth
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  label="Organization URL"
                  type="url"
                  placeholder="https://org.example.com"
                  value={newOrg.org_url}
                  onChange={(e) => setNewOrg({...newOrg, org_url: e.target.value})}
                  fullWidth
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  label="Enabled Features (comma-separated)"
                  placeholder="campaign management, user roles, API v2"
                  value={newOrg.enabled_features}
                  onChange={(e) => setNewOrg({...newOrg, enabled_features: e.target.value})}
                  fullWidth
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  label="Data Sets Available (comma-separated)"
                  placeholder="admin users, test campaigns, sample data"
                  value={newOrg.data_sets_available}
                  onChange={(e) => setNewOrg({...newOrg, data_sets_available: e.target.value})}
                  fullWidth
                />
              </Grid>
              <Grid xs={12} sm={6}>
                <TextField
                  label="Stability Score"
                  type="number"
                  InputProps={{
                    inputProps: { min: 0, max: 1, step: 0.1 }
                  }}
                  value={newOrg.stability_score}
                  onChange={(e) => setNewOrg({...newOrg, stability_score: parseFloat(e.target.value)})}
                  fullWidth
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  label="Known Issues (comma-separated)"
                  placeholder="slow response time, data refresh needed"
                  value={newOrg.known_issues}
                  onChange={(e) => setNewOrg({...newOrg, known_issues: e.target.value})}
                  fullWidth
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={() => setShowCreateForm(false)}
              sx={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              disabled={createMutation.isPending}
              sx={{ textTransform: 'none', px: 3 }}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Organizations Grid */}
      {isError ? (
        <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent sx={{ py: 7, textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 54, color: SUITECRAFT_TOKENS.colors.error, mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              We couldn&apos;t load organizations
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The page is available, but the environment list did not come through yet.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              sx={SUITECRAFT_STYLES.secondaryButton}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : orgs && orgs.length > 0 ? (
        <Grid container spacing={3}>
          {orgs.map((org: QAOrg) => (
            <Grid xs={12} sm={6} md={4} key={org.id}>
              <Card 
                elevation={0}
                sx={{
                  ...SUITECRAFT_STYLES.glassCard,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(247,251,252,0.46) 100%)',
                  '&:hover': {
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(248,251,252,0.56) 100%)',
                  },
                }}
              >
                <CardContent>
                  {/* Header with Icon and Status */}
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <ServerIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    {org.is_active ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} />
                    ) : (
                      <ErrorIcon sx={{ color: 'error.main' }} />
                    )}
                  </Box>
                  
                  {/* Org Name */}
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {org.org_name}
                  </Typography>
                  
                  {/* Version */}
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Version: {org.release_version || 'Not specified'}
                  </Typography>
                  
                  {/* Stability Score */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Stability Score
                      </Typography>
                      <Typography 
                        variant="caption" 
                        fontWeight={600}
                        color={`${getStabilityColor(org.stability_score)}.main`}
                      >
                        {(org.stability_score * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={org.stability_score * 100}
                      color={getStabilityColor(org.stability_score)}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                  </Box>

                  {/* Features */}
                  {org.enabled_features && org.enabled_features.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Features
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                        {org.enabled_features.slice(0, 3).map((feature, idx) => (
                          <Chip 
                            key={idx} 
                            label={feature} 
                            size="small"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        ))}
                        {org.enabled_features.length > 3 && (
                          <Chip 
                            label={`+${org.enabled_features.length - 3} more`} 
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                      </Stack>
                    </Box>
                  )}

                  {/* Data Sets */}
                  {org.data_sets_available && org.data_sets_available.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Data Sets
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {org.data_sets_available.length} available
                      </Typography>
                    </Box>
                  )}

                  {/* Known Issues */}
                  {org.known_issues && org.known_issues.length > 0 && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      <Typography variant="body2" color="warning.main">
                        {org.known_issues.length} known issue{org.known_issues.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent
            sx={{
              minHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <ServerIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>
              No organizations yet
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={3} sx={{ maxWidth: 480 }}>
              Create your first QA organization to start tracking stable environments, features, and known issues in the same glass workspace.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateForm(true)}
              size="large"
              sx={SUITECRAFT_STYLES.primaryButton}
            >
              Create Organization
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
