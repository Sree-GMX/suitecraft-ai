import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as AiIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  FactCheck as RegressionIcon,
  PlaylistAddCheck as ApprovalIcon,
  Save as SaveIcon,
  WarningAmber as RiskIcon,
} from '@mui/icons-material';
import { SUITECRAFT_TOKENS } from '../../../styles/theme';

interface ReviewTestPlanStepProps {
  releaseId: string;
  testPlan: any;
  onComplete: (approvedTestPlan: any) => void;
  isReadOnly: boolean;
}

interface TestCase {
  id: number;
  test_case_id: string;
  title: string;
  description: string;
  section: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  related_ticket?: string;
  source: 'ai_generated' | 'testrail_existing';
  steps: { action: string; expected: string }[];
}

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  { value: 'high', label: 'High', color: '#EA580C', bg: '#FFF7ED' },
  { value: 'medium', label: 'Medium', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'low', label: 'Low', color: '#0F766E', bg: '#ECFDF5' },
] as const;

export default function ReviewTestPlanStep({
  releaseId,
  testPlan: initialTestPlan,
  onComplete,
  isReadOnly,
}: ReviewTestPlanStepProps) {
  const [testPlan, setTestPlan] = useState(initialTestPlan);
  const [editMode, setEditMode] = useState(false);
  const [editingTest, setEditingTest] = useState<TestCase | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai_generated' | 'testrail_existing'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialTestPlan !== testPlan) {
      setTestPlan(initialTestPlan);
    }
  }, [initialTestPlan, testPlan]);

  const [editForm, setEditForm] = useState<Partial<TestCase>>({
    test_case_id: '',
    title: '',
    description: '',
    section: 'Manual Review',
    priority: 'medium',
    steps: [{ action: '', expected: '' }],
  });

  if (!testPlan || !testPlan.test_cases) {
    return (
      <Paper elevation={0} sx={emptyStateSx}>
        <Stack direction="row" spacing={2} alignItems="center">
          <ApprovalIcon sx={{ fontSize: 40, color: SUITECRAFT_TOKENS.colors.secondary }} />
          <Box>
            <Typography variant="h6" fontWeight={800}>No Test Plan Available</Typography>
            <Typography variant="body2" color="text.secondary">
              Please generate a release strategy in Step 2 before reviewing the approval set.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }

  const allTests: TestCase[] = testPlan.test_cases || [];
  const summary = testPlan.summary || {};
  const strategyInsights = testPlan.strategy_insights || {};
  const riskAssessment = testPlan.risk_assessment || {};
  const executionStrategy = testPlan.execution_strategy || {};

  const filteredTests = useMemo(() => {
    return allTests.filter((test) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery = !query || [
        test.test_case_id,
        test.title,
        test.description,
        test.section,
        test.related_ticket,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const matchesSource = sourceFilter === 'all' || test.source === sourceFilter;
      const matchesPriority = priorityFilter === 'all' || test.priority === priorityFilter;
      return matchesQuery && matchesSource && matchesPriority;
    });
  }, [allTests, searchQuery, sourceFilter, priorityFilter]);

  const groupedTests = useMemo(() => {
    const criticalPathIds = new Set(
      (executionStrategy.critical_path || []).flatMap((suite: any) =>
        (suite.test_cases || []).map((testCase: any) => String(testCase.id))
      )
    );

    const groups = [
      {
        key: 'critical',
        title: 'Critical Approval',
        subtitle: 'Must-pass and high-priority coverage to validate first.',
        tests: filteredTests.filter((test) => criticalPathIds.has(String(test.test_case_id)) || ['critical', 'high'].includes(test.priority)),
        tone: '#DC2626',
      },
      {
        key: 'new',
        title: 'New Scenarios',
        subtitle: 'AI-added scenarios that need human validation before signoff.',
        tests: filteredTests.filter((test) => test.source === 'ai_generated'),
        tone: SUITECRAFT_TOKENS.colors.secondary,
      },
      {
        key: 'regression',
        title: 'Existing Regression',
        subtitle: 'Previously known regression coverage included from Step 1 and Step 2 strategy.',
        tests: filteredTests.filter((test) => test.source === 'testrail_existing'),
        tone: '#2563EB',
      },
    ];

    return groups.filter((group) => group.tests.length > 0);
  }, [filteredTests, executionStrategy]);

  const toggleExpand = (testId: number) => {
    const next = new Set(expandedTests);
    if (next.has(testId)) {
      next.delete(testId);
    } else {
      next.add(testId);
    }
    setExpandedTests(next);
  };

  const handleEditClick = (test: TestCase) => {
    setEditingTest(test);
    setEditForm(test);
  };

  const resetForm = () => {
    setEditForm({
      test_case_id: '',
      title: '',
      description: '',
      section: 'Manual Review',
      priority: 'medium',
      steps: [{ action: '', expected: '' }],
    });
  };

  const handleSaveEdit = () => {
    if (!editingTest) return;
    const updatedTestCases = allTests.map((tc) => (tc.id === editingTest.id ? { ...tc, ...editForm } : tc));
    setTestPlan(clearApprovalState({ ...testPlan, test_cases: updatedTestCases, summary: buildSummary(updatedTestCases) }));
    setEditingTest(null);
    resetForm();
  };

  const handleAddTest = () => {
    const newTest: TestCase = {
      id: Math.max(...allTests.map((tc) => tc.id), 0) + 1,
      test_case_id: editForm.test_case_id || `TC-${Date.now()}`,
      title: editForm.title || '',
      description: editForm.description || '',
      section: editForm.section || 'Manual Review',
      priority: (editForm.priority as TestCase['priority']) || 'medium',
      source: 'ai_generated',
      related_ticket: editForm.related_ticket || '',
      steps: editForm.steps || [{ action: '', expected: '' }],
    };

    const updatedTestCases = [...allTests, newTest];
    setTestPlan(clearApprovalState({ ...testPlan, test_cases: updatedTestCases, summary: buildSummary(updatedTestCases) }));
    setShowAddDialog(false);
    resetForm();
  };

  const handleDeleteTest = (testId: number) => {
    const updatedTestCases = allTests.filter((tc) => tc.id !== testId);
    setTestPlan(clearApprovalState({ ...testPlan, test_cases: updatedTestCases, summary: buildSummary(updatedTestCases) }));
    setShowDeleteConfirm(null);
  };

  const addStep = () => setEditForm({ ...editForm, steps: [...(editForm.steps || []), { action: '', expected: '' }] });

  const updateStep = (index: number, field: 'action' | 'expected', value: string) => {
    const steps = [...(editForm.steps || [])];
    steps[index][field] = value;
    setEditForm({ ...editForm, steps });
  };

  const removeStep = (index: number) => {
    const steps = (editForm.steps || []).filter((_, i) => i !== index);
    setEditForm({ ...editForm, steps: steps.length > 0 ? steps : [{ action: '', expected: '' }] });
  };

  const handleApprove = () => {
    const approvedPlan = {
      ...testPlan,
      approval_metadata: {
        approved_at: new Date().toISOString(),
        approved_tests: allTests.length,
      },
    };
    onComplete(approvedPlan);
  };

  const newScenarioCount = allTests.filter((test) => test.source === 'ai_generated').length;
  const regressionCount = allTests.filter((test) => test.source === 'testrail_existing').length;
  const highPriorityCount = allTests.filter((test) => ['critical', 'high'].includes(test.priority)).length;
  const coverageLabel = summary.total_tests || allTests.length;
  const attentionCount = allTests.filter((test) => test.source === 'ai_generated' || test.priority === 'critical').length;
  const approvalReady = allTests.length > 0 && highPriorityCount > 0;
  const isApproved = Boolean(testPlan.approval_metadata?.approved_at);
  const PAGE_SIZE = 8;
  const approvalRecommendation = approvalReady
    ? `Approve only after the ${newScenarioCount} new scenario${newScenarioCount === 1 ? '' : 's'} and ${highPriorityCount} must-pass test${highPriorityCount === 1 ? '' : 's'} look justified.`
    : 'This set still needs stronger must-pass coverage before it should move into execution.';

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={glassPanelSx}>
        <Stack spacing={2.25}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
            <Box sx={{ maxWidth: 760 }}>
              <Typography variant="overline" sx={overlineSx}>Step 3 - Review & Approve</Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                Turn the generated strategy into an approved execution set.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                This step is where we validate the plan before execution: confirm the must-pass coverage,
                challenge any weak AI scenarios, remove noise, and approve only the tests that should reach execution.
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                minWidth: { lg: 280 },
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.4)',
                bgcolor: approvalReady ? 'rgba(236,253,245,0.82)' : 'rgba(255,247,237,0.84)',
              }}
            >
              <Typography variant="caption" sx={overlineSx}>APPROVAL STATUS</Typography>
              <Typography variant="body1" fontWeight={800} sx={{ color: approvalReady ? '#166534' : '#B45309', mb: 0.35 }}>
                {isApproved ? 'Approved for execution' : approvalReady ? 'Ready for signoff review' : 'Needs more review'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                {isApproved
                  ? 'You can keep reviewing this approved plan here, then use Continue when you want to move to Step 4.'
                  : approvalRecommendation}
              </Typography>
            </Paper>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <SummaryCard label="Tests In Review" value={coverageLabel} tone="#2563EB" bg="#EFF6FF" />
            <SummaryCard label="New Scenarios" value={newScenarioCount} tone={SUITECRAFT_TOKENS.colors.secondary} bg="#FFF1EC" />
            <SummaryCard label="Must-Pass Focus" value={highPriorityCount} tone="#B45309" bg="#FFF7ED" />
            <SummaryCard label="Needs Attention" value={attentionCount} tone={approvalReady ? '#166534' : '#B45309'} bg={approvalReady ? '#ECFDF5' : '#FFF7ED'} />
          </Stack>

          <Paper elevation={0} sx={readinessPanelSx(approvalReady)}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={overlineSx}>APPROVAL READINESS</Typography>
                <Typography variant="body1" fontWeight={800} sx={{ color: approvalReady ? '#166534' : '#B45309', mb: 0.35 }}>
                  {isApproved
                    ? 'This plan has been approved and is ready for execution when you are.'
                    : approvalReady
                      ? 'The plan is structured well enough for signoff review.'
                      : 'The plan still needs more review before approval.'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  {isApproved
                    ? 'Stay on this screen if you want to double-check the approval set. Use the workflow Continue button only when you want to enter Step 4.'
                    : approvalReady
                    ? `Prioritize the ${highPriorityCount} must-pass tests, challenge the ${newScenarioCount} new scenarios, and confirm the rest is the right-sized regression set for this release.`
                    : 'Make sure at least the critical and high-priority coverage is clearly represented before approving execution.'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.7, color: isApproved || approvalReady ? '#166534' : '#B45309', fontWeight: 700 }}>
                  Recommendation: {isApproved ? 'Review freely here, then continue to Step 4 when ready.' : approvalRecommendation}
                </Typography>
              </Box>
              <Stack spacing={0.75} sx={{ minWidth: { lg: 320 } }}>
                <NeedsAttentionChip label="Needs attention" value={attentionCount} tone="#B45309" />
                <NeedsAttentionChip label="AI-added scenarios" value={newScenarioCount} tone={SUITECRAFT_TOKENS.colors.secondary} />
                <NeedsAttentionChip label="Critical tests" value={allTests.filter((test) => test.priority === 'critical').length} tone="#DC2626" />
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={subtlePanelSx}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" sx={overlineSx}>APPROVAL GUIDANCE</Typography>
                <Typography variant="body1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.4 }}>
                  Start with critical-path and high-priority coverage.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  {riskAssessment.risk_narrative || strategyInsights.risk_narrative || 'Review the riskiest coverage first, then validate whether the new scenarios and broader regression remain proportionate to the release scope.'}
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25}>
                <InsightCard
                  title="Go-live concerns"
                  value={(strategyInsights.go_live_concerns || []).slice(0, 2).join(', ') || 'No explicit concerns were returned.'}
                />
                <InsightCard
                  title="Coverage confidence"
                  value={testPlan.coverage_confidence?.label || 'Review manually'}
                />
                <InsightCard
                  title="Team hint"
                  value={testPlan.team_guidance?.assignment_hint || 'Assign stronger testers to must-pass coverage first.'}
                />
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={glassPanelSx}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A' }}>
                Approval Workspace
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Filter and inspect the exact execution set that should move into Step 4. Switch to edit mode only when you need to change the plan.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                size="small"
                variant={editMode ? 'contained' : 'outlined'}
                startIcon={<EditIcon />}
                onClick={() => setEditMode((prev) => !prev)}
                disabled={isReadOnly}
                sx={{
                  textTransform: 'none',
                  borderRadius: 999,
                  fontWeight: 700,
                  ...(editMode
                    ? { bgcolor: SUITECRAFT_TOKENS.colors.secondary, '&:hover': { bgcolor: '#E84E37' } }
                    : { color: '#475569' }),
                }}
              >
                {editMode ? 'Exit Edit Mode' : 'Edit Plan'}
              </Button>
              {editMode && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddDialog(true)}
                  disabled={isReadOnly}
                  sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 700, color: SUITECRAFT_TOKENS.colors.secondary }}
                >
                  Add Manual Test
                </Button>
              )}
            </Stack>
          </Stack>

          <Paper elevation={0} sx={subtlePanelSx}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Typography variant="caption" sx={{ ...overlineSx, minWidth: { md: 110 } }}>
                REVIEW FILTERS
              </Typography>
            <TextField
              fullWidth
              size="small"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by ID, title, section, description, or ticket"
            />
            <TextField
              select
              size="small"
              label="Source"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as any)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="all">All Sources</MenuItem>
              <MenuItem value="ai_generated">New Scenarios</MenuItem>
              <MenuItem value="testrail_existing">Regression</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Priority"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as any)}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="all">All Priorities</MenuItem>
              {PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSearchQuery('');
                  setSourceFilter('all');
                  setPriorityFilter('all');
                }}
                sx={{ textTransform: 'none', borderRadius: 999, whiteSpace: 'nowrap' }}
              >
                Reset
              </Button>
            </Stack>
          </Paper>

          {groupedTests.length === 0 ? (
            <Alert severity="info">No tests matched the current review filters.</Alert>
          ) : (
            <Stack spacing={2}>
              {groupedTests.map((group) => (
                <Paper key={group.key} elevation={0} sx={groupPanelSx}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: group.tone, mb: 0.35 }}>
                        {group.title} ({group.tests.length})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{group.subtitle}</Typography>
                    </Box>

                    <Stack spacing={1.25}>
                      {paginateGroup(group.tests, groupPages[group.key] || 1, PAGE_SIZE).map((test) => {
                        const priority = getPriorityConfig(test.priority);
                        const sourceBadge = getSourceBadge(test.source);
                        const expanded = expandedTests.has(test.id);

                        return (
                          <Paper key={test.id} elevation={0} sx={testCardSx(expanded)}>
                            <Stack spacing={1.2}>
                              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between">
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.65 }}>
                                    <Chip label={test.test_case_id} size="small" sx={monoChipSx} />
                                    <Chip label={priority.label} size="small" sx={{ bgcolor: priority.bg, color: priority.color, fontWeight: 700 }} />
                                    <Chip label={sourceBadge.label} size="small" sx={{ bgcolor: sourceBadge.bg, color: sourceBadge.color, fontWeight: 700 }} />
                                    {test.related_ticket && <Chip label={test.related_ticket} size="small" variant="outlined" />}
                                    {(test.source === 'ai_generated' || test.priority === 'critical') && (
                                      <Chip
                                        label={test.priority === 'critical' ? 'Needs Attention' : 'Review New'}
                                        size="small"
                                        sx={{
                                          bgcolor: test.priority === 'critical' ? '#FEF2F2' : '#FFF7ED',
                                          color: test.priority === 'critical' ? '#B91C1C' : '#9A3412',
                                          fontWeight: 700,
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="body1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.35 }}>
                                    {test.title}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: 0.4 }}>
                                    {test.description || 'No description available for this test.'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {test.section || 'General coverage'}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.5} alignItems="flex-start">
                                  <IconButton size="small" onClick={() => toggleExpand(test.id)}>
                                    {expanded ? <CollapseIcon /> : <ExpandIcon />}
                                  </IconButton>
                                  {editMode && (
                                    <>
                                      <IconButton size="small" onClick={() => handleEditClick(test)} disabled={isReadOnly}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" onClick={() => setShowDeleteConfirm(test.id)} disabled={isReadOnly} color="error">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </>
                                  )}
                                </Stack>
                              </Stack>

                              {expanded && (
                                <Paper elevation={0} sx={expandedPanelSx}>
                                  <Stack spacing={1.25}>
                                    <InfoLine label="Review intent" value={test.source === 'ai_generated' ? 'Validate whether this new scenario is really needed before execution.' : 'Confirm this regression test still belongs in the final execution set.'} />
                                    {test.steps && test.steps.length > 0 ? (
                                      <Stack spacing={1}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A' }}>
                                          Test Steps
                                        </Typography>
                                        {test.steps.map((step, index) => (
                                          <Paper key={index} elevation={0} sx={{ p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.26)', border: '1px solid rgba(255,255,255,0.40)', backdropFilter: 'blur(12px)' }}>
                                            <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.25 }}>
                                              Step {index + 1}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700 }}>
                                              {step.action || 'No action defined'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              Expected: {step.expected || 'No expected result defined'}
                                            </Typography>
                                          </Paper>
                                        ))}
                                      </Stack>
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">No detailed steps defined for this test.</Typography>
                                    )}
                                  </Stack>
                                </Paper>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>

                    {group.tests.length > PAGE_SIZE && (
                      <Stack direction="row" justifyContent="flex-end">
                        <Pagination
                          count={Math.ceil(group.tests.length / PAGE_SIZE)}
                          page={groupPages[group.key] || 1}
                          onChange={(_, page) => setGroupPages((prev) => ({ ...prev, [group.key]: page }))}
                          color="primary"
                          shape="rounded"
                          size="small"
                        />
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
      </Stack>
      </Paper>

      <Paper elevation={0} sx={glassPanelSx}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A', mb: 0.35 }}>
              Ready For Execution?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
              Approve only after you’re comfortable that this set is the right size, the must-pass coverage is present, and the new scenarios are justified.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CheckIcon />}
            onClick={handleApprove}
            disabled={isReadOnly || allTests.length === 0 || !approvalReady || isApproved}
            sx={{ ...primaryButtonSx, alignSelf: 'flex-start', width: 'auto', maxWidth: '100%', minWidth: 232 }}
          >
            {isApproved ? 'Approved For Execution' : 'Approve For Execution'}
          </Button>
        </Stack>
      </Paper>

      <TestCaseDialog
        open={editingTest !== null}
        title="Edit Test Case"
        form={editForm}
        onClose={() => {
          setEditingTest(null);
          resetForm();
        }}
        onSave={handleSaveEdit}
        onChange={setEditForm}
        onAddStep={addStep}
        onUpdateStep={updateStep}
        onRemoveStep={removeStep}
        submitLabel="Save Changes"
      />

      <TestCaseDialog
        open={showAddDialog}
        title="Add Manual Test Case"
        form={editForm}
        onClose={() => {
          setShowAddDialog(false);
          resetForm();
        }}
        onSave={handleAddTest}
        onChange={setEditForm}
        onAddStep={addStep}
        onUpdateStep={updateStep}
        onRemoveStep={removeStep}
        submitLabel="Add Test Case"
        disableSubmit={!editForm.title}
      />

      <Dialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ elevation: 0, sx: dialogPaperSx }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={800}>Delete Test Case?</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Remove this test case from the approval set? This should only be done if it genuinely adds noise or duplicates more important coverage.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setShowDeleteConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => showDeleteConfirm && handleDeleteTest(showDeleteConfirm)} sx={{ textTransform: 'none' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function TestCaseDialog({
  open,
  title,
  form,
  onClose,
  onSave,
  onChange,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  submitLabel,
  disableSubmit,
}: any) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: dialogPaperSx }}>
      <DialogTitle>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="Test Case ID" value={form.test_case_id || ''} onChange={(e) => onChange({ ...form, test_case_id: e.target.value })} fullWidth />
          <TextField label="Title" value={form.title || ''} onChange={(e) => onChange({ ...form, title: e.target.value })} fullWidth />
          <TextField label="Description" value={form.description || ''} onChange={(e) => onChange({ ...form, description: e.target.value })} multiline rows={3} fullWidth />
          <TextField label="Section" value={form.section || ''} onChange={(e) => onChange({ ...form, section: e.target.value })} fullWidth />
          <TextField label="Related Ticket" value={form.related_ticket || ''} onChange={(e) => onChange({ ...form, related_ticket: e.target.value })} fullWidth />
          <TextField select label="Priority" value={form.priority || 'medium'} onChange={(e) => onChange({ ...form, priority: e.target.value })} fullWidth>
            {PRIORITY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={800}>Test Steps</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={onAddStep} sx={{ textTransform: 'none' }}>
                Add Step
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {(form.steps || []).map((step: any, index: number) => (
                <Paper key={index} elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.42)', bgcolor: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(14px)' }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center" mb={1}>
                    <Typography variant="caption" fontWeight={700}>Step {index + 1}</Typography>
                    <IconButton size="small" onClick={() => onRemoveStep(index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack spacing={1}>
                    <TextField label="Action" value={step.action || ''} onChange={(e) => onUpdateStep(index, 'action', e.target.value)} fullWidth size="small" />
                    <TextField label="Expected Result" value={step.expected || ''} onChange={(e) => onUpdateStep(index, 'expected', e.target.value)} fullWidth size="small" />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button startIcon={<CancelIcon />} onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={disableSubmit} sx={primaryButtonSx}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SummaryCard({ label, value, tone, bg }: { label: string; value: string | number; tone: string; bg: string }) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 3, border: '1px solid rgba(255,255,255,0.42)', bgcolor: bg, backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700 }}>{label}</Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color: tone }}>{value}</Typography>
    </Paper>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.25 }}>{label}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{value}</Typography>
    </Box>
  );
}

function InsightCard({ title, value }: { title: string; value: string }) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 1.25, borderRadius: 2.5, border: '1px solid rgba(255,255,255,0.44)', bgcolor: 'rgba(255,255,255,0.24)', backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.3 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: '#0F172A', lineHeight: 1.55 }}>{value}</Typography>
    </Paper>
  );
}

function NeedsAttentionChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Paper elevation={0} sx={{ p: 1, borderRadius: 2.5, border: '1px solid rgba(255,255,255,0.44)', bgcolor: 'rgba(255,255,255,0.24)', backdropFilter: 'blur(14px)' }}>
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: tone }}>{value}</Typography>
    </Paper>
  );
}

function paginateGroup<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function buildSummary(testCases: TestCase[]) {
  return {
    total_tests: testCases.length,
    new_scenarios: testCases.filter((test) => test.source === 'ai_generated').length,
    existing_regression_tests: testCases.filter((test) => test.source === 'testrail_existing').length,
  };
}

function clearApprovalState(plan: any) {
  if (!plan?.approval_metadata?.approved_at) {
    return plan;
  }

  return {
    ...plan,
    approval_metadata: {
      ...plan.approval_metadata,
      approved_at: null,
      approved_tests: null,
      approval_invalidated: true,
      approval_invalidated_reason: 'Plan changed after approval and needs re-approval.',
    },
  };
}

function getPriorityConfig(priority: string) {
  return PRIORITY_OPTIONS.find((option) => option.value === priority) || PRIORITY_OPTIONS[2];
}

function getSourceBadge(source: string) {
  return source === 'ai_generated'
    ? { label: 'New Scenario', color: SUITECRAFT_TOKENS.colors.secondary, bg: '#FFF1EC' }
    : { label: 'Regression', color: '#2563EB', bg: '#EFF6FF' };
}

