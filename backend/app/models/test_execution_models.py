"""
Database models for test execution and test runs
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class TestRunStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ExecutionStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"

class TestRun(Base):
    """Test run represents a collection of test case executions"""
    __tablename__ = "test_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("releases.id"), nullable=False)
    test_plan_id = Column(Integer, ForeignKey("saved_test_plans.id"))
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(SQLEnum(TestRunStatus), default=TestRunStatus.DRAFT)
    
    # Execution metadata
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    estimated_duration_minutes = Column(Integer)
    actual_duration_minutes = Column(Integer)
    
    # Progress tracking
    total_test_cases = Column(Integer, default=0)
    executed_count = Column(Integer, default=0)
    passed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    blocked_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    
    # AI insights
    ai_generated_assignments = Column(Boolean, default=False)
    ai_insights = Column(JSON)
    
    # Audit
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    executions = relationship("TestExecution", back_populates="test_run", cascade="all, delete-orphan")

class TestExecution(Base):
    """Individual test case execution within a test run"""
    __tablename__ = "test_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    test_run_id = Column(Integer, ForeignKey("test_runs.id"), nullable=False)
    
    # Test case details (from test plan or TestRail)
    test_case_id = Column(String(100), nullable=False, index=True)  # e.g., "C12345" from TestRail
    test_case_title = Column(String(500), nullable=False)
    test_case_description = Column(Text)
    test_steps = Column(JSON)  # List of steps to execute
    expected_result = Column(Text)
    priority = Column(String(20))
    
    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime(timezone=True))
    assigned_by_ai = Column(Boolean, default=False)
    
    # Execution details
    status = Column(SQLEnum(ExecutionStatus), default=ExecutionStatus.NOT_STARTED)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    
    # Salesforce org to use
    recommended_org_id = Column(Integer, ForeignKey("qa_orgs.id"))
    selected_org_id = Column(Integer, ForeignKey("qa_orgs.id"))
    
    # Results
    actual_result = Column(Text)
    tester_notes = Column(Text)
    screenshots = Column(JSON)  # Array of screenshot URLs/paths
    ai_validation_summary = Column(Text)
    ai_confidence_score = Column(Float)
    
    # Defects
    defect_id = Column(String(100))  # Link to Jira/external defect
    defect_summary = Column(Text)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    test_run = relationship("TestRun", back_populates="executions")

class TestExecutionComment(Base):
    """Chat/comments during test execution for AI assistance"""
    __tablename__ = "test_execution_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    test_execution_id = Column(Integer, ForeignKey("test_executions.id"), nullable=False)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    is_ai_response = Column(Boolean, default=False)
    
    message = Column(Text, nullable=False)
    screenshot_url = Column(String(500))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BrowserSession(Base):
    """Track Salesforce browser sessions for auto-login"""
    __tablename__ = "browser_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    test_execution_id = Column(Integer, ForeignKey("test_executions.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("qa_orgs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    session_id = Column(String(255), unique=True, index=True)
    browser_type = Column(String(50))
    
    # Session tokens (encrypted)
    access_token = Column(Text)
    refresh_token = Column(Text)
    instance_url = Column(String(500))
    
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
