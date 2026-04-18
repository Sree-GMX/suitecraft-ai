import axios from 'axios';

const rawApiBaseUrl = import.meta.env.VITE_API_URL?.trim();
const normalizedApiOrigin = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  : '';
const API_BASE_URL = normalizedApiOrigin ? `${normalizedApiOrigin}/api/v1` : '/api/v1';

// Helper function to clear only authentication-related localStorage
const clearAuthData = () => {
  const keysToRemove = ['access_token', 'user', 'isAuthenticated'];
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface UserSummary {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
}

export interface User extends UserSummary {
  created_at: string;
  is_active: boolean;
}

export interface Release {
  id: number;
  release_name: string;
  release_version: string;
  description: string | null;
  target_date: string | null;
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  owner?: UserSummary;
  collaborators?: UserSummary[];
}

export interface ReleaseCreate {
  release_name: string;
  release_version: string;
  target_date?: string | null;
  status?: string;
  description?: string;
}

export interface ReleaseUpdate {
  release_name?: string;
  target_date?: string | null;
  description?: string;
  status?: string;
};

export interface TestPlan {
  id: number;
  release_id: number;
  title: string;
  description: string | null;
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator?: UserSummary;
}

export interface TestPlanCreate {
  release_id: number;
  title: string;
  description?: string;
}

export interface TestPlanUpdate {
  title?: string;
  description?: string;
  status?: string;
}

export interface TestCase {
  id: number;
  test_plan_id: number;
  title: string;
  description: string | null;
  steps: string | null;
  expected_result: string | null;
  status: string;
  priority: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  creator?: UserSummary;
}

export interface TestCaseCreate {
  test_plan_id: number;
  title: string;
  description?: string;
  steps?: string;
  expected_result?: string;
  priority?: string;
}

export interface TestCaseUpdate {
  title?: string;
  description?: string;
  steps?: string;
  expected_result?: string;
  status?: string;
  priority?: string;
}

export interface TestExecution {
  id: number;
  test_case_id: number;
  executed_by: number;
  result: string;
  notes: string | null;
  executed_at: string;
  executor?: UserSummary;
}

export interface TestExecutionCreate {
  test_case_id: number;
  result: string;
  notes?: string;
}

export interface Bug {
  id: number;
  release_id: number;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  reported_by: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  reporter?: UserSummary;
  assignee?: UserSummary;
}

export interface BugCreate {
  release_id: number;
  title: string;
  description?: string;
  severity: string;
  assigned_to?: number;
}

export interface BugUpdate {
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  assigned_to?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

// Auth Service
export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  register: (data: RegisterRequest) =>
    api.post<LoginResponse>('/auth/register', data),
  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post<{ message: string }>('/auth/forgot-password', data),
  resetPassword: (data: ResetPasswordRequest) =>
    api.post<{ message: string }>('/auth/reset-password', data),
};

// Test Case Service
export const testCaseService = {
  getAll: (testPlanId?: number) =>
    api.get<TestCase[]>('/test-cases/', { params: { test_plan_id: testPlanId } }),
  getById: (id: number) => api.get<TestCase>(`/test-cases/${id}`),
  create: (data: TestCaseCreate) => api.post<TestCase>('/test-cases/', data),
  update: (id: number, data: TestCaseUpdate) =>
    api.put<TestCase>(`/test-cases/${id}`, data),
  delete: (id: number) => api.delete(`/test-cases/${id}`),
};
// Bug Service
export const bugService = {
  getAll: (releaseId?: number) =>
    api.get<Bug[]>('/bugs/', { params: { release_id: releaseId } }),
  getById: (id: number) => api.get<Bug>(`/bugs/${id}`),
  create: (data: BugCreate) => api.post<Bug>('/bugs/', data),
  update: (id: number, data: BugUpdate) => api.put<Bug>(`/bugs/${id}`, data),
  delete: (id: number) => api.delete(`/bugs/${id}`),
};

// Integration types
export interface TicketsWithTestCases {
  releases?: string[];
  summary?: Record<string, any>;
  stories?: any[];
  bugs?: any[];
  tickets?: any[];
  testcases?: any[];
  [key: string]: any;
}

// Integration Service
export const integrationService = {
  list: () =>
    api.get<any[]>('/integrations'),
  getTicketsWithTestCases: (releases: string[], projectId?: number) =>
    api.get<any>('/integrations/tickets-with-testcases', {
      params: { release_versions: releases.join(','), testrail_project_id: projectId },
    }),
  getReleases: () =>
    api.get<string[]>('/integrations/google-sheets/releases'),
  getTestRailCSVStats: () =>
    api.get<any>('/integrations/testrail-csv/stats'),
  getAllTestRailCSV: (limit = 1000, offset = 0) =>
    api.get<any>('/integrations/testrail-csv/all', {
      params: { limit, offset },
    }),
  searchTestRailCSV: (searchTerm: string) =>
    api.get<any>('/integrations/testrail-csv/search', {
      params: { search_term: searchTerm },
    }),
  getTestRailCSVByIds: (ids: string[]) =>
    api.get<any>('/integrations/testrail-csv/by-ids', {
      params: { ids: ids.join(',') },
    }),
  analyzeTestImpact: (selectedTickets: any[], allTestCases?: any[]) =>
    api.post<any>('/integrations/ai/analyze-test-impact', {
      selected_tickets: selectedTickets,
      all_test_cases: allTestCases,
    }),
  generateTestPlan: (selectedTickets: any[], selectedTestCases: any[], releaseInfo: any, options?: { forceRefresh?: boolean }) =>
    api.post<any>('/integrations/ai/generate-test-plan', {
      selected_tickets: selectedTickets,
      selected_test_cases: selectedTestCases,
      release_info: releaseInfo,
      force_refresh: options?.forceRefresh || false,
    }),
};

// Dashboard types
export interface DashboardMetrics {
  test_progress?: {
    total?: number;
    passed?: number;
    failed?: number;
    pending?: number;
  };
  bug_stats?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
  recent_activity?: any[];
  [key: string]: any;
}

// Dashboard Service
export const dashboardService = {
  getMetrics: (releaseId: number) =>
    api.get<DashboardMetrics>(`/dashboard/${releaseId}`),
  getReleaseMetrics: (releaseId: number) =>
    api.get<DashboardMetrics>(`/dashboard/${releaseId}`),
};

// Feature/Ticket types
export interface Feature {
  id: number;
  release_id: number;
  ticket_id: string;
  ticket_type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  risk_score?: number;
  impacted_modules?: string[];
  [key: string]: any;
}

// QA Organization types
export interface QAOrg {
  id: number;
  org_name: string;
  release_version: string;
  org_url: string;
  enabled_features: string[];
  data_sets_available: string[];
  stability_score: number;
  known_issues: string[];
  created_at: string;
  is_active?: boolean;
  [key: string]: any;
}

export interface QABotSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string | null;
}

