import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Divider,
  Avatar,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  RocketLaunch as RocketIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Edit as EditIcon,
  AssignmentTurnedIn as TestIcon,
  ListAlt as ListIcon,
  Groups as GroupsIcon,
  PlayCircle as ExecuteIcon,
  Refresh as RefreshIcon,
  ErrorOutline as ErrorIcon,
  AutoAwesome as SparklesIcon,
} from '@mui/icons-material';
import { releaseService, dashboardService, testExecutionService } from '../services/api';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';
import { getReleaseWorkflowSummary } from '../utils/releaseWorkflow';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: SUITECRAFT_TOKENS.colors.text.secondary, bgcolor: 'rgba(84, 98, 122, 0.10)', progress: 0 },
  in_progress: { label: 'In Progress', color: SUITECRAFT_TOKENS.colors.primaryLight, bgcolor: SUITECRAFT_TOKENS.colors.accent.cyanTint, progress: 40 },
  testing: { label: 'Testing', color: SUITECRAFT_TOKENS.colors.warning, bgcolor: 'rgba(245, 158, 11, 0.10)', progress: 70 },
  ready: { label: 'Ready', color: SUITECRAFT_TOKENS.colors.success, bgcolor: 'rgba(16, 185, 129, 0.10)', progress: 90 },
  deployed: { label: 'Deployed', color: SUITECRAFT_TOKENS.colors.accent.violet, bgcolor: SUITECRAFT_TOKENS.colors.accent.violetTint, progress: 100 },
  cancelled: { label: 'Cancelled', color: SUITECRAFT_TOKENS.colors.error, bgcolor: 'rgba(232, 78, 118, 0.10)', progress: 0 },
};

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: 'Scope Release',
    description: 'Release tickets and impacted areas confirmed',
    icon: <ListIcon />,
    color: SUITECRAFT_TOKENS.colors.primaryLight,
  },
  {
    id: 2,
    title: 'Generate Strategy',
    description: 'Regression plan and coverage strategy created',
    icon: <TestIcon />,
    color: SUITECRAFT_TOKENS.colors.success,
  },
  {
    id: 3,
    title: 'Approve Execution Set',
    description: 'Execution-ready set approved for the release',
    icon: <GroupsIcon />,
    color: SUITECRAFT_TOKENS.colors.warning,
  },
  {
    id: 4,
    title: 'Run Tests',
    description: 'Execution progress and outcomes tracked live',
    icon: <ExecuteIcon />,
    color: SUITECRAFT_TOKENS.colors.accent.violet,
  },
];

type PersistedWorkflowState = {
  currentStep?: 1 | 2 | 3 | 4;
  step1Complete?: boolean;
  step2Complete?: boolean;
  step3Complete?: boolean;
  step4Complete?: boolean;
  selectedTickets?: any[];
  selectedTestCases?: any[];
  generatedTestPlan?: any;
};

function readPersistedWorkflowState(releaseId: string | undefined): PersistedWorkflowState | null {
  if (!releaseId || typeof window === 'undefined') {
    return null;
  }

  try {
    const savedState = localStorage.getItem(`workflow_${releaseId}`);
    if (!savedState) {
      return null;
    }

    return JSON.parse(savedState) as PersistedWorkflowState;
  } catch {
    return null;
  }
}

function SectionState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={{
        py: 5,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Avatar
        sx={{
          width: 54,
          height: 54,
          bgcolor: 'rgba(255,255,255,0.52)',
          color: SUITECRAFT_TOKENS.colors.text.secondary,
          border: '1px solid rgba(255,255,255,0.54)',
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

function MetricTileSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(248,252,252,0.36) 100%)',
        border: '1px solid rgba(255,255,255,0.44)',
      }}
    >
      <Skeleton variant="text" width="55%" height={42} />
      <Skeleton variant="text" width="70%" />
    </Paper>
  );
}

