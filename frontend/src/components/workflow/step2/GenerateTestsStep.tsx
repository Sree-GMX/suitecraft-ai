import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  ArrowOutward as ArrowOutwardIcon,
  FactCheck as SuiteIcon,
  Schedule as EffortIcon,
  WarningAmber as RiskIcon,
  Insights as ConfidenceIcon,
  KeyboardDoubleArrowRight as NextIcon,
} from '@mui/icons-material';
import { integrationService } from '../../../services/api';
import { SUITECRAFT_TOKENS } from '../../../styles/theme';

interface GenerateTestsStepProps {
  releaseId: string;
  selectedTickets: any[];
  selectedTestCases?: any[];
  existingTestPlan: any;
  onComplete: (testPlan: any) => void;
  isReadOnly: boolean;
  releaseInfo?: {
    release_name?: string;
    release_version?: string;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: SUITECRAFT_TOKENS.colors.risk.critical,
  high: SUITECRAFT_TOKENS.colors.risk.high,
  medium: SUITECRAFT_TOKENS.colors.risk.medium,
  low: SUITECRAFT_TOKENS.colors.risk.low,
};

const STRATEGY_PROGRESS_STEPS = [
  {
    label: 'Reading release scope',
    helper: 'Validating the Step 1 tickets and selected regression coverage.',
  },
  {
    label: 'Assessing product and dependency impact',
    helper: 'Working through business value, feature scope, and integration risk.',
  },
  {
    label: 'Building QA strategy',
    helper: 'Turning risk, coverage confidence, and execution order into a plan.',
  },
  {
    label: 'Designing new scenarios',
    helper: 'Generating the smallest useful set of new scenarios for approval.',
  },
];

export default function GenerateTestsStep({
  releaseId,
  selectedTickets,
  selectedTestCases = [],
  existingTestPlan,
  onComplete,
  isReadOnly,
  releaseInfo,
}: GenerateTestsStepProps) {
  const [testPlan, setTestPlan] = useState(existingTestPlan);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [forceRefreshRequested, setForceRefreshRequested] = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);