const glassPanelSx = {
  p: 3,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.54)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
  backdropFilter: 'blur(22px)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.74)',
};

const subtlePanelSx = {
  p: 1.75,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.44)',
  bgcolor: 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(16px)',
};

const readinessPanelSx = (ready: boolean) => ({
  p: 1.75,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.44)',
  bgcolor: ready ? 'rgba(236,253,245,0.42)' : 'rgba(255,247,237,0.42)',
  backdropFilter: 'blur(16px)',
});

const emptyStateSx = {
  p: 3,
  border: '1px solid rgba(255,255,255,0.50)',
  borderRadius: 3,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.14) 100%)',
  backdropFilter: 'blur(18px)',
};

const primaryButtonSx = {
  textTransform: 'none',
  borderRadius: 3,
  px: 2.75,
  py: 1.05,
  minHeight: 48,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '0.95rem',
  lineHeight: 1.2,
  bgcolor: SUITECRAFT_TOKENS.colors.primary,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
  '&:hover': {
    bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
  },
};

const overlineSx = {
  color: '#64748B',
  letterSpacing: '0.08em',
  fontWeight: 700,
};

const groupPanelSx = {
  p: 2,
  borderRadius: 3.5,
  border: '1px solid rgba(255,255,255,0.42)',
  bgcolor: 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(14px)',
};

const testCardSx = (expanded: boolean) => ({
  p: 1.5,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.40)',
  bgcolor: expanded ? 'rgba(255,247,237,0.34)' : 'rgba(255,255,255,0.24)',
  backdropFilter: 'blur(14px)',
  boxShadow: expanded ? '0 10px 24px rgba(15, 23, 42, 0.05)' : 'none',
});

const expandedPanelSx = {
  p: 1.5,
  borderRadius: 3,
  bgcolor: 'rgba(255,255,255,0.22)',
  border: '1px solid rgba(255,255,255,0.36)',
  backdropFilter: 'blur(14px)',
};

const monoChipSx = {
  fontWeight: 800,
  fontFamily: 'monospace',
  bgcolor: 'rgba(255,255,255,0.34)',
  color: '#0F172A',
};

const dialogPaperSx = {
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.50)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.18) 100%)',
  backdropFilter: 'blur(22px)',
};
