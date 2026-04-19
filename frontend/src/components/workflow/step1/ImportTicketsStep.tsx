import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  CheckCircle as CheckIcon,
  Description as TicketIcon,
  PlaylistAddCheck as TestCaseIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Shield as CoverageIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import { integrationService } from '../../../services/api';
import { SUITECRAFT_TOKENS } from '../../../styles/theme';

interface ImportTicketsStepProps {
  releaseId: string;
  releaseVersion?: string;
  selectedTickets?: any[];
  selectedTestCases?: any[];
  onComplete: (data: { tickets: any[]; testCases: any[] }) => void;
  isReadOnly: boolean;
}

type CoverageMode = 'recommended' | 'gaps' | 'all';

const PRIORITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#FEE2E2', color: '#DC2626', label: 'Critical' },
  high: { bg: '#FEF3C7', color: '#B45309', label: 'High' },
  medium: { bg: '#DBEAFE', color: '#2563EB', label: 'Medium' },
  low: { bg: '#DCFCE7', color: '#15803D', label: 'Low' },
};

const TEST_CASE_PAGE_SIZE = 500;
const TICKETS_PER_PAGE = 8;
const TESTS_PER_PAGE = 8;

export default function ImportTicketsStep({
  releaseId,
  releaseVersion,
  selectedTickets: initialSelectedTickets = [],
  selectedTestCases: initialSelectedTestCases = [],
  onComplete,
  isReadOnly,
}: ImportTicketsStepProps) {
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [testCaseSearchQuery, setTestCaseSearchQuery] = useState('');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('recommended');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(
    new Set((initialSelectedTickets || []).map((ticket) => getTicketId(ticket)))
  );
  const [includedTestCases, setIncludedTestCases] = useState<Set<string>>(new Set());
  const [excludedLinkedTestCases, setExcludedLinkedTestCases] = useState<Set<string>>(new Set());
  const [resolvedTestCases, setResolvedTestCases] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [testCasePage, setTestCasePage] = useState(1);
  const lastCompletionSignature = useRef('');

  const {
    data: ticketsData,
    isLoading: loadingTickets,
    isFetching: fetchingTickets,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['integration-tickets', releaseId, releaseVersion],
    queryFn: async () => {
      const response = await integrationService.getTicketsWithTestCases(
        releaseVersion ? [releaseVersion] : []
      );
      return response.data;
    },
    enabled: !!releaseId,
    refetchOnWindowFocus: false,
  });

  const stories = ticketsData?.stories || [];
  const bugs = ticketsData?.bugs || [];
  const allTickets = useMemo(() => [...stories, ...bugs], [stories, bugs]);
  const selectedTicketList = useMemo(
    () => allTickets.filter((ticket: any) => selectedTickets.has(getTicketId(ticket))),
    [allTickets, selectedTickets]
  );
  const initialSelectedTicketIds = useMemo(
    () => new Set((initialSelectedTickets || []).map((ticket) => getTicketId(ticket)).filter(Boolean)),
    [initialSelectedTickets]
  );
  const initialSelectedTicketList = useMemo(
    () => allTickets.filter((ticket: any) => initialSelectedTicketIds.has(getTicketId(ticket))),
    [allTickets, initialSelectedTicketIds]
  );
  const ticketDataReady = Boolean(ticketsData) || !releaseVersion;

  const linkedTestCases = useMemo(() => {
    const map = new Map<string, any>();
    allTickets.forEach((ticket: any) => {
      (ticket.test_cases || []).forEach((testCase: any) => {
        const id = getTestCaseId(testCase);
        if (id) {
          map.set(id, normalizeTestCase(testCase));
        }
      });
    });
    return Array.from(map.values());
  }, [allTickets]);

  const scopedLinkedTestCases = useMemo(() => {
    const map = new Map<string, any>();
    selectedTicketList.forEach((ticket: any) => {
      (ticket.test_cases || []).forEach((testCase: any) => {
        const id = getTestCaseId(testCase);
        if (id) {
          map.set(id, normalizeTestCase(testCase));
        }
      });
    });
    return Array.from(map.values());
  }, [selectedTicketList]);
  const initialScopedLinkedTestCaseIds = useMemo(() => {
    const ids = new Set<string>();
    initialSelectedTicketList.forEach((ticket: any) => {
      (ticket.test_cases || []).forEach((testCase: any) => {
        const id = getTestCaseId(testCase);
        if (id) {
          ids.add(id);
        }
      });
    });
    return ids;
  }, [initialSelectedTicketList]);

  const scopedLinkedTestCaseIds = useMemo(
    () => new Set(scopedLinkedTestCases.map((testCase: any) => getTestCaseId(testCase)).filter(Boolean)),
    [scopedLinkedTestCases]
  );
  const initialSelectedTestCaseIds = useMemo(
    () => new Set((initialSelectedTestCases || []).map((testCase) => getTestCaseId(testCase)).filter(Boolean)),
    [initialSelectedTestCases]
  );
  const hasUnresolvedInitialSelections = useMemo(
    () => Array.from(initialSelectedTestCaseIds).some((testCaseId) => !scopedLinkedTestCaseIds.has(testCaseId)),
    [initialSelectedTestCaseIds, scopedLinkedTestCaseIds]
  );
  const shouldLoadCsv =
    coverageMode !== 'recommended' ||
    includedTestCases.size > 0 ||
    !!aiAnalysis ||
    hasUnresolvedInitialSelections;

  const {
    data: testCasesPages,
    isLoading: loadingTestCases,
    isFetching: fetchingTestCases,
    refetch: refetchTestCases,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['testrail-csv-all-browse'],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await integrationService.getAllTestRailCSV(TEST_CASE_PAGE_SIZE, pageParam as number);
      return response.data;
    },
    enabled: shouldLoadCsv,
    refetchOnWindowFocus: false,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum: number, page: any) => sum + (page.test_cases?.length || 0), 0);
      return loaded < (lastPage.total || 0) ? loaded : undefined;
    },
  });

  const allCsvTestCases = useMemo(
    () =>
      (testCasesPages?.pages || [])
        .flatMap((page: any) => page.test_cases || [])
        .map((testCase: any) => normalizeTestCase(testCase)),
    [testCasesPages]
  );

  const totalCsvTestCases = testCasesPages?.pages?.[0]?.total || allCsvTestCases.length;

  const testCaseLookup = useMemo(() => {
    const map = new Map<string, any>();
    [...allCsvTestCases, ...linkedTestCases, ...scopedLinkedTestCases, ...resolvedTestCases].forEach((testCase) => {
      const id = getTestCaseId(testCase);
      if (id) {
        map.set(id, testCase);
      }
    });
    return map;
  }, [allCsvTestCases, linkedTestCases, scopedLinkedTestCases, resolvedTestCases]);

  useEffect(() => {
    const initialIds = new Set((initialSelectedTestCases || []).map((testCase) => getTestCaseId(testCase)).filter(Boolean));
    const nextIncluded = new Set<string>();
    const nextExcluded = new Set<string>();

    initialIds.forEach((testCaseId) => {
      if (!initialScopedLinkedTestCaseIds.has(testCaseId)) {
        nextIncluded.add(testCaseId);
      }
    });

    initialScopedLinkedTestCaseIds.forEach((testCaseId) => {
      if (!initialIds.has(testCaseId)) {
        nextExcluded.add(testCaseId);
      }
    });

    setIncludedTestCases((currentIncluded) =>
      areSetsEqual(currentIncluded, nextIncluded) ? currentIncluded : nextIncluded
    );
    setExcludedLinkedTestCases((currentExcluded) =>
      areSetsEqual(currentExcluded, nextExcluded) ? currentExcluded : nextExcluded
    );
  }, [initialSelectedTestCases, initialScopedLinkedTestCaseIds]);

  const effectiveSelectedTestCaseIds = useMemo(() => {
    const ids = new Set<string>();
    scopedLinkedTestCaseIds.forEach((id) => {
      if (!excludedLinkedTestCases.has(id)) {
        ids.add(id);
      }
    });
    includedTestCases.forEach((id) => ids.add(id));
    return ids;
  }, [scopedLinkedTestCaseIds, excludedLinkedTestCases, includedTestCases]);

  const effectiveSelectedTestCases = useMemo(
    () =>
      Array.from(effectiveSelectedTestCaseIds)
        .map((testCaseId) => testCaseLookup.get(testCaseId))
        .filter(Boolean),
    [effectiveSelectedTestCaseIds, testCaseLookup]
  );
  const initialSelectionFullyResolved = useMemo(
    () =>
      Array.from(initialSelectedTestCaseIds).every((testCaseId) =>
        effectiveSelectedTestCaseIds.has(testCaseId) || testCaseLookup.has(testCaseId)
      ),
    [effectiveSelectedTestCaseIds, initialSelectedTestCaseIds, testCaseLookup]
  );
  const testSelectionHydrated = initialSelectedTestCaseIds.size === 0
    ? (!shouldLoadCsv || !loadingTestCases || effectiveSelectedTestCases.length > 0)
    : initialSelectionFullyResolved;
  const selectedTicketsForPersistence = ticketDataReady ? selectedTicketList : initialSelectedTickets;
  const selectedTestCasesForPersistence = testSelectionHydrated ? effectiveSelectedTestCases : initialSelectedTestCases;

  const aiRecommendedIds = useMemo(() => {
    const ids = new Set<string>();
    aiAnalysis?.recommended_sections?.forEach((section: any) => {
      section.recommended_test_ids?.forEach((id: string) => ids.add(id));
    });
    aiAnalysis?.additional_test_ids?.forEach((id: string) => ids.add(id));
    return ids;
  }, [aiAnalysis]);

  const aiRecommendedCases = useMemo(
    () =>
      Array.from(aiRecommendedIds)
        .map((id) => testCaseLookup.get(id))
        .filter(Boolean),
    [aiRecommendedIds, testCaseLookup]
  );

  const gapCoverageCases = useMemo(() => {
    const highPriorityCases = allCsvTestCases.filter((testCase: any) => {
      const priority = getPriorityKey(testCase.priority || testCase.priority_label || testCase.Priority);
      return (priority === 'critical' || priority === 'high') && !effectiveSelectedTestCaseIds.has(getTestCaseId(testCase));
    });
    return dedupeTestCases([...aiRecommendedCases, ...highPriorityCases]);
  }, [aiRecommendedCases, allCsvTestCases, effectiveSelectedTestCaseIds]);

  const displayedTestCases = useMemo(() => {
    let baseCases: any[] = [];

    if (coverageMode === 'recommended') {
      baseCases = scopedLinkedTestCases;
    } else if (coverageMode === 'gaps') {
      baseCases = gapCoverageCases;
    } else {
      baseCases = allCsvTestCases;
    }

    if (!testCaseSearchQuery) {
      return baseCases;
    }

    const query = testCaseSearchQuery.toLowerCase();
    return baseCases.filter((testCase) => {
      const haystack = [
        getTestCaseId(testCase),
        testCase.title,
        testCase.section,
        testCase.section_hierarchy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [coverageMode, scopedLinkedTestCases, gapCoverageCases, allCsvTestCases, testCaseSearchQuery]);

  const filteredTickets = useMemo(() => {
    if (!ticketSearchQuery) {
      return allTickets;
    }
    const query = ticketSearchQuery.toLowerCase();
    return allTickets.filter((ticket: any) => {
      const haystack = [getTicketId(ticket), ticket.summary, ticket.title, ticket.issue_type, ticket.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allTickets, ticketSearchQuery]);

  useEffect(() => {
    setTicketPage(1);
  }, [ticketSearchQuery, releaseVersion]);

  useEffect(() => {
    lastCompletionSignature.current = '';
  }, [releaseVersion]);

  useEffect(() => {
    const nextSelectedTickets = new Set(
      (initialSelectedTickets || []).map((ticket) => getTicketId(ticket)).filter(Boolean)
    );

    setSelectedTickets((currentSelectedTickets) =>
      areSetsEqual(currentSelectedTickets, nextSelectedTickets)
        ? currentSelectedTickets
        : nextSelectedTickets
    );
  }, [initialSelectedTickets]);

  useEffect(() => {
    setTestCasePage(1);
  }, [coverageMode, testCaseSearchQuery]);

  useEffect(() => {
    if (!ticketDataReady || !testSelectionHydrated) {
      return;
    }

    const ticketSignature = selectedTicketsForPersistence
      .map((ticket) => getTicketId(ticket))
      .filter(Boolean)
      .sort()
      .join('|');
    const testCaseSignature = selectedTestCasesForPersistence
      .map((testCase) => getTestCaseId(testCase))
      .filter(Boolean)
      .sort()
      .join('|');
    const completionSignature = `${ticketSignature}::${testCaseSignature}`;

    if (lastCompletionSignature.current === completionSignature) {
      return;
    }

    lastCompletionSignature.current = completionSignature;
    onComplete({
      tickets: selectedTicketsForPersistence,
      testCases: selectedTestCasesForPersistence,
    });
  }, [ticketDataReady, testSelectionHydrated, selectedTicketsForPersistence, selectedTestCasesForPersistence, onComplete]);

  const scopeSummary = {
    tickets: selectedTickets.size,
    linkedCoverage: scopedLinkedTestCases.length,
    selectedCoverage: effectiveSelectedTestCaseIds.size,
    risks: aiAnalysis?.overall_risk ? aiAnalysis.overall_risk.toUpperCase() : 'Pending',
  };

  const directMatchCount = useMemo(
    () => scopedLinkedTestCases.filter((testCase: any) => testCase.match_type === 'direct_ticket_match').length,
    [scopedLinkedTestCases]
  );
  const inferredMatchCount = useMemo(
    () => scopedLinkedTestCases.filter((testCase: any) => testCase.match_type === 'summary_keyword_match').length,
    [scopedLinkedTestCases]
  );
  const storiesWithoutCoverage = useMemo(
    () => selectedTicketList.filter(
      (ticket: any) => !String(ticket.issue_type || '').toLowerCase().includes('bug') && (ticket.test_cases_count || 0) === 0
    ).length,
    [selectedTicketList]
  );
  const readyToContinue = selectedTickets.size > 0;
  const coverageDecisionLabel = selectedTickets.size === 0
    ? 'Choose the release tickets first.'
    : scopedLinkedTestCases.length === 0
      ? 'No linked coverage found yet for this scope.'
      : 'Review linked coverage and trim noise before moving on.';
  const linkedCoverageTabLabel = `Linked To Selected Tickets (${scopedLinkedTestCases.length})`;
  const suggestedCoverageTabLabel = `Suggested Missing Coverage (${gapCoverageCases.length})`;
  const allCoverageTabLabel = shouldLoadCsv ? `Browse All Tests (${totalCsvTestCases})` : 'Browse All Tests';

  const handleToggleTicket = useCallback((ticketId: string) => {
    if (isReadOnly) return;

    setSelectedTickets((currentTickets) => {
      const nextTickets = new Set(currentTickets);

      if (nextTickets.has(ticketId)) {
        nextTickets.delete(ticketId);
      } else {
        nextTickets.add(ticketId);
      }

      return nextTickets;
    });
  }, [isReadOnly]);

  const handleTicketCheckboxClick = useCallback((event: React.MouseEvent, ticketId: string) => {
    event.stopPropagation();
    handleToggleTicket(ticketId);
  }, [handleToggleTicket]);

  const handleSelectAllTickets = useCallback(() => {
    if (isReadOnly) return;

    const shouldSelectAll = selectedTickets.size !== allTickets.length;
    const nextTickets = shouldSelectAll
      ? new Set(allTickets.map((ticket: any) => getTicketId(ticket)))
      : new Set<string>();

    setSelectedTickets(nextTickets);
    if (!shouldSelectAll) {
      setIncludedTestCases(new Set());
      setExcludedLinkedTestCases(new Set());
    }
  }, [allTickets, isReadOnly, selectedTickets.size]);

  const handleToggleTestCase = useCallback((testCaseId: string) => {
    if (isReadOnly) return;

    if (scopedLinkedTestCaseIds.has(testCaseId)) {
      setExcludedLinkedTestCases((currentExcluded) => {
        const nextExcluded = new Set(currentExcluded);
        if (effectiveSelectedTestCaseIds.has(testCaseId)) {
          nextExcluded.add(testCaseId);
        } else {
          nextExcluded.delete(testCaseId);
        }
        return nextExcluded;
      });
    } else {
      setIncludedTestCases((currentIncluded) => {
        const nextIncluded = new Set(currentIncluded);
        if (nextIncluded.has(testCaseId)) {
          nextIncluded.delete(testCaseId);
        } else {
          nextIncluded.add(testCaseId);
        }
        return nextIncluded;
      });
    }
  }, [effectiveSelectedTestCaseIds, isReadOnly, scopedLinkedTestCaseIds]);

  const handleTestCaseCheckboxClick = useCallback((event: React.MouseEvent, testCaseId: string) => {
    event.stopPropagation();
    handleToggleTestCase(testCaseId);
  }, [handleToggleTestCase]);

  const handleRefreshData = useCallback(async () => {
    setIsRefreshingData(true);
    try {
      await Promise.all([
        refetchTickets(),
        shouldLoadCsv ? refetchTestCases() : Promise.resolve(null),
      ]);
    } finally {
      setIsRefreshingData(false);
    }
  }, [refetchTickets, refetchTestCases, shouldLoadCsv]);

  const runAiAnalysis = async () => {
    if (selectedTickets.size === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const ticketsToAnalyze = allTickets.filter((ticket: any) => selectedTickets.has(getTicketId(ticket)));
      const response = await retryAsync(
        () => integrationService.analyzeTestImpact(ticketsToAnalyze),
        3,
        900
      );
      setAiAnalysis(response.data.analysis);
      setCoverageMode('gaps');
    } catch (error) {
      console.error('AI Analysis error:', error);
      setAiAnalysis(null);
      setAnalysisError(extractApiErrorMessage(error, 'Actual AI impact analysis is unavailable right now.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyAiRecommendations = async () => {
    if (!aiAnalysis || isReadOnly) return;

    const missingIds = Array.from(aiRecommendedIds).filter((id) => !testCaseLookup.has(id));
    if (missingIds.length > 0) {
      try {
        const response = await integrationService.getTestRailCSVByIds(missingIds);
        const fetchedCases = (response.data.test_cases || []).map((testCase: any) => normalizeTestCase(testCase));
        setResolvedTestCases((prev) => dedupeTestCases([...prev, ...fetchedCases]));
      } catch (error) {
        console.error('Failed to resolve AI-recommended test cases:', error);
      }
    }

    const nextIncluded = new Set(includedTestCases);
    const nextExcluded = new Set(excludedLinkedTestCases);
    aiRecommendedIds.forEach((id) => {
      nextIncluded.add(id);
      nextExcluded.delete(id);
    });
    setIncludedTestCases(nextIncluded);
    setExcludedLinkedTestCases(nextExcluded);
  };

  const ticketPageCount = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE));
  const totalCoverageItems = coverageMode === 'all' ? totalCsvTestCases : displayedTestCases.length;
  const testCasePageCount = Math.max(1, Math.ceil(totalCoverageItems / TESTS_PER_PAGE));

  const visibleTickets = filteredTickets.slice((ticketPage - 1) * TICKETS_PER_PAGE, ticketPage * TICKETS_PER_PAGE);
  const visibleDisplayedTestCases = displayedTestCases.slice((testCasePage - 1) * TESTS_PER_PAGE, testCasePage * TESTS_PER_PAGE);

  useEffect(() => {
    if (ticketPage > ticketPageCount) {
      setTicketPage(ticketPageCount);
    }
  }, [ticketPage, ticketPageCount]);

  useEffect(() => {
    if (testCasePage > testCasePageCount) {
      setTestCasePage(testCasePageCount);
    }
  }, [testCasePage, testCasePageCount]);

  useEffect(() => {
    if (
      coverageMode === 'all' &&
      hasNextPage &&
      !isFetchingNextPage &&
      displayedTestCases.length < testCasePage * TESTS_PER_PAGE
    ) {
      fetchNextPage();
    }
  }, [coverageMode, displayedTestCases.length, fetchNextPage, hasNextPage, isFetchingNextPage, testCasePage]);

  if (loadingTickets) {
    return (
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid rgba(255,255,255,0.58)', background: 'linear-gradient(180deg, rgba(255,255,255,0.36) 0%, rgba(245,250,251,0.16) 100%)', backdropFilter: 'blur(22px)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.76)' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Preparing release scope and coverage context...
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.25, md: 2.75 },
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.60)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.18) 100%)',
          backdropFilter: 'blur(24px) saturate(170%)',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255,255,255,0.78)',
        }}
      >
          <Stack spacing={2.25}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box sx={{ maxWidth: 760 }}>
                <Chip label="Step 1 - Scope Release" size="small" sx={{ mb: 1.25, bgcolor: '#FFF1EC', color: SUITECRAFT_TOKENS.colors.primary, fontWeight: 700 }} />
                <Typography variant="h5" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                Build a clean release scope before generating the plan.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                Select the tickets in scope, inspect linked regression coverage, and use AI impact analysis only where it helps the decision.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'row', md: 'column' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={isRefreshingData || fetchingTickets || fetchingTestCases ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                onClick={handleRefreshData}
                disabled={isRefreshingData}
                sx={{ textTransform: 'none', borderRadius: 999 }}
              >
                {isRefreshingData || fetchingTickets || fetchingTestCases ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              </Stack>
            </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.28)',
              border: '1px solid rgba(255,255,255,0.44)',
              backdropFilter: 'blur(18px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.68)',
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
                <Stack spacing={2.2}>
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
                      STEP 1 SCOPE BRIEF
                    </Typography>
                  </Stack>

                  <Box sx={{ maxWidth: 900 }}>
                    <Typography
                      variant="h4"
                      fontWeight={800}
                      sx={{
                        mb: 1.2,
                        fontSize: { xs: '1.6rem', md: '2.05rem' },
                        lineHeight: 1.12,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {selectedTickets.size === 0
                        ? 'Start by selecting the release tickets that should drive the regression plan.'
                        : 'Review linked coverage first. Only carry forward the tests that sharpen planning.'}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.9)', lineHeight: 1.75, fontSize: { xs: '0.98rem', md: '1.05rem' }, mb: 1.65 }}>
                      {coverageDecisionLabel}
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
                      REVIEW FLOW
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {[
                        '1. Choose tickets',
                        '2. Audit linked tests',
                        '3. Remove noise',
                        '4. Add true gaps',
                      ].map((item, index) => (
                        <Chip
                          key={item}
                          label={item}
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
                      ))}
                    </Stack>
                  </Box>

                  <Typography sx={{ color: '#FDBA74', lineHeight: 1.75, maxWidth: 920, fontSize: '0.98rem' }}>
                    <Box component="span" sx={{ fontWeight: 800, color: '#FED7AA' }}>
                      How it works:
                    </Box>{' '}
                    choose tickets, review the tests linked to those selected tickets, remove noise, then add missing coverage
                    only if it materially improves the plan.
                  </Typography>
                </Stack>
              </Box>

              <Box
                sx={{
                  width: { xs: '100%', xl: 360 },
                  flexShrink: 0,
                  p: { xs: 2, md: 2.25 },
                  borderRadius: 4,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(248,250,252,0.16) 100%)',
                  border: '1px solid rgba(255,255,255,0.52)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255,255,255,0.72)',
                }}
              >
                <Stack spacing={1.4}>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, letterSpacing: '0.08em' }}>
                    RELEASE SNAPSHOT
                  </Typography>

                  <Stack spacing={1}>
                    <ScopeBriefingCard icon={<TicketIcon />} label="Scoped Tickets" value={scopeSummary.tickets} tone="slate" />
                    <ScopeBriefingCard icon={<TestCaseIcon />} label="Selected Tests" value={scopeSummary.selectedCoverage} tone="violet" />
                    <ScopeBriefingCard icon={<InsightsIcon />} label="Release Risk" value={scopeSummary.risks} tone="amber" />
                  </Stack>

                  <Box
                    sx={{
                      p: 1.35,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.16)',
                      border: '1px solid rgba(255,255,255,0.36)',
                      backdropFilter: 'blur(14px)',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#0F172A', fontWeight: 700, mb: 0.4 }}>
                      Scope note
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.65 }}>
                      {selectedTickets.size === 0
                        ? 'Select the release-driving tickets first, then evaluate whether the linked coverage already gives enough confidence.'
                        : `${scopedLinkedTestCases.length} linked tests are already attached to this scope. Add more only when the current set still leaves a meaningful planning gap.`}
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    startIcon={isAnalyzing ? <CircularProgress size={18} color="inherit" /> : <AIIcon />}
                    onClick={runAiAnalysis}
                    disabled={selectedTickets.size === 0 || isAnalyzing}
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
                    {isAnalyzing ? 'Analyzing Impact...' : 'Run Impact Analysis'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      {analysisError && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
            Step 1 requires actual AI analysis.
          </Typography>
          <Typography variant="body2">
            {analysisError}
          </Typography>
        </Alert>
      )}

      {aiAnalysis && (
          <Alert
            icon={<AIIcon />}
            severity={aiAnalysis.overall_risk === 'high' ? 'warning' : 'info'}
            sx={{ borderRadius: 3, alignItems: 'flex-start' }}
            action={
              <Button color="inherit" size="small" onClick={applyAiRecommendations} disabled={isReadOnly} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Apply Suggested Coverage
              </Button>
            }
          >
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
            {`AI impact analysis marked this release as ${aiAnalysis.overall_risk?.toUpperCase() || 'UNKNOWN'} risk.`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {aiAnalysis.summary || 'Recommended sections and additional high-value tests are ready for review in the Coverage Gaps view.'}
          </Typography>
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.54)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.14) 100%)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.72)',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
            <SummaryCard icon={<TicketIcon />} label="Scoped Tickets" value={selectedTickets.size} tone="#2563EB" bg="#EFF6FF" />
            <SummaryCard icon={<CoverageIcon />} label="Linked Coverage" value={scopedLinkedTestCases.length} tone="#0F766E" bg="#ECFEFF" />
            <SummaryCard icon={<TestCaseIcon />} label="Selected Tests" value={effectiveSelectedTestCaseIds.size} tone="#7C3AED" bg="#F5F3FF" />
            <SummaryCard icon={<InsightsIcon />} label="Missing Coverage" value={storiesWithoutCoverage} tone="#B45309" bg="#FFF7ED" />
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              minWidth: { lg: 280 },
              borderRadius: 3,
              bgcolor: readyToContinue ? 'rgba(236,253,245,0.72)' : 'rgba(255,247,237,0.76)',
              border: '1px solid rgba(255,255,255,0.44)',
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.4 }}>
              Continue Readiness
            </Typography>
            <Typography variant="body2" fontWeight={800} sx={{ color: readyToContinue ? '#166534' : '#B45309', mb: 0.35 }}>
              {readyToContinue ? 'Scope is ready for planning' : 'Select at least one ticket to continue'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {readyToContinue
                ? 'Review coverage quality, then move into strategy generation.'
                : 'The workflow needs a release scope before the next step becomes trustworthy.'}
            </Typography>
          </Paper>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', gap: 3, alignItems: { xs: 'flex-start', xl: 'stretch' }, flexDirection: { xs: 'column', xl: 'row' } }}>
        <Paper
          elevation={0}
        sx={{
          flex: 1,
          minWidth: 0,
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.54)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
          boxShadow: '0 12px 26px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.72)',
        }}
      >
          <Stack spacing={2.5} sx={{ flex: 1 }}>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 }}>
                Release Inputs
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                1. Select Release Tickets
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose the tickets that should be part of this release test plan. When you select a ticket, its linked test coverage is pulled into the coverage review automatically.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by ticket ID, summary, type, or status"
                value={ticketSearchQuery}
                onChange={(event) => setTicketSearchQuery(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="outlined"
                onClick={handleSelectAllTickets}
                disabled={allTickets.length === 0 || isReadOnly}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 999 }}
              >
                {selectedTickets.size === allTickets.length ? 'Clear Scope' : 'Select All Tickets'}
              </Button>
            </Stack>

            <Stack spacing={1} sx={{ flex: 1 }}>
              {filteredTickets.length === 0 ? (
                <EmptyState
                  title="No tickets matched your search"
                  description="Try adjusting the search terms or refresh the connected release data."
                />
              ) : (
                visibleTickets.map((ticket: any) => {
                  const ticketId = getTicketId(ticket);
                  const selected = selectedTickets.has(ticketId);
                  const linkedCount = ticket.test_cases_count || ticket.test_cases?.length || 0;
                  const priority = getPriorityStyle(ticket.priority);

                  return (
                    <Paper
                      key={ticketId}
                      elevation={0}
                      onClick={() => handleToggleTicket(ticketId)}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: selected ? `${SUITECRAFT_TOKENS.colors.primary}55` : 'rgba(148, 163, 184, 0.22)',
                        bgcolor: selected ? 'rgba(255, 88, 65, 0.08)' : 'rgba(255,255,255,0.34)',
                        cursor: isReadOnly ? 'default' : 'pointer',
                        transition: 'border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease',
                        transform: 'translateZ(0)',
                        '&:hover': isReadOnly
                          ? undefined
                          : {
                              borderColor: `${SUITECRAFT_TOKENS.colors.primary}70`,
                              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
                            },
                      }}
                    >
                      <Stack spacing={0.9}>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                          <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
                            <Checkbox
                              checked={selected}
                              tabIndex={-1}
                              disableRipple
                              onClick={(event) => handleTicketCheckboxClick(event, ticketId)}
                              sx={{
                                p: 0.25,
                                mt: -0.2,
                                color: 'rgba(100,116,139,0.7)',
                                '&.Mui-checked': { color: SUITECRAFT_TOKENS.colors.primary },
                              }}
                            />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.55 }}>
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#0F172A', fontFamily: 'monospace' }}>
                                  {ticketId}
                                </Typography>
                                <Chip size="small" label={ticket.issue_type || 'Ticket'} variant="outlined" />
                                <Chip
                                  size="small"
                                  label={priority.label}
                                  sx={{ bgcolor: priority.bg, color: priority.color, fontWeight: 700 }}
                                />
                                <Chip size="small" label={`${linkedCount} linked tests`} sx={{ bgcolor: '#F8FAFC', color: '#334155', fontWeight: 700 }} />
                                
                              </Stack>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#0F172A', mb: 0.35, lineHeight: 1.45 }}>
                                {ticket.summary || ticket.title || 'Untitled ticket'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Status: {ticket.status || 'Unknown'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>

            {filteredTickets.length > TICKETS_PER_PAGE && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 'auto' }}
              >
                <Typography variant="caption" color="text.secondary">
                  Page {ticketPage} of {ticketPageCount}
                </Typography>
                <Pagination
                  page={ticketPage}
                  count={ticketPageCount}
                  onChange={(_, page) => setTicketPage(page)}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                  siblingCount={0}
                  boundaryCount={1}
                />
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper
          elevation={0}
        sx={{
          flex: 1,
          minWidth: 0,
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.54)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 100%)',
          boxShadow: '0 12px 26px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.72)',
        }}
      >
          <Stack spacing={2.5} sx={{ flex: 1 }}>
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 }}>
                Coverage Review
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
                2. Review Coverage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start with tests linked to the selected tickets. Then remove noise, add missing tests, and use AI suggestions only if you need more coverage ideas.
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                alignItems: 'center',
                overflowX: 'auto',
                pb: 0.5,
              }}
            >
              {[
                { key: 'recommended', label: linkedCoverageTabLabel },
                { key: 'gaps', label: suggestedCoverageTabLabel },
                { key: 'all', label: allCoverageTabLabel },
              ].map((option) => (
                <Button
                  key={option.key}
                  size="small"
                  variant={coverageMode === option.key ? 'contained' : 'outlined'}
                  onClick={() => setCoverageMode(option.key as CoverageMode)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    ...(coverageMode === option.key
                      ? {
                          bgcolor: '#0F172A',
                          '&:hover': { bgcolor: '#020617' },
                        }
                      : {}),
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </Box>

            <TextField
              fullWidth
              size="small"
              placeholder="Search linked or suggested tests by ID, title, or section"
              value={testCaseSearchQuery}
              onChange={(event) => setTestCaseSearchQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {shouldLoadCsv && loadingTestCases && allCsvTestCases.length === 0 && coverageMode !== 'recommended' && (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                Loading TestRail coverage for this view...
              </Alert>
            )}

            <Stack spacing={1} sx={{ flex: 1 }}>
              {displayedTestCases.length === 0 ? (
                <EmptyState
                  title="No tests in this view yet"
                  description={coverageMode === 'gaps'
                    ? 'Run impact analysis or broaden the release scope to surface more recommended coverage.'
                    : 'No tests were found for the current search and filter combination.'}
                />
              ) : (
                visibleDisplayedTestCases.map((testCase: any) => {
                  const testCaseId = getTestCaseId(testCase);
                  const selected = effectiveSelectedTestCaseIds.has(testCaseId);
                  const priority = getPriorityStyle(testCase.priority || testCase.priority_label || testCase.Priority);
                  const aiSuggested = aiRecommendedIds.has(testCaseId);
                  const matchType = String(testCase.match_type || '');
                  const isDirectLinkedMatch = matchType === 'direct_ticket_match';
                  const isInferredLinkedMatch = matchType === 'summary_keyword_match';

                  return (
                    <Paper
                      key={testCaseId}
                      elevation={0}
                      onClick={() => handleToggleTestCase(testCaseId)}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: selected ? '#7C3AED55' : 'rgba(148, 163, 184, 0.22)',
                        bgcolor: selected ? 'rgba(124, 58, 237, 0.08)' : 'rgba(255,255,255,0.34)',
                        cursor: isReadOnly ? 'default' : 'pointer',
                        transition: 'border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease',
                        transform: 'translateZ(0)',
                      }}
                    >
                      <Stack spacing={0.9}>
                        <Stack direction="row" justifyContent="space-between" spacing={1.25} alignItems="flex-start">
                          <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
                            <Checkbox
                              checked={selected}
                              tabIndex={-1}
                              disableRipple
                              onClick={(event) => handleTestCaseCheckboxClick(event, testCaseId)}
                              sx={{
                                p: 0.25,
                                mt: -0.2,
                                color: 'rgba(100,116,139,0.7)',
                                '&.Mui-checked': { color: '#7C3AED' },
                              }}
                            />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.55 }}>
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#0F172A', fontFamily: 'monospace' }}>
                                  {testCaseId}
                                </Typography>
                                <Chip size="small" label={priority.label} sx={{ bgcolor: priority.bg, color: priority.color, fontWeight: 700 }} />
                                {isDirectLinkedMatch && (
                                  <Chip size="small" label="Direct Link" sx={{ bgcolor: '#ECFDF5', color: '#166534', fontWeight: 700 }} />
                                )}
                                {isInferredLinkedMatch && (
                                  <Chip size="small" label="Summary Match" sx={{ bgcolor: '#EFF6FF', color: '#1D4ED8', fontWeight: 700 }} />
                                )}
                                {aiSuggested && (
                                  <Chip size="small" icon={<AIIcon sx={{ fontSize: 14 }} />} label="AI Suggested" sx={{ bgcolor: '#F5F3FF', color: '#6D28D9', fontWeight: 700 }} />
                                )}
                              </Stack>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#0F172A', mb: 0.35, lineHeight: 1.45 }}>
                                {testCase.title || 'Untitled test case'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {testCase.section_hierarchy || testCase.section || 'General coverage'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>

            {totalCoverageItems > TESTS_PER_PAGE && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 'auto' }}
              >
                <Stack spacing={0.35}>
                  <Typography variant="caption" color="text.secondary">
                    Page {testCasePage} of {testCasePageCount}
                  </Typography>
                  {coverageMode === 'all' && isFetchingNextPage && (
                    <Typography variant="caption" color="text.secondary">
                      Loading more tests for deeper pages...
                    </Typography>
                  )}
                </Stack>
                <Pagination
                  page={testCasePage}
                  count={testCasePageCount}
                  onChange={(_, page) => setTestCasePage(page)}
                  color="secondary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                  siblingCount={0}
                  boundaryCount={1}
                />
              </Stack>
            )}

          </Stack>
        </Paper>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.28)',
          border: '1px solid rgba(255,255,255,0.44)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A' }}>
            Ready To Move On?
          </Typography>
          <InstructionLine text="Confirm the tickets you want included in this release plan." />
          <InstructionLine text="Review the tests linked to those selected tickets and remove anything irrelevant." />
          <InstructionLine text="Add missing coverage only where it materially improves the release plan." />
        </Stack>
      </Paper>

      <Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1 }}>
          AI Insight
        </Typography>
        {aiAnalysis ? (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: 'rgba(245,243,255,0.34)',
              border: '1px solid rgba(221,214,254,0.72)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight={800} sx={{ color: '#6D28D9' }}>
                {aiAnalysis.analysis_mode === 'heuristic' ? 'Heuristic Fallback' : 'AI-Backed'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {(aiAnalysis.summary || 'AI suggestions are ready for review in the coverage column.') +
                  (aiAnalysis.confidence ? ` Confidence: ${String(aiAnalysis.confidence).toUpperCase()}.` : '')}
              </Typography>
              {Array.isArray(aiAnalysis.impacted_areas) && aiAnalysis.impacted_areas.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {aiAnalysis.impacted_areas.slice(0, 6).map((area: string) => (
                    <Chip
                      key={area}
                      size="small"
                      label={area}
                      sx={{ bgcolor: 'rgba(255,255,255,0.46)', color: '#6D28D9', fontWeight: 700, backdropFilter: 'blur(12px)' }}
                    />
                  ))}
                </Stack>
              )}
              {Array.isArray(aiAnalysis.top_risk_tickets) && aiAnalysis.top_risk_tickets.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {aiAnalysis.top_risk_tickets.slice(0, 4).map((ticket: string) => (
                    <Chip
                      key={ticket}
                      size="small"
                      label={`Risk: ${ticket}`}
                      sx={{ bgcolor: 'rgba(255,255,255,0.46)', color: '#7C2D12', fontWeight: 700, backdropFilter: 'blur(12px)' }}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        ) : (
          <EmptyState
            title="AI analysis not run yet"
            description="Run impact analysis after selecting tickets to surface inferred gaps and suggested coverage."
          />
        )}
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#0F172A', mb: 1 }}>
          3. Scope Decision Support
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <StatusBlock
            label="Direct ticket matches"
            value={`${directMatchCount} tests`}
            tone="#0F766E"
            bg="#ECFEFF"
            description="Tests explicitly linked to the selected ticket IDs in the TestRail dataset."
          />
          <StatusBlock
            label="Inferred coverage"
            value={`${inferredMatchCount} tests`}
            tone="#7C3AED"
            bg="#F5F3FF"
            description="Suggested tests inferred from selected-ticket summaries and section overlap."
          />
          <StatusBlock
            label="CSV loaded"
            value={`${allCsvTestCases.length} tests`}
            tone="#2563EB"
            bg="#EFF6FF"
            description="Browsable TestRail cases currently loaded into this session."
          />
        </Stack>
      </Box>
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

function SummaryCard({ icon, label, value, tone, bg }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string; bg: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.75,
        minWidth: { xs: '100%', sm: 170 },
        minHeight: 104,
        borderRadius: 3,
        bgcolor: bg,
        border: '1px solid rgba(255,255,255,0.42)',
        transform: 'translateZ(0)',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ height: '100%' }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.42)',
            color: tone,
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0, pr: 0.25 }}>
          <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.25 }}>
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ color: tone, lineHeight: 1.1, wordBreak: 'break-word' }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ScopeBriefingCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: 'slate' | 'violet' | 'amber';
}) {
  const toneMap = {
    slate: {
      bg: 'linear-gradient(180deg, rgba(241,245,249,0.92) 0%, rgba(226,232,240,0.76) 100%)',
      border: 'rgba(255,255,255,0.54)',
      iconBg: 'rgba(255,255,255,0.42)',
      iconColor: '#4361D8',
      labelColor: '#64748B',
      valueColor: '#4361D8',
    },
    violet: {
      bg: 'linear-gradient(180deg, rgba(243,240,255,0.96) 0%, rgba(237,233,254,0.8) 100%)',
      border: 'rgba(255,255,255,0.54)',
      iconBg: 'rgba(255,255,255,0.42)',
      iconColor: '#7C3AED',
      labelColor: '#64748B',
      valueColor: '#7C3AED',
    },
    amber: {
      bg: 'linear-gradient(180deg, rgba(255,247,237,0.96) 0%, rgba(254,243,226,0.84) 100%)',
      border: 'rgba(255,255,255,0.54)',
      iconBg: 'rgba(255,255,255,0.42)',
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
        p: 1.35,
        minHeight: 88,
        borderRadius: 3.5,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        transform: 'translateZ(0)',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            bgcolor: colors.iconBg,
            color: colors.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 18px rgba(255,255,255,0.45)',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: colors.labelColor, fontWeight: 800, mb: 0.15 }}>
            {label}
          </Typography>
          <Typography
            sx={{
              color: colors.valueColor,
              fontWeight: 900,
              lineHeight: 1,
              fontSize: { xs: '1.35rem', sm: '1.45rem' },
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#F8FAFC', border: '1px dashed rgba(148, 163, 184, 0.45)' }}>
      <Typography variant="body2" fontWeight={700} sx={{ color: '#0F172A', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Paper>
  );
}

function StatusBlock({
  label,
  value,
  tone,
  bg,
  description,
}: {
  label: string;
  value: string;
  tone: string;
  bg: string;
  description: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 3,
        bgcolor: bg,
        border: '1px solid rgba(148, 163, 184, 0.12)',
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontWeight: 700, mb: 0.35 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={800} sx={{ color: tone, mb: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Paper>
  );
}

function InstructionLine({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: SUITECRAFT_TOKENS.colors.primary,
          mt: '7px',
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}

function getTicketId(ticket: any): string {
  return ticket?.issue_key || ticket?.ticket_id || ticket?.id || '';
}

function getTestCaseId(testCase: any): string {
  return testCase?.id || testCase?.ID || testCase?.test_case_id || testCase?.case_id || '';
}

function getPriorityKey(priority: string): 'critical' | 'high' | 'medium' | 'low' {
  const value = String(priority || '').toLowerCase();
  if (value.includes('critical') || value.includes('p0')) return 'critical';
  if (value.includes('high') || value.includes('p1')) return 'high';
  if (value.includes('low') || value.includes('p3')) return 'low';
  return 'medium';
}

function getPriorityStyle(priority: string) {
  return PRIORITY_STYLES[getPriorityKey(priority)] || PRIORITY_STYLES.medium;
}

function normalizeTestCase(testCase: any) {
  return {
    ...testCase,
    id: getTestCaseId(testCase),
    title: testCase?.title || testCase?.Title || `Test Case ${getTestCaseId(testCase)}`,
    section: testCase?.section || testCase?.Section || 'General',
    section_hierarchy: testCase?.section_hierarchy || testCase?.['Section Hierarchy'] || testCase?.Section_Hierarchy || '',
    priority: testCase?.priority || testCase?.priority_label || testCase?.Priority || 'Medium',
  };
}

function dedupeTestCases(testCases: any[]) {
  const map = new Map<string, any>();
  testCases.forEach((testCase) => {
    const id = getTestCaseId(testCase);
    if (id) map.set(id, normalizeTestCase(testCase));
  });
  return Array.from(map.values());
}

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}
