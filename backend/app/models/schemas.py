from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    QA_LEAD = "qa_lead"
    QA_ENGINEER = "qa_engineer"
    DEVELOPER = "developer"
    VIEWER = "viewer"

class ReleaseStatus(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    TESTING = "testing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SuiteType(str, Enum):
    SMOKE = "smoke"
    SANITY = "sanity"
    HIGH_PRIORITY = "high_priority"
    MEDIUM_PRIORITY = "medium_priority"
    FULL_REGRESSION = "full_regression"

class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.VIEWER

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserSummary(BaseModel):
    id: int
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ReleaseBase(BaseModel):
    release_version: str
    release_name: str
    target_date: Optional[datetime] = None
    status: Optional[ReleaseStatus] = ReleaseStatus.PLANNING
    description: Optional[str] = None
    
    class Config:
        use_enum_values = True

class ReleaseCreate(ReleaseBase):
    pass

class ReleaseUpdate(BaseModel):
    release_name: Optional[str] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        use_enum_values = True

class ReleaseResponse(ReleaseBase):
    id: int
    created_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    owner: Optional[UserSummary] = None
    collaborators: List[UserSummary] = []
    
    class Config:
        from_attributes = True

class AddCollaboratorRequest(BaseModel):
    user_id: int

class RemoveCollaboratorRequest(BaseModel):
    user_id: int

class FeatureBase(BaseModel):
    ticket_id: str
    ticket_type: Optional[str] = None
    title: str
    description: Optional[str] = None
    impacted_modules: Optional[List[str]] = []
    dependencies: Optional[List[str]] = []
    priority: Optional[str] = "medium"

class FeatureCreate(FeatureBase):
    release_id: int

class FeatureResponse(FeatureBase):
    id: int
    release_id: int
    risk_score: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class TestCaseSchema(BaseModel):
    title: str
    description: str
    test_steps: List[Dict[str, Any]]
    expected_result: str
    test_data_requirements: Optional[List[str]] = []
    impacted_modules: List[str]
    priority: str
    risk_category: str

class TestSuiteBase(BaseModel):
    suite_name: str
    suite_type: SuiteType
    priority: str
    test_cases: List[TestCaseSchema]
    confidence_score: Optional[float] = 0.0
    estimated_duration: Optional[int] = None

class TestSuiteCreate(TestSuiteBase):
    release_id: int
    ai_generated: bool = True

class TestSuiteResponse(TestSuiteBase):
    id: int
    release_id: int
    ai_generated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class QAOrgBase(BaseModel):
    org_name: str
    release_version: Optional[str] = None
    enabled_features: Optional[List[str]] = []
    data_sets_available: Optional[List[str]] = []
    user_roles: Optional[Dict[str, Any]] = {}
    stability_score: Optional[float] = 0.0
    known_issues: Optional[List[str]] = []
    org_url: Optional[str] = None
    is_active: bool = True

class QAOrgCreate(QAOrgBase):
    credentials: Optional[Dict[str, str]] = None

class QAOrgResponse(QAOrgBase):
    id: int
    last_validation_date: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrgRecommendationSchema(BaseModel):
    org_id: int
    org_name: str
    confidence_score: float
    reasoning: Dict[str, Any]
    recommendation_rank: int

class RegressionSuiteRequest(BaseModel):
    release_id: int
    include_historical_analysis: bool = True
    priority_threshold: Optional[str] = None

class RegressionSuiteResponse(BaseModel):
    release_id: int
    release_version: str
    suites: Dict[str, List[TestCaseSchema]]
    overall_confidence: float
    analysis_summary: Dict[str, Any]

class OrgRecommendationRequest(BaseModel):
    release_id: int
    required_features: Optional[List[str]] = []
    data_requirements: Optional[List[str]] = []

class OrgRecommendationResponse(BaseModel):
    release_id: int
    recommendations: List[OrgRecommendationSchema]
    analysis_timestamp: datetime

class DashboardMetrics(BaseModel):
    release_confidence_score: float
    regression_coverage_percentage: float
    critical_bug_count: int
    recommended_org: Optional[str]
    risk_heatmap: Dict[str, float]
    org_health_status: Dict[str, str]

class QAOrgUpdate(BaseModel):
    org_name: Optional[str] = None
    release_version: Optional[str] = None
    enabled_features: Optional[List[str]] = None
    data_sets_available: Optional[List[str]] = None
    user_roles: Optional[Dict[str, Any]] = None
    stability_score: Optional[float] = None
    known_issues: Optional[List[str]] = None
    org_url: Optional[str] = None
    is_active: Optional[bool] = None
    credentials: Optional[Dict[str, str]] = None

class QABotSessionCreate(BaseModel):
    title: Optional[str] = None

class QABotSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class QABotActionDescriptor(BaseModel):
    operation: str
    resource_type: str
    resource_id: Optional[int] = None
    summary: str
    payload: Optional[Dict[str, Any]] = None

class QABotMessageCreate(BaseModel):
    message: str
    confirm_action: bool = False
    pending_action: Optional[QABotActionDescriptor] = None

class QABotMessageResponse(BaseModel):
    id: int
    session_id: int
    user_id: Optional[int]
    is_bot: bool
    message: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class QABotTurnResponse(BaseModel):
    user_message: QABotMessageResponse
    bot_message: QABotMessageResponse
