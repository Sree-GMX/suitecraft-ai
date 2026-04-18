import type { DashboardMetrics, TestRunSummary } from '../services/api';

export type ReleaseWorkflowStatus =
  | 'planning'
  | 'in_progress'
  | 'testing'
  | 'ready'
  | 'deployed'
  | 'cancelled';

type WorkflowStepProgress = {
  completed: number;
  total: number;
  progress: number;
  helper: string;
};

export type ReleaseWorkflowSummary = {
  effectiveStatus: ReleaseWorkflowStatus;
  overallProgress: number;
  workflowProgress: {
    importTickets: WorkflowStepProgress;
    generateTests: WorkflowStepProgress;
    assignTeam: WorkflowStepProgress;
    runTests: WorkflowStepProgress;
  };
};

type ReleaseWorkflowInputs = {
  releaseStatus?: string | null;
  metrics?: DashboardMetrics | null;
  testRuns?: TestRunSummary[] | null;
};

const TERMINAL_STATUSES: ReleaseWorkflowStatus[] = ['cancelled', 'deployed'];

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function getReleaseWorkflowSummary({
  releaseStatus,
  metrics,
  testRuns,
}: ReleaseWorkflowInputs): ReleaseWorkflowSummary {
  const scopedItems = metrics?.feature_breakdown?.total || 0;
  const generatedSuites = metrics?.test_suite_summary?.total_suites || 0;
  const generatedTests = metrics?.test_suite_summary?.total_test_cases || 0;
  const coverageProgress = metrics?.regression_coverage_percentage || 0;
  const availableRuns = testRuns || [];

  const latestRun = [...availableRuns].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const hasExecutionSet = availableRuns.length > 0;
  const executedCount = latestRun?.executed_count || 0;
  const executionTotal = latestRun?.total_test_cases || generatedTests;
  const failedCount = latestRun?.failed_count || 0;
  const pendingExecutions = Math.max(executionTotal - executedCount, 0);

  const workflowProgress = {
    importTickets: {
      completed: scopedItems,
      total: Math.max(scopedItems, 1),
      progress: scopedItems > 0 ? 100 : 0,
      helper: scopedItems > 0 ? `${scopedItems} scoped release items` : 'Scope not created yet',
    },
    generateTests: {
      completed: generatedTests,
      total: Math.max(generatedTests, 1),
      progress: generatedSuites > 0 ? Math.max(35, clampProgress(coverageProgress)) : 0,
      helper:
        generatedSuites > 0
          ? `${generatedSuites} suites covering ${generatedTests} tests`
          : 'Strategy has not been generated yet',
    },
    assignTeam: {
      completed: hasExecutionSet ? 1 : 0,
      total: 1,
      progress: hasExecutionSet ? 100 : generatedTests > 0 ? 45 : 0,
      helper: hasExecutionSet
        ? `${availableRuns.length} execution run${availableRuns.length > 1 ? 's' : ''} created`
        : 'Approval not converted into an execution run yet',
    },
    runTests: {
      completed: executedCount,
      total: Math.max(executionTotal, 1),
      progress: executionTotal > 0 ? clampProgress((executedCount / executionTotal) * 100) : 0,
      helper: latestRun
        ? `${latestRun.name} • ${failedCount} failed • ${pendingExecutions} pending`
        : 'Execution has not started yet',
    },
  };

  const overallProgress = clampProgress(
    (workflowProgress.importTickets.progress +
      workflowProgress.generateTests.progress +
      workflowProgress.assignTeam.progress +
      workflowProgress.runTests.progress) / 4
  );

  let effectiveStatus: ReleaseWorkflowStatus = 'planning';

  if (releaseStatus && TERMINAL_STATUSES.includes(releaseStatus as ReleaseWorkflowStatus)) {
    effectiveStatus = releaseStatus as ReleaseWorkflowStatus;
  } else if (latestRun) {
    effectiveStatus =
      executionTotal > 0 && executedCount >= executionTotal ? 'ready' : 'testing';
  } else if (generatedSuites > 0 || generatedTests > 0 || scopedItems > 0) {
    effectiveStatus = 'in_progress';
  }

  return {
    effectiveStatus,
    overallProgress,
    workflowProgress,
  };
}