function formatMetricValue(value: number | null | undefined, loading: boolean) {
  if (loading) {
    return '...';
  }

  return value ?? '\u2014';
}

function OverviewPageSkeleton() {
  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent', py: 4 }}>
      <Container maxWidth="xl">
        <Skeleton variant="rounded" width={160} height={38} sx={{ mb: 3, borderRadius: 999 }} />
        <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={8}>
                <Skeleton variant="text" width={120} />
                <Skeleton variant="text" width="55%" height={56} />
                <Skeleton variant="text" width="88%" />
                <Skeleton variant="text" width="72%" sx={{ mb: 2 }} />
                <Stack direction="row" spacing={1.5}>
                  <Skeleton variant="rounded" width={112} height={32} sx={{ borderRadius: 999 }} />
                  <Skeleton variant="rounded" width={140} height={32} sx={{ borderRadius: 999 }} />
                  <Skeleton variant="rounded" width={120} height={32} sx={{ borderRadius: 999 }} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  <Skeleton variant="rounded" height={52} sx={{ borderRadius: 2 }} />
                  <Skeleton variant="rounded" height={52} sx={{ borderRadius: 2 }} />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Skeleton variant="text" width={240} height={34} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={16} sx={{ borderRadius: 999 }} />
              </CardContent>
            </Card>
            <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Skeleton variant="text" width={160} height={34} sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: 2,
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(248,252,252,0.36) 100%)',
                          border: '1px solid rgba(255,255,255,0.44)',
                        }}
                      >
                        <Stack direction="row" spacing={2}>
                          <Skeleton variant="circular" width={48} height={48} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="95%" />
                            <Skeleton variant="text" width="70%" />
                            <Skeleton variant="rounded" height={6} sx={{ borderRadius: 999, mt: 1 }} />
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Skeleton variant="text" width={130} height={34} sx={{ mb: 3 }} />
                <Stack spacing={2}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} variant="rounded" height={44} sx={{ borderRadius: 2 }} />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default function ReleaseOverviewDashboard() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const numericReleaseId = Number(releaseId);
  const hasValidReleaseId = Number.isFinite(numericReleaseId) && numericReleaseId > 0;
  const persistedWorkflowState = readPersistedWorkflowState(releaseId);

  // Fetch release
  const {
    data: release,
    isLoading: loadingRelease,
    isError: releaseError,
    refetch: refetchRelease,
  } = useQuery({
    queryKey: ['release', releaseId],
    queryFn: async () => {
      const response = await releaseService.getById(numericReleaseId);
      return response.data;
    },
    enabled: hasValidReleaseId,
  });

  // Fetch dashboard metrics
  const {
    data: metrics,
    isLoading: loadingMetrics,
    isError: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['release-metrics', releaseId],
    queryFn: async () => {
      const response = await dashboardService.getReleaseMetrics(numericReleaseId);
      return response.data;
    },
    enabled: hasValidReleaseId,
  });

  const {
    data: testRuns = [],
    isLoading: loadingRuns,
    isError: runsError,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: ['release-test-runs', releaseId],
    queryFn: async () => {
      const response = await testExecutionService.getTestRuns(numericReleaseId);
      return response.data;
    },
    enabled: hasValidReleaseId,
  });

  if (!hasValidReleaseId) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'transparent', py: 4 }}>
        <Container maxWidth="md">
          <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
            <CardContent sx={{ p: 4 }}>
              <SectionState
                icon={<ErrorIcon />}
                title="Release overview unavailable"
                description="This overview link is missing a valid release id. Return to Releases and open the release again."
                action={
                  <Button
                    variant="contained"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/releases')}
                    sx={SUITECRAFT_STYLES.primaryButton}
                  >
                    Back to Releases
                  </Button>
                }
              />
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  if (loadingRelease) {
    return <OverviewPageSkeleton />;
  }

  if (releaseError || !release) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'transparent', py: 4 }}>
        <Container maxWidth="md">
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/releases')}
            sx={{
              mb: 3,
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            Back to Releases
          </Button>
          <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
            <CardContent sx={{ p: 4 }}>
              <SectionState
                icon={<ErrorIcon />}
                title="We couldn't load this release"
                description="The overview data did not arrive successfully. Try again, or go back to the Releases list and reopen the release."
                action={
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={() => refetchRelease()}
                      sx={SUITECRAFT_STYLES.primaryButton}
                    >
                      Retry
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<BackIcon />}
                      onClick={() => navigate('/releases')}
                      sx={SUITECRAFT_STYLES.secondaryButton}
                    >
                      Back to Releases
                    </Button>
                  </Stack>
                }
              />
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  const daysUntilRelease = release.target_date
    ? Math.ceil((new Date(release.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const workflowSummary = getReleaseWorkflowSummary({
    releaseStatus: release.status,
    metrics,
    testRuns,
  });
  const statusConfig =
    STATUS_CONFIG[workflowSummary.effectiveStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.planning;
  const latestRun = [...testRuns].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
  const scopedItems = persistedWorkflowState?.selectedTickets?.length ?? metrics?.feature_breakdown?.total ?? 0;
  const selectedTests = persistedWorkflowState?.selectedTestCases?.length ?? metrics?.test_suite_summary?.total_test_cases ?? 0;
  const strategySummary = persistedWorkflowState?.generatedTestPlan?.summary;
  const strategyTests = strategySummary?.total_tests ?? metrics?.test_suite_summary?.total_test_cases ?? 0;
  const newScenarios = strategySummary?.new_scenarios ?? 0;
  const currentWorkflowStep =
    persistedWorkflowState?.currentStep && persistedWorkflowState.currentStep >= 1 && persistedWorkflowState.currentStep <= 4
      ? persistedWorkflowState.currentStep
      : persistedWorkflowState?.step3Complete
        ? 4
        : persistedWorkflowState?.step2Complete
          ? 3
          : persistedWorkflowState?.step1Complete
            ? 2
            : 1;
  const maxEnabledStep =
    persistedWorkflowState?.step3Complete
      ? 4
      : persistedWorkflowState?.step2Complete
        ? 3
        : persistedWorkflowState?.step1Complete
          ? 2
          : 1;
  const generatedTests = metrics?.test_suite_summary?.total_test_cases || 0;
  const coverageProgress = metrics?.regression_coverage_percentage || 0;
  const executedCount = latestRun?.executed_count || 0;
  const failedCount = latestRun?.failed_count || 0;
  const skippedCount = latestRun?.skipped_count || 0;
  const pendingExecutions = Math.max((latestRun?.total_test_cases || generatedTests) - executedCount, 0);
  const executionTotal = latestRun?.total_test_cases || strategyTests || generatedTests;
  const runTestsProgress = executionTotal > 0 ? Math.round((executedCount / executionTotal) * 100) : 0;
  const overallProgress = Math.round(
    (
      (persistedWorkflowState?.step1Complete ? 100 : 0) +
      (persistedWorkflowState?.step2Complete ? 100 : 0) +
      (persistedWorkflowState?.step3Complete ? 100 : 0) +
      (persistedWorkflowState?.step4Complete ? 100 : runTestsProgress)
    ) / 4
  ) || workflowSummary.overallProgress;
  const workflowProgress = [
    {
      completed: scopedItems,
      total: Math.max(scopedItems, 1),
      progress: persistedWorkflowState?.step1Complete ? 100 : 0,
      helper: scopedItems > 0 ? `${scopedItems} scoped ticket${scopedItems === 1 ? '' : 's'} confirmed` : 'Scope not created yet',
      enabled: true,
    },
    {
      completed: persistedWorkflowState?.step2Complete ? strategyTests : 0,
      total: Math.max(strategyTests, 1),
      progress: persistedWorkflowState?.step2Complete ? 100 : 0,
      helper: persistedWorkflowState?.step2Complete
        ? `${strategyTests} strategy tests ready${newScenarios > 0 ? ` • ${newScenarios} new scenarios` : ''}`
        : 'Strategy has not been generated yet',
      enabled: maxEnabledStep >= 2,
    },
    {
      completed: persistedWorkflowState?.step3Complete ? strategyTests : 0,
      total: Math.max(strategyTests, 1),
      progress: persistedWorkflowState?.step3Complete ? 100 : persistedWorkflowState?.step2Complete ? 45 : 0,
      helper: persistedWorkflowState?.step3Complete
        ? `Execution set approved for ${strategyTests} tests`
        : persistedWorkflowState?.step2Complete
          ? 'Strategy ready for approval'
          : 'Approval unlocks after strategy generation',
      enabled: maxEnabledStep >= 3,
    },
    {
      completed: executedCount,
      total: Math.max(executionTotal, 1),
      progress: runTestsProgress,
      helper: latestRun
        ? `${latestRun.name} • ${failedCount} failed • ${pendingExecutions} pending`
        : 'Execution has not started yet',
      enabled: maxEnabledStep >= 4,
    },
  ];
  const showMetricsLoadingState = loadingMetrics || loadingRuns;
  const hasMetricsData = Boolean(metrics);
  const hasRunData = testRuns.length > 0;
  const showExecutionEmptyState = !showMetricsLoadingState && !hasMetricsData && !hasRunData;
  const navigateToWorkflowStep = (step: 1 | 2 | 3 | 4) => {
    navigate(`/unified-workflow/${releaseId}?step=${step}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent', py: 4 }}>
      <Container maxWidth="xl">
        {/* Back Button */}
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/releases')}
          sx={{
            mb: 3,
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          Back to Releases
        </Button>

        {/* Header */}
        <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
          <CardContent sx={{ p: 4 }}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                  {release.release_version}
                </Typography>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  {release.release_name}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {release.description || 'No release summary yet. Add a short description so the team can understand the goal and scope at a glance.'}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    label={statusConfig.label}
                    sx={{
                      bgcolor: statusConfig.bgcolor,
                      color: statusConfig.color,
                      fontWeight: 700,
                    }}
                  />
                  {release.target_date && (
                    <Chip
                      icon={<CalendarIcon sx={{ fontSize: 16 }} />}
                      label={new Date(release.target_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      variant="outlined"
                    />
                  )}
                  {daysUntilRelease !== null && (
                    <Chip
                      icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                      label={
                        daysUntilRelease > 0
                          ? `${daysUntilRelease} days left`
                          : daysUntilRelease === 0
                          ? 'Today'
                          : `${Math.abs(daysUntilRelease)} days overdue`
                      }
                      color={daysUntilRelease < 0 ? 'error' : daysUntilRelease < 7 ? 'warning' : 'default'}
                    />
                  )}
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={<TrendingIcon />}
                    onClick={() => navigateToWorkflowStep(currentWorkflowStep)}
                    sx={{
                      bgcolor: SUITECRAFT_TOKENS.colors.primary,
                      py: 1.5,
                      textTransform: 'none',
                      fontWeight: 700,
                    }}
                  >
                    Resume Workflow
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Left Column - Workflow Progress */}
          <Grid item xs={12} lg={8}>
            {/* Overall Progress */}
            <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>
                    Overall Workflow Progress
                  </Typography>
                  <Chip
                    label={`${overallProgress}%`}
                    sx={{
                      bgcolor: statusConfig.bgcolor,
                      color: statusConfig.color,
                      fontWeight: 700,
                      fontSize: '1rem',
                      height: 32,
                    }}
                  />
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={overallProgress}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: 'rgba(0, 0, 0, 0.05)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: statusConfig.color,
                      borderRadius: 6,
                    },
                  }}
                />
              </CardContent>
            </Card>

            {/* Workflow Steps */}
            <Card elevation={0} sx={{ mb: 3, ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={3}>
                  Workflow Steps
                </Typography>
                <Grid container spacing={2}>
                  {WORKFLOW_STEPS.map((step, index) => {
                    const progressData = workflowProgress[index];
                    const isDisabled = !progressData.enabled;
                    return (
                      <Grid item xs={12} sm={6} key={step.id}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2.5,
                            border: `1px solid ${isDisabled ? 'rgba(148, 163, 184, 0.22)' : 'rgba(0, 0, 0, 0.06)'}`,
                            borderRadius: 2,
                            height: '100%',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.58 : 1,
                            ...(isDisabled
                              ? {}
                              : {
                                  '&:hover': {
                                    borderColor: step.color,
                                    boxShadow: `0 4px 12px ${step.color}20`,
                                    transform: 'translateY(-2px)',
                                  },
                                }),
                          }}
                          onClick={() => {
                            if (!isDisabled) {
                              navigateToWorkflowStep(step.id as 1 | 2 | 3 | 4);
                            }
                          }}
                        >
                          <Stack direction="row" spacing={2} alignItems="flex-start">
                            <Avatar
                              sx={{
                                bgcolor: `${step.color}20`,
                                color: step.color,
                                width: 48,
                                height: 48,
                              }}
                            >
                              {step.icon}
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                {step.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                                {step.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                                {progressData.helper}
                              </Typography>
                              {isDisabled && (
                                <Chip
                                  label="Locked"
                                  size="small"
                                  sx={{
                                    mb: 1.5,
                                    bgcolor: 'rgba(148, 163, 184, 0.16)',
                                    color: '#64748B',
                                    fontWeight: 700,
                                  }}
                                />
                              )}
                              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                <Typography variant="caption" fontWeight={600}>
                                  {progressData.completed} / {progressData.total}
                                </Typography>
                                <Typography variant="caption" fontWeight={700} color={step.color}>
                                  {progressData.progress}%
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={progressData.progress}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: step.color,
                                    borderRadius: 3,
                                  },
                                }}
                              />
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </CardContent>
            </Card>

            {/* Test Metrics */}
            <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={3}>
                  Test Execution Metrics
                </Typography>
                {showMetricsLoadingState ? (
                  <Grid container spacing={2}>
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Grid item xs={6} sm={3} key={index}>
                        <MetricTileSkeleton />
                      </Grid>
                    ))}
                  </Grid>
                ) : metricsError || runsError ? (
                  <SectionState
                    icon={<ErrorIcon />}
                    title="Metrics are temporarily unavailable"
                    description="The release loaded, but the execution metrics did not. You can retry without leaving the page."
                    action={
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                          void refetchMetrics();
                          void refetchRuns();
                        }}
                        sx={SUITECRAFT_STYLES.secondaryButton}
                      >
                        Retry metrics
                      </Button>
                    }
                  />
                ) : hasMetricsData || hasRunData ? (
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        <Typography variant="h4" fontWeight={800} color="#3B82F6">
                          {generatedTests}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Total Tests
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                        }}
                      >
                        <Typography variant="h4" fontWeight={800} color="#10B981">
                          {latestRun?.passed_count || 0}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Passed
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: '#FEF2F2',
                          border: '1px solid #FECACA',
                        }}
                      >
                        <Typography variant="h4" fontWeight={800} color="#EF4444">
                          {failedCount}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Failed
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          textAlign: 'center',
                          bgcolor: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        <Typography variant="h4" fontWeight={800} color="#475569">
                          {skippedCount}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Skipped
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : (
                  <SectionState
                    icon={<SparklesIcon />}
                    title="No execution insights yet"
                    description="Scope the release and generate a strategy to populate coverage and execution metrics here."
                    action={
                      <Button
                        variant="outlined"
                        startIcon={<TrendingIcon />}
                        onClick={() => navigateToWorkflowStep(currentWorkflowStep)}
                        sx={SUITECRAFT_STYLES.secondaryButton}
                      >
                        Resume Workflow
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Stats & Info */}
          <Grid item xs={12} lg={4}>
            <Stack spacing={3}>
              {/* Key Metrics */}
              <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={700} mb={3}>
                    Workflow Snapshot
                  </Typography>
                  <Stack spacing={2.5}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AssignmentIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Typography variant="body2" fontWeight={600}>
                            Scoped Tickets
                          </Typography>
                        </Stack>
                        <Typography variant="h6" fontWeight={700} color="primary.main">
                          {scopedItems}
                        </Typography>
                      </Stack>
                      <Divider />
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TestIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Typography variant="body2" fontWeight={600}>
                            Selected Tests
                          </Typography>
                        </Stack>
                        <Typography variant="h6" fontWeight={700} color="primary.main">
                          {selectedTests}
                        </Typography>
                      </Stack>
                      <Divider />
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <SparklesIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Typography variant="body2" fontWeight={600}>
                            Strategy Tests
                          </Typography>
                        </Stack>
                        <Typography variant="h6" fontWeight={700} color="primary.main">
                          {persistedWorkflowState?.step2Complete ? strategyTests : '\u2014'}
                        </Typography>
                      </Stack>
                      <Divider />
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <SpeedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                          <Typography variant="body2" fontWeight={600}>
                            Current Step
                          </Typography>
                        </Stack>
                        <Typography variant="h6" fontWeight={700} color="primary.main">
                          {`Step ${currentWorkflowStep}`}
                        </Typography>
                      </Stack>
                      <Divider />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Release Health */}
              <Card elevation={0} sx={{ ...SUITECRAFT_STYLES.glassCard }}>
                <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={2}>
                  Release Health
                </Typography>
                <Stack spacing={2}>
                  {showMetricsLoadingState ? (
                    <>
                      <Skeleton variant="rounded" height={74} sx={{ borderRadius: 2 }} />
                      <Skeleton variant="rounded" height={74} sx={{ borderRadius: 2 }} />
                    </>
                  ) : metricsError || runsError ? (
                    <SectionState
                      icon={<ErrorIcon />}
                      title="Health status unavailable"
                      description="Release health depends on execution metrics, which could not be loaded just now."
                      action={
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={() => {
                            void refetchMetrics();
                            void refetchRuns();
                          }}
                          sx={SUITECRAFT_STYLES.secondaryButton}
                        >
                          Retry
                        </Button>
                      }
                    />
                  ) : showExecutionEmptyState ? (
                    <SectionState
                      icon={<RocketIcon />}
                      title="Health checks start after planning"
                      description="Once tests are generated or a run is created, this panel will surface schedule and execution risks."
                    />
                  ) : (
                    <>
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: failedCount > 0 ? '#FEF2F2' : '#ECFDF5',
                          border: `1px solid ${failedCount > 0 ? '#FECACA' : '#A7F3D0'}`,
                          borderRadius: 1.5,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {failedCount > 0 ? (
                            <WarningIcon sx={{ color: '#EF4444' }} />
                          ) : (
                            <CheckIcon sx={{ color: '#10B981' }} />
                          )}
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              {failedCount > 0 ? `${failedCount} Failed Tests` : executedCount > 0 ? 'Execution Stable' : 'Execution Not Started'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {failedCount > 0
                                ? 'Requires attention'
                                : executedCount > 0
                                ? 'No active failures in the current run'
                                : 'Create or start a run to begin execution'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                      {daysUntilRelease !== null && daysUntilRelease < 0 && (
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: 1.5,
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <ScheduleIcon sx={{ color: '#EF4444' }} />
                            <Box>
                              <Typography variant="body2" fontWeight={700}>
                                Release Overdue
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {Math.abs(daysUntilRelease)} days past target
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      )}
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
