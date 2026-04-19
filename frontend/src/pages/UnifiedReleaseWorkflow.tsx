import { startTransition, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  ArrowBack,
  Check as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { releaseService } from '../services/api';
import { SUITECRAFT_TOKENS } from '../styles/theme';

import WorkflowStepper from '../components/workflow/WorkflowStepper';
import ImportTicketsStep from '../components/workflow/step1/ImportTicketsStep';
import GenerateTestsStep from '../components/workflow/step2/GenerateTestsStep';
import ReviewTestPlanStep from '../components/workflow/step3/ReviewTestPlanStep';
import RunTestsStep from '../components/workflow/step4/RunTestsStep';

interface WorkflowState {
  currentStep: 1 | 2 | 3 | 4;
  step1Complete: boolean;
  step2Complete: boolean;
  step3Complete: boolean;
  step4Complete: boolean;
  selectedTickets: any[];
  selectedTestCases: any[];
  generatedTestPlan: any;
  strategyScopeSignature: string | null;
  teamAssignments: any;
  testProgress: any;
}

const EMPTY_ITEMS: any[] = [];

const DEFAULT_WORKFLOW_STATE: WorkflowState = {
  currentStep: 1,
  step1Complete: false,
  step2Complete: false,
  step3Complete: false,
  step4Complete: false,
  selectedTickets: EMPTY_ITEMS,
  selectedTestCases: EMPTY_ITEMS,
  generatedTestPlan: null,
  strategyScopeSignature: null,
  teamAssignments: null,
  testProgress: null,
};

function getComparableId(item: any, fallback = ''): string {
  return String(item?.issue_key || item?.ticket_id || item?.test_case_id || item?.case_id || item?.id || fallback);
}

function haveSameIds(previousItems: any[], nextItems: any[]) {
  if (previousItems.length !== nextItems.length) {
    return false;
  }

  const previousIds = previousItems.map((item, index) => getComparableId(item, `prev-${index}`)).sort();
  const nextIds = nextItems.map((item, index) => getComparableId(item, `next-${index}`)).sort();

  return previousIds.every((id, index) => id === nextIds[index]);
}

function normalizeWorkflowState(state: WorkflowState): WorkflowState {
  const hasScopedTickets = state.selectedTickets.length > 0;
  const hasGeneratedPlan = Boolean(state.generatedTestPlan);
  const derivedScopeSignature = hasScopedTickets
    ? buildScopeSignature(state.selectedTickets, state.selectedTestCases)
    : null;
  const strategyScopeSignature = hasGeneratedPlan
    ? (state.strategyScopeSignature || derivedScopeSignature)
    : null;
  const generatedPlanMatchesScope = Boolean(
    hasGeneratedPlan &&
    hasScopedTickets &&
    strategyScopeSignature &&
    strategyScopeSignature === derivedScopeSignature
  );

  const step1Complete = hasScopedTickets;
  const step2Complete = step1Complete && hasGeneratedPlan && (state.step2Complete || generatedPlanMatchesScope);
  const step3Complete = step2Complete && state.step3Complete;
  const step4Complete = step3Complete && state.step4Complete;

  const maxAccessibleStep: 1 | 2 | 3 | 4 =
    step3Complete ? 4 : step2Complete ? 3 : step1Complete ? 2 : 1;

  const currentStep = (Math.min(state.currentStep, maxAccessibleStep) || 1) as 1 | 2 | 3 | 4;

  return {
    ...state,
    currentStep,
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
    selectedTestCases: hasScopedTickets ? state.selectedTestCases : EMPTY_ITEMS,
    generatedTestPlan: generatedPlanMatchesScope ? state.generatedTestPlan : null,
    strategyScopeSignature: step2Complete ? strategyScopeSignature : null,
    teamAssignments: step3Complete ? state.teamAssignments : null,
    testProgress: step4Complete ? state.testProgress : null,
  };
}

function isSameWorkflowState(previous: WorkflowState, next: WorkflowState) {
  return (
    previous.currentStep === next.currentStep &&
    previous.step1Complete === next.step1Complete &&
    previous.step2Complete === next.step2Complete &&
    previous.step3Complete === next.step3Complete &&
    previous.step4Complete === next.step4Complete &&
    haveSameIds(previous.selectedTickets, next.selectedTickets) &&
    haveSameIds(previous.selectedTestCases, next.selectedTestCases) &&
    previous.generatedTestPlan === next.generatedTestPlan &&
    previous.strategyScopeSignature === next.strategyScopeSignature &&
    previous.teamAssignments === next.teamAssignments &&
    previous.testProgress === next.testProgress
  );
}

function buildScopeSignature(tickets: any[], testCases: any[]) {
  const ticketIds = tickets
    .map((ticket, index) => getComparableId(ticket, `ticket-${index}`))
    .filter(Boolean)
    .sort()
    .join('|');
  const testCaseIds = testCases
    .map((testCase, index) => getComparableId(testCase, `test-${index}`))
    .filter(Boolean)
    .sort()
    .join('|');

  return `${ticketIds}::${testCaseIds}`;
}

function buildPlanCacheKey(releaseId: string | undefined, scopeSignature: string) {
  return `workflow_plan_${releaseId}_${scopeSignature}`;
}

function buildApprovedPlanCacheKey(releaseId: string | undefined, scopeSignature: string) {
  return `workflow_approved_plan_${releaseId}_${scopeSignature}`;
}

const STEP_COPY = {
  1: {
    eyebrow: 'Release Scope',
    title: 'Confirm what changed before we plan coverage.',
    description: 'Choose the release tickets, review linked coverage, and shape the regression scope with confidence.',
  },
  2: {
    eyebrow: 'Planning Strategy',
    title: 'Generate a focused plan for this release.',
    description: 'Use the scoped release context to produce a strategy that balances risk, coverage, and effort.',
  },
  3: {
    eyebrow: 'Approval Workspace',
    title: 'Review the plan like a release decision, not a spreadsheet.',
    description: 'Validate priorities, remove noise, and approve the final execution set for the team.',
  },
  4: {
    eyebrow: 'Execution Control',
    title: 'Track readiness and keep the team aligned.',
    description: 'Monitor progress, surface blockers, and close out the release with a clear execution view.',
  },
} as const;

export default function UnifiedReleaseWorkflow() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastPersistedStateRef = useRef<string>('');
  const persistWorkflowStateImmediately = useCallback((nextState: WorkflowState) => {
    const normalizedState = normalizeWorkflowState(nextState);
    const serializedState = JSON.stringify(normalizedState);
    localStorage.setItem(`workflow_${releaseId}`, serializedState);
    lastPersistedStateRef.current = serializedState;
    return normalizedState;
  }, [releaseId]);
  const navigateToRelease = () => {
    if (!releaseId) {
      window.location.assign('/releases');
      return;
    }

    window.location.assign(`/release-overview/${releaseId}`);
  };

  const [workflowState, setWorkflowState] = useState<WorkflowState>(() => {
    const saved = localStorage.getItem(`workflow_${releaseId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_WORKFLOW_STATE;
      }
    }
    return DEFAULT_WORKFLOW_STATE;
  });

  const normalizedWorkflowState = useMemo(() => normalizeWorkflowState(workflowState), [workflowState]);
  const currentScopeSignature = useMemo(
    () => buildScopeSignature(normalizedWorkflowState.selectedTickets, normalizedWorkflowState.selectedTestCases),
    [normalizedWorkflowState.selectedTestCases, normalizedWorkflowState.selectedTickets]
  );

  useEffect(() => {
    if (!isSameWorkflowState(workflowState, normalizedWorkflowState)) {
      setWorkflowState(normalizedWorkflowState);
    }
  }, [workflowState, normalizedWorkflowState]);

  useEffect(() => {
    if (!releaseId) {
      return;
    }

    if (
      !normalizedWorkflowState.step1Complete ||
      normalizedWorkflowState.generatedTestPlan ||
      !currentScopeSignature
    ) {
      return;
    }

    const cachedPlan = localStorage.getItem(buildPlanCacheKey(releaseId, currentScopeSignature));
    if (!cachedPlan) {
      return;
    }

    try {
      const parsedPlan = JSON.parse(cachedPlan);
      setWorkflowState((prev) => ({
        ...prev,
        step2Complete: true,
        step3Complete: Boolean(parsedPlan?.approval_metadata?.approved_at),
        generatedTestPlan: parsedPlan,
        strategyScopeSignature: currentScopeSignature,
      }));
    } catch {
      localStorage.removeItem(buildPlanCacheKey(releaseId, currentScopeSignature));
    }
  }, [
    currentScopeSignature,
    normalizedWorkflowState.generatedTestPlan,
    normalizedWorkflowState.step1Complete,
    releaseId,
  ]);

  useEffect(() => {
    if (!releaseId) {
      return;
    }

    if (
      !normalizedWorkflowState.step1Complete ||
      normalizedWorkflowState.step3Complete ||
      normalizedWorkflowState.generatedTestPlan?.approval_metadata?.approved_at !== undefined ||
      !currentScopeSignature
    ) {
      return;
    }

    const cachedApprovedPlan = localStorage.getItem(buildApprovedPlanCacheKey(releaseId, currentScopeSignature));
    if (!cachedApprovedPlan) {
      return;
    }

    try {
      const parsedApprovedPlan = JSON.parse(cachedApprovedPlan);
      setWorkflowState((prev) => ({
        ...prev,
        step2Complete: true,
        step3Complete: true,
        generatedTestPlan: parsedApprovedPlan,
        strategyScopeSignature: currentScopeSignature,
      }));
    } catch {
      localStorage.removeItem(buildApprovedPlanCacheKey(releaseId, currentScopeSignature));
    }
  }, [
    currentScopeSignature,
    normalizedWorkflowState.generatedTestPlan,
    normalizedWorkflowState.step1Complete,
    normalizedWorkflowState.step3Complete,
    releaseId,
  ]);

  const { data: release, isLoading } = useQuery({
    queryKey: ['release', releaseId],
    queryFn: async () => {
      if (!releaseId) return null;
      const response = await releaseService.getById(parseInt(releaseId, 10));
      return response.data;
    },
    enabled: !!releaseId,
    refetchOnWindowFocus: false,
  });

  const { data: permissions } = useQuery({
    queryKey: ['permissions', releaseId],
    queryFn: async () => {
      if (!releaseId) return null;
      const response = await releaseService.getPermissions(parseInt(releaseId, 10));
      return response.data;
    },
    enabled: !!releaseId,
    refetchOnWindowFocus: false,
  });

  const isReadOnly = permissions ? (!permissions.can_edit && !permissions.is_owner) : false;

  const requestedStep = useMemo(() => {
    const parsedStep = Number(searchParams.get('step'));
    return parsedStep >= 1 && parsedStep <= 4 ? (parsedStep as 1 | 2 | 3 | 4) : null;
  }, [searchParams]);

  useEffect(() => {
    const serializedState = JSON.stringify(normalizedWorkflowState);
    if (lastPersistedStateRef.current === serializedState) {
      return;
    }

    const persistState = () => {
      localStorage.setItem(`workflow_${releaseId}`, serializedState);
      lastPersistedStateRef.current = serializedState;
    };

    const timeoutId = window.setTimeout(persistState, 150);
    return () => window.clearTimeout(timeoutId);
  }, [normalizedWorkflowState, releaseId]);

  const progress = useMemo(() => {
    const completedSteps = [
      normalizedWorkflowState.step1Complete,
      normalizedWorkflowState.step2Complete,
      normalizedWorkflowState.step3Complete,
      normalizedWorkflowState.step4Complete,
    ].filter(Boolean).length;
    return (completedSteps / 4) * 100;
  }, [
    normalizedWorkflowState.step1Complete,
    normalizedWorkflowState.step2Complete,
    normalizedWorkflowState.step3Complete,
    normalizedWorkflowState.step4Complete,
  ]);

  const goToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    if (step > 1 && !normalizedWorkflowState.step1Complete) return;
    if (step > 2 && !normalizedWorkflowState.step2Complete) return;
    if (step > 3 && !normalizedWorkflowState.step3Complete) return;
    setWorkflowState((prev) => ({ ...prev, currentStep: step }));
  }, [normalizedWorkflowState.step1Complete, normalizedWorkflowState.step2Complete, normalizedWorkflowState.step3Complete]);

  useEffect(() => {
    if (!requestedStep || requestedStep === normalizedWorkflowState.currentStep) {
      return;
    }

    if (requestedStep > 1 && !normalizedWorkflowState.step1Complete) {
      return;
    }
    if (requestedStep > 2 && !normalizedWorkflowState.step2Complete) {
      return;
    }
    if (requestedStep > 3 && !normalizedWorkflowState.step3Complete) {
      return;
    }

    setWorkflowState((prev) => ({ ...prev, currentStep: requestedStep }));
    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      nextParams.delete('step');
      return nextParams;
    }, { replace: true });
  }, [
    normalizedWorkflowState.currentStep,
    normalizedWorkflowState.step1Complete,
    normalizedWorkflowState.step2Complete,
    normalizedWorkflowState.step3Complete,
    requestedStep,
    setSearchParams,
  ]);

  const nextStep = () => {
    if (normalizedWorkflowState.currentStep < 4) {
      setWorkflowState((prev) => ({
        ...prev,
        currentStep: (prev.currentStep + 1) as 1 | 2 | 3 | 4,
      }));
    }
  };

  const previousStep = () => {
    if (normalizedWorkflowState.currentStep > 1) {
      setWorkflowState((prev) => ({
        ...prev,
        currentStep: (prev.currentStep - 1) as 1 | 2 | 3 | 4,
      }));
    }
  };

  const handleStep1Complete = useCallback((data: { tickets: any[]; testCases: any[] }) => {
    startTransition(() => {
      setWorkflowState((prev) => {
        const nextScopeSignature = buildScopeSignature(data.tickets, data.testCases);
        const previousScopeSignature = prev.strategyScopeSignature || buildScopeSignature(prev.selectedTickets, prev.selectedTestCases);
        const existingStrategyStillValid =
          Boolean(prev.generatedTestPlan) &&
          previousScopeSignature === nextScopeSignature;
        const scopeChanged =
          !existingStrategyStillValid &&
          (
            !haveSameIds(prev.selectedTickets, data.tickets) ||
            !haveSameIds(prev.selectedTestCases, data.testCases)
          );
        const nextStep1Complete = data.tickets.length > 0;

        if (
          !scopeChanged &&
          prev.step1Complete === nextStep1Complete &&
          haveSameIds(prev.selectedTickets, data.tickets) &&
          haveSameIds(prev.selectedTestCases, data.testCases)
        ) {
          return prev;
        }

        return {
          ...prev,
          currentStep: data.tickets.length === 0 ? 1 : prev.currentStep,
          step1Complete: nextStep1Complete,
          step2Complete: scopeChanged ? false : prev.step2Complete,
          step3Complete: scopeChanged ? false : prev.step3Complete,
          step4Complete: scopeChanged ? false : prev.step4Complete,
          selectedTickets: data.tickets,
          selectedTestCases: data.testCases,
          generatedTestPlan: scopeChanged ? null : prev.generatedTestPlan,
          strategyScopeSignature: scopeChanged
            ? null
            : existingStrategyStillValid
              ? nextScopeSignature
              : previousScopeSignature,
          teamAssignments: scopeChanged ? null : prev.teamAssignments,
          testProgress: scopeChanged ? null : prev.testProgress,
        };
      });
    });
  }, []);

  const handleStep2Complete = useCallback((testPlan: any) => {
    const currentScopeSignature = buildScopeSignature(
      normalizedWorkflowState.selectedTickets,
      normalizedWorkflowState.selectedTestCases
    );
    const newScenarios = (testPlan.new_test_scenarios || testPlan.test_scenarios || []).map((scenario: any, index: number) => ({
      id: index + 1,
      test_case_id: scenario.id || `TS-${String(index + 1).padStart(3, '0')}`,
      title: scenario.title || scenario.name || 'Untitled scenario',
      description: scenario.description || '',
      section: scenario.section || 'New Test Scenarios',
      priority: scenario.priority || 'medium',
      related_ticket: scenario.related_tickets?.[0] || '',
      source: 'ai_generated' as const,
      steps: scenario.test_steps || scenario.steps || [],
    }));

    const existingTestCases: any[] = [];
    let currentId = newScenarios.length + 1;

    (testPlan.test_suites || []).forEach((suite: any) => {
      (suite.test_cases || []).forEach((testCase: any) => {
        existingTestCases.push({
          id: currentId++,
          test_case_id: testCase.id || `TC-${currentId}`,
          title: testCase.title || `Test Case ${testCase.id || currentId}`,
          description: suite.description || `Regression coverage from ${suite.suite_name || 'suite'}`,
          section: testCase.section || suite.suite_name || 'Regression Suite',
          priority: String(testCase.priority || suite.priority || 'medium').toLowerCase(),
          related_ticket: '',
          source: 'testrail_existing' as const,
          steps: [],
        });
      });
    });

    const allTestCases = [...newScenarios, ...existingTestCases];
    const transformedTestPlan = {
      ...testPlan,
      test_cases: allTestCases,
      summary: {
        total_tests: allTestCases.length,
        new_scenarios: newScenarios.length,
        existing_regression_tests: existingTestCases.length,
      },
    };

    setWorkflowState((prev) =>
      persistWorkflowStateImmediately({
        ...prev,
        step2Complete: true,
        generatedTestPlan: transformedTestPlan,
        strategyScopeSignature: currentScopeSignature,
      })
    );
    if (releaseId) {
      localStorage.setItem(
        buildPlanCacheKey(releaseId, currentScopeSignature),
        JSON.stringify(transformedTestPlan)
      );
    }
  }, [normalizedWorkflowState.selectedTestCases, normalizedWorkflowState.selectedTickets, persistWorkflowStateImmediately]);

  const handleStep3Complete = useCallback((approvedTestPlan: any) => {
    const currentApprovedScopeSignature = buildScopeSignature(
      normalizedWorkflowState.selectedTickets,
      normalizedWorkflowState.selectedTestCases
    );
    setWorkflowState((prev) =>
      persistWorkflowStateImmediately({
        ...prev,
        step2Complete: true,
        step3Complete: true,
        generatedTestPlan: approvedTestPlan,
        strategyScopeSignature: currentApprovedScopeSignature,
      })
    );
    if (releaseId) {
      localStorage.setItem(
        buildApprovedPlanCacheKey(releaseId, currentApprovedScopeSignature),
        JSON.stringify(approvedTestPlan)
      );
    }
  }, [normalizedWorkflowState.selectedTestCases, normalizedWorkflowState.selectedTickets, persistWorkflowStateImmediately, releaseId]);

  const handleStep4Complete = useCallback(() => {
    setWorkflowState((prev) =>
      persistWorkflowStateImmediately({
        ...prev,
        step4Complete: true,
      })
    );
    navigateToRelease();
  }, [navigateToRelease, persistWorkflowStateImmediately]);

  const canProceedToNext = () => {
    switch (normalizedWorkflowState.currentStep) {
      case 1:
        return normalizedWorkflowState.step1Complete && normalizedWorkflowState.selectedTickets.length > 0;
      case 2:
        return normalizedWorkflowState.step2Complete && normalizedWorkflowState.generatedTestPlan;
      case 3:
        return normalizedWorkflowState.step3Complete && normalizedWorkflowState.generatedTestPlan;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!release) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Release not found</Alert>
      </Container>
    );
  }

  const currentCopy = STEP_COPY[normalizedWorkflowState.currentStep];
  const planStatusLabel = !normalizedWorkflowState.step1Complete
    ? 'Scope Needed'
    : normalizedWorkflowState.generatedTestPlan
      ? 'Ready'
      : 'Not Started';
  const headerStatusCards = [
    {
      label: 'Current Step',
      value: `Step ${normalizedWorkflowState.currentStep} of 4`,
      helper: currentCopy.eyebrow,
      tone: '#0F172A',
      bg: '#F8FAFC',
    },
    {
      label: 'Plan Status',
      value: planStatusLabel,
      helper: normalizedWorkflowState.step1Complete
        ? 'Workflow state is aligned with the current release scope.'
        : 'Select release tickets to unlock planning.',
      tone: '#EA580C',
      bg: '#FFF7ED',
    },
    {
      label: 'Release Health',
      value: `${Math.round(progress)}%`,
      helper: normalizedWorkflowState.currentStep === 1
        ? 'Scoping and coverage confirmation in progress.'
        : normalizedWorkflowState.currentStep === 2
          ? 'Plan generation is underway.'
          : normalizedWorkflowState.currentStep === 3
            ? 'Approval is in progress.'
            : 'Execution progress is being tracked.',
      tone: SUITECRAFT_TOKENS.colors.primary,
      bg: '#EFF6FF',
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'transparent',
      }}
    >
      <Container maxWidth="xl" sx={{ py: 3, pb: 18 }}>
        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.25, md: 2.75 },
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.62)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.40) 0%, rgba(245,250,251,0.20) 100%)',
              backdropFilter: 'blur(24px) saturate(165%)',
              boxShadow: '0 18px 44px rgba(13, 28, 33, 0.08), inset 0 1px 0 rgba(255,255,255,0.74)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0) 52%)',
                pointerEvents: 'none',
              },
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
                  <Button
                    startIcon={<ArrowBack />}
                    onClick={navigateToRelease}
                    sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 0 }}
                  >
                    Back to Release Overview
                  </Button>

                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip label={currentCopy.eyebrow} size="small" sx={{ bgcolor: 'rgba(255, 88, 65, 0.1)', color: SUITECRAFT_TOKENS.colors.primary, fontWeight: 700 }} />
                    <Chip label={release.release_version} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                    <Chip label={release.status} size="small" sx={{ textTransform: 'capitalize', fontWeight: 700 }} />
                  </Stack>

                  <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                      {release.release_name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 780, lineHeight: 1.65 }}>
                      {currentCopy.title}
                    </Typography>
                    {release.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, maxWidth: 720 }}>
                        {release.description}
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Box
                  sx={{
                    width: { xs: '100%', md: 320 },
                    alignSelf: 'stretch',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.54)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(248,251,252,0.16) 100%)',
                    backdropFilter: 'blur(22px)',
                    p: 2,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 }}>
                      Release Health
                    </Typography>
                    <Typography variant="h3" fontWeight={800} color={SUITECRAFT_TOKENS.colors.primary}>
                      {Math.round(progress)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {normalizedWorkflowState.currentStep === 1 && 'Scoping the release and confirming coverage context.'}
                      {normalizedWorkflowState.currentStep === 2 && 'Building a plan from the approved release scope.'}
                      {normalizedWorkflowState.currentStep === 3 && 'Validating the final plan before execution.'}
                      {normalizedWorkflowState.currentStep === 4 && 'Tracking execution progress and release readiness.'}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        bgcolor: 'rgba(148, 163, 184, 0.18)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 999,
                          bgcolor: SUITECRAFT_TOKENS.colors.primary,
                        },
                      }}
                    />
                  </Stack>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                {headerStatusCards.map((card) => (
                  <Paper
                    key={card.label}
                    elevation={0}
                    sx={{
                      p: 1.75,
                      flex: 1,
                      borderRadius: 3,
                      bgcolor: `${card.bg}CC`,
                      backdropFilter: 'blur(18px)',
                      border: '1px solid rgba(255,255,255,0.44)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)',
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.45, color: '#64748B', fontWeight: 700 }}>
                      {card.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ color: card.tone, mb: 0.25 }}>
                      {card.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.helper}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>

          {isReadOnly && (
            <Alert severity="info" icon={<WarningIcon />} sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.52)', backdropFilter: 'blur(16px)' }}>
              <Typography variant="body2" fontWeight={700}>
                You're viewing this workflow in read-only mode.
              </Typography>
              <Typography variant="body2">
                Only the release owner or collaborators can make changes. You can still review the workflow state and coverage choices.
              </Typography>
            </Alert>
          )}

          <Box
            sx={{
              position: 'fixed',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1100,
              display: { xs: 'none', xl: 'block' },
            }}
          >
            <Stack spacing={1.25} alignItems="flex-start">
              <Paper
                elevation={0}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.62)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(248,251,252,0.18) 100%)',
                  backdropFilter: 'blur(22px)',
                  boxShadow: '0 14px 30px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.78)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, letterSpacing: '0.08em' }}>
                  WORKFLOW
                </Typography>
              </Paper>

              <WorkflowStepper
                currentStep={normalizedWorkflowState.currentStep}
                completedSteps={{
                  step1: normalizedWorkflowState.step1Complete,
                  step2: normalizedWorkflowState.step2Complete,
                  step3: normalizedWorkflowState.step3Complete,
                  step4: normalizedWorkflowState.step4Complete,
                }}
                onStepClick={goToStep}
              />
            </Stack>
          </Box>

          <Stack spacing={2} sx={{ display: { xs: 'flex', xl: 'none' } }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                Workflow Stages
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use the footer below to move between release stages.
              </Typography>
            </Box>
            <WorkflowStepper
              currentStep={normalizedWorkflowState.currentStep}
              completedSteps={{
                step1: normalizedWorkflowState.step1Complete,
                step2: normalizedWorkflowState.step2Complete,
                step3: normalizedWorkflowState.step3Complete,
                step4: normalizedWorkflowState.step4Complete,
              }}
              onStepClick={goToStep}
            />
          </Stack>

          <Box sx={{ minWidth: 0, width: '100%' }}>
              {normalizedWorkflowState.currentStep === 1 && (
                <ImportTicketsStep
                  releaseId={releaseId!}
                  releaseVersion={release?.release_version}
                  selectedTickets={normalizedWorkflowState.selectedTickets}
                  selectedTestCases={normalizedWorkflowState.selectedTestCases}
                  onComplete={handleStep1Complete}
                  isReadOnly={isReadOnly}
                />
              )}

              {normalizedWorkflowState.currentStep === 2 && (
                <GenerateTestsStep
                  releaseId={releaseId!}
                  selectedTickets={normalizedWorkflowState.selectedTickets}
                  selectedTestCases={normalizedWorkflowState.selectedTestCases}
                  existingTestPlan={normalizedWorkflowState.generatedTestPlan}
                  onComplete={handleStep2Complete}
                  isReadOnly={isReadOnly}
                  releaseInfo={{
                    release_name: release.release_name,
                    release_version: release.release_version,
                  }}
                />
              )}

              {normalizedWorkflowState.currentStep === 3 && (
                <ReviewTestPlanStep
                  releaseId={releaseId!}
                  testPlan={normalizedWorkflowState.generatedTestPlan}
                  onComplete={handleStep3Complete}
                  isReadOnly={isReadOnly}
                />
              )}

              {normalizedWorkflowState.currentStep === 4 && (
                <RunTestsStep
                  releaseId={releaseId!}
                  testPlan={normalizedWorkflowState.generatedTestPlan}
                  assignments={normalizedWorkflowState.teamAssignments}
                  onComplete={handleStep4Complete}
                  isReadOnly={isReadOnly}
                />
              )}
          </Box>
        </Stack>

        <Box
          sx={{
            position: 'fixed',
            left: { xs: 0, md: 0 },
            right: { xs: 0, md: 0 },
            bottom: { xs: 0, md: 0 },
            zIndex: 1200,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Paper
            elevation={6}
            sx={{
              width: '100%',
              maxWidth: '100%',
              p: { xs: 1.4, md: 1.75 },
              bgcolor: 'rgba(255, 255, 255, 0.34)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(244,249,250,0.18) 100%)',
              backdropFilter: 'blur(26px) saturate(175%)',
              border: '1px solid rgba(255,255,255,0.62)',
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 14px 36px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255,255,255,0.78)',
              pointerEvents: 'auto',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 42%)',
                pointerEvents: 'none',
              },
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Stack spacing={0.35}>
                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700, letterSpacing: '0.08em' }}>
                  CURRENT STEP
                </Typography>
                <Typography variant="h6" fontWeight={800} color="#0F172A">
                  Step {normalizedWorkflowState.currentStep} of 4 - {currentCopy.eyebrow}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {currentCopy.description}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={previousStep}
                  disabled={normalizedWorkflowState.currentStep === 1}
                  sx={{ textTransform: 'none', px: 3.5, borderRadius: 999, minWidth: 140 }}
                >
                  Previous
                </Button>

                <Button
                  variant="contained"
                  onClick={normalizedWorkflowState.currentStep === 4 ? handleStep4Complete : nextStep}
                  disabled={!canProceedToNext() || isReadOnly}
                  startIcon={normalizedWorkflowState.currentStep === 4 ? <CheckIcon /> : null}
                  sx={{
                    textTransform: 'none',
                    px: 3.5,
                    minWidth: 140,
                    borderRadius: 999,
                    bgcolor: SUITECRAFT_TOKENS.colors.primary,
                    '&:hover': {
                      bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
                    },
                  }}
                >
                  {normalizedWorkflowState.currentStep === 4 ? 'Complete Release' : 'Continue'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
