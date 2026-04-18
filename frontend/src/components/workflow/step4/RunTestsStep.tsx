import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  Block as BlockedIcon,
  CheckCircle as PassedIcon,
  Error as FailedIcon,
  Person as PersonIcon,
  PlayArrow as StartIcon,
  Search as SearchIcon,
  SkipNext as SkippedIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { testExecutionService, testPlanService, TestExecutionResult, TestExecutionSummary, TestRunSummary } from '../../../services/api';
import { SUITECRAFT_TOKENS } from '../../../styles/theme';
import TestExecutionModal from './TestExecutionModal';

interface RunTestsStepProps {
  releaseId: string;
  testPlan: any;
  assignments: any;
  onComplete: () => void;
  isReadOnly: boolean;
}

interface ExecutionView {
  id: number;
  test_run_id: number;
  test_case_id: string;
  title: string;
  description: string;
  section: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedUser: any;
  status: 'not_started' | 'in_progress' | 'passed' | 'failed' | 'blocked' | 'skipped';
  relatedTicket?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

const STATUS_LABELS: Record<ExecutionView['status'], string> = {
  not_started: 'To Do',
  in_progress: 'In Progress',
  passed: 'Passed',
  failed: 'Failed',
  blocked: 'Blocked',
  skipped: 'Skipped',
};

const STATUS_TONES: Record<ExecutionView['status'], { bg: string; color: string }> = {
  not_started: { bg: '#F8FAFC', color: '#64748B' },
  in_progress: { bg: '#EFF6FF', color: '#2563EB' },
  passed: { bg: '#ECFDF5', color: '#059669' },
  failed: { bg: '#FEF2F2', color: '#DC2626' },
  blocked: { bg: '#FFF7ED', color: '#D97706' },
  skipped: { bg: '#F1F5F9', color: '#475569' },
};

const PRIORITY_TONES: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#FEE2E2', color: '#DC2626', label: 'Critical' },
  high: { bg: '#FEF3C7', color: '#B45309', label: 'High' },
  medium: { bg: '#DBEAFE', color: '#2563EB', label: 'Medium' },
  low: { bg: '#DCFCE7', color: '#15803D', label: 'Low' },
};

