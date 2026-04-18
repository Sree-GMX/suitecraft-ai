import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  Stack,
  Divider,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cloud as ServerIcon,
  Schedule as ClockIcon,
  GpsFixed as TargetIcon,
  Error as AlertTriangleIcon,
  ArrowBack as BackIcon,
  TrendingUp as WorkflowIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  Layers as LayersIcon,
} from '@mui/icons-material';
import { dashboardService } from '../services/api';
import { SUITECRAFT_STYLES, SUITECRAFT_TOKENS } from '../styles/theme';

const glassPanelSx = {
  ...SUITECRAFT_STYLES.glassCard,
  borderRadius: 4,
  background: 'rgba(255,255,255,0.52)',
  boxShadow: '0 16px 36px rgba(13, 28, 33, 0.06)',
};

const metricCardSx = {
  ...glassPanelSx,
  height: '100%',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 18px 40px rgba(13, 28, 33, 0.08)',
  },
};

const softInsetSx = {
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.34)',
  background: 'rgba(255,255,255,0.56)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38)',
};

export default function Dashboard() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboard', releaseId],
    queryFn: () => dashboardService.getMetrics(Number(releaseId)),
    enabled: !!releaseId,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
        <CircularProgress size={56} />
        <Typography variant="body1" mt={2} color="text.secondary">
          Loading release readiness dashboard...
        </Typography>
      </Box>
    );
  }

  if (error || !metrics) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
        <AlertTriangleIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Failed to load dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We could not pull the release metrics for this page.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/releases')} sx={{ mt: 3 }}>
          Back to Releases
        </Button>
      </Box>
    );
  }

  const dashboardData = metrics.data;

  const getConfidenceColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getRiskLevelColor = (level: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (level.toLowerCase()) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
      case 'critical':
        return 'error';
      default:
        return 'info';
    }
  };

  const confidenceColor = getConfidenceColor(dashboardData.release_confidence_score);
  const riskSeverity = getRiskLevelColor(dashboardData.ai_insights.risk_level);
  const targetDateLabel = dashboardData.release_details.target_date
    ? new Date(dashboardData.release_details.target_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No target date';
  const daysRemainingLabel =
    dashboardData.release_details.days_remaining === 0
      ? 'Due now'
      : `${dashboardData.release_details.days_remaining} days remaining`;

  const metricCards = [
    {
      title: 'Release Confidence',
      value: `${dashboardData.release_confidence_score}%`,
      subtitle: `Risk ${dashboardData.ai_insights.risk_level}`,
      icon: <TargetIcon sx={{ fontSize: 38, color: `${confidenceColor}.main` }} />,
      accent: `${confidenceColor}.main`,
    },
    {
      title: 'Regression Coverage',
      value: `${dashboardData.regression_coverage_percentage}%`,
      subtitle: `${dashboardData.test_suite_summary.total_test_cases} test cases mapped`,
      icon: <CheckCircleIcon sx={{ fontSize: 38, color: 'success.main' }} />,
      accent: 'success.main',
    },
    {
      title: 'Critical Bugs',
      value: dashboardData.critical_bug_count,
      subtitle: 'Open or in-progress blockers',
      icon: <WarningIcon sx={{ fontSize: 38, color: 'error.main' }} />,
      accent: 'error.main',
    },
    {
      title: 'Test Suites',
      value: dashboardData.test_suite_summary.total_suites,
      subtitle: `${dashboardData.test_suite_summary.high_priority_tests} high-priority tests`,
      icon: <LayersIcon sx={{ fontSize: 38, color: 'info.main' }} />,
      accent: 'info.main',
    },
  ];

  return (
    <Box sx={{ minHeight: '100%', py: 2, background: 'transparent' }}>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/releases')}
        sx={{
          mb: 2.5,
          textTransform: 'none',
          fontWeight: 700,
          color: 'text.secondary',
        }}
      >
        Back to Releases
      </Button>

      <Card elevation={0} sx={{ ...glassPanelSx, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid xs={12} md={8}>
              <Stack spacing={1.5}>
                <Typography variant="overline" sx={{ color: '#64748B', letterSpacing: '0.1em', fontWeight: 700 }}>
                  Release Overview
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  Release Readiness Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {dashboardData.release_details.name}
                </Typography>

                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={dashboardData.release_details.version}
                    sx={{ bgcolor: 'rgba(248,250,252,0.82)', color: '#334155', fontWeight: 700 }}
                  />
                  <Chip
                    label={dashboardData.release_details.status}
                    sx={{
                      textTransform: 'capitalize',
                      fontWeight: 700,
                      bgcolor: 'rgba(255,255,255,0.54)',
                      border: '1px solid rgba(255,255,255,0.44)',
                    }}
                  />
                  <Chip
                    icon={<CalendarIcon sx={{ fontSize: 16 }} />}
                    label={targetDateLabel}
                    sx={{ bgcolor: 'rgba(255,255,255,0.46)' }}
                  />
                  <Chip
                    icon={<ClockIcon sx={{ fontSize: 16 }} />}
                    label={daysRemainingLabel}
                    color={dashboardData.release_details.days_remaining <= 3 ? 'warning' : 'default'}
                    variant={dashboardData.release_details.days_remaining <= 3 ? 'filled' : 'outlined'}
                  />
                  <Chip
                    label={`Recommended org: ${dashboardData.recommended_org || 'None'}`}
                    sx={{ bgcolor: 'rgba(239,246,255,0.65)', color: '#1D4ED8' }}
                  />
                </Stack>
              </Stack>
            </Grid>

            <Grid xs={12} md={4}>
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<WorkflowIcon />}
                  onClick={() => navigate(`/unified-workflow/${releaseId}`)}
                  sx={{
                    py: 1.4,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: SUITECRAFT_TOKENS.colors.primary,
                    boxShadow: '0 14px 28px rgba(71, 85, 105, 0.16)',
                    '&:hover': {
                      bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
                    },
                  }}
                >
                  Open Workflow
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/release-overview/${releaseId}`)}
                  sx={{
                    py: 1.4,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: 'rgba(148,163,184,0.4)',
                    bgcolor: 'rgba(255,255,255,0.32)',
                  }}
                >
                  Release Overview
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3} mb={3}>
        {metricCards.map((metric) => (
          <Grid key={metric.title} xs={12} sm={6} md={3}>
            <Card elevation={0} sx={metricCardSx}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                  <Box
                    sx={{
                      ...softInsetSx,
                      width: 58,
                      height: 58,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {metric.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {metric.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={metric.accent}>
                      {metric.value}
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {metric.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3} mb={3}>
        <Grid xs={12} md={7}>
          <Card elevation={0} sx={{ ...glassPanelSx, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={700}>
                  Risk Heatmap
                </Typography>
                <Chip
                  size="small"
                  label={`${dashboardData.feature_breakdown.high_risk} high-risk features`}
                  color={dashboardData.feature_breakdown.high_risk > 0 ? 'error' : 'success'}
                  variant="outlined"
                />
              </Stack>

              {Object.keys(dashboardData.risk_heatmap).length > 0 ? (
                <Stack spacing={2}>
                  {Object.entries(dashboardData.risk_heatmap).map(([module, risk]) => {
                    const value = Number(risk) * 100;
                    return (
                      <Box key={module} sx={{ ...softInsetSx, p: 1.75 }}>
                        <Stack direction="row" justifyContent="space-between" mb={1}>
                          <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                            {module}
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {value.toFixed(0)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={value}
                          color={value > 70 ? 'error' : value > 40 ? 'warning' : 'success'}
                          sx={{
                            height: 10,
                            borderRadius: 999,
                            bgcolor: 'rgba(148,163,184,0.18)',
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Alert severity="info" sx={{ ...softInsetSx }}>
                  No module risk data is available for this release yet.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={5}>
          <Card elevation={0} sx={{ ...glassPanelSx, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Feature Breakdown
              </Typography>
              <Grid container spacing={2} mt={0.5}>
                <Grid xs={6}>
                  <Box sx={{ ...softInsetSx, p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700}>
                      {dashboardData.feature_breakdown.total}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Features
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box sx={{ ...softInsetSx, p: 2, textAlign: 'center', bgcolor: 'rgba(254,242,242,0.62)' }}>
                    <Typography variant="h4" fontWeight={700} color="error.main">
                      {dashboardData.feature_breakdown.high_risk}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      High Risk
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box sx={{ ...softInsetSx, p: 2, textAlign: 'center', bgcolor: 'rgba(255,247,237,0.62)' }}>
                    <Typography variant="h4" fontWeight={700} color="warning.main">
                      {dashboardData.feature_breakdown.medium_risk}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Medium Risk
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box sx={{ ...softInsetSx, p: 2, textAlign: 'center', bgcolor: 'rgba(236,253,245,0.62)' }}>
                    <Typography variant="h4" fontWeight={700} color="success.main">
                      {dashboardData.feature_breakdown.low_risk}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Low Risk
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2.5, borderColor: 'rgba(148,163,184,0.16)' }} />

              <Typography variant="h6" fontWeight={700} gutterBottom>
                Org Health Status
              </Typography>
              {Object.keys(dashboardData.org_health_status).length > 0 ? (
                <List sx={{ py: 0 }}>
                  {Object.entries(dashboardData.org_health_status).map(([org, status]) => (
                    <ListItem key={org} sx={{ px: 0, py: 1 }}>
                      <ListItemText
                        primary={org}
                        secondary={
                          <Chip
                            label={status as string}
                            size="small"
                            sx={{
                              mt: 0.75,
                              textTransform: 'capitalize',
                              bgcolor:
                                (status as string).toLowerCase() === 'healthy'
                                  ? 'rgba(236,253,245,0.9)'
                                  : (status as string).toLowerCase() === 'warning'
                                  ? 'rgba(255,247,237,0.9)'
                                  : 'rgba(254,242,242,0.9)',
                              color:
                                (status as string).toLowerCase() === 'healthy'
                                  ? '#047857'
                                  : (status as string).toLowerCase() === 'warning'
                                  ? '#B45309'
                                  : '#B91C1C',
                            }}
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info" sx={{ ...softInsetSx }}>
                  No active QA organization health data is available yet.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid xs={12} lg={7}>
          <Card elevation={0} sx={{ ...glassPanelSx, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                AI Insights
              </Typography>
              <Alert severity={riskSeverity} sx={{ mb: 2, ...softInsetSx }}>
                {dashboardData.ai_insights.summary || 'No AI summary is available for this release yet.'}
              </Alert>

              <Grid container spacing={2}>
                <Grid xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Key Concerns
                  </Typography>
                  {dashboardData.ai_insights.key_concerns.length > 0 ? (
                    <List dense sx={{ py: 0 }}>
                      {dashboardData.ai_insights.key_concerns.map((concern: string, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0, alignItems: 'flex-start' }}>
                          <ListItemText primary={concern} />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No key concerns were flagged.
                    </Typography>
                  )}
                </Grid>

                <Grid xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Recommendations
                  </Typography>
                  {dashboardData.ai_insights.recommendations.length > 0 ? (
                    <List dense sx={{ py: 0 }}>
                      {dashboardData.ai_insights.recommendations.map((rec: string, idx: number) => (
                        <ListItem key={idx} sx={{ px: 0, alignItems: 'flex-start' }}>
                          <ListItemText primary={rec} />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No specific recommendations are available yet.
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} lg={5}>
          <Card elevation={0} sx={{ ...glassPanelSx, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Recommended Organization
              </Typography>
              <Box
                sx={{
                  ...softInsetSx,
                  py: 4,
                  px: 3,
                  textAlign: 'center',
                }}
              >
                <ServerIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {dashboardData.recommended_org || 'No recommendation available'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Best match for this release based on current AI analysis and org stability.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