export interface QABotActionDescriptor {
  operation: string;
  resource_type: string;
  resource_id?: number | null;
  summary: string;
  payload?: Record<string, any> | null;
}

export interface QABotMessage {
  id: number;
  session_id: number;
  user_id: number | null;
  is_bot: boolean;
  message: string;
  metadata_json: Record<string, any> | null;
  created_at: string;
}

export interface QABotTurnResponse {
  user_message: QABotMessage;
  bot_message: QABotMessage;
}

// TestPlan Response types
export interface TestPlanResponse {
  test_plan: any;
  test_cases?: any[];
  summary?: any;
  [key: string]: any;
}

// Extended Release Service
export const releaseService = {
  getAll: () => api.get<Release[]>('/releases/'),
  getById: (id: number) => api.get<Release>(`/releases/${id}`),
  create: (data: ReleaseCreate) => api.post<Release>('/releases/', data),
  update: (id: number, data: ReleaseUpdate) =>
    api.put<Release>(`/releases/${id}`, data),
  delete: (id: number) => api.delete(`/releases/${id}`),
  getFeatures: (releaseId: number) => api.get<Feature[]>(`/releases/${releaseId}/features`),
  addFeature: (releaseId: number, data: any) => api.post<Feature>(`/releases/${releaseId}/features`, data),
  deleteFeature: (releaseId: number, featureId: number) => api.delete(`/releases/${releaseId}/features/${featureId}`),
  generateRegressionSuite: (releaseId: number) => api.post(`/releases/${releaseId}/regression-suite`),
  getPermissions: (releaseId: number) => api.get(`/releases/${releaseId}/permissions`),
};