export default function RunTestsStep({
  releaseId,
  testPlan,
  onComplete,
  isReadOnly,
}: RunTestsStepProps) {
  const queryClient = useQueryClient();
  const autoSetupAttempted = useRef(false);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExecutionView['status'] | 'all'>('all');
  const [showMyTests, setShowMyTests] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  const [executionModalOpen, setExecutionModalOpen] = useState(false);

  const currentUser = useMemo(() => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }, []);

  const { data: testRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ['testRuns', releaseId],
    queryFn: async () => {
      const response = await testExecutionService.getTestRuns(Number(releaseId));
      return response.data;
    },
    enabled: !!releaseId,
  });

  const handleCreateExecutionRun = () => {
    if (isReadOnly || createExecutionRunMutation.isPending) return;

    if (testRuns.length > 0) {
      const confirmed = window.confirm(
        'A test run already exists for this release. Do you want to create an additional execution run from the same approved plan?'
      );
      if (!confirmed) return;
    }

    createExecutionRunMutation.mutate();
  };

  const createExecutionRunMutation = useMutation({
    mutationFn: async () => {
      const executionReadyPlan = buildExecutionReadyPlan(testPlan, releaseId);
      const releaseLabel = executionReadyPlan.release_version || `Release ${releaseId}`;
      const dateLabel = new Date().toLocaleDateString();

      const saveResponse = await testPlanService.save(
        { test_plan: executionReadyPlan },
        `Execution Plan - ${releaseLabel} - ${dateLabel}`
      );

      const savedPlanId = saveResponse.data?.saved_plan_id;
      if (!savedPlanId) {
        throw new Error('Could not save the approved execution plan before creating the run.');
      }

      const runResponse = await testExecutionService.createTestRun({
        release_id: Number(releaseId),
        test_plan_id: savedPlanId,
        name: `Execution Run - ${releaseLabel} - ${dateLabel}`,
        description: 'Created automatically from the approved workflow plan',
        auto_assign: true,
      });

      await testExecutionService.updateTestRun(runResponse.data.id, {
        status: 'active',
      });

      return runResponse.data;
    },
    onSuccess: (createdRun) => {
      queryClient.invalidateQueries({ queryKey: ['testRuns', releaseId] });
      setSelectedRunId(createdRun.id);
    },
  });

  useEffect(() => {
    if (testRuns.length === 0) {
      return;
    }

    if (!selectedRunId || !testRuns.some((run) => run.id === selectedRunId)) {
      const preferredRun =
        testRuns.find((run) => run.status === 'active') ||
        testRuns.find((run) => run.status === 'draft') ||
        [...testRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      setSelectedRunId(preferredRun?.id || null);
    }
  }, [testRuns, selectedRunId]);

  useEffect(() => {
    if (
      !autoSetupAttempted.current &&
      !loadingRuns &&
      !isReadOnly &&
      !!testPlan &&
      testRuns.length === 0 &&
      !createExecutionRunMutation.isPending
    ) {
      autoSetupAttempted.current = true;
      handleCreateExecutionRun();
    }
  }, [loadingRuns, isReadOnly, testPlan, testRuns.length, createExecutionRunMutation]);

  const currentRun = useMemo(
    () => testRuns.find((run) => run.id === selectedRunId) || null,
    [testRuns, selectedRunId]
  );

  const { data: executionSummaries = [], isLoading: loadingExecutions } = useQuery({
    queryKey: ['testExecutions', currentRun?.id],
    queryFn: async () => {
      if (!currentRun) return [];
      const response = await testExecutionService.getExecutions(currentRun.id);
      return response.data;
    },
    enabled: !!currentRun,
  });

  const startExecutionMutation = useMutation({
    mutationFn: async (executionId: number) => {
      await testExecutionService.startExecution(executionId);
      return executionId;
    },
    onSuccess: (executionId) => {
      queryClient.invalidateQueries({ queryKey: ['testExecutions', currentRun?.id] });
      setSelectedExecutionId(executionId);
      setExecutionModalOpen(true);
    },
  });

  const submitResultMutation = useMutation({
    mutationFn: async ({ executionId, result }: { executionId: number; result: TestExecutionResult }) => {
      return testExecutionService.submitResult(executionId, result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testExecutions', currentRun?.id] });
      queryClient.invalidateQueries({ queryKey: ['testRuns', releaseId] });
      setExecutionModalOpen(false);
      setSelectedExecutionId(null);
    },
  });

  const executions = useMemo(
    () => executionSummaries.map(normalizeExecution),
    [executionSummaries]
  );

  const stats = useMemo(() => {
    const total = executions.length;
    const passed = executions.filter((execution) => execution.status === 'passed').length;
    const failed = executions.filter((execution) => execution.status === 'failed').length;
    const blocked = executions.filter((execution) => execution.status === 'blocked').length;
    const skipped = executions.filter((execution) => execution.status === 'skipped').length;
    const inProgress = executions.filter((execution) => execution.status === 'in_progress').length;
    const notStarted = executions.filter((execution) => execution.status === 'not_started').length;
    const completed = passed + failed + blocked + skipped;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      passed,
      failed,
      blocked,
      skipped,
      inProgress,
      notStarted,
      completed,
      progress,
    };
  }, [executions]);

  const filteredExecutions = useMemo(() => {
    let next = [...executions];

    if (statusFilter !== 'all') {
      next = next.filter((execution) => execution.status === statusFilter);
    }

    if (showMyTests && currentUser) {
      next = next.filter((execution) => execution.assignedUser?.id === currentUser.id);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      next = next.filter((execution) => {
        const haystack = [
          execution.test_case_id,
          execution.title,
          execution.section,
          execution.relatedTicket,
          execution.assignedUser?.username,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return next;
  }, [executions, statusFilter, showMyTests, currentUser, searchQuery]);

  const groupedExecutions = useMemo(() => {
    const groups = new Map<string, ExecutionView[]>();

    filteredExecutions.forEach((execution) => {
      const key = execution.section || 'Ungrouped';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(execution);
    });

    return Array.from(groups.entries())
      .map(([section, items]) => ({
        section,
        items: items.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
        completed: items.filter((item) => ['passed', 'failed', 'blocked', 'skipped'].includes(item.status)).length,
      }))
      .sort((a, b) => {
        const attentionDelta =
          b.items.filter((item) => item.status === 'failed' || item.status === 'blocked').length -
          a.items.filter((item) => item.status === 'failed' || item.status === 'blocked').length;
        return attentionDelta !== 0 ? attentionDelta : a.section.localeCompare(b.section);
      });
  }, [filteredExecutions]);

  const readiness = useMemo(() => {
    if (stats.total === 0) {
      return {
        label: 'Execution Workspace Needed',
        tone: '#B45309',
        helper: 'We still need to create a test run from the approved execution set before the team can start testing.',
      };
    }

    if (stats.failed > 0 || stats.blocked > 0) {
      return {
        label: 'At Risk',
        tone: '#DC2626',
        helper: 'Failures or blockers are active. Clear these before calling the release execution-ready.',
      };
    }

    if (stats.progress < 100) {
      return {
        label: 'Execution In Progress',
        tone: '#2563EB',
        helper: 'The team is moving through the run, but signoff should wait until critical coverage is complete.',
      };
    }

    return {
      label: 'Execution Complete',
      tone: '#059669',
      helper: 'All tests in the current run have results. Review failures and blockers, then complete the release when you’re comfortable.',
    };
  }, [stats]);

  const handleOpenExecution = async (execution: ExecutionView) => {
    if (startExecutionMutation.isPending || submitResultMutation.isPending) return;

    if (execution.status === 'not_started' && !isReadOnly) {
      startExecutionMutation.mutate(execution.id);
      return;
    }

    setSelectedExecutionId(execution.id);
    setExecutionModalOpen(true);
  };

  const handleSubmitExecution = (executionId: number, status: TestExecutionResult['status'], notes: string) => {
    submitResultMutation.mutate({
      executionId,
      result: {
        status,
        actual_result: notes || `Marked as ${STATUS_LABELS[status]}.`,
        tester_notes: notes,
      },
    });
  };

  if (loadingRuns) {
    return (
      <Paper elevation={0} sx={emptyStateSx}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading execution workspace...
        </Typography>
      </Paper>
    );
  }

  const showSetupState = createExecutionRunMutation.isPending || (!isReadOnly && testRuns.length === 0 && !createExecutionRunMutation.isError);

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={glassPanelSx}>
        <Stack spacing={2.25}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
            <Box sx={{ maxWidth: 780 }}>
              <Typography variant="overline" sx={overlineSx}>
                Step 4 - Execute & Monitor
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                Run the approved execution set like a release command center.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                This is where the approved plan becomes operational: track pass/fail health, focus attention on blocked work,
                and make sure the right tests are moving at the right pace before signoff.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              startIcon={createExecutionRunMutation.isPending ? <CircularProgress size={16} /> : <AiIcon />}
              onClick={handleCreateExecutionRun}
              disabled={isReadOnly || createExecutionRunMutation.isPending}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                borderRadius: 999,
                borderColor: SUITECRAFT_TOKENS.colors.secondary,
                color: SUITECRAFT_TOKENS.colors.secondary,
              }}
            >
              {createExecutionRunMutation.isPending ? 'Preparing Run...' : testRuns.length > 0 ? 'Create Additional Run' : 'Prepare Execution Run'}
            </Button>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <SummaryTile label="Execution Progress" value={`${Math.round(stats.progress)}%`} helper={`${stats.completed} of ${stats.total} tests have results`} tone="#2563EB" bg="#EFF6FF" />
            <SummaryTile label="Passed" value={stats.passed} helper="Tests already cleared by the team" tone="#059669" bg="#ECFDF5" />
            <SummaryTile label="Needs Attention" value={stats.failed + stats.blocked} helper="Failed or blocked tests that threaten signoff" tone="#DC2626" bg="#FEF2F2" />
            <SummaryTile label="Remaining Work" value={stats.inProgress + stats.notStarted} helper="Tests still to run or currently in progress" tone="#B45309" bg="#FFF7ED" />
          </Stack>

          <Paper elevation={0} sx={readinessPanelSx(readiness.tone)}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
              <Box sx={{ maxWidth: 780 }}>
                <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 800, letterSpacing: '0.06em', mb: 0.4 }}>
                  EXECUTION READINESS
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color: readiness.tone, mb: 0.4 }}>
                  {readiness.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  {readiness.helper}
                </Typography>
              </Box>

              {currentRun && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`Run ${currentRun.id}`} size="small" sx={metaChipSx} />
                  <Chip label={currentRun.status.toUpperCase()} size="small" sx={metaChipSx} />
                  <Chip label={`${currentRun.executed_count}/${currentRun.total_test_cases} executed`} size="small" sx={metaChipSx} />
                </Stack>
              )}
            </Stack>
          </Paper>

          {showSetupState && (
            <Paper elevation={0} sx={softPanelSx}>
              <Stack spacing={1.2}>
                <Typography variant="caption" sx={overlineSx}>
                  PREPARING EXECUTION
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A' }}>
                  Creating a run from the approved Step 3 plan
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  We’re saving the approved execution set and creating a local execution run in Suitecraft so the team can track pass/fail health from the workflow. TestRail result sync can be added once a writable API environment is available.
                </Typography>
                <LinearProgress sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(15, 23, 42, 0.06)' }} />
              </Stack>
            </Paper>
          )}

          {createExecutionRunMutation.isError && (
            <Alert severity="error">
              {createExecutionRunMutation.error instanceof Error
                ? createExecutionRunMutation.error.message
                : 'Failed to prepare the execution workspace.'}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={glassPanelSx}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} flexWrap="wrap">
              <Button variant={statusFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setStatusFilter('all')} sx={filterButtonSx(statusFilter === 'all')}>
                All ({stats.total})
              </Button>
              <Button variant={statusFilter === 'failed' ? 'contained' : 'outlined'} onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')} sx={filterButtonSx(statusFilter === 'failed', '#DC2626')}>
                Failed ({stats.failed})
              </Button>
              <Button variant={statusFilter === 'blocked' ? 'contained' : 'outlined'} onClick={() => setStatusFilter(statusFilter === 'blocked' ? 'all' : 'blocked')} sx={filterButtonSx(statusFilter === 'blocked', '#D97706')}>
                Blocked ({stats.blocked})
              </Button>
              <Button variant={showMyTests ? 'contained' : 'outlined'} startIcon={<PersonIcon />} onClick={() => setShowMyTests((value) => !value)} sx={filterButtonSx(showMyTests, '#2563EB')}>
                My Tests
              </Button>
            </Stack>

            <TextField
              size="small"
              placeholder="Search by case ID, title, ticket, assignee..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              sx={{ minWidth: { xs: '100%', lg: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {testRuns.length > 1 && (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {testRuns.map((run) => (
                <Chip
                  key={run.id}
                  label={`${run.name} · ${run.status}`}
                  onClick={() => setSelectedRunId(run.id)}
                  color={run.id === currentRun?.id ? 'primary' : 'default'}
                  variant={run.id === currentRun?.id ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 700 }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {!currentRun && !showSetupState ? (
        <Paper elevation={0} sx={emptyStateSx}>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', mb: 1 }}>
            No execution run is ready yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620, lineHeight: 1.7, mb: 2.5 }}>
            Step 4 expects an execution run in Suitecraft. Create one from the approved execution set so the team can track pass/fail/blocker progress here.
          </Typography>
          {!isReadOnly && (
            <Button variant="contained" startIcon={<AiIcon />} onClick={handleCreateExecutionRun} sx={primaryButtonSx}>
              Prepare Execution Run
            </Button>
          )}
        </Paper>
      ) : loadingExecutions ? (
        <Paper elevation={0} sx={emptyStateSx}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }} color="text.secondary">
            Loading the active execution run...
          </Typography>
        </Paper>
      ) : groupedExecutions.length === 0 ? (
        <Paper elevation={0} sx={emptyStateSx}>
          <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', mb: 1 }}>
            No executions match the current filters
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620, lineHeight: 1.7 }}>
            Clear the search or filters to bring the full execution set back into view.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {groupedExecutions.map((group) => {
            const sectionProgress = group.items.length > 0 ? (group.completed / group.items.length) * 100 : 0;

            return (
              <Paper key={group.section} elevation={0} sx={groupPanelSx}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A' }}>
                        {group.section}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {group.completed} of {group.items.length} tests have results in this section.
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: { xs: '100%', lg: 240 } }}>
                      <LinearProgress
                        variant="determinate"
                        value={sectionProgress}
                        sx={{
                          height: 8,
                          borderRadius: 999,
                          bgcolor: 'rgba(15, 23, 42, 0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            bgcolor: sectionProgress === 100 ? '#059669' : SUITECRAFT_TOKENS.colors.primary,
                          },
                        }}
                      />
                    </Box>
                  </Stack>

                  <Stack spacing={1.25}>
                    {group.items.map((execution) => {
                      const priorityTone = PRIORITY_TONES[execution.priority] || PRIORITY_TONES.medium;
                      const statusTone = STATUS_TONES[execution.status];
                      const actionLabel =
                        execution.status === 'not_started'
                          ? 'Start Test'
                          : execution.status === 'in_progress'
                            ? 'Continue'
                            : 'Review';

                      return (
                        <Paper key={execution.id} elevation={0} sx={testCardSx(execution.status)}>
                          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between">
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 0.8 }}>
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#0F172A' }}>
                                  {execution.test_case_id}
                                </Typography>
                                <Chip label={priorityTone.label} size="small" sx={{ bgcolor: priorityTone.bg, color: priorityTone.color, fontWeight: 700 }} />
                                <Chip label={STATUS_LABELS[execution.status]} size="small" sx={{ bgcolor: statusTone.bg, color: statusTone.color, fontWeight: 700 }} />
                                {execution.relatedTicket && (
                                  <Chip label={execution.relatedTicket} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                                )}
                                {execution.assignedUser && (
                                  <Chip icon={<PersonIcon fontSize="small" />} label={execution.assignedUser.username} size="small" variant="outlined" />
                                )}
                              </Stack>

                              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                                {execution.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                                {execution.description || 'Open the execution to review the expected behavior and complete the run.'}
                              </Typography>
                            </Box>

                            <Stack spacing={1.25} alignItems={{ xs: 'flex-start', lg: 'flex-end' }}>
                              {(execution.status === 'failed' || execution.status === 'blocked') && (
                                <Chip
                                  icon={<WarningIcon fontSize="small" />}
                                  label="Needs Attention"
                                  size="small"
                                  sx={{ bgcolor: '#FEF2F2', color: '#DC2626', fontWeight: 800 }}
                                />
                              )}
                              <Button
                                variant={execution.status === 'not_started' ? 'contained' : 'outlined'}
                                startIcon={execution.status === 'not_started' ? <StartIcon /> : undefined}
                                onClick={() => handleOpenExecution(execution)}
                                disabled={startExecutionMutation.isPending || submitResultMutation.isPending}
                                sx={execution.status === 'not_started' ? primaryButtonSx : secondaryButtonSx}
                              >
                                {actionLabel}
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {selectedExecutionId && (
        <TestExecutionModal
          open={executionModalOpen}
          onClose={() => {
            setExecutionModalOpen(false);
            setSelectedExecutionId(null);
          }}
          executionId={selectedExecutionId}
          onComplete={handleSubmitExecution}
          isReadOnly={isReadOnly}
          isSubmitting={submitResultMutation.isPending}
        />
      )}
    </Stack>
  );
}

function normalizeExecution(execution: TestExecutionSummary): ExecutionView {
  const description = execution.test_case_description || '';
  return {
    id: execution.id,
    test_run_id: execution.test_run_id,
    test_case_id: execution.test_case_id,
    title: execution.test_case_title,
    description: cleanExecutionDescription(description),
    section: parseDescriptionLine(description, 'Section') || 'Execution Set',
    priority: normalizePriority(execution.priority),
    assignedUser: execution.assigned_user || null,
    status: execution.status,
    relatedTicket: parseDescriptionLine(description, 'Related Ticket') || undefined,
    startedAt: execution.started_at,
    completedAt: execution.completed_at,
  };
}

function cleanExecutionDescription(description: string) {
  return description
    .split('\n')
    .filter((line) => !line.startsWith('Section:') && !line.startsWith('Hierarchy:') && !line.startsWith('Related Ticket:'))
    .join(' ')
    .trim();
}

function parseDescriptionLine(description: string, label: string) {
  const line = description
    .split('\n')
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.split(':').slice(1).join(':').trim() : '';
}

function normalizePriority(priority?: string | null): ExecutionView['priority'] {
  const normalized = String(priority || 'medium').toLowerCase();
  return ['critical', 'high', 'medium', 'low'].includes(normalized) ? (normalized as ExecutionView['priority']) : 'medium';
}

function priorityRank(priority: ExecutionView['priority']) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 4;
}

function buildExecutionReadyPlan(testPlan: any, releaseId: string) {
  const groupedSuites = new Map<string, any[]>();
  const testCases = testPlan?.test_cases || [];

  testCases.forEach((testCase: any) => {
    const section = testCase.section || 'Execution Set';
    if (!groupedSuites.has(section)) {
      groupedSuites.set(section, []);
    }
    groupedSuites.get(section)!.push({
      id: testCase.test_case_id || testCase.id,
      title: testCase.title,
      priority: testCase.priority,
      section: testCase.section,
      related_ticket: testCase.related_ticket || '',
      steps: testCase.steps || [],
    });
  });

  const suites = Array.from(groupedSuites.entries()).map(([suiteName, cases]) => ({
    suite_name: suiteName,
    priority: normalizePriority(cases[0]?.priority),
    description: `${suiteName} execution coverage`,
    test_cases: cases,
  }));

  return {
    release_version: testPlan?.release_version || `Release ${releaseId}`,
    release_name: testPlan?.release_name || `Release ${releaseId}`,
    test_suites: suites,
    new_test_scenarios: testPlan?.new_scenarios || [],
    test_cases: testCases,
    summary: testPlan?.summary || {
      total_tests: testCases.length,
    },
  };
}

function SummaryTile({
  label,
  value,
  helper,
  tone,
  bg,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: string;
  bg: string;
}) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.42)', bgcolor: bg }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} sx={{ color: tone, mb: 0.35 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
        {helper}
      </Typography>
    </Paper>
  );
}

