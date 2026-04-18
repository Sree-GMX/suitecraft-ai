"""
API endpoints for test execution and test runs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.test_execution_schemas import (
    TestRunCreate, TestRunUpdate, TestRunSummary, TestRunDetail,
    TestExecutionCreate, TestExecutionUpdate, TestExecutionSummary, TestExecutionDetail,
    TestExecutionResult, AIAssignmentRequest, AIAssignmentResponse,
    OrgSelectionRequest, OrgRecommendationResponse,
    BrowserSessionCreate, BrowserSessionResponse,
    ChatMessageCreate, ChatMessageResponse,
    AIValidationRequest, AIValidationResponse
)
from app.models.models import User
from app.api.dependencies import get_current_user, check_release_access
from app.services.test_execution_service import TestExecutionService
from app.models.test_execution_models import TestRun, TestExecution

router = APIRouter(prefix="/test-runs", tags=["test-execution"])


def raise_test_execution_error(error: Exception, fallback_message: str) -> None:
    if isinstance(error, ValueError):
        raise HTTPException(status_code=400, detail=str(error))
    raise HTTPException(status_code=500, detail=fallback_message)


def require_release_visibility(release_id: int, current_user: User, db: Session) -> None:
    if not check_release_access(release_id, current_user, db):
        raise HTTPException(status_code=403, detail="You don't have permission to access this release")


def require_test_run_visibility(test_run_id: int, current_user: User, db: Session) -> TestRun:
    test_run = db.query(TestRun).filter(TestRun.id == test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    require_release_visibility(test_run.release_id, current_user, db)
    return test_run


def require_execution_visibility(execution_id: int, current_user: User, db: Session) -> TestExecution:
    execution = db.query(TestExecution).filter(TestExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Test execution not found")
    test_run = db.query(TestRun).filter(TestRun.id == execution.test_run_id).first()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    require_release_visibility(test_run.release_id, current_user, db)
    return execution

# ===== Test Run Endpoints =====

@router.post("/", response_model=TestRunDetail, status_code=status.HTTP_201_CREATED)
async def create_test_run(
    test_run: TestRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new test run from a test plan.
    Optionally uses AI to auto-assign test cases to collaborators.
    """
    service = TestExecutionService(db)
    try:
        require_release_visibility(test_run.release_id, current_user, db)
        return await service.create_test_run(test_run, current_user.id)
    except Exception as e:
        raise_test_execution_error(e, "Could not create the test run")