// Extended TestPlan Service
export const testPlanService = {
  getAll: (releaseId?: number) =>
    api.get<TestPlan[]>('/test-plans/', { params: { release_id: releaseId } }),
  getById: (id: number) => api.get<TestPlan>(`/test-plans/${id}`),
  create: (data: TestPlanCreate) => api.post<TestPlan>('/test-plans/', data),
  update: (id: number, data: TestPlanUpdate) =>
    api.put<TestPlan>(`/test-plans/${id}`, data),
  delete: (id: number) => api.delete(`/test-plans/${id}`),
  generate: (releases: string[], priorityFocus: string, useAI: boolean, useEnterpriseAI: boolean = true) =>
    api.post<TestPlanResponse>('/test-plans/generate', { 
      release_versions: releases, 
      priority_focus: priorityFocus, 
      use_ai: useAI,
      use_enterprise_ai: useEnterpriseAI 
    }),
  save: (testPlan: any, name: string) =>
    api.post('/test-plans/save', { test_plan_data: testPlan, test_plan_name: name }),
  listSaved: () => api.get('/test-plans/saved'),
  getSaved: (planId: number) => api.get(`/test-plans/saved/${planId}`),
  deleteSaved: (planId: number) => api.delete(`/test-plans/saved/${planId}`),
};

// Organization Service
export const orgService = {
  getAll: () => api.get<QAOrg[]>('/orgs/'),
  create: (data: any) => api.post<QAOrg>('/orgs/', data),
  update: (orgId: number, data: any) => api.put<QAOrg>(`/orgs/${orgId}`, data),
  delete: (orgId: number) => api.delete(`/orgs/${orgId}`),
};

export const qabotService = {
  listSessions: () => api.get<QABotSession[]>('/qabot/sessions'),
  createSession: (title?: string) => api.post<QABotSession>('/qabot/sessions', { title }),
  getMessages: (sessionId: number) => api.get<QABotMessage[]>(`/qabot/sessions/${sessionId}/messages`),
  sendMessage: (sessionId: number, message: string, confirmAction = false, pendingAction?: QABotActionDescriptor | null) =>
    api.post<QABotTurnResponse>(`/qabot/sessions/${sessionId}/messages`, {
      message,
      confirm_action: confirmAction,
      pending_action: pendingAction ?? null,
    }),
};

// ===== Test Execution Types =====

export interface TestRunSummary {
  id: number;
  release_id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  total_test_cases: number;
  executed_count: number;
  passed_count: number;
  failed_count: number;
  blocked_count: number;
  skipped_count: number;
  created_at: string;
}

export interface TestRunDetail extends TestRunSummary {
  test_plan_id: number | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  ai_generated_assignments: boolean;
  ai_insights: any;
  created_by: number | null;
  updated_at: string | null;
}

export interface TestRunCreate {
  release_id: number;
  test_plan_id?: number;
  name: string;
  description?: string;
  auto_assign?: boolean;
}

