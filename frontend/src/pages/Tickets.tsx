import { 
  Box, 
  Typography, 
  Grid, 
  TextField, 
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Collapse,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Description as TicketIcon,
  BugReport as BugIcon,
  Article as StoryIcon,
  Assignment as TestCaseIcon,
} from '@mui/icons-material';
import { useReleaseContext } from '../contexts/ReleaseContext';
import { useState, Fragment, useMemo } from 'react';
import { GlassCard, MetricCard, StatusChip, PriorityChip, SectionHeader, LoadingSpinner, EmptyState } from '../components/ui';
import { SUITECRAFT_TOKENS } from '../styles/theme';

const TICKETS_PER_PAGE = 10;
const TEST_CASES_PER_PAGE = 5;

export default function Tickets() {
  const { selectedReleases, ticketsData, isLoadingTickets } = useReleaseContext();
  
  // All hooks must be called before any conditional returns
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [testCaseFilter, setTestCaseFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [testCasesPages, setTestCasesPages] = useState<Record<string, number>>({});

  // Process data with useMemo
  const allTickets = useMemo(() => {
    if (!ticketsData) return [];
    return [...(ticketsData.stories || []), ...(ticketsData.bugs || [])];
  }, [ticketsData]);
  
  const filteredTickets = useMemo(() => {
    return allTickets.filter(ticket => {
      const matchesSearch = !searchQuery || 
        ticket.issue_key?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.summary?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPriority = priorityFilter === 'all' || 
        ticket.priority?.toLowerCase() === priorityFilter.toLowerCase();
      
      const matchesStatus = statusFilter === 'all' || 
        ticket.status?.toLowerCase().includes(statusFilter.toLowerCase());
      
      const matchesTestCase = testCaseFilter === 'all' ||
        (testCaseFilter === 'generated' && ticket.test_cases && ticket.test_cases.length > 0) ||
        (testCaseFilter === 'none' && (!ticket.test_cases || ticket.test_cases.length === 0));
      
      return matchesSearch && matchesPriority && matchesStatus && matchesTestCase;
    });
  }, [allTickets, searchQuery, priorityFilter, statusFilter, testCaseFilter]);

  const storiesFiltered = useMemo(() => 
    filteredTickets.filter(t => 
      !['bug', 'defect'].some(type => t.issue_type?.toLowerCase().includes(type))
    ), [filteredTickets]
  );
  
  const bugsFiltered = useMemo(() => 
    filteredTickets.filter(t => 
      ['bug', 'defect'].some(type => t.issue_type?.toLowerCase().includes(type))
    ), [filteredTickets]
  );

  const allCurrentTickets = activeTab === 0 ? storiesFiltered : bugsFiltered;
  
  const totalPages = Math.ceil(allCurrentTickets.length / TICKETS_PER_PAGE);
  const currentTickets = useMemo(() => {
    const startIndex = (ticketsPage - 1) * TICKETS_PER_PAGE;
    return allCurrentTickets.slice(startIndex, startIndex + TICKETS_PER_PAGE);
  }, [allCurrentTickets, ticketsPage]);

  // Helper functions
  const handleFilterChange = () => {
    setTicketsPage(1);
  };

  const getPaginatedTestCases = (ticket: any) => {
    if (!ticket.test_cases || ticket.test_cases.length === 0) return [];
    const page = testCasesPages[ticket.issue_key] || 1;
    const startIndex = (page - 1) * TEST_CASES_PER_PAGE;
    return ticket.test_cases.slice(startIndex, startIndex + TEST_CASES_PER_PAGE);
  };

  const getTestCasesTotalPages = (ticket: any) => {
    if (!ticket.test_cases) return 0;
    return Math.ceil(ticket.test_cases.length / TEST_CASES_PER_PAGE);
  };

  const handleTestCasesPageChange = (ticketKey: string, page: number) => {
    setTestCasesPages(prev => ({
      ...prev,
      [ticketKey]: page,
    }));
  };

  // Conditional renders AFTER all hooks
  if (selectedReleases.length === 0) {
    return (
      <EmptyState
        title="No Release Selected"
        description="Please select a release from the dropdown to view tickets and test cases"
        icon={<StoryIcon sx={{ fontSize: 64 }} />}
      />
    );
  }

  if (isLoadingTickets) {
    return <LoadingSpinner message="Loading Tickets & Test Cases" />;
  }

  if (!ticketsData) {
    return (
      <EmptyState
        title="No Data Available"
        description="No ticket data available for the selected releases"
        icon={<TicketIcon sx={{ fontSize: 64 }} />}
      />
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader>Tickets & Test Cases</SectionHeader>
        <Typography variant="body2" color="text.secondary">
          {selectedReleases.join(', ')}
        </Typography>
      </Box>

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Tickets"
            value={ticketsData.summary?.total_tickets || 0}
            icon={<TicketIcon sx={{ fontSize: 32 }} />}
            color={SUITECRAFT_TOKENS.colors.primary}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Stories"
            value={ticketsData.summary?.story_tickets || 0}
            subtitle={`${ticketsData.stories?.length || 0} items`}
            icon={<StoryIcon sx={{ fontSize: 32 }} />}
            color={SUITECRAFT_TOKENS.colors.info}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Bugs"
            value={ticketsData.summary?.bug_tickets || 0}
            subtitle={`${ticketsData.bugs?.length || 0} items`}
            icon={<BugIcon sx={{ fontSize: 32 }} />}
            color={SUITECRAFT_TOKENS.colors.error}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Test Cases"
            value={ticketsData.summary?.total_test_cases || 0}
            icon={<TestCaseIcon sx={{ fontSize: 32 }} />}
            color={SUITECRAFT_TOKENS.colors.success}
          />
        </Grid>
      </Grid>

      {/* Filters */}
      <GlassCard sx={{ mb: 3, p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleFilterChange();
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: SUITECRAFT_TOKENS.colors.text.tertiary }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(247,250,252,0.18) 100%)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderRadius: 2,
                '& fieldset': {
                  border: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
                },
                '&:hover fieldset': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                },
                '&.Mui-focused fieldset': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                  borderWidth: '2px',
                },
              },
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority"
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                handleFilterChange();
              }}
              sx={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(247,250,252,0.18) 100%)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderRadius: 2,
                '& fieldset': {
                  border: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                  borderWidth: '2px',
                },
              }}
            >
              <MenuItem value="all">All Priorities</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                handleFilterChange();
              }}
              sx={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(247,250,252,0.18) 100%)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderRadius: 2,
                '& fieldset': {
                  border: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                  borderWidth: '2px',
                },
              }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="done">Done</MenuItem>
              <MenuItem value="progress">In Progress</MenuItem>
              <MenuItem value="review">In Review</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Test Cases</InputLabel>
            <Select
              value={testCaseFilter}
              label="Test Cases"
              onChange={(e) => {
                setTestCaseFilter(e.target.value);
                handleFilterChange();
              }}
              sx={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(247,250,252,0.18) 100%)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                borderRadius: 2,
                '& fieldset': {
                  border: `1px solid ${SUITECRAFT_TOKENS.colors.border.default}`,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: SUITECRAFT_TOKENS.colors.primary,
                  borderWidth: '2px',
                },
              }}
            >
              <MenuItem value="all">All Tickets</MenuItem>
              <MenuItem value="generated">With Test Cases</MenuItem>
              <MenuItem value="none">Without Test Cases</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </GlassCard>

      {/* Tabs */}
      <GlassCard sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, value) => setActiveTab(value)}
          sx={{
            borderBottom: `1px solid ${SUITECRAFT_TOKENS.colors.border.light}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9375rem',
              minHeight: 56,
            },
          }}
        >
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <StoryIcon fontSize="small" />
                <span>Stories</span>
                <Chip 
                  label={storiesFiltered.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    bgcolor: SUITECRAFT_TOKENS.colors.info + '20',
                    color: SUITECRAFT_TOKENS.colors.info,
                  }} 
                />
              </Stack>
            } 
          />
          <Tab 
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <BugIcon fontSize="small" />
                <span>Bugs</span>
                <Chip 
                  label={bugsFiltered.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    bgcolor: SUITECRAFT_TOKENS.colors.error + '20',
                    color: SUITECRAFT_TOKENS.colors.error,
                  }} 
                />
              </Stack>
            } 
          />
        </Tabs>

        {/* Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }} />
                <TableCell sx={{ fontWeight: 600, color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Ticket
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Summary
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Priority
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Status
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: SUITECRAFT_TOKENS.colors.text.secondary }}>
                  Test Cases
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="body2" color="text.secondary">
                      No tickets found matching your filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                currentTickets.map((ticket) => {
                  const paginatedTestCases = getPaginatedTestCases(ticket);
                  const testCasesTotalPages = getTestCasesTotalPages(ticket);
                  const currentTestCasesPage = testCasesPages[ticket.issue_key] || 1;
                  
                  return (
                    <Fragment key={ticket.issue_key}>
                      <TableRow 
                        hover
                        sx={{
                          cursor: 'pointer',
                          '& td': {
                            borderBottom: `1px solid ${SUITECRAFT_TOKENS.colors.border.light}`,
                          },
                        }}
                        onClick={() => setExpandedTicket(
                          expandedTicket === ticket.issue_key ? null : ticket.issue_key
                        )}
                      >
                        <TableCell>
                          <IconButton size="small">
                            {expandedTicket === ticket.issue_key ? <ArrowUpIcon /> : <ArrowDownIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            fontWeight={600}
                            sx={{ color: SUITECRAFT_TOKENS.colors.primary }}
                          >
                            {ticket.issue_key}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 400 }}>
                            {ticket.summary}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <PriorityChip priority={ticket.priority || 'Medium'} />
                        </TableCell>
                        <TableCell>
                          <StatusChip status={ticket.status || 'Open'} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={ticket.test_cases_count || 0}
                            size="small"
                            sx={{
                              bgcolor: SUITECRAFT_TOKENS.colors.success + '15',
                              color: SUITECRAFT_TOKENS.colors.success,
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Test Cases with Pagination */}
                      <TableRow>
                        <TableCell 
                          colSpan={6} 
                          sx={{ 
                            p: 0, 
                            borderBottom: expandedTicket === ticket.issue_key 
                              ? `1px solid ${SUITECRAFT_TOKENS.colors.border.light}` 
                              : 'none' 
                          }}
                        >
                          <Collapse in={expandedTicket === ticket.issue_key} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 3, background: 'rgba(248, 249, 250, 0.3)', backdropFilter: 'blur(10px)' }}>
                              {ticket.test_cases && ticket.test_cases.length > 0 ? (
                                <Box>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">
                                      Test Cases ({ticket.test_cases.length})
                                    </Typography>
                                    {testCasesTotalPages > 1 && (
                                      <Typography variant="caption" color="text.tertiary">
                                        Page {currentTestCasesPage} of {testCasesTotalPages}
                                      </Typography>
                                    )}
                                  </Stack>
                                  
                                  <Stack spacing={1} sx={{ mb: testCasesTotalPages > 1 ? 2 : 0 }}>
                                    {paginatedTestCases.map((testCase: any, idx: number) => (
                                      <Box
                                        key={idx}
                                        sx={{
                                        p: 2,
                                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)',
                                        borderRadius: 2,
                                        border: `1px solid rgba(255, 255, 255, 0.3)`,
                                        transition: SUITECRAFT_TOKENS.transitions.normal,
                                        '&:hover': {
                                          boxShadow: SUITECRAFT_TOKENS.effects.shadow.sm,
                                          background: 'rgba(255, 255, 255, 0.3)',
                                        },
                                        }}
                                      >
                                        <Stack direction="row" spacing={2} alignItems="flex-start">
                                          <TestCaseIcon 
                                            fontSize="small" 
                                            sx={{ color: SUITECRAFT_TOKENS.colors.text.tertiary, mt: 0.5 }} 
                                          />
                                          <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={500}>
                                              {testCase.title || testCase.name || 'Test Case'}
                                            </Typography>
                                            {testCase.description && (
                                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                {testCase.description}
                                              </Typography>
                                            )}
                                          </Box>
                                          {testCase.status && (
                                            <StatusChip status={testCase.status} />
                                          )}
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Stack>
                                  
                                  {/* Test Cases Pagination */}
                                  {testCasesTotalPages > 1 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                      <Pagination
                                        count={testCasesTotalPages}
                                        page={currentTestCasesPage}
                                        onChange={(_, page) => handleTestCasesPageChange(ticket.issue_key, page)}
                                        size="small"
                                        sx={{
                                          '& .MuiPaginationItem-root': {
                                            borderRadius: 2,
                                          },
                                          '& .Mui-selected': {
                                            bgcolor: SUITECRAFT_TOKENS.colors.primary + '20',
                                            color: SUITECRAFT_TOKENS.colors.primary,
                                          },
                                        }}
                                      />
                                    </Box>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                                  No test cases available
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </GlassCard>

      {/* Tickets Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <GlassCard sx={{ py: 2, px: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Showing {((ticketsPage - 1) * TICKETS_PER_PAGE) + 1} - {Math.min(ticketsPage * TICKETS_PER_PAGE, allCurrentTickets.length)} of {allCurrentTickets.length} tickets
              </Typography>
              <Pagination
                count={totalPages}
                page={ticketsPage}
                onChange={(_, page) => setTicketsPage(page)}
                sx={{
                  '& .MuiPaginationItem-root': {
                    borderRadius: 2,
                  },
                  '& .Mui-selected': {
                    bgcolor: SUITECRAFT_TOKENS.colors.primary,
                    color: 'white',
                    '&:hover': {
                      bgcolor: SUITECRAFT_TOKENS.colors.primaryDark,
                    },
                  },
                }}
              />
            </Stack>
          </GlassCard>
        </Box>
      )}
    </Box>
  );
}