const glassPanelSx = {
  p: 3,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.54)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
  backdropFilter: 'blur(22px)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.74)',
};

const softPanelSx = {
  p: 1.8,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.44)',
  bgcolor: 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(16px)',
};

const emptyStateSx = {
  p: 6,
  textAlign: 'center',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.50)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.14) 100%)',
  backdropFilter: 'blur(18px)',
};

const overlineSx = {
  color: '#64748B',
  letterSpacing: '0.08em',
  fontWeight: 700,
};

const metaChipSx = {
  fontWeight: 700,
  bgcolor: 'rgba(255,255,255,0.30)',
  backdropFilter: 'blur(12px)',
};

const groupPanelSx = {
  p: 2,
  borderRadius: 3.5,
  border: '1px solid rgba(255,255,255,0.36)',
  bgcolor: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(10px)',
};

const primaryButtonSx = {
  textTransform: 'none',
  borderRadius: 3,
  px: 2.75,
  py: 1.05,
  minHeight: 46,
  whiteSpace: 'nowrap',
  fontWeight: 800,
  bgcolor: SUITECRAFT_TOKENS.colors.primary,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
  '&:hover': {
    bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
  },
};

const secondaryButtonSx = {
  ...primaryButtonSx,
  bgcolor: 'transparent',
  color: '#0F172A',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  boxShadow: 'none',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.72)',
    borderColor: SUITECRAFT_TOKENS.colors.primary,
    boxShadow: 'none',
  },
};

const filterButtonSx = (active: boolean, color: string = SUITECRAFT_TOKENS.colors.primary) => ({
  textTransform: 'none',
  borderRadius: 999,
  fontWeight: 700,
  ...(active
    ? {
        bgcolor: color,
        borderColor: color,
        color: '#fff',
        '&:hover': {
          bgcolor: color,
          opacity: 0.92,
        },
      }
    : {}),
});

const testCardSx = (status: ExecutionView['status']) => ({
  p: 1.5,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.40)',
  bgcolor:
    status === 'failed'
      ? 'rgba(254,242,242,0.42)'
      : status === 'blocked'
        ? 'rgba(255,247,237,0.42)'
        : status === 'in_progress'
          ? 'rgba(239,246,255,0.36)'
          : 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(14px)',
});

const readinessPanelSx = (tone: string) => ({
  p: 1.8,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.44)',
  bgcolor: tone === '#DC2626' ? 'rgba(254,242,242,0.42)' : tone === '#059669' ? 'rgba(236,253,245,0.42)' : 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(16px)',
});