export interface TestExecutionSummary {
  id: number;
  test_run_id: number;
  test_case_id: string;
  test_case_title: string;
  test_case_description?: string | null;
  priority: string | null;
  assigned_to: number | null;
  assigned_user?: UserSummary | null;
  status: 'not_started' | 'in_progress' | 'passed' | 'failed' | 'blocked' | 'skipped';
  recommended_org_id: number | null;
  selected_org_id: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TestExecutionDetail extends TestExecutionSummary {
  test_case_description: string | null;
  test_steps: any[];
  expected_result: string | null;
  assigned_at: string | null;
  assigned_by_ai: boolean;
  duration_minutes: number | null;
  actual_result: string | null;
  tester_notes: string | null;
  screenshots: string[] | null;
  ai_validation_summary: string | null;
  ai_confidence_score: number | null;
  defect_id: string | null;
  defect_summary: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TestExecutionResult {
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  actual_result: string;
  tester_notes?: string;
  screenshots?: string[];
  defect_id?: string;
  defect_summary?: string;
}

export interface ChatMessage {
  id: number;
  test_execution_id: number;
  user_id: number | null;
  is_ai_response: boolean;
  message: string;
  screenshot_url: string | null;
  created_at: string;
}

export interface OrgRecommendation {
  org_id: number;
  org_name: string;
  confidence_score: number;
  reasons: string[];
}

export interface AIValidationResponse {
  validation_summary: string;
  confidence_score: number;
  suggested_status: 'passed' | 'failed' | 'blocked';
  observations: string[];
  concerns: string[];
}

// Test Execution Service
export const testExecutionService = {
  // Test Runs
  createTestRun: (data: TestRunCreate) =>
    api.post<TestRunDetail>('/test-runs/', data),
  getTestRuns: (releaseId?: number, status?: string) =>
    api.get<TestRunSummary[]>('/test-runs/', { params: { release_id: releaseId, status } }),
  getTestRun: (testRunId: number) =>
    api.get<TestRunDetail>(`/test-runs/${testRunId}`),
  updateTestRun: (testRunId: number, data: Partial<TestRunCreate> & { status?: string }) =>
    api.put<TestRunDetail>(`/test-runs/${testRunId}`, data),
  deleteTestRun: (testRunId: number) =>
    api.delete(`/test-runs/${testRunId}`),
  
  // Test Executions
  getExecutions: (testRunId: number, assignedTo?: number, status?: string) =>
    api.get<TestExecutionSummary[]>(`/test-runs/${testRunId}/executions`, { 
      params: { assigned_to: assignedTo, status } 
    }),
  getExecution: (executionId: number) =>
    api.get<TestExecutionDetail>(`/test-runs/executions/${executionId}`),
  updateExecution: (executionId: number, data: any) =>
    api.put<TestExecutionDetail>(`/test-runs/executions/${executionId}`, data),
  startExecution: (executionId: number) =>
    api.post<TestExecutionDetail>(`/test-runs/executions/${executionId}/start`),
  submitResult: (executionId: number, result: TestExecutionResult) =>
    api.post<TestExecutionDetail>(`/test-runs/executions/${executionId}/submit-result`, result),
  
  // AI Assignment
  aiAssign: (testRunId: number, collaboratorIds: number[]) =>
    api.post(`/test-runs/${testRunId}/ai-assign`, { test_run_id: testRunId, collaborator_ids: collaboratorIds }),
  
  // Org Recommendations
  getOrgRecommendations: (executionId: number) =>
    api.get<{ execution_id: number; recommendations: OrgRecommendation[] }>(
      `/test-runs/executions/${executionId}/org-recommendations`
    ),
  selectOrg: (executionId: number, orgId: number) =>
    api.post<TestExecutionDetail>(`/test-runs/executions/${executionId}/select-org`, { 
      execution_id: executionId, 
      org_id: orgId 
    }),
  
  // Browser Session
  startBrowser: (executionId: number, orgId: number) =>
    api.post(`/test-runs/executions/${executionId}/start-browser`, { org_id: orgId }),
  
  // Chat
  getChatHistory: (executionId: number) =>
    api.get<ChatMessage[]>(`/test-runs/executions/${executionId}/chat`),
  sendChatMessage: (executionId: number, message: string, screenshotUrl?: string) =>
    api.post<ChatMessage>(`/test-runs/executions/${executionId}/chat`, { 
      test_execution_id: executionId, 
      message, 
      screenshot_url: screenshotUrl 
    }),
  
  // AI Validation
  requestAIValidation: (executionId: number, userNotes: string, screenshots: string[] = []) =>
    api.post<AIValidationResponse>(`/test-runs/executions/${executionId}/ai-validate`, { 
      execution_id: executionId, 
      user_notes: userNotes, 
      screenshots 
    }),
  
  // My Assignments
  getMyAssignments: (status?: string) =>
    api.get<TestExecutionSummary[]>('/test-runs/my-assignments', { params: { status } }),
};

// Collaborator Service
export const collaboratorService = {
  add: (releaseId: number, userId: number) =>
    api.post<Release>(`/releases/${releaseId}/collaborators`, { user_id: userId }),
  remove: (releaseId: number, userId: number) =>
    api.delete<Release>(`/releases/${releaseId}/collaborators/${userId}`),
  getAll: (releaseId: number) =>
    api.get<UserSummary[]>(`/releases/${releaseId}/collaborators`),
};

// Users Service (for finding users to add as collaborators)
export const usersService = {
  search: (query: string) =>
    api.get<User[]>('/auth/users', { params: { q: query } }),
  getAll: () =>
    api.get<User[]>('/auth/users'),
};
