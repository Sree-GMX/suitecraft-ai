import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Error,
  Block,
  Send,
  AutoAwesome as AIIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  testExecutionService,
  orgService,
  TestExecutionDetail,
  TestExecutionResult,
  QAOrg,
  ChatMessage,
  AIValidationResponse,
} from '../services/api';

export default function TestExecute() {
  const { releaseId, testRunId, executionId } = useParams<{
    releaseId: string;
    testRunId: string;
    executionId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<'passed' | 'failed' | 'blocked'>('passed');
  const [actualResult, setActualResult] = useState('');
  const [testerNotes, setTesterNotes] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [aiValidation, setAiValidation] = useState<AIValidationResponse | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);

  // Fetch test execution details
  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => {
      const response = await testExecutionService.getExecution(Number(executionId));
      return response.data;
    },
    enabled: !!executionId,
  });

  // Fetch org recommendations
  const { data: orgRecommendations } = useQuery({
    queryKey: ['orgRecommendations', executionId],
    queryFn: async () => {
      const response = await testExecutionService.getOrgRecommendations(Number(executionId));
      return response.data;
    },
    enabled: !!executionId && activeStep === 0,
  });

  // Fetch chat history
  const { data: chatHistory = [] } = useQuery({
    queryKey: ['chatHistory', executionId],
    queryFn: async () => {
      const response = await testExecutionService.getChatHistory(Number(executionId));
      return response.data;
    },
    enabled: !!executionId && activeStep === 1,
  });

  // Start execution mutation
  const startMutation = useMutation({
    mutationFn: () => testExecutionService.startExecution(Number(executionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      setActiveStep(1);
    },
  });

  // Select org mutation
  const selectOrgMutation = useMutation({
    mutationFn: (orgId: number) => testExecutionService.selectOrg(Number(executionId), orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      startMutation.mutate();
    },
  });

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) =>
      testExecutionService.sendChatMessage(Number(executionId), message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatHistory', executionId] });
      setChatMessage('');
    },
  });

  // Request AI validation
  const requestValidationMutation = useMutation({
    mutationFn: () =>
      testExecutionService.requestAIValidation(Number(executionId), testerNotes, []),
    onSuccess: (data) => {
      setAiValidation(data.data);
      setTestResult(data.data.suggested_status as any);
      setShowAIDialog(true);
    },
  });

  // Submit result mutation
  const submitMutation = useMutation({
    mutationFn: (result: TestExecutionResult) =>
      testExecutionService.submitResult(Number(executionId), result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', executionId] });
      queryClient.invalidateQueries({ queryKey: ['executions', testRunId] });
      queryClient.invalidateQueries({ queryKey: ['testRun', testRunId] });
      navigate(`/test-execution/${releaseId}/run/${testRunId}`);
    },
  });

  const handleSelectOrg = () => {
    if (selectedOrg) {
      selectOrgMutation.mutate(selectedOrg);
    }
  };

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage);
    }
  };

  const handleRequestAIValidation = () => {
    requestValidationMutation.mutate();
  };

  const handleSubmitResult = () => {
    const result: TestExecutionResult = {
      status: testResult,
      actual_result: actualResult,
      tester_notes: testerNotes,
    };
    submitMutation.mutate(result);
  };

  if (isLoading || !execution) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const steps = ['Select Org', 'Execute Test', 'Submit Results'];

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/test-execution/${releaseId}/run/${testRunId}`)}
          >
            Back to Test Run
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/unified-workflow/${releaseId}`)}
            sx={{ textTransform: 'none' }}
          >
            Back to Workflow
          </Button>
        </Stack>

        <Typography variant="h5" fontWeight={600} gutterBottom>
          {execution.test_case_title}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Test Case ID: {execution.test_case_id}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Step 0: Select Org */}
      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Salesforce Org for Testing
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Choose the org where you'll execute this test. AI has recommended the best orgs based on your test requirements.
          </Typography>

          {orgRecommendations && orgRecommendations.recommendations.length > 0 ? (
            <RadioGroup value={selectedOrg} onChange={(e) => setSelectedOrg(Number(e.target.value))}>
              <Stack spacing={2}>
                {orgRecommendations.recommendations.map((org) => (
                  <Card key={org.org_id} variant="outlined">
                    <CardContent>
                      <FormControlLabel
                        value={org.org_id}
                        control={<Radio />}
                        label={
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {org.org_name}
                              </Typography>
                              <Chip
                                icon={<AIIcon />}
                                label={`${Math.round(org.confidence_score * 100)}% match`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {org.reasons.join(' • ')}
                            </Typography>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </RadioGroup>
          ) : (
            <Alert severity="info">Loading org recommendations...</Alert>
          )}

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={handleSelectOrg}
              disabled={!selectedOrg || selectOrgMutation.isPending}
            >
              {selectOrgMutation.isPending ? 'Starting...' : 'Start Test'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Step 1: Execute Test */}
      {activeStep === 1 && (
        <Box display="flex" gap={3}>
          {/* Test Instructions */}
          <Paper sx={{ flex: 2, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Test Instructions
            </Typography>

            <Box mb={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Description:
              </Typography>
              <Typography variant="body2">{execution.test_case_description}</Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box mb={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Test Steps:
              </Typography>
              <List>
                {execution.test_steps && execution.test_steps.length > 0 ? (
                  execution.test_steps.map((step: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${index + 1}. ${step.action || step.description || step}`}
                        secondary={step.expected || ''}
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem>
                    <ListItemText primary="No detailed steps provided" />
                  </ListItem>
                )}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Expected Result:
              </Typography>
              <Alert severity="info">{execution.expected_result || 'Not specified'}</Alert>
            </Box>

            <Box mt={3}>
              <Button
                variant="contained"
                startIcon={<ComputerIcon />}
                fullWidth
                size="large"
              >
                Open Salesforce Org (Coming Soon)
              </Button>
            </Box>
          </Paper>

          {/* AI Assistant Chat */}
          <Paper sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', height: 600 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <AIIcon color="primary" />
              AI Assistant
            </Typography>

            <Box flex={1} overflow="auto" mb={2} sx={{ maxHeight: 400 }}>
              {chatHistory.length === 0 ? (
                <Alert severity="info">
                  Chat with AI to get guidance during testing. Ask questions about the test case or report what you observe.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {chatHistory.map((msg: ChatMessage) => (
                    <Box
                      key={msg.id}
                      sx={{
                        alignSelf: msg.is_ai_response ? 'flex-start' : 'flex-end',
                        maxWidth: '80%',
                      }}
                    >
                      <Paper
                        sx={{
                          p: 1.5,
                          bgcolor: msg.is_ai_response ? 'primary.light' : 'grey.200',
                        }}
                      >
                        <Typography variant="body2">{msg.message}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask AI for help..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <IconButton
                color="primary"
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || sendMessageMutation.isPending}
              >
                <Send />
              </IconButton>
            </Stack>

            <Button
              variant="outlined"
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => setActiveStep(2)}
            >
              Continue to Results
            </Button>
          </Paper>
        </Box>
      )}

      {/* Step 2: Submit Results */}
      {activeStep === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Submit Test Results
          </Typography>

          <Stack spacing={3}>
            <TextField
              label="Actual Result"
              multiline
              rows={4}
              value={actualResult}
              onChange={(e) => setActualResult(e.target.value)}
              placeholder="Describe what actually happened during the test..."
              required
            />

            <TextField
              label="Tester Notes"
              multiline
              rows={3}
              value={testerNotes}
              onChange={(e) => setTesterNotes(e.target.value)}
              placeholder="Any additional observations or notes..."
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Test Status
              </Typography>
              <RadioGroup
                row
                value={testResult}
                onChange={(e) => setTestResult(e.target.value as any)}
              >
                <FormControlLabel
                  value="passed"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" />
                      <span>Passed</span>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="failed"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Error color="error" />
                      <span>Failed</span>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="blocked"
                  control={<Radio />}
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Block color="warning" />
                      <span>Blocked</span>
                    </Box>
                  }
                />
              </RadioGroup>
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<AIIcon />}
                onClick={handleRequestAIValidation}
                disabled={!testerNotes || requestValidationMutation.isPending}
              >
                Get AI Validation
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmitResult}
                disabled={!actualResult || submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Results'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* AI Validation Dialog */}
      <Dialog open={showAIDialog} onClose={() => setShowAIDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>AI Validation</DialogTitle>
        <DialogContent>
          {aiValidation && (
            <Stack spacing={2}>
              <Alert severity="info">
                {aiValidation.validation_summary}
              </Alert>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Confidence Score
                </Typography>
                <Chip
                  label={`${Math.round(aiValidation.confidence_score * 100)}%`}
                  color="primary"
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Suggested Status
                </Typography>
                <Chip
                  label={aiValidation.suggested_status}
                  color={
                    aiValidation.suggested_status === 'passed'
                      ? 'success'
                      : aiValidation.suggested_status === 'failed'
                      ? 'error'
                      : 'warning'
                  }
                />
              </Box>

              {aiValidation.observations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Observations
                  </Typography>
                  <List dense>
                    {aiValidation.observations.map((obs, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={`• ${obs}`} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {aiValidation.concerns.length > 0 && (
                <Alert severity="warning">
                  <Typography variant="subtitle2" gutterBottom>
                    Concerns:
                  </Typography>
                  <List dense>
                    {aiValidation.concerns.map((concern, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={`• ${concern}`} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAIDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