@router.get("/", response_model=List[TestRunSummary])
def get_test_runs(
    release_id: int = None,
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all test runs (optionally filtered by release and status)"""
    service = TestExecutionService(db)
    test_runs = service.get_test_runs(release_id, status, skip, limit)
    return [run for run in test_runs if check_release_access(run.release_id, current_user, db)]

@router.get("/{test_run_id}", response_model=TestRunDetail)
def get_test_run(
    test_run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed test run information"""
    require_test_run_visibility(test_run_id, current_user, db)
    service = TestExecutionService(db)
    test_run = service.get_test_run(test_run_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_run

@router.put("/{test_run_id}", response_model=TestRunDetail)
def update_test_run(
    test_run_id: int,
    test_run_update: TestRunUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update test run details"""
    require_test_run_visibility(test_run_id, current_user, db)
    service = TestExecutionService(db)
    test_run = service.update_test_run(test_run_id, test_run_update)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_run

@router.delete("/{test_run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_run(
    test_run_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a test run and all its executions"""
    require_test_run_visibility(test_run_id, current_user, db)
    service = TestExecutionService(db)
    success = service.delete_test_run(test_run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test run not found")
    return None

# ===== Test Execution Endpoints =====

@router.get("/{test_run_id}/executions", response_model=List[TestExecutionSummary])
def get_test_executions(
    test_run_id: int,
    assigned_to: int = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all test executions for a test run (optionally filtered)"""
    require_test_run_visibility(test_run_id, current_user, db)
    service = TestExecutionService(db)
    return service.get_test_executions(test_run_id, assigned_to, status)

@router.get("/executions/{execution_id}", response_model=TestExecutionDetail)
def get_test_execution(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed test execution information"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    execution = service.get_test_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Test execution not found")
    return execution

@router.put("/executions/{execution_id}", response_model=TestExecutionDetail)
def update_test_execution(
    execution_id: int,
    execution_update: TestExecutionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update test execution (assign, change status, etc.)"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    execution = service.update_test_execution(execution_id, execution_update)
    if not execution:
        raise HTTPException(status_code=404, detail="Test execution not found")
    return execution

@router.post("/executions/{execution_id}/start", response_model=TestExecutionDetail)
def start_test_execution(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a test execution (marks it as in progress)"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    execution = service.start_test_execution(execution_id, current_user.id)
    if not execution:
        raise HTTPException(status_code=404, detail="Test execution not found")
    return execution

@router.post("/executions/{execution_id}/submit-result", response_model=TestExecutionDetail)
async def submit_test_result(
    execution_id: int,
    result: TestExecutionResult,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit test execution result (with optional AI validation)"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    try:
        execution = await service.submit_test_result(execution_id, result, current_user.id)
        if not execution:
            raise HTTPException(status_code=404, detail="Test execution not found")
        return execution
    except Exception as e:
        raise_test_execution_error(e, "Could not submit the test result")

# ===== Assignment Endpoints =====

@router.post("/{test_run_id}/ai-assign", response_model=AIAssignmentResponse)
async def ai_assign_test_cases(
    test_run_id: int,
    request: AIAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Use AI to automatically assign test cases to collaborators"""
    require_test_run_visibility(test_run_id, current_user, db)
    service = TestExecutionService(db)
    try:
        return await service.ai_assign_test_cases(test_run_id, request.collaborator_ids)
    except Exception as e:
        raise_test_execution_error(e, "Could not assign tests for this run")

# ===== Org Recommendation Endpoints =====

@router.get("/executions/{execution_id}/org-recommendations", response_model=OrgRecommendationResponse)
async def get_org_recommendations(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI-recommended Salesforce orgs for testing this test case"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    try:
        return await service.get_org_recommendations(execution_id)
    except Exception as e:
        raise_test_execution_error(e, "Could not load org recommendations")

@router.post("/executions/{execution_id}/select-org", response_model=TestExecutionDetail)
def select_testing_org(
    execution_id: int,
    request: OrgSelectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Select a Salesforce org to use for testing"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    execution = service.select_testing_org(execution_id, request.org_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Test execution not found")
    return execution

# ===== Browser Session Endpoints =====

@router.post("/executions/{execution_id}/start-browser", response_model=BrowserSessionResponse)
async def start_browser_session(
    execution_id: int,
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Auto-login to Salesforce org and open browser for testing.
    Returns session information for the frontend to connect.
    """
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    try:
        return await service.start_browser_session(execution_id, org_id, current_user.id)
    except Exception as e:
        raise_test_execution_error(e, "Could not start the browser session")

# ===== AI Chat Endpoints =====

@router.get("/executions/{execution_id}/chat", response_model=List[ChatMessageResponse])
def get_chat_history(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for this test execution"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    return service.get_chat_history(execution_id)

@router.post("/executions/{execution_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    execution_id: int,
    message: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to AI assistant during test execution"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    try:
        return await service.send_chat_message(execution_id, message, current_user.id)
    except Exception as e:
        raise_test_execution_error(e, "Could not send the assistant message")

@router.post("/executions/{execution_id}/ai-validate", response_model=AIValidationResponse)
async def request_ai_validation(
    execution_id: int,
    request: AIValidationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request AI to validate test execution and suggest pass/fail"""
    require_execution_visibility(execution_id, current_user, db)
    service = TestExecutionService(db)
    try:
        return await service.request_ai_validation(execution_id, request)
    except Exception as e:
        raise_test_execution_error(e, "Could not complete AI validation")

# ===== My Assignments Endpoint =====

@router.get("/my-assignments", response_model=List[TestExecutionSummary])
def get_my_assignments(
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all test executions assigned to the current user"""
    service = TestExecutionService(db)
    return service.get_user_assignments(current_user.id, status)
