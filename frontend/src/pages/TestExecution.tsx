import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
  ArrowBack,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testExecutionService, testPlanService, TestRunSummary } from '../services/api';

export default function TestExecution() {
  const { releaseId } = useParams<{ releaseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testRunToDelete, setTestRunToDelete] = useState<number | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTestRunId, setSelectedTestRunId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch test runs for this release
  const { data: testRuns = [], isLoading } = useQuery({
    queryKey: ['testRuns', releaseId],
    queryFn: async () => {
      const response = await testExecutionService.getTestRuns(Number(releaseId));
      return response.data;
    },
    enabled: !!releaseId,
  });

  // Fetch saved test plans
  const { data: savedTestPlans = [] } = useQuery({
    queryKey: ['savedTestPlans'],
    queryFn: async () => {
      const response = await testPlanService.listSaved();
      return response.data.saved_plans || [];
    },
  });

  // Delete test run mutation
  const deleteMutation = useMutation({
    mutationFn: (testRunId: number) => testExecutionService.deleteTestRun(testRunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testRuns', releaseId] });
      setDeleteDialogOpen(false);
      setTestRunToDelete(null);
    },
  });

  const handleGenerateTestRun = async () => {
    if (!releaseId) return;
    
    setIsGenerating(true);
    
    try {
      // Get the most recent saved test plan
      if (!savedTestPlans || savedTestPlans.length === 0) {
        alert('No saved test plans found. Please generate and save a test plan first in the Release Workflow.');
        setIsGenerating(false);
        setCreateDialogOpen(false);
        return;
      }
      
      // Use the most recent test plan
      const latestPlan = savedTestPlans[0];
      
      // Create test run with AI assignment
      const testRunName = `AI Test Run - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      
      const testRunPromise = testExecutionService.createTestRun({
        release_id: parseInt(releaseId),
        test_plan_id: latestPlan.id,
        name: testRunName,
        description: `AI-generated test run with automatic test assignment`,
        auto_assign: true
      });
      
      // Add 60-second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test run creation timed out after 60 seconds')), 60000)
      );
      
      await Promise.race([testRunPromise, timeoutPromise]);
      
      // Refresh test runs
      queryClient.invalidateQueries({ queryKey: ['testRuns', releaseId] });
      
      setCreateDialogOpen(false);
      alert('✅ Test run created successfully with AI assignment!');
    } catch (error: any) {
      alert(`Failed to generate test run: ${error.message || 'Unknown error'}. The AI assignment may have timed out.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, testRunId: number) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTestRunId(testRunId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTestRunId(null);
  };

  const handleDeleteClick = () => {
    if (selectedTestRunId) {
      setTestRunToDelete(selectedTestRunId);
      setDeleteDialogOpen(true);
      handleMenuClose();
    }
  };

  const handleDeleteConfirm = () => {
    if (testRunToDelete) {
      deleteMutation.mutate(testRunToDelete);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'active': return 'primary';
      case 'paused': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const calculateProgress = (testRun: TestRunSummary) => {
    if (testRun.total_test_cases === 0) return 0;
    return (testRun.executed_count / testRun.total_test_cases) * 100;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/unified-workflow/${releaseId}`)}
            sx={{ mb: 1 }}
          >
            Back to Release Workflow
          </Button>
          <Typography variant="h4" fontWeight={600}>
            Test Execution
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-generated test runs with automatic assignment
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AIIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="large"
          sx={{
            background: '#152F38',
            '&:hover': {
              background: '#0E2329',
            }
          }}
        >
          Generate AI Test Run
        </Button>
      </Box>

      {/* Test Runs List */}
      {testRuns.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <AIIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No test runs yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Generate your first AI-powered test run with automatic test assignment
          </Typography>
          <Button
            variant="contained"
            startIcon={<AIIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{
              background: '#152F38',
              '&:hover': {
                background: '#0E2329',
              }
            }}
          >
            Generate AI Test Run
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {testRuns.map((testRun) => (
            <Grid item xs={12} md={6} lg={4} key={testRun.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 6 },
                  height: '100%',
                }}
                onClick={() => navigate(`/test-execution/${releaseId}/run/${testRun.id}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Typography variant="h6" fontWeight={600}>
                      {testRun.name}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label={testRun.status}
                        color={getStatusColor(testRun.status)}
                        size="small"
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, testRun.id)}
                        sx={{ ml: 1 }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {testRun.executed_count} / {testRun.total_test_cases}
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={calculateProgress(testRun)} 
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <CheckIcon color="success" fontSize="small" />
                      <Typography variant="body2">{testRun.passed_count}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ErrorIcon color="error" fontSize="small" />
                      <Typography variant="body2">{testRun.failed_count}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <BlockIcon color="warning" fontSize="small" />
                      <Typography variant="body2">{testRun.blocked_count}</Typography>
                    </Box>
                  </Stack>

                  <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                    Created {new Date(testRun.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Generate AI Test Run Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => !isGenerating && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AIIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Generate AI Test Run
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" icon={<AIIcon />}>
              AI will automatically:
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>Generate test cases from your saved test plan</li>
                <li>Assign tests to team members based on their expertise</li>
                <li>Optimize workload distribution across your team</li>
              </ul>
            </Alert>

            {savedTestPlans && savedTestPlans.length > 0 ? (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Using latest test plan:
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" fontWeight={600}>
                    {savedTestPlans[0].test_plan_name || 'Unnamed Test Plan'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {savedTestPlans[0].total_test_cases} test cases • Created {new Date(savedTestPlans[0].created_at).toLocaleDateString()}
                  </Typography>
                </Paper>
              </Box>
            ) : (
              <Alert severity="warning">
                No saved test plans found. Please generate and save a test plan first in the Release Workflow.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateTestRun}
            disabled={!savedTestPlans || savedTestPlans.length === 0 || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
            sx={{
              background: '#152F38',
              '&:hover': {
                background: '#0E2329',
              }
            }}
          >
            {isGenerating ? 'Generating with AI...' : 'Generate Test Run'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteClick}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Test Run
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
      >
        <DialogTitle>Delete Test Run?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this test run? This will permanently delete all test executions, results, and comments associated with this test run.
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Alert>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(() => {
                const errorData = (deleteMutation.error as any)?.response?.data;
                if (typeof errorData?.detail === 'string') {
                  return errorData.detail;
                }
                if (Array.isArray(errorData?.detail)) {
                  return errorData.detail.map((err: any) => err.msg).join(', ');
                }
                return 'Failed to delete test run';
              })()}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
