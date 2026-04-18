import { ReactNode, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Block as BlockedIcon,
  CheckCircle as PassedIcon,
  Close as CloseIcon,
  Error as FailedIcon,
  Info as InfoIcon,
  AutoAwesome as AiIcon,
  SkipNext as SkippedIcon,
} from '@mui/icons-material';
import { OrgRecommendation, testExecutionService, TestExecutionResult } from '../../../services/api';
import { SUITECRAFT_TOKENS } from '../../../styles/theme';

interface TestExecutionModalProps {
  open: boolean;
  onClose: () => void;
  executionId: number;
  onComplete: (executionId: number, status: TestExecutionResult['status'], notes: string) => void;
  isReadOnly: boolean;
  isSubmitting?: boolean;
}

const STATUS_OPTIONS: Array<{
  value: TestExecutionResult['status'];
  label: string;
  icon: ReactNode;
  color: string;
  bg: string;
}> = [
  { value: 'passed', label: 'Passed', icon: <PassedIcon />, color: '#059669', bg: '#ECFDF5' },
  { value: 'failed', label: 'Failed', icon: <FailedIcon />, color: '#DC2626', bg: '#FEF2F2' },
  { value: 'blocked', label: 'Blocked', icon: <BlockedIcon />, color: '#D97706', bg: '#FFF7ED' },
  { value: 'skipped', label: 'Skipped', icon: <SkippedIcon />, color: '#475569', bg: '#F1F5F9' },
];

