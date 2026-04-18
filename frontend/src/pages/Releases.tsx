import { useState } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Container,
  Stack,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  Menu,
  ListItemIcon,
  ListItemText,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon,
  RocketLaunch as RocketIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { releaseService, integrationService, dashboardService, testExecutionService, Release } from '../services/api';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';
import DatePicker from '../components/DatePicker';
import { getReleaseWorkflowSummary } from '../utils/releaseWorkflow';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: '#6B7280', bgcolor: '#F3F4F6' },
  in_progress: { label: 'In Progress', color: '#3B82F6', bgcolor: '#EFF6FF' },
  testing: { label: 'Testing', color: '#F59E0B', bgcolor: '#FFF7ED' },
  ready: { label: 'Ready', color: '#10B981', bgcolor: '#ECFDF5' },
  deployed: { label: 'Deployed', color: '#8B5CF6', bgcolor: '#F5F3FF' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bgcolor: '#FEF2F2' },
};

const emptyReleaseForm = {
  release_version: '',
  release_name: '',
  description: '',
  target_date: '',
  status: 'planning'
};

const RELEASE_MODAL_FIELD_SX = {
  '& .MuiInputLabel-root': {
    color: '#5B7080',
    fontWeight: 700,
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: SUITECRAFT_TOKENS.colors.primary,
  },
  '& .MuiFormHelperText-root': {
    mt: 1,
    mx: 0.5,
    color: '#70838E',
    fontWeight: 500,
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: 2.5,
    background: 'rgba(255,255,255,0.98)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255,255,255,0.86)',
    '& fieldset': {
      borderColor: 'rgba(148,163,184,0.34)',
      borderWidth: '1px',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(42,74,85,0.42)',
    },
    '&.Mui-focused fieldset': {
      borderColor: SUITECRAFT_TOKENS.colors.primary,
      borderWidth: '2px',
    },
    '&.Mui-disabled': {
      background: 'rgba(248,250,252,0.96)',
    },
  },
};

const formatApiError = (error: any): string => {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((err: any) => err.msg).join(', ');
  } else if (typeof detail === 'string') {
    return detail;
  } else if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  return 'Please check all required fields and try again.';
};