  useEffect(() => {
    if (existingTestPlan !== testPlan) {
      setTestPlan(existingTestPlan);
    }
  }, [existingTestPlan, testPlan]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      setGenerationError(null);
      const response = await retryAsync(
        () => integrationService.generateTestPlan(
          selectedTickets,
          selectedTestCases || [],
          {
            release_id: releaseId,
            release_name: releaseInfo?.release_name || `Release ${releaseId}`,
            release_version: releaseInfo?.release_version || `Release ${releaseId}`,
          },
          {
            forceRefresh: forceRefreshRequested,
          }
        ),
        3,
        900
      );
      return response.data.test_plan;
    },
    onSuccess: (data) => {
      setTestPlan(data);
      onComplete(data);
      setForceRefreshRequested(false);
      setGenerationError(null);
    },
    onError: (error: any) => {
      console.error('Failed to generate test plan:', error);
      setForceRefreshRequested(false);
      setGenerationError(extractApiErrorMessage(error, 'Actual AI strategy generation is unavailable right now.'));
    }
  });

  useEffect(() => {
    if (!generateMutation.isPending) {
      setProgressStepIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProgressStepIndex((current) => Math.min(current + 1, STRATEGY_PROGRESS_STEPS.length - 1));
    }, 1600);

    return () => window.clearInterval(interval);
  }, [generateMutation.isPending]);

  const strategy = useMemo(() => buildStrategyModel(testPlan, selectedTickets, selectedTestCases), [testPlan, selectedTickets, selectedTestCases]);
  const activeProgressStep = STRATEGY_PROGRESS_STEPS[progressStepIndex];

  const handleGenerate = () => {
    if (isReadOnly) return;
    setForceRefreshRequested(false);
    generateMutation.mutate();
  };

  const handleForceRefresh = () => {
    if (isReadOnly) return;
    setForceRefreshRequested(true);
    generateMutation.mutate();
  };

  if (!testPlan) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: '1px solid rgba(255,255,255,0.58)',
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
          backdropFilter: 'blur(22px)',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.74)',
          textAlign: 'center',
        }}
      >
        <Stack spacing={3} alignItems="center">
          {generationError && (
            <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                Step 2 requires actual AI strategy generation.
              </Typography>
              <Typography variant="body2">
                {generationError}
              </Typography>
            </Alert>
          )}

          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 88, 65, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AiIcon sx={{ fontSize: 40, color: SUITECRAFT_TOKENS.colors.secondary }} />
          </Box>

          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
              Turn the approved scope into a test strategy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620, lineHeight: 1.7 }}>
              Step 2 should explain the release strategy, not just generate output. We use the scoped tickets and selected
              coverage from Step 1 to identify risk, group execution priorities, suggest new scenarios, and recommend the
              leanest plan that still gives the team confidence.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
            <Chip label={`${selectedTickets.length} scoped tickets`} size="small" sx={{ fontWeight: 700 }} />
            <Chip label={`${selectedTestCases.length} selected tests`} size="small" sx={{ fontWeight: 700 }} />
            {selectedTickets.slice(0, 3).map((ticket) => (
              <Chip
                key={getTicketId(ticket)}
                label={getTicketId(ticket)}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>

          <Button
            variant="contained"
            size="large"
            startIcon={generateMutation.isPending ? <CircularProgress size={20} /> : <AiIcon />}
            onClick={handleGenerate}
            disabled={generateMutation.isPending || isReadOnly}
            sx={{
              textTransform: 'none',
              px: 6,
              py: 1.5,
              bgcolor: SUITECRAFT_TOKENS.colors.secondary,
              '&:hover': {
                bgcolor: SUITECRAFT_TOKENS.colors.secondaryDark,
              },
            }}
          >
            {generateMutation.isPending ? 'Generating strategy...' : 'Generate Strategy'}
          </Button>

          {generateMutation.isPending && (
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                p: 2,
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.42)',
                bgcolor: 'rgba(255,255,255,0.68)',
                backdropFilter: 'blur(10px)',
                textAlign: 'left',
              }}
            >
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', mb: 0.4 }}>
                    STRATEGY IN PROGRESS
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.35 }}>
                    {forceRefreshRequested ? 'Running a fresh AI pass for this scope.' : activeProgressStep.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {forceRefreshRequested
                      ? 'We are intentionally bypassing the cached plan and rebuilding the release strategy from the same Step 1 scope.'
                      : activeProgressStep.helper}
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {STRATEGY_PROGRESS_STEPS.map((step, index) => {
                    const isComplete = index < progressStepIndex;
                    const isActive = index === progressStepIndex;

                    return (
                      <Paper
                        key={step.label}
                        elevation={0}
                        sx={{
                          flex: 1,
                          p: 1.2,
                          borderRadius: 2.5,
                          border: isActive
                            ? `1px solid ${SUITECRAFT_TOKENS.colors.secondary}`
                            : '1px solid rgba(226,232,240,0.9)',
                          bgcolor: isActive
                            ? 'rgba(255,241,236,0.9)'
                            : isComplete
                              ? 'rgba(236,253,245,0.88)'
                              : 'rgba(255,255,255,0.76)',
                        }}
                      >
                        <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700 }}>
                          {isComplete ? 'DONE' : isActive ? 'NOW' : 'NEXT'}
                        </Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#0F172A', lineHeight: 1.45 }}>
                          {step.label}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            </Paper>
          )}

          {generateMutation.isError && (
            <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>
              Failed to generate the release strategy.
              {generateMutation.error instanceof Error && (
                <Box component="span" sx={{ display: 'block', mt: 0.75, fontSize: '0.9em' }}>
                  Error: {generateMutation.error.message}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid rgba(255,255,255,0.54)',
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
          backdropFilter: 'blur(22px)',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.74)',
        }}
      >
        <Stack spacing={2.25}>
          <Alert
            severity={strategy.generationStatus.mode === 'cached' ? 'success' : strategy.generationStatus.mode === 'fresh' ? 'info' : 'info'}
            sx={{
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.44)',
              bgcolor: 'rgba(255,255,255,0.24)',
              backdropFilter: 'blur(14px)',
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
              <Box>
                <Typography variant="body2" fontWeight={800} sx={{ color: '#0F172A' }}>
                  {strategy.generationStatus.mode === 'cached'
                    ? 'Using cached strategy for the current Step 1 scope.'
                    : strategy.generationStatus.mode === 'fresh'
                      ? 'Showing a fresh AI strategy pass for the current Step 1 scope.'
                      : 'Showing the strategy generated for the current Step 1 scope.'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {strategy.generationStatus.mode === 'cached'
                    ? 'Same scoped tickets + same selected tests = same plan. This keeps Step 2 stable until the scope changes.'
                    : 'If the scope stays the same, future visits should reuse the cached plan unless you explicitly force a fresh pass.'}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={strategy.generationStatus.label}
                sx={{
                  fontWeight: 700,
                  bgcolor: `${strategy.generationStatus.tone}12`,
                  color: strategy.generationStatus.tone,
                }}
              />
            </Stack>
          </Alert>

          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="overline" sx={{ color: '#64748B', letterSpacing: '0.08em', fontWeight: 700 }}>
                Step 2 - Generate Strategy
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                Turn the approved scope into a defensible release plan.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: 780 }}>
                This strategy should explain what is risky, what is already covered, what still needs new scenarios,
                and what the team should run first to build confidence quickly.
              </Typography>
            </Box>
          </Stack>

          {generateMutation.isPending && (
            <Paper
              elevation={0}
              sx={{
                p: 1.6,
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.42)',
                bgcolor: 'rgba(255,255,255,0.62)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Stack spacing={1.2}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, letterSpacing: '0.06em' }}>
                  GENERATING STRATEGY
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A' }}>
                  {forceRefreshRequested ? 'Fresh AI pass in progress' : activeProgressStep.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {forceRefreshRequested
                    ? 'Rebuilding the plan from scratch for the same scope. This takes longer than reusing the cached strategy.'
                    : activeProgressStep.helper}
                </Typography>
              </Stack>
            </Paper>
          )}

          <Paper
            elevation={0}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              p: { xs: 1.25, md: 1.5 },
              borderRadius: 4.5,
              border: '1px solid rgba(255,255,255,0.62)',
              background: `
                radial-gradient(circle at top left, rgba(255, 88, 65, 0.12), transparent 24%),
                radial-gradient(circle at bottom right, rgba(91, 75, 255, 0.12), transparent 28%),
                linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(248,250,252,0.22) 100%)
              `,
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.09)',
              backdropFilter: 'blur(22px)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(120deg, rgba(255,255,255,0.18), transparent 42%)',
                pointerEvents: 'none',
              },
            }}
          >
            <Stack
              direction={{ xs: 'column', xl: 'row' }}
              spacing={1.5}
              sx={{ position: 'relative', zIndex: 1 }}
            >
              <Box
                sx={{
                  flex: 1.3,
                  p: { xs: 2, md: 3 },
                  borderRadius: 4,
                  color: 'white',
                  background: `
                    radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 24%),
                    linear-gradient(135deg, #152033 0%, #1E293B 45%, #374151 100%)
                  `,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <Stack spacing={2.25}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Chip
                      label="Next Best Action"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.12)',
                        color: 'white',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        borderRadius: 999,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.82)', fontWeight: 700, letterSpacing: '0.08em' }}>
                      STEP 2 STRATEGY BRIEF
                    </Typography>
                  </Stack>

                  <Box sx={{ maxWidth: 880 }}>
                    <Typography
                      variant="h4"
                      fontWeight={800}
                      sx={{
                        mb: 1.2,
                        fontSize: { xs: '1.6rem', md: '2.1rem' },
                        lineHeight: 1.12,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      Review linked coverage first. Only add net-new scenarios if they genuinely improve release confidence.
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.9)', lineHeight: 1.75, fontSize: { xs: '0.98rem', md: '1.05rem' }, mb: 1.75 }}>
                      {strategy.nextAction.body}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      maxWidth: 940,
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontWeight: 800, letterSpacing: '0.08em', mb: 0.6 }}>
                      REVIEW PATH
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ alignItems: 'center' }}>
                      {strategy.executionOrder.map((stepLabel: string, index: number) => (
                        <Stack key={stepLabel} direction="row" spacing={0.75} alignItems="center">
                          <Chip
                            label={`${index + 1}. ${shortExecutionLabel(stepLabel)}`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              height: 32,
                              px: 0.45,
                              borderRadius: 999,
                              bgcolor: index === 0 ? 'rgba(255, 88, 65, 0.18)' : 'rgba(255,255,255,0.08)',
                              color: 'white',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          />
                          {index < strategy.executionOrder.length - 1 && <NextIcon sx={{ fontSize: 16, color: 'rgba(226,232,240,0.55)' }} />}
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Typography sx={{ color: '#FDBA74', lineHeight: 1.75, maxWidth: 920, fontSize: '0.98rem' }}>
                    <Box component="span" sx={{ fontWeight: 800, color: '#FED7AA' }}>
                      How it works:
                    </Box>{' '}
                    start from the scoped tickets, audit the Step 1 tests already linked to them, trim anything noisy, and add
                    coverage only when it changes the approval conversation.
                  </Typography>
                </Stack>
              </Box>

              <Box
                sx={{
                  width: { xs: '100%', xl: 360 },
                  flexShrink: 0,
                  p: { xs: 2, md: 2.25 },
                  borderRadius: 4,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(248,250,252,0.14) 100%)',
                  border: '1px solid rgba(255,255,255,0.54)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.72)',
                }}
              >
                <Stack spacing={1.4}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, letterSpacing: '0.08em' }}>
                    RELEASE SNAPSHOT
                  </Typography>

                  <Stack spacing={1}>
                    <BriefingStatCard
                      icon={<SuiteIcon />}
                      label="Scoped Tickets"
                      value={selectedTickets.length}
                      tone="slate"
                      compact
                    />
                    <BriefingStatCard
                      icon={<ConfidenceIcon />}
                      label="Selected Tests"
                      value={selectedTestCases.length}
                      tone="violet"
                      compact
                    />
                    <BriefingStatCard
                      icon={<RiskIcon />}
                      label="Release Risk"
                      value={strategy.riskLabel}
                      tone="amber"
                      compact
                    />
                  </Stack>

                  <Box
                    sx={{
                      p: 1.35,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.34)',
                      backdropFilter: 'blur(14px)',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700, mb: 0.4 }}>
                      Analyst note
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.65 }}>
                      {strategy.coverageConfidence.shortReason}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={generateMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <ArrowOutwardIcon />}
                    onClick={handleGenerate}
                    disabled={isReadOnly || generateMutation.isPending}
                    sx={{
                      mt: 0.5,
                      minHeight: 54,
                      borderRadius: 3,
                      px: 2.5,
                      py: 1.2,
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: '1rem',
                      background: 'linear-gradient(135deg, #7C3AED 0%, #5B4BFF 100%)',
                      boxShadow: '0 16px 32px rgba(91, 75, 255, 0.26)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)',
                        boxShadow: '0 18px 36px rgba(91, 75, 255, 0.32)',
                      },
                      '&:disabled': {
                        background: '#CBD5E1',
                        color: 'white',
                        boxShadow: 'none',
                      },
                    }}
                  >
                    {generateMutation.isPending ? 'Generating Strategy...' : 'Refresh Strategy'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <SummaryTile icon={<RiskIcon />} label="Release Risk" value={strategy.riskLabel} helper={strategy.riskNarrativeShort} tone={strategy.riskTone} />
            <SummaryTile icon={<ConfidenceIcon />} label="Coverage Confidence" value={strategy.coverageConfidence.label} helper={strategy.coverageConfidence.shortReason} tone={strategy.coverageConfidence.tone} />
            <SummaryTile icon={<EffortIcon />} label="Effort" value={strategy.effortLabel} helper={strategy.teamGuidanceShort} />
            <SummaryTile icon={<SuiteIcon />} label="Execution Shape" value={`${strategy.executionShapeCount} Tests`} helper={`${strategy.newScenarioCount} new scenarios + ${strategy.existingRegressionCount} existing regression tests`} />
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.42)',
              bgcolor: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(14px)',
            }}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 800, mb: 0.4, letterSpacing: '0.06em' }}>
                  STRATEGY STABILITY
                </Typography>
                <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700 }}>
                  This strategy is locked to the current Step 1 scope.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Re-running with the same tickets and selected tests will reuse the same plan. Use `Force Fresh Regeneration` only if you intentionally want a new AI pass for the same scope.
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Chip
                    size="small"
                    label={strategy.generationStatus.label}
                    sx={{
                      fontWeight: 700,
                      bgcolor: `${strategy.generationStatus.tone}12`,
                      color: strategy.generationStatus.tone,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {strategy.generationStatus.helper}
                  </Typography>
                </Stack>
              </Box>
              <Button
                variant="text"
                size="small"
                onClick={handleForceRefresh}
                disabled={isReadOnly || generateMutation.isPending}
                sx={{ textTransform: 'none', fontWeight: 700, color: SUITECRAFT_TOKENS.colors.secondary }}
              >
                {generateMutation.isPending && forceRefreshRequested ? 'Refreshing AI Pass...' : 'Force Fresh Regeneration'}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
        <Paper elevation={0} sx={sectionPaperSx}>
          <SectionHeader title="Why This Plan" subtitle="Explain the strategy, not just the output." />
          <Stack spacing={1.25}>
            <StatusNarrative
              title="Risk Narrative"
              tone={strategy.riskTone}
              body={strategy.riskNarrative}
            />
            <StatusNarrative
              title="Coverage Confidence"
              tone={strategy.coverageConfidence.tone}
              body={strategy.coverageConfidence.fullReason}
            />
            <StatusNarrative
              title="Input Audit"
              tone="#2563EB"
              body={`Built from ${selectedTickets.length} scoped tickets and ${selectedTestCases.length} selected tests from Step 1. Top scoped input: ${strategy.topTicketLabels.join(', ') || 'Not available'}.`}
            />
          </Stack>
        </Paper>

        <Paper elevation={0} sx={sectionPaperSx}>
          <SectionHeader title="What AI Sees" subtitle="The strategy is only as good as the scoped input." />
          <Stack spacing={1.25}>
            <InfoRow label="Impacted Areas" value={strategy.impactedAreasLabel} />
            <InfoRow label="Existing Coverage Strength" value={strategy.coverageStrengthsLabel} />
            <InfoRow label="Likely Gaps" value={strategy.coverageGapsLabel} />
            <InfoRow label="Go-Live Concerns" value={strategy.goLiveConcernsLabel} />
          </Stack>
        </Paper>
      </Stack>

      <Paper elevation={0} sx={sectionPaperSx}>
        <SectionHeader title="Input Audit" subtitle="Exactly what Step 1 sent into this strategy." />
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <AuditStatCard
              label="Scoped Tickets"
              value={selectedTickets.length}
              helper="Release tickets selected in Step 1 and locked into this strategy."
            />
            <AuditStatCard
              label="Selected Tests"
              value={selectedTestCases.length}
              helper="Existing coverage carried forward from Step 1 into planning."
            />
            <AuditStatCard
              label="New Scenarios"
              value={strategy.newScenarioCount}
              helper="Additional scenarios AI added on top of the selected regression set."
            />
          </Stack>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
            <AuditList
              title="Scoped Ticket Sample"
              items={selectedTickets.slice(0, 6).map((ticket: any) => `${getTicketId(ticket)} — ${ticket.summary || ticket.title || 'No summary'}`)}
              emptyText="No scoped tickets were available."
            />
            <AuditList
              title="Selected Test Sample"
              items={selectedTestCases.slice(0, 6).map((testCase: any) => `${getTestCaseLabel(testCase)} — ${getTestCaseSection(testCase)}`)}
              emptyText="No selected tests were available."
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={sectionPaperSx}>
        <SectionHeader title="Execution Plan" subtitle="What to run first, what is must-pass, and what is optional." />
        <Stack spacing={2}>
          <ExecutionBucket
            title="Critical Path"
            subtitle="Must-pass suites that should run first."
            suites={strategy.executionBuckets.criticalPath}
            tone="#DC2626"
            emptyText="No critical-path suites were identified explicitly."
          />
          <ExecutionBucket
            title="High-Risk Regression"
            subtitle="Must-pass coverage for core functionality and risky areas."
            suites={strategy.executionBuckets.highRisk}
            tone="#EA580C"
            emptyText="No additional high-risk regression bucket was separated."
          />
          <ExecutionBucket
            title="Broader Regression"
            subtitle="Recommended coverage that strengthens confidence after critical paths pass."
            suites={strategy.executionBuckets.broader}
            tone="#2563EB"
            emptyText="No broader regression bucket was identified."
          />
          <ExecutionBucket
            title="Optional Extended Coverage"
            subtitle="Lower-priority validation to run if time and capacity allow."
            suites={strategy.executionBuckets.optional}
            tone="#0F766E"
            emptyText="No optional extended coverage was identified."
          />
        </Stack>
      </Paper>

      {strategy.newScenarios.length > 0 && (
        <Paper elevation={0} sx={sectionPaperSx}>
          <SectionHeader title={`New Scenarios (${strategy.newScenarios.length})`} subtitle="Every new scenario should justify why it belongs in the release plan." />
          <Stack spacing={2}>
            {strategy.scenarioGroups.map((group: any) => (
              <Paper key={group.label} elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.42)', bgcolor: 'rgba(255,255,255,0.24)', backdropFilter: 'blur(14px)' }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1 }}>
                  {group.label} ({group.scenarios.length})
                </Typography>
                <List sx={{ p: 0 }}>
                  {group.scenarios.map((scenario: any, index: number) => (
                    <Box key={scenario.id || index}>
                      {index > 0 && <Divider />}
                      <ListItem sx={{ px: 0, py: 2.25, alignItems: 'flex-start' }}>
                        <ListItemText
                          secondaryTypographyProps={{ component: 'div' }}
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.85 }}>
                              <Typography variant="body2" fontWeight={800}>{scenario.id || `NS-${index + 1}`}</Typography>
                              <Chip
                                label={String(scenario.priority || 'medium').toUpperCase()}
                                size="small"
                                sx={{
                                  bgcolor: PRIORITY_COLORS[String(scenario.priority || 'medium').toLowerCase()] || SUITECRAFT_TOKENS.colors.risk.medium,
                                  color: 'white',
                                  fontWeight: 700,
                                }}
                              />
                              {scenario.related_tickets?.[0] && <Chip label={scenario.related_tickets[0]} size="small" variant="outlined" />}
                              {scenario.estimated_time_minutes && <Chip label={`${scenario.estimated_time_minutes} min`} size="small" sx={{ fontWeight: 700 }} />}
                            </Stack>
                          }
                          secondary={
                            <Stack spacing={0.75}>
                              <Typography variant="body2" color="text.primary" sx={{ fontWeight: 700 }}>
                                {scenario.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {scenario.description || 'No scenario description provided.'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#7C2D12', lineHeight: 1.6 }}>
                                Why this was added: {scenario.why_needed || buildScenarioReason(scenario, strategy)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                                Risk addressed: {scenario.risk_addressed || 'Release-specific behavior'}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
        <Paper elevation={0} sx={sectionPaperSx}>
          <SectionHeader title="Recommendations" subtitle="What the team should do with this plan next." />
          <Stack spacing={1.1}>
            {strategy.recommendations.length > 0 ? (
              strategy.recommendations.map((recommendation: string, index: number) => (
                <InstructionLine key={index} text={recommendation} />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">No recommendations were returned.</Typography>
            )}
          </Stack>
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 3,
              border: '1px solid rgba(254,215,170,0.9)',
              bgcolor: 'rgba(255,247,237,0.92)',
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', color: '#9A3412', fontWeight: 800, mb: 0.45 }}>
              APPROVAL HANDOFF
            </Typography>
            <Typography variant="body2" sx={{ color: '#7C2D12', lineHeight: 1.65 }}>
              Take this strategy into Step 3 to approve the final execution set. Focus first on the critical-path suites,
              then confirm whether the new scenarios and broader regression are proportionate to the release risk.
            </Typography>
          </Paper>
        </Paper>

        <Paper elevation={0} sx={sectionPaperSx}>
          <SectionHeader title="Team Guidance" subtitle="Use the strategy operationally, not just analytically." />
          <Stack spacing={1.25}>
            <InfoRow label="Recommended Team Size" value={strategy.teamGuidance.teamSizeLabel} />
            <InfoRow label="Parallel Execution" value={strategy.teamGuidance.parallelLabel} />
            <InfoRow label="Likely Bottleneck" value={strategy.teamGuidance.bottleneckLabel} />
            <InfoRow label="Assignment Hint" value={strategy.teamGuidance.assignmentHint} />
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}

function extractApiErrorMessage(error: any, fallbackMessage: string) {
  return error?.response?.data?.detail || error?.message || fallbackMessage;
}

async function retryAsync<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const statusCode = (error as any)?.response?.status;
      if (statusCode === 503 || statusCode === 429) {
        break;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function buildStrategyModel(testPlan: any, selectedTickets: any[], selectedTestCases: any[]) {
  const coverageMetrics = testPlan?.coverage_metrics || {};
  const executionPlan = testPlan?.execution_plan || {};
  const executionStrategy = testPlan?.execution_strategy || {};
  const generationMetadata = testPlan?.generation_metadata || {};
  const riskAssessment = testPlan?.risk_assessment || {};
  const businessContext = testPlan?.business_context || {};
  const scopeAnalysis = testPlan?.scope_analysis || {};
  const strategyInsights = testPlan?.strategy_insights || {};
  const backendCoverageConfidence = testPlan?.coverage_confidence || {};
  const backendTeamGuidance = testPlan?.team_guidance || {};
  const newScenarios = testPlan?.new_test_scenarios || [];
  const testSuites = testPlan?.test_suites || [];
  const topRisks = riskAssessment.key_risks || [];
  const impactedModules = scopeAnalysis.impacted_modules || [];
  const rejectionCriteria = businessContext.rejection_criteria || [];
  const recommendations = testPlan?.recommendations || [];
  const riskLevel = String(riskAssessment.overall_risk_level || 'medium').toLowerCase();
  const riskTone = riskLevel === 'high' ? '#B91C1C' : riskLevel === 'low' ? '#0F766E' : '#B45309';
  const totalExistingTests = testSuites.reduce((sum: number, suite: any) => sum + (suite.test_cases?.length || 0), 0);
  const totalTests = coverageMetrics.total_test_cases || totalExistingTests;
  const executionShapeCount = totalExistingTests + newScenarios.length;
  const topTicketLabels = selectedTickets.slice(0, 4).map(getTicketId).filter(Boolean);
  const storyCount = coverageMetrics.stories || selectedTickets.filter((ticket) => !isBugTicket(ticket)).length;
  const bugCount = coverageMetrics.bugs || selectedTickets.filter((ticket) => isBugTicket(ticket)).length;

  const criticalPath = executionStrategy.critical_path
    || testSuites.filter((suite: any) => suite.must_pass && ['critical', 'high'].includes(String(suite.priority || '').toLowerCase()));
  const highRisk = executionStrategy.high_risk_regression
    || testSuites.filter((suite: any) => suite.must_pass && !criticalPath.includes(suite));
  const broader = executionStrategy.broader_regression
    || testSuites.filter((suite: any) => String(suite.priority || '').toLowerCase() === 'medium');
  const optional = executionStrategy.optional_extended_coverage
    || testSuites.filter((suite: any) => String(suite.priority || '').toLowerCase() === 'low' || !suite.must_pass);

  const coverageConfidence = backendCoverageConfidence.label ? {
    label: backendCoverageConfidence.label,
    tone: normalizeTone(backendCoverageConfidence.tone, riskTone),
    shortReason: backendCoverageConfidence.short_reason || 'Coverage confidence available.',
    fullReason: backendCoverageConfidence.full_reason || backendCoverageConfidence.short_reason || 'Coverage confidence available.',
  } : deriveCoverageConfidence({
    riskLevel,
    selectedTicketCount: selectedTickets.length,
    selectedTestCount: selectedTestCases.length,
    newScenarioCount: newScenarios.length,
    totalExistingTests,
    impactedModules,
    topRisks,
  });

  const riskNarrative = strategyInsights.risk_narrative || buildRiskNarrative({
    riskLevel,
    topRisks,
    impactedModules,
    selectedTickets,
    selectedTestCases,
    newScenarios,
  });

  const effortLabel = formatHours(executionPlan.total_duration_hours || 0);
  const teamSize = backendTeamGuidance.recommended_team_size || executionPlan.recommended_team_size || 0;
  const teamGuidance = {
    teamSizeLabel: backendTeamGuidance.team_size_label || (teamSize ? `${teamSize} testers` : 'TBD'),
    parallelLabel: backendTeamGuidance.parallel_label || (executionPlan.parallel_execution_possible ? 'Yes, execution can be parallelized' : 'No, mostly sequential'),
    bottleneckLabel: backendTeamGuidance.bottleneck_label || (criticalPath.length > 0 ? `${criticalPath.length} must-pass suite${criticalPath.length > 1 ? 's' : ''} gate the release` : 'No critical bottleneck identified yet'),
    assignmentHint: backendTeamGuidance.assignment_hint || (criticalPath.length > 0
      ? 'Assign stronger testers to critical-path and high-risk suites first.'
      : 'Start with the highest-risk suites, then spread broader regression across the team.'),
  };
  const scenarioGroups = groupScenariosByTheme(newScenarios);
  const executionOrder = Array.isArray(strategyInsights.execution_order) && strategyInsights.execution_order.length > 0
    ? strategyInsights.execution_order
    : ['Critical Path', 'High-Risk Regression', 'Broader Regression', 'Optional Extended Coverage'];
  const nextAction = buildNextAction({
    criticalPathCount: criticalPath.length,
    newScenarioCount: newScenarios.length,
    coverageLabel: coverageConfidence.label,
  });
  const generationStatus = buildGenerationStatus(generationMetadata);

  return {
    riskLabel: `${riskLevel.toUpperCase()}${riskAssessment.risk_score ? ` • ${riskAssessment.risk_score}` : ''}`,
    riskTone,
    riskNarrative,
    riskNarrativeShort: impactedModules.length > 0 ? impactedModules.slice(0, 2).join(', ') : `${storyCount} stories / ${bugCount} bugs`,
    coverageConfidence,
    effortLabel,
    teamGuidance,
    teamGuidanceShort: teamSize ? `${teamSize} testers recommended` : 'Team sizing needs review',
    totalTests,
    executionShapeCount,
    newScenarioCount: newScenarios.length,
    existingRegressionCount: totalExistingTests,
    newScenarios,
    recommendations,
    topRisks,
    impactedAreasLabel: strategyInsights.top_impacted_areas?.length > 0
      ? strategyInsights.top_impacted_areas.join(', ')
      : impactedModules.length > 0 ? impactedModules.join(', ') : 'Impacted areas were not clearly identified.',
    coverageStrengthsLabel: strategyInsights.coverage_strengths?.length > 0
      ? strategyInsights.coverage_strengths.join(' ')
      : totalExistingTests > 0
      ? `${totalExistingTests} selected regression tests already anchor this plan across ${testSuites.length} suite${testSuites.length !== 1 ? 's' : ''}.`
      : 'The plan relies heavily on new scenarios because selected regression coverage is limited.',
    coverageGapsLabel: strategyInsights.coverage_gaps?.length > 0
      ? strategyInsights.coverage_gaps.join(' ')
      : newScenarios.length > 0
      ? `${newScenarios.length} new scenarios were added because the existing selected coverage did not fully cover release-specific behavior.`
      : 'No additional net-new scenarios were identified from the current scope.',
    goLiveConcernsLabel: strategyInsights.go_live_concerns?.length > 0
      ? strategyInsights.go_live_concerns.join(', ')
      : rejectionCriteria.length > 0 ? rejectionCriteria.join(', ') : 'No explicit release rejection criteria were returned.',
    topTicketLabels: topTicketLabels.length > 0 ? topTicketLabels : Object.keys(strategyInsights.input_audit || {}).length > 0 ? [
      `${strategyInsights.input_audit.scoped_tickets || 0} scoped tickets`,
      `${strategyInsights.input_audit.selected_tests || 0} selected tests`,
    ] : [],
    executionBuckets: {
      criticalPath,
      highRisk,
      broader,
      optional,
    },
    scenarioGroups,
    executionOrder,
    nextAction,
    generationStatus,
  };
}

function normalizeTone(tone: string | undefined, fallback: string) {
  switch (String(tone || '').toLowerCase()) {
    case 'good':
      return '#0F766E';
    case 'watch':
      return '#B45309';
    case 'risk':
      return '#B91C1C';
    default:
      return fallback;
  }
}

function groupScenariosByTheme(scenarios: any[]) {
  const groups = new Map<string, any[]>();

  scenarios.forEach((scenario) => {
    const label = scenario.scenario_group || scenario.risk_addressed || 'Targeted Release Validation';
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)?.push(scenario);
  });

  return Array.from(groups.entries()).map(([label, groupedScenarios]) => ({
    label,
    scenarios: groupedScenarios,
  }));
}

function shortExecutionLabel(label: string) {
  switch (label) {
    case 'Critical Path':
      return 'Critical';
    case 'High-Risk Regression':
      return 'High-Risk';
    case 'Broader Regression':
      return 'Broader';
    case 'Optional Extended Coverage':
      return 'Optional';
    default:
      return label;
  }
}

function buildNextAction({
  criticalPathCount,
  newScenarioCount,
  coverageLabel,
}: {
  criticalPathCount: number;
  newScenarioCount: number;
  coverageLabel: string;
}) {
  if (criticalPathCount > 0) {
    return {
      title: `Review ${criticalPathCount} critical-path suite${criticalPathCount > 1 ? 's' : ''} first.`,
      body: `These suites should gate confidence before the team expands into broader regression. After that, confirm whether ${newScenarioCount} new scenario${newScenarioCount === 1 ? '' : 's'} feel proportionate to the release risk.`,
    };
  }

  if (coverageLabel === 'Watch Closely') {
    return {
      title: 'Scrutinize the new scenarios before approval.',
      body: 'The current coverage confidence is still thin for the risk level involved, so Step 3 should validate whether the added scenarios are enough before signoff.',
    };
  }

  return {
    title: 'Validate strategy balance before moving to approval.',
    body: 'Check that the execution order, new scenarios, and broader regression all look right-sized for the release. If they do, Step 3 should feel like a clean approval pass rather than a rework step.',
  };
}

function buildGenerationStatus(generationMetadata: any) {
  const mode = String(generationMetadata?.mode || 'unknown').toLowerCase();

  if (mode === 'cached') {
    return {
      label: 'Cached Stable Plan',
      tone: '#0F766E',
      helper: 'This plan was reused because the Step 1 scope is unchanged.',
      mode,
    };
  }

  if (mode === 'fresh') {
    return {
      label: 'Fresh AI Pass',
      tone: '#B45309',
      helper: 'This plan was regenerated intentionally for the same scope.',
      mode,
    };
  }

  return {
    label: 'New Scope Plan',
    tone: '#2563EB',
    helper: 'This plan was created from the current Step 1 scope.',
    mode: 'new',
  };
}

function deriveCoverageConfidence({
  riskLevel,
  selectedTicketCount,
  selectedTestCount,
  newScenarioCount,
  totalExistingTests,
  impactedModules,
  topRisks,
}: {
  riskLevel: string;
  selectedTicketCount: number;
  selectedTestCount: number;
  newScenarioCount: number;
  totalExistingTests: number;
  impactedModules: any[];
  topRisks: any[];
}) {
  const density = selectedTicketCount > 0 ? selectedTestCount / selectedTicketCount : 0;
  const riskPressure = riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0;
  const gapPressure = newScenarioCount > Math.max(2, selectedTicketCount / 3) ? 2 : newScenarioCount > 0 ? 1 : 0;
  const score = density >= 6 ? 3 : density >= 3 ? 2 : density >= 1 ? 1 : 0;
  const confidenceScore = score - riskPressure - gapPressure;

  if (confidenceScore >= 2) {
    return {
      label: 'Strong',
      tone: '#0F766E',
      shortReason: 'Existing selected coverage looks broad enough for this release.',
      fullReason: `Confidence is strong because Step 1 already supplied ${selectedTestCount} selected tests for ${selectedTicketCount} scoped tickets, and the AI only needed ${newScenarioCount} additional scenarios. The plan still needs normal review, but it is not starting from a thin coverage base.`,
    };
  }

  if (confidenceScore >= 0) {
    return {
      label: 'Moderate',
      tone: '#B45309',
      shortReason: 'Coverage is usable, but some risk still depends on added scenarios.',
      fullReason: `Coverage confidence is moderate because the plan includes ${totalExistingTests} selected regression tests, but the AI still added ${newScenarioCount} new scenarios and flagged ${topRisks.length || impactedModules.length || 1} meaningful risk areas. This is a workable plan, but it needs approval discipline in Step 3.`,
    };
  }

  return {
    label: 'Watch Closely',
    tone: '#B91C1C',
    shortReason: 'The current scope still looks thin for the level of risk involved.',
    fullReason: `Coverage confidence is lower because the release carries ${riskLevel} risk while only ${selectedTestCount} selected tests were provided for ${selectedTicketCount} scoped tickets. The AI had to fill more of the strategy using inferred reasoning and new scenarios, so human review matters more here than normal.`,
  };
}

function buildRiskNarrative({
  riskLevel,
  topRisks,
  impactedModules,
  selectedTickets,
  selectedTestCases,
  newScenarios,
}: {
  riskLevel: string;
  topRisks: any[];
  impactedModules: any[];
  selectedTickets: any[];
  selectedTestCases: any[];
  newScenarios: any[];
}) {
  const riskAreas = topRisks
    .slice(0, 3)
    .map((risk: any) => (typeof risk === 'string' ? risk : risk.area || risk.risk))
    .filter(Boolean);

  if (riskAreas.length > 0) {
    return `${riskLevel.toUpperCase()} risk because ${riskAreas.join(', ')} need confidence before release. The strategy is based on ${selectedTickets.length} scoped tickets and ${selectedTestCases.length} selected tests from Step 1, with ${newScenarios.length} new scenarios added to close likely gaps.`;
  }

  if (impactedModules.length > 0) {
    return `${riskLevel.toUpperCase()} risk because this release touches ${impactedModules.slice(0, 3).join(', ')}. Existing selected coverage was used where possible, and ${newScenarios.length} new scenarios were added where the plan still needed release-specific validation.`;
  }

  return `${riskLevel.toUpperCase()} risk based on the scoped release input. The strategy uses ${selectedTestCases.length} selected tests from Step 1 and ${newScenarios.length} newly generated scenarios to build a reviewable execution plan.`;
}

function buildScenarioReason(scenario: any, strategy: any) {
  const relatedTicket = scenario.related_tickets?.[0];
  const riskArea = strategy.topRisks[0];
  const riskLabel = typeof riskArea === 'string' ? riskArea : riskArea?.area || riskArea?.risk;
  const impacted = strategy.impactedAreasLabel;

  if (relatedTicket && riskLabel) {
    return `Ticket ${relatedTicket} likely changes behavior in a risky area (${riskLabel}), and existing selected regression coverage did not fully cover that path.`;
  }

  if (relatedTicket) {
    return `Ticket ${relatedTicket} introduced behavior that the selected Step 1 coverage did not fully explain, so this scenario was added to make the plan safer.`;
  }

  return `The strategy still needed explicit validation around ${riskLabel || impacted || 'the scoped release changes'}, and this scenario improves confidence without forcing a broader regression explosion.`;
}

function ExecutionBucket({
  title,
  subtitle,
  suites,
  tone,
  emptyText,
}: {
  title: string;
  subtitle: string;
  suites: any[];
  tone: string;
  emptyText: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(255,255,255,0.48)', bgcolor: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(16px)' }}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ color: tone, mb: 0.35 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>{subtitle}</Typography>
      {suites.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      ) : (
        <Stack spacing={1}>
          {suites.map((suite: any, index: number) => (
            <Paper key={`${suite.suite_name || index}-${index}`} elevation={0} sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.24)', border: '1px solid rgba(255,255,255,0.36)', backdropFilter: 'blur(12px)' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{suite.suite_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{suite.description}</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`${suite.test_cases?.length || 0} tests`} size="small" sx={{ fontWeight: 700 }} />
                  <Chip label={formatHours((suite.estimated_duration_minutes || 0) / 60)} size="small" sx={{ fontWeight: 700 }} />
                  {suite.must_pass && <Chip label="Must Pass" size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(254,243,199,0.92)', color: '#92400E' }} />}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  helper,
  tone = '#0F172A',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  helper: string;
  tone?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        p: 1.5,
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.44)',
        bgcolor: 'rgba(255,255,255,0.24)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(15,23,42,0.06)',
            color: tone,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700 }}>
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={800} sx={{ color: tone }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function BriefingStatCard({
  icon,
  label,
  value,
  tone,
  emphasized = false,
  fullWidth = false,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'slate' | 'violet' | 'amber';
  emphasized?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
}) {
  const toneMap = {
    slate: {
      bg: 'linear-gradient(180deg, rgba(241,245,249,0.92) 0%, rgba(226,232,240,0.76) 100%)',
      border: 'rgba(255,255,255,0.52)',
      iconBg: 'rgba(255,255,255,0.40)',
      iconColor: '#4361D8',
      labelColor: '#64748B',
      valueColor: '#4361D8',
    },
    violet: {
      bg: 'linear-gradient(180deg, rgba(243,240,255,0.96) 0%, rgba(237,233,254,0.8) 100%)',
      border: 'rgba(255,255,255,0.52)',
      iconBg: 'rgba(255,255,255,0.40)',
      iconColor: '#7C3AED',
      labelColor: '#64748B',
      valueColor: '#7C3AED',
    },
    amber: {
      bg: 'linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(254,243,226,0.84) 100%)',
      border: 'rgba(255,255,255,0.52)',
      iconBg: 'rgba(255,255,255,0.40)',
      iconColor: '#EA580C',
      labelColor: '#64748B',
      valueColor: '#EA580C',
    },
  } as const;

  const colors = toneMap[tone];

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? 1.35 : 2,
        minHeight: compact ? 88 : emphasized ? 136 : 120,
        borderRadius: 3.5,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        backdropFilter: 'blur(16px)',
        boxShadow: emphasized ? '0 14px 28px rgba(234, 88, 12, 0.08)' : '0 10px 24px rgba(15, 23, 42, 0.05)',
        gridColumn: fullWidth ? { xs: 'span 1', sm: 'span 2' } : 'auto',
      }}
    >
      <Stack direction="row" spacing={compact ? 1 : 1.4} alignItems="center" sx={{ height: '100%' }}>
        <Box
          sx={{
            width: compact ? 42 : 52,
            height: compact ? 42 : 52,
            borderRadius: '50%',
            bgcolor: colors.iconBg,
            color: colors.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 18px rgba(255,255,255,0.18)',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: colors.labelColor, fontWeight: 800, mb: compact ? 0.15 : 0.25 }}>
            {label}
          </Typography>
          <Typography
            sx={{
              color: colors.valueColor,
              fontWeight: 900,
              lineHeight: 1,
              fontSize: compact
                ? { xs: '1.35rem', sm: '1.45rem' }
                : emphasized
                  ? { xs: '1.8rem', sm: '2rem' }
                  : { xs: '1.7rem', sm: '1.9rem' },
              wordBreak: 'break-word',
            }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.35 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    </Box>
  );
}

function StatusNarrative({ title, body, tone }: { title: string; body: string; tone: string }) {
  return (
    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.44)', bgcolor: 'rgba(255,255,255,0.26)', backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#64748B', mb: 0.45 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: tone, lineHeight: 1.65 }}>
        {body}
      </Typography>
    </Paper>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.35 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {value}
      </Typography>
    </Box>
  );
}

function AuditStatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.44)', bgcolor: 'rgba(255,255,255,0.24)', backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', mb: 0.35 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
        {helper}
      </Typography>
    </Paper>
  );
}

function AuditList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.44)', bgcolor: 'rgba(255,255,255,0.24)', backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', mb: 0.8 }}>
        {title}
      </Typography>
      <Stack spacing={0.75}>
        {items.length > 0 ? items.map((item) => (
          <Typography key={item} variant="body2" sx={{ color: '#0F172A', lineHeight: 1.55 }}>
            {item}
          </Typography>
        )) : (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {emptyText}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

function getTestCaseLabel(testCase: any) {
  return testCase?.title || testCase?.Title || testCase?.test_case_id || testCase?.id || 'Untitled test';
}

function getTestCaseSection(testCase: any) {
  return testCase?.section || testCase?.Section || testCase?.section_hierarchy || testCase?.['Section Hierarchy'] || 'Unknown section';
}

function InstructionLine({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1.1} alignItems="flex-start">
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: SUITECRAFT_TOKENS.colors.primary,
          mt: '7px',
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
        {text}
      </Typography>
    </Stack>
  );
}

function getTicketId(ticket: any): string {
  return ticket?.issue_key || ticket?.ticket_id || ticket?.id || 'Unknown ticket';
}

function isBugTicket(ticket: any) {
  const issueType = String(ticket?.issue_type || ticket?.type || '').toLowerCase();
  return issueType.includes('bug') || issueType.includes('defect');
}

function formatHours(hours: number): string {
  if (hours <= 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const days = hours / 8;
  if (days >= 1) return `${hours.toFixed(1)}h (${days.toFixed(1)} days)`;
  return `${hours.toFixed(1)}h`;
}

const sectionPaperSx = {
  flex: 1,
  p: 2.5,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.54)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
  backdropFilter: 'blur(22px)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.74)',
};