export default function TestExecutionModal({
  open,
  onClose,
  executionId,
  onComplete,
  isReadOnly,
  isSubmitting = false,
}: TestExecutionModalProps) {
  const queryClient = useQueryClient();
  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution-detail', executionId],
    queryFn: async () => {
      const response = await testExecutionService.getExecution(executionId);
      return response.data;
    },
    enabled: open && !!executionId,
  });

  const [status, setStatus] = useState<TestExecutionResult['status']>('passed');
  const [notes, setNotes] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const { data: orgRecommendationData, isLoading: loadingOrgs } = useQuery({
    queryKey: ['execution-org-recommendations', executionId],
    queryFn: async () => {
      const response = await testExecutionService.getOrgRecommendations(executionId);
      return response.data;
    },
    enabled: open && !!executionId,
  });

  const selectOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const response = await testExecutionService.selectOrg(executionId, orgId);
      return response.data;
    },
    onSuccess: (updatedExecution) => {
      setSelectedOrgId(updatedExecution.selected_org_id || null);
      queryClient.invalidateQueries({ queryKey: ['execution-detail', executionId] });
      queryClient.invalidateQueries({ queryKey: ['testExecutions'] });
    },
  });

  useEffect(() => {
    if (!execution) return;
    setStatus(
      execution.status === 'not_started' || execution.status === 'in_progress'
        ? 'passed'
        : (execution.status as TestExecutionResult['status'])
    );
    setNotes(execution.tester_notes || execution.actual_result || '');
  }, [execution]);

  useEffect(() => {
    if (!execution) return;

    if (execution.selected_org_id) {
      setSelectedOrgId(execution.selected_org_id);
      return;
    }

    if (execution.recommended_org_id) {
      setSelectedOrgId(execution.recommended_org_id);
      return;
    }

    const recommendedFallback = orgRecommendationData?.recommendations?.[0]?.org_id;
    if (recommendedFallback) {
      setSelectedOrgId(recommendedFallback);
    }
  }, [execution, orgRecommendationData]);

  const handleSubmit = () => {
    onComplete(executionId, status, notes);
  };

  const recommendations = orgRecommendationData?.recommendations || [];
  const selectedOrg = recommendations.find((org) => org.org_id === selectedOrgId) || null;

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.74)',
          background: 'linear-gradient(180deg, rgba(246,249,250,0.94) 0%, rgba(240,245,246,0.90) 100%)',
          backdropFilter: 'blur(14px) saturate(120%)',
          boxShadow: '0 26px 60px rgba(13, 28, 33, 0.14), inset 0 1px 0 rgba(255,255,255,0.88)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0) 54%)',
            pointerEvents: 'none',
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: '#64748B', letterSpacing: '0.08em', fontWeight: 700 }}>
              EXECUTE TEST
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A' }}>
              {execution?.test_case_id || 'Loading execution'}
            </Typography>
          </Box>
          <Button onClick={onClose} disabled={isSubmitting} startIcon={<CloseIcon />} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{
          py: 3,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(242,247,247,0.03) 100%)',
        }}
      >
        {isLoading || !execution ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading execution details...</Typography>
          </Stack>
        ) : (
          <Stack spacing={3}>
            <Paper elevation={0} sx={infoPanelSx}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" sx={sectionLabelSx}>
                    TITLE
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0F172A' }}>
                    {execution.test_case_title}
                  </Typography>
                </Box>

                {execution.test_case_description && (
                  <Box>
                    <Typography variant="caption" sx={sectionLabelSx}>
                      CONTEXT
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {execution.test_case_description}
                    </Typography>
                  </Box>
                )}

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {execution.priority && (
                    <Chip label={String(execution.priority).toUpperCase()} size="small" sx={{ fontWeight: 700 }} />
                  )}
                  <Chip label={String(execution.status).replace('_', ' ').toUpperCase()} size="small" sx={{ fontWeight: 700 }} />
                  {execution.assigned_user && (
                    <Chip label={execution.assigned_user.username} size="small" variant="outlined" />
                  )}
                </Stack>

                {(!execution.test_steps || execution.test_steps.length === 0) && !execution.expected_result && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    Detailed TestRail steps were not available in the imported metadata for this case. Use the linked case ID and section context as guidance, and refer to TestRail directly for authoritative step-by-step instructions if needed.
                  </Alert>
                )}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={infoPanelSx}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" sx={sectionLabelSx}>
                    AI TESTING ORG
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Choose the org or environment that best matches this test case before you execute it.
                  </Typography>
                </Box>

                {loadingOrgs ? (
                  <Typography variant="body2" color="text.secondary">
                    Loading AI org recommendations...
                  </Typography>
                ) : recommendations.length > 0 ? (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {recommendations.map((org: OrgRecommendation, index: number) => {
                        const isSelected = selectedOrgId === org.org_id;
                        return (
                          <Button
                            key={org.org_id}
                            size="small"
                            variant={isSelected ? 'contained' : 'outlined'}
                            startIcon={index === 0 ? <AiIcon /> : undefined}
                            onClick={() => {
                              setSelectedOrgId(org.org_id);
                              selectOrgMutation.mutate(org.org_id);
                            }}
                            disabled={isReadOnly || isSubmitting || selectOrgMutation.isPending}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 999,
                              fontWeight: 700,
                              ...(isSelected
                                ? {
                                    bgcolor: '#7C3AED',
                                    '&:hover': { bgcolor: '#6D28D9' },
                                  }
                                : {}),
                            }}
                          >
                            {index === 0 ? `AI: ${org.org_name}` : org.org_name}
                          </Button>
                        );
                      })}
                    </Stack>
                    {selectedOrg && (
                      <Alert severity="info" icon={<AiIcon />}>
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.35 }}>
                          {selectedOrg.org_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(selectedOrg.reasons || []).join(' ')}
                        </Typography>
                      </Alert>
                    )}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No AI org recommendation is available for this test yet.
                  </Typography>
                )}
              </Stack>
            </Paper>

            {execution.test_steps && execution.test_steps.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1.25 }}>
                  Test Steps
                </Typography>
                <Stack spacing={1.25}>
                  {execution.test_steps.map((step: any, index: number) => (
                    <Paper key={index} elevation={0} sx={stepCardSx}>
                      <Stack direction="row" spacing={1.5}>
                        <Box sx={stepIndexSx}>{index + 1}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#0F172A', mb: 0.35 }}>
                            {step.action || `Execute step ${index + 1}`}
                          </Typography>
                          {step.expected_result || step.expected ? (
                            <Typography variant="caption" color="text.secondary">
                              Expected: {step.expected_result || step.expected}
                            </Typography>
                          ) : null}
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1.25 }}>
                Result
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} flexWrap="wrap">
                {STATUS_OPTIONS.map((option) => {
                  const selected = status === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={selected ? 'contained' : 'outlined'}
                      startIcon={option.icon}
                      onClick={() => setStatus(option.value)}
                      disabled={isReadOnly || isSubmitting}
                      sx={{
                        minWidth: 132,
                        textTransform: 'none',
                        borderRadius: 3,
                        py: 1.2,
                        ...(selected
                          ? {
                              bgcolor: option.color,
                              borderColor: option.color,
                              '&:hover': { bgcolor: option.color, opacity: 0.92 },
                            }
                          : {
                              borderColor: 'rgba(148,163,184,0.4)',
                              color: '#0F172A',
                              '&:hover': {
                                bgcolor: option.bg,
                                borderColor: option.color,
                              },
                            }),
                      }}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1.25 }}>
                Tester Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={isReadOnly || isSubmitting}
                placeholder={
                  status === 'failed'
                    ? 'Describe what failed and what the team should look at next...'
                    : status === 'blocked'
                      ? 'Explain what is blocking the test and what needs to be resolved...'
                      : 'Capture any helpful observations from execution...'
                }
              />
            </Box>

            <Alert severity="info" icon={<InfoIcon />}>
              This step saves execution results in Suitecraft for workflow tracking. Screenshot upload and TestRail result sync can come next once writable integrations are available.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !execution || isReadOnly || isSubmitting}
          sx={submitButtonSx}
        >
          {isSubmitting ? 'Saving Result...' : 'Save Result'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const sectionLabelSx = {
  display: 'block',
  color: '#64748B',
  fontWeight: 700,
  mb: 0.35,
  letterSpacing: '0.06em',
};

const infoPanelSx = {
  p: 2.25,
  borderRadius: 4,
  border: '1px solid rgba(226,232,240,0.92)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(249,251,252,0.92) 100%)',
  boxShadow: '0 10px 28px rgba(13, 28, 33, 0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
};

const stepCardSx = {
  p: 1.5,
  borderRadius: 3,
  border: '1px solid rgba(226,232,240,0.86)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.88) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)',
};

const stepIndexSx = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  bgcolor: SUITECRAFT_TOKENS.colors.primary,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  flexShrink: 0,
};

const submitButtonSx = {
  textTransform: 'none',
  px: 3,
  borderRadius: 3,
  fontWeight: 800,
  bgcolor: SUITECRAFT_TOKENS.colors.primary,
  '&:hover': {
    bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
  },
};
