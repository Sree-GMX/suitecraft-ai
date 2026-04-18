import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  LinearProgress,
  Stack,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  TablePagination,
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  ArrowBack,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Block as BlockIcon,
  SkipNext as SkipIcon,
  MoreVert as MoreIcon,
  AutoAwesome as AIIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testExecutionService, TestRunDetail as TestRunDetailType, TestExecutionSummary } from '../services/api';

export default function TestRunDetail() {
  const { releaseId, testRunId } = useParams<{ releaseId: string; testRunId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedExecution, setSelectedExecution] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'default' | 'priority'>('default');

  // Fetch test run details
  const { data: testRun, isLoading: loadingTestRun } = useQuery({
    queryKey: ['testRun', testRunId],
    queryFn: async () => {
      const response = await testExecutionService.getTestRun(Number(testRunId));
      return response.data;
    },
    enabled: !!testRunId,
  });

  // Fetch test executions
  const { data: executions = [], isLoading: loadingExecutions } = useQuery({
    queryKey: ['executions', testRunId],
    queryFn: async () => {
      const response = await testExecutionService.getExecutions(Number(testRunId));
      return response.data;
    },
    enabled: !!testRunId,
  });

  // Start execution mutation
  const startMutation = useMutation({
    mutationFn: (executionId: number) => testExecutionService.startExecution(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions', testRunId] });
      queryClient.invalidateQueries({ queryKey: ['testRun', testRunId] });
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, executionId: number) => {
    setMenuAnchor(event.currentTarget);
    setSelectedExecution(executionId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedExecution(null);
  };

  const handleStartExecution = (executionId: number) => {
    navigate(`/test-execution/${releaseId}/run/${testRunId}/execute/${executionId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started': return 'default';
      case 'in_progress': return 'primary';
      case 'passed': return 'success';
      case 'failed': return 'error';
      case 'blocked': return 'warning';
      case 'skipped': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckIcon color="success" />;
      case 'failed': return <ErrorIcon color="error" />;
      case 'blocked': return <BlockIcon color="warning" />;
      case 'skipped': return <SkipIcon />;
      case 'in_progress': return <PlayIcon color="primary" />;
      default: return null;
    }
  };

  const calculateProgress = () => {
    if (!testRun || testRun.total_test_cases === 0) return 0;
    return (testRun.executed_count / testRun.total_test_cases) * 100;
  };

  // Filter and sort executions
  const filteredAndSortedExecutions = useMemo(() => {
    let filtered = [...executions];
    
    // Apply status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(exec => statusFilter.includes(exec.status));
    }
    
    // Apply sorting
    if (sortBy === 'priority') {
      const priorityOrder: Record<string, number> = {
        'critical': 0,
        'high': 1,
        'medium': 2,
        'low': 3,
      };
      
      filtered.sort((a, b) => {
        const priorityA = priorityOrder[a.priority || 'medium'] ?? 2;
        const priorityB = priorityOrder[b.priority || 'medium'] ?? 2;
        return priorityA - priorityB;
      });
    }
    
    return filtered;
  }, [executions, statusFilter, sortBy]);

  // Group executions by section from test_case_description
  const groupedExecutions = useMemo(() => {
    const groups: Record<string, { section: string; executions: TestExecutionSummary[] }> = {};
    
    filteredAndSortedExecutions.forEach((execution) => {
      // Extract section from test_case_description
      // Format: "Section: <section_name>\nHierarchy: ..."
      let section = 'Ungrouped';
      if (execution.test_case_description) {
        const match = execution.test_case_description.match(/Section: ([^\n]+)/);
        if (match) {
          section = match[1].trim();
        }
      }
      
      if (!groups[section]) {
        groups[section] = { section, executions: [] };
      }
      groups[section].executions.push(execution);
    });
    
    // Sort groups by section name
    return Object.values(groups).sort((a, b) => a.section.localeCompare(b.section));
  }, [filteredAndSortedExecutions]);

  // Flatten grouped executions for pagination
  const flattenedExecutions = useMemo(() => {
    const flattened: Array<{ type: 'header' | 'execution'; data: any }> = [];
    
    groupedExecutions.forEach((group) => {
      flattened.push({ type: 'header', data: group });
      group.executions.forEach((execution) => {
        flattened.push({ type: 'execution', data: execution });
      });
    });
    
    return flattened;
  }, [groupedExecutions]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return flattenedExecutions.slice(start, end);
  }, [flattenedExecutions, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleSection = (section: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(section)) {
      newCollapsed.delete(section);
    } else {
      newCollapsed.add(section);
    }
    setCollapsedSections(newCollapsed);
  };

  const handleStatusFilterChange = (
    event: React.MouseEvent<HTMLElement>,
    newFilter: string[],
  ) => {
    setStatusFilter(newFilter);
    setPage(0); // Reset to first page when filtering
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    setSortBy(event.target.value as 'default' | 'priority');
    setPage(0); // Reset to first page when sorting
  };

  if (loadingTestRun || loadingExecutions) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!testRun) {
    return (
      <Alert severity="error">Test run not found</Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/test-execution/${releaseId}`)}
          >
            Back to Test Runs
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
        
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              {testRun.name}
            </Typography>
            <Chip label={testRun.status} color={getStatusColor(testRun.status)} />
          </Box>
          
          {testRun.ai_generated_assignments && (
            <Chip icon={<AIIcon />} label="AI Assigned" color="secondary" variant="outlined" />
          )}
        </Box>

        {testRun.description && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {testRun.description}
          </Typography>
        )}

        {/* Progress Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              Overall Progress
            </Typography>
            <Typography variant="body2">
              {testRun.executed_count} / {testRun.total_test_cases} tests executed
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={calculateProgress()} 
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={1}>
              <CheckIcon color="success" />
              <Typography variant="body2">
                Passed: <strong>{testRun.passed_count}</strong>
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <ErrorIcon color="error" />
              <Typography variant="body2">
                Failed: <strong>{testRun.failed_count}</strong>
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <BlockIcon color="warning" />
              <Typography variant="body2">
                Blocked: <strong>{testRun.blocked_count}</strong>
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <SkipIcon />
              <Typography variant="body2">
                Skipped: <strong>{testRun.skipped_count}</strong>
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Filters and Sorting */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="body2" fontWeight={600} mb={1} display="flex" alignItems="center" gap={1}>
                <FilterIcon fontSize="small" />
                Filter by Status
              </Typography>
              <ToggleButtonGroup
                value={statusFilter}
                onChange={handleStatusFilterChange}
                aria-label="status filter"
                size="small"
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="passed" aria-label="passed">
                  <CheckIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Passed
                </ToggleButton>
                <ToggleButton value="failed" aria-label="failed">
                  <ErrorIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Failed
                </ToggleButton>
                <ToggleButton value="blocked" aria-label="blocked">
                  <BlockIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Blocked
                </ToggleButton>
                <ToggleButton value="skipped" aria-label="skipped">
                  <SkipIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Skipped
                </ToggleButton>
                <ToggleButton value="not_started" aria-label="not started">
                  Not Started
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-label">Sort By</InputLabel>
              <Select
                labelId="sort-label"
                value={sortBy}
                label="Sort By"
                onChange={handleSortChange}
              >
                <MenuItem value="default">
                  <Box display="flex" alignItems="center" gap={1}>
                    <SortIcon fontSize="small" />
                    Default Order
                  </Box>
                </MenuItem>
                <MenuItem value="priority">
                  <Box display="flex" alignItems="center" gap={1}>
                    <ErrorIcon fontSize="small" color="error" />
                    Priority (High First)
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {statusFilter.length > 0 && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary">
                Showing {filteredAndSortedExecutions.length} of {executions.length} test cases
                {statusFilter.length > 0 && ` (filtered by: ${statusFilter.join(', ')})`}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Test Cases Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Test Case ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((item, index) => {
                if (item.type === 'header') {
                  const group = item.data;
                  const isCollapsed = collapsedSections.has(group.section);
                  
                  return (
                    <TableRow
                      key={`header-${group.section}-${index}`}
                      sx={{
                        backgroundColor: 'action.hover',
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.selected' }
                      }}
                      onClick={() => toggleSection(group.section)}
                    >
                      <TableCell colSpan={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <IconButton size="small">
                            {isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
                          </IconButton>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {group.section}
                          </Typography>
                          <Chip 
                            label={`${group.executions.length} test cases`} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                }
                
                // Execution row
                const execution = item.data;
                // Extract section and related ticket for collapse check
                let section = 'Ungrouped';
                let relatedTicket = '';
                if (execution.test_case_description) {
                  const sectionMatch = execution.test_case_description.match(/Section: ([^\n]+)/);
                  if (sectionMatch) {
                    section = sectionMatch[1].trim();
                  }
                  const ticketMatch = execution.test_case_description.match(/Related Ticket: ([^\n]+)/);
                  if (ticketMatch) {
                    relatedTicket = ticketMatch[1].trim();
                  }
                }
                const isCollapsed = collapsedSections.has(section);
                
                if (isCollapsed) return null;
                
                return (
                  <TableRow
                    key={execution.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleStartExecution(execution.id)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {execution.test_case_id}
                      </Typography>
                      {relatedTicket && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {relatedTicket}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {execution.test_case_title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={execution.priority || 'medium'} 
                        size="small" 
                        color={
                          execution.priority === 'critical' ? 'error' : 
                          execution.priority === 'high' ? 'warning' : 
                          execution.priority === 'medium' ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {execution.assigned_user ? (
                        <Chip 
                          label={execution.assigned_user.username} 
                          size="small" 
                          variant="outlined" 
                        />
                      ) : execution.assigned_to ? (
                        <Chip label={`User #${execution.assigned_to}`} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unassigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(execution.status)}
                        <Chip 
                          label={execution.status.replace('_', ' ')}
                          color={getStatusColor(execution.status)}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, execution.id);
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={flattenedExecutions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />

        {executions.length === 0 && (
          <Box p={6} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              No test cases found in this test run
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedExecution) handleStartExecution(selectedExecution);
          handleMenuClose();
        }}>
          <PlayIcon fontSize="small" sx={{ mr: 1 }} />
          Start Test
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <AIIcon fontSize="small" sx={{ mr: 1 }} />
          Get AI Suggestions
        </MenuItem>
      </Menu>
    </Box>
  );
}
