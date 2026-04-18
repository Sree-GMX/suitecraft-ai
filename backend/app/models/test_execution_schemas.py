"""
Pydantic schemas for test execution
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from app.models.schemas import UserSummary

class TestRunStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ExecutionStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"

# ===== Test Run Schemas =====

class TestRunCreate(BaseModel):
    release_id: int
    test_plan_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    auto_assign: bool = True  # Use AI to assign test cases

class TestRunUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TestRunStatus] = None

class TestRunSummary(BaseModel):
    id: int
    release_id: int
    name: str
    status: TestRunStatus
    total_test_cases: int
    executed_count: int
    passed_count: int
    failed_count: int
    blocked_count: int
    skipped_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TestRunDetail(TestRunSummary):
    test_plan_id: Optional[int]
    description: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    estimated_duration_minutes: Optional[int]
    actual_duration_minutes: Optional[int]
    ai_generated_assignments: bool
    ai_insights: Optional[Dict[str, Any]]
    created_by: Optional[int]
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# ===== Test Execution Schemas =====

class TestExecutionCreate(BaseModel):
    test_run_id: int
    test_case_id: str
    test_case_title: str
    test_case_description: Optional[str] = None
    test_steps: List[Dict[str, Any]] = []
    expected_result: Optional[str] = None
    priority: Optional[str] = "medium"
    assigned_to: Optional[int] = None

class TestExecutionUpdate(BaseModel):
    status: Optional[ExecutionStatus] = None
    assigned_to: Optional[int] = None
    selected_org_id: Optional[int] = None
    actual_result: Optional[str] = None
    tester_notes: Optional[str] = None
    defect_id: Optional[str] = None
    defect_summary: Optional[str] = None

class TestExecutionResult(BaseModel):
    """Submit test execution result with AI validation"""
    status: ExecutionStatus
    actual_result: str
    tester_notes: Optional[str] = None
    screenshots: Optional[List[str]] = []
    defect_id: Optional[str] = None
    defect_summary: Optional[str] = None

class TestExecutionSummary(BaseModel):
    id: int
    test_run_id: int
    test_case_id: str
    test_case_title: str
    test_case_description: Optional[str] = None
    priority: Optional[str]
    assigned_to: Optional[int]
    assigned_user: Optional[UserSummary] = None
    status: ExecutionStatus
    recommended_org_id: Optional[int]
    selected_org_id: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class TestExecutionDetail(TestExecutionSummary):
    test_case_description: Optional[str]
    test_steps: List[Dict[str, Any]]
    expected_result: Optional[str]
    assigned_at: Optional[datetime]
    assigned_by_ai: bool
    duration_minutes: Optional[int]
    actual_result: Optional[str]
    tester_notes: Optional[str]
    screenshots: Optional[List[str]]
    ai_validation_summary: Optional[str]
    ai_confidence_score: Optional[float]
    defect_id: Optional[str]
    defect_summary: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# ===== Assignment Schemas =====

class AssignmentRequest(BaseModel):
    execution_id: int
    user_id: int

class BulkAssignmentRequest(BaseModel):
    test_run_id: int
    assignments: List[Dict[str, int]]  # [{"execution_id": 1, "user_id": 2}, ...]

class AIAssignmentRequest(BaseModel):
    test_run_id: int
    collaborator_ids: List[int]

class AIAssignmentResponse(BaseModel):
    test_run_id: int
    total_assigned: int
    assignments: List[Dict[str, Any]]  # [{"execution_id": 1, "user_id": 2, "reason": "..."}]

# ===== Org Selection Schemas =====

class OrgSelectionRequest(BaseModel):
    org_id: int

class OrgRecommendation(BaseModel):
    org_id: int
    org_name: str
    confidence_score: float
    reasons: List[str]

class OrgRecommendationResponse(BaseModel):
    execution_id: int
    recommendations: List[OrgRecommendation]

# ===== Browser Session Schemas =====

class BrowserSessionCreate(BaseModel):
    test_execution_id: int
    org_id: int

class BrowserSessionResponse(BaseModel):
    session_id: str
    instance_url: str
    expires_at: datetime

# ===== AI Chat Schemas =====

class ChatMessageCreate(BaseModel):
    message: str
    screenshot_url: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    test_execution_id: int
    user_id: Optional[int]
    is_ai_response: bool
    message: str
    screenshot_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class AIValidationRequest(BaseModel):
    user_notes: str
    screenshots: List[str] = []

class AIValidationResponse(BaseModel):
    validation_summary: str
    confidence_score: float
    suggested_status: ExecutionStatus
    observations: List[str]
    concerns: List[str]