export default function Releases() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [releaseDialogMode, setReleaseDialogMode] = useState<'create' | 'edit'>('create');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [targetDate, setTargetDate] = useState<Dayjs | null>(null);
  const [releaseForm, setReleaseForm] = useState(emptyReleaseForm);

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['releases'],
    queryFn: async () => {
      const response = await releaseService.getAll();
      return response.data;
    },
  });

  const { data: availableVersions = [] } = useQuery({
    queryKey: ['google-sheets-releases'],
    queryFn: async () => {
      try {
        const response = await integrationService.getReleases();
        return response.data.sort((a: string, b: string) => {
          const getNum = (str: string) => parseInt(str.match(/\d+/)?.[0] || '0');
          return getNum(b) - getNum(a);
        });
      } catch {
        return [];
      }
    },
    enabled: showReleaseDialog,
  });

  const releaseWorkflowQueries = useQueries({
    queries: releases.map((release: Release) => ({
      queryKey: ['release-workflow-summary', release.id],
      queryFn: async () => {
        const [metricsResponse, testRunsResponse] = await Promise.all([
          dashboardService.getReleaseMetrics(release.id),
          testExecutionService.getTestRuns(release.id),
        ]);

        return getReleaseWorkflowSummary({
          releaseStatus: release.status,
          metrics: metricsResponse.data,
          testRuns: testRunsResponse.data,
        });
      },
      staleTime: 60_000,
    })),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => releaseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      resetReleaseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => releaseService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      resetReleaseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => releaseService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      setShowDeleteDialog(false);
      setSelectedRelease(null);
    },
  });

  const workflowByReleaseId = new Map(
    releases.map((release: Release, index: number) => [release.id, releaseWorkflowQueries[index]?.data])
  );

  const filteredReleases = releases.filter((release: Release) => {
    const workflowSummary = workflowByReleaseId.get(release.id);
    const effectiveStatus = workflowSummary?.effectiveStatus || release.status;
    const matchesSearch = !searchQuery ||
      release.release_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      release.release_version.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(effectiveStatus);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: releases.length,
    active: releases.filter((release: Release) => {
      const effectiveStatus = workflowByReleaseId.get(release.id)?.effectiveStatus || release.status;
      return ['planning', 'in_progress', 'testing'].includes(effectiveStatus);
    }).length,
    deployed: releases.filter((release: Release) => {
      const effectiveStatus = workflowByReleaseId.get(release.id)?.effectiveStatus || release.status;
      return effectiveStatus === 'deployed';
    }).length,
    ready: releases.filter((release: Release) => {
      const effectiveStatus = workflowByReleaseId.get(release.id)?.effectiveStatus || release.status;
      return effectiveStatus === 'ready';
    }).length,
  };

  function resetReleaseDialog() {
    setShowReleaseDialog(false);
    setReleaseDialogMode('create');
    setSelectedRelease(null);
    setTargetDate(null);
    setReleaseForm(emptyReleaseForm);
  }

  const openCreateReleaseDialog = () => {
    setReleaseDialogMode('create');
    setTargetDate(null);
    setReleaseForm(emptyReleaseForm);
    setSelectedRelease(null);
    setShowReleaseDialog(true);
  };

  const openEditReleaseDialog = (release: Release) => {
    setReleaseDialogMode('edit');
    setSelectedRelease(release);
    setReleaseForm({
      release_version: release.release_version,
      release_name: release.release_name,
      description: release.description || '',
      target_date: release.target_date || '',
      status: release.status,
    });
    setTargetDate(release.target_date ? dayjs(release.target_date) : null);
    setShowReleaseDialog(true);
  };

  const handleReleaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const releaseData = {
      ...releaseForm,
      target_date: releaseForm.target_date || null,
    };

    if (releaseDialogMode === 'edit' && selectedRelease) {
      updateMutation.mutate({
        id: selectedRelease.id,
        data: {
          release_name: releaseData.release_name,
          description: releaseData.description,
          target_date: releaseData.target_date,
          status: releaseData.status,
        },
      });
      return;
    }

    createMutation.mutate(releaseData);
  };

  const handleDeleteRelease = () => {
    if (selectedRelease) {
      deleteMutation.mutate(selectedRelease.id);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, release: Release) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedRelease(release);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', py: 2, background: 'transparent' }}>
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              mb: 3,
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.44)',
              background: 'rgba(255,255,255,0.54)',
              backdropFilter: 'blur(20px) saturate(160%)',
              boxShadow: '0 24px 60px rgba(13, 28, 33, 0.08)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Box>
                <Typography variant="overline" sx={{ color: '#64748B', letterSpacing: '0.1em', fontWeight: 700 }}>
                  Release Workspace
                </Typography>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Release Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage release planning, progress, and readiness in one calmer workspace.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={openCreateReleaseDialog}
                sx={{
                  bgcolor: SUITECRAFT_TOKENS.colors.primary,
                  px: 4,
                  py: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: '0 14px 28px rgba(71, 85, 105, 0.18)',
                  '&:hover': {
                    bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
                  },
                }}
              >
                Create Release
              </Button>
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Card elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.44)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.48)', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Typography variant="h3" fontWeight={800} color="primary.main">
                      {stats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Total Releases
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card elevation={0} sx={{ bgcolor: 'rgba(239,246,255,0.58)', backdropFilter: 'blur(18px)', border: '1px solid rgba(191,219,254,0.9)', boxShadow: '0 12px 30px rgba(59, 130, 246, 0.08)' }}>
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Typography variant="h3" fontWeight={800} color="#3B82F6">
                      {stats.active}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Active
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card elevation={0} sx={{ bgcolor: 'rgba(236,253,245,0.58)', backdropFilter: 'blur(18px)', border: '1px solid rgba(167,243,208,0.9)', boxShadow: '0 12px 30px rgba(16, 185, 129, 0.08)' }}>
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Typography variant="h3" fontWeight={800} color="#10B981">
                      {stats.ready}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Ready to Deploy
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card elevation={0} sx={{ bgcolor: 'rgba(245,243,255,0.58)', backdropFilter: 'blur(18px)', border: '1px solid rgba(221,214,254,0.9)', boxShadow: '0 12px 30px rgba(139, 92, 246, 0.08)' }}>
                  <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                    <Typography variant="h3" fontWeight={800} color="#8B5CF6">
                      {stats.deployed}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Deployed
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Box>

        <Card elevation={0} sx={{ mb: 3, borderRadius: 4, ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent sx={{ py: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <TextField
                size="small"
                placeholder="Search releases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flexGrow: 1,
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.42)',
                    backdropFilter: 'blur(16px)',
                  },
                }}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <Chip
                    key={status}
                    label={config.label}
                    onClick={() => toggleStatusFilter(status)}
                    variant={statusFilter.includes(status) ? 'filled' : 'outlined'}
                    sx={{
                      ...(statusFilter.includes(status) && {
                        bgcolor: config.bgcolor,
                        color: config.color,
                        borderColor: config.color,
                      }),
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {isLoading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography>Loading releases...</Typography>
          </Box>
        ) : filteredReleases.length === 0 ? (
          <Card elevation={0} sx={{ borderRadius: 4, ...SUITECRAFT_STYLES.glassCard, py: 8 }}>
            <Box sx={{ textAlign: 'center' }}>
              <RocketIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {releases.length === 0 ? 'No releases visible yet' : 'No releases match your filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {releases.length === 0
                  ? 'This account does not have any release workspaces yet. Create one now, or ask a release owner to add you as a collaborator.'
                  : 'Try adjusting your search or filters'}
              </Typography>
              {releases.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateReleaseDialog}
                  sx={{
                    bgcolor: SUITECRAFT_TOKENS.colors.primary,
                    textTransform: 'none',
                  }}
                >
                  Create Release
                </Button>
              )}
            </Box>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {filteredReleases.map((release: Release) => {
              const workflowSummary = workflowByReleaseId.get(release.id);
              const effectiveStatus = workflowSummary?.effectiveStatus || release.status;
              const progressValue = workflowSummary?.overallProgress ?? 0;
              const statusConfig = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
              const daysUntilRelease = release.target_date
                ? Math.ceil((new Date(release.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <Grid item xs={12} md={6} lg={4} key={release.id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      border: '1px solid rgba(255,255,255,0.42)',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.52)',
                      backdropFilter: 'blur(18px) saturate(145%)',
                      boxShadow: '0 18px 42px rgba(13, 28, 33, 0.06)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      '&:hover': {
                        boxShadow: '0 20px 48px rgba(13, 28, 33, 0.10)',
                        transform: 'translateY(-4px)',
                        borderColor: 'rgba(255, 255, 255, 0.62)',
                      },
                    }}
                    onClick={() => navigate(`/release-overview/${release.id}`)}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 0.75, display: 'block', letterSpacing: '0.08em' }}>
                            {release.release_version}
                          </Typography>
                          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.15 }}>
                            {release.release_name}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={statusConfig.label}
                            size="small"
                            sx={{
                              bgcolor: statusConfig.bgcolor,
                              color: statusConfig.color,
                              fontWeight: 700,
                              borderRadius: 999,
                              px: 0.5,
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, release)}
                            sx={{
                              ml: 1,
                              border: '1px solid rgba(255,255,255,0.48)',
                              bgcolor: 'rgba(255,255,255,0.4)',
                              backdropFilter: 'blur(10px)',
                            }}
                          >
                            <MoreIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>

                      {release.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: 44,
                          }}
                        >
                          {release.description}
                        </Typography>
                      )}

                      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 3,
                            border: '1px solid rgba(255,255,255,0.42)',
                            bgcolor: 'rgba(255,255,255,0.36)',
                            backdropFilter: 'blur(14px)',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                {release.target_date
                                  ? new Date(release.target_date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })
                                  : 'No target date'}
                              </Typography>
                            </Stack>
                            {daysUntilRelease !== null && (
                              <Chip
                                label={
                                  daysUntilRelease > 0
                                    ? `${daysUntilRelease} days left`
                                    : daysUntilRelease === 0
                                      ? 'Today'
                                      : `${Math.abs(daysUntilRelease)} days overdue`
                                }
                                size="small"
                                color={daysUntilRelease < 0 ? 'error' : daysUntilRelease < 7 ? 'warning' : 'default'}
                                sx={{ height: 24, fontSize: '0.72rem', fontWeight: 700 }}
                              />
                            )}
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              Owner:{' '}
                              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                {release.owner?.username || 'Unassigned'}
                              </Box>
                            </Typography>
                          </Stack>
                        </Box>

                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 3,
                            border: '1px solid rgba(255,255,255,0.42)',
                            bgcolor: 'rgba(255,255,255,0.32)',
                            backdropFilter: 'blur(14px)',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
                              Workflow Progress
                            </Typography>
                            <Typography variant="body2" fontWeight={800} color="text.primary">
                              {progressValue}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={progressValue}
                            sx={{
                              height: 8,
                              borderRadius: 999,
                              bgcolor: 'rgba(148, 163, 184, 0.18)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: statusConfig.color,
                                borderRadius: 999,
                              },
                            }}
                          />
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DashboardIcon />}
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/release-overview/${release.id}`);
                          }}
                          sx={{
                            bgcolor: SUITECRAFT_TOKENS.colors.primary,
                            textTransform: 'none',
                            fontWeight: 700,
                            py: 1.15,
                            borderRadius: 2.5,
                          }}
                        >
                          Overview
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<TrendingIcon />}
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/unified-workflow/${release.id}`);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            py: 1.15,
                            borderRadius: 2.5,
                            borderColor: 'rgba(148, 163, 184, 0.28)',
                            bgcolor: 'rgba(255,255,255,0.26)',
                            '&:hover': {
                              borderColor: SUITECRAFT_TOKENS.colors.primary,
                              bgcolor: 'rgba(71, 85, 105, 0.04)',
                            },
                          }}
                        >
                          Workflow
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem
            onClick={() => {
              if (selectedRelease) {
                openEditReleaseDialog(selectedRelease);
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Details</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedRelease) navigate(`/release-overview/${selectedRelease.id}`);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <ViewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Overview</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleMenuClose();
              setShowDeleteDialog(true);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete Release</ListItemText>
          </MenuItem>
        </Menu>

        <Dialog
          open={showReleaseDialog}
          onClose={resetReleaseDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.82)',
              background: 'linear-gradient(180deg, rgba(245,248,249,0.96) 0%, rgba(239,244,245,0.94) 100%)',
              backdropFilter: 'blur(12px) saturate(120%)',
              boxShadow: '0 28px 72px rgba(13, 28, 33, 0.16), inset 0 1px 0 rgba(255,255,255,0.92)',
              overflow: 'hidden',
            },
          }}
        >
          <form onSubmit={handleReleaseSubmit}>
            <DialogTitle
              sx={{
                px: 4,
                pt: 3.5,
                pb: 2,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 100%)',
                borderBottom: '1px solid rgba(226,232,240,0.72)',
              }}
            >
              <Stack spacing={0.75}>
                <Typography variant="overline" sx={{ color: '#64748B', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {releaseDialogMode === 'create' ? 'New Release' : 'Edit Release'}
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#152F38' }}>
                  {releaseDialogMode === 'create' ? 'Create a release workspace' : 'Update release details'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#607480', maxWidth: 440 }}>
                  {releaseDialogMode === 'create'
                    ? 'Set the release context, target date, and starting status before planning begins.'
                    : 'Adjust the release metadata and status without leaving the workspace.'}
                </Typography>
              </Stack>
            </DialogTitle>
            <DialogContent
              sx={{
                px: 4,
                pt: 3,
                pb: 2.5,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(242,247,247,0.02) 100%)',
              }}
            >
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Autocomplete
                  freeSolo
                  disabled={releaseDialogMode === 'edit'}
                  options={availableVersions}
                  value={releaseForm.release_version}
                  onChange={(_, newValue) => {
                    setReleaseForm({ ...releaseForm, release_version: newValue || '' });
                  }}
                  onInputChange={(_, newInputValue) => {
                    setReleaseForm({ ...releaseForm, release_version: newInputValue });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Release Version"
                      placeholder="e.g., 2605-Release"
                      required
                      fullWidth
                      sx={RELEASE_MODAL_FIELD_SX}
                      helperText={
                        releaseDialogMode === 'edit'
                          ? 'Release version is locked after creation to preserve ticket mapping.'
                          : 'Use a release identifier for connected lookup.'
                      }
                    />
                  )}
                />
                <TextField
                  label="Release Name"
                  placeholder="e.g., May Release"
                  value={releaseForm.release_name}
                  onChange={(e) => setReleaseForm({ ...releaseForm, release_name: e.target.value })}
                  required
                  fullWidth
                  sx={RELEASE_MODAL_FIELD_SX}
                />
                <TextField
                  label="Description"
                  placeholder="Summarize the purpose or scope of this release"
                  value={releaseForm.description}
                  onChange={(e) => setReleaseForm({ ...releaseForm, description: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                  sx={RELEASE_MODAL_FIELD_SX}
                />
                <DatePicker
                  label="Target Release Date"
                  value={targetDate}
                  onChange={(date) => {
                    setTargetDate(date);
                    setReleaseForm({
                      ...releaseForm,
                      target_date: date ? date.startOf('day').toISOString() : '',
                    });
                  }}
                  sx={RELEASE_MODAL_FIELD_SX}
                />
                <TextField
                  select
                  label={releaseDialogMode === 'create' ? 'Initial Status' : 'Current Status'}
                  value={releaseForm.status}
                  onChange={(e) => setReleaseForm({ ...releaseForm, status: e.target.value })}
                  fullWidth
                  sx={RELEASE_MODAL_FIELD_SX}
                >
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <MenuItem key={value} value={value}>
                      {config.label}
                    </MenuItem>
                  ))}
                </TextField>
                {(createMutation.isError || updateMutation.isError) && (
                  <Alert severity="error">
                    {releaseDialogMode === 'create' ? 'Failed to create release.' : 'Failed to update release.'}{' '}
                    {formatApiError(releaseDialogMode === 'create' ? createMutation.error : updateMutation.error)}
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions
              sx={{
                px: 4,
                pb: 3.5,
                pt: 2.25,
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(226,232,240,0.72)',
                background: 'rgba(244,247,248,0.92)',
              }}
            >
              <Button
                onClick={resetReleaseDialog}
                sx={{
                  textTransform: 'none',
                  color: '#48606C',
                  fontWeight: 700,
                  px: 2.25,
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending || updateMutation.isPending}
                sx={{
                  bgcolor: SUITECRAFT_TOKENS.colors.primary,
                  textTransform: 'none',
                  px: 4,
                  fontWeight: 700,
                  borderRadius: 999,
                  minWidth: 180,
                  boxShadow: '0 12px 28px rgba(21, 47, 56, 0.18)',
                }}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? releaseDialogMode === 'create'
                    ? 'Creating...'
                    : 'Saving...'
                  : releaseDialogMode === 'create'
                    ? 'Create Release'
                    : 'Save Changes'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            elevation: 0,
            sx: {
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.42)',
              background: 'rgba(255,255,255,0.70)',
              backdropFilter: 'blur(18px)',
            },
          }}
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight={700}>
              Delete Release?
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone. All associated data will be permanently deleted.
            </Alert>
            <Typography variant="body2">
              Are you sure you want to delete <strong>{selectedRelease?.release_name}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setShowDeleteDialog(false)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteRelease}
              disabled={deleteMutation.isPending}
              sx={{ textTransform: 'none', px: 4 }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
