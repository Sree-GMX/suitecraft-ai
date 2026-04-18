from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, JSON, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Association table for release collaborators
release_collaborators = Table(
    'release_collaborators',
    Base.metadata,
    Column('release_id', Integer, ForeignKey('releases.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('added_at', DateTime(timezone=True), server_default=func.now())
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="viewer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    audit_logs = relationship("AuditLog", back_populates="user")
    owned_releases = relationship("Release", back_populates="owner", foreign_keys="Release.created_by")
    collaborative_releases = relationship("Release", secondary=release_collaborators, back_populates="collaborators")

class Release(Base):
    __tablename__ = "releases"
    
    id = Column(Integer, primary_key=True, index=True)
    release_version = Column(String(100), index=True, nullable=False)
    release_name = Column(String(255), nullable=False)
    target_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="planning")
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    features = relationship("Feature", back_populates="release")
    test_suites = relationship("TestSuite", back_populates="release")
    owner = relationship("User", back_populates="owned_releases", foreign_keys=[created_by])
    collaborators = relationship("User", secondary=release_collaborators, back_populates="collaborative_releases")

class Feature(Base):
    __tablename__ = "features"
    
    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("releases.id"), nullable=False)
    ticket_id = Column(String(50), index=True, nullable=False)
    ticket_type = Column(String(50))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    impacted_modules = Column(JSON)
    dependencies = Column(JSON)
    priority = Column(String(20))
    risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    release = relationship("Release", back_populates="features")
    defects = relationship("Defect", back_populates="feature")

class Defect(Base):
    __tablename__ = "defects"
    
    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("features.id"))
    defect_id = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20))
    status = Column(String(50))
    found_in_release = Column(String(100))
    escaped_to_production = Column(Boolean, default=False)
    impacted_modules = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    feature = relationship("Feature", back_populates="defects")

class QAOrg(Base):
    __tablename__ = "qa_orgs"
    
    id = Column(Integer, primary_key=True, index=True)
    org_name = Column(String(255), unique=True, index=True, nullable=False)
    release_version = Column(String(100))
    enabled_features = Column(JSON)
    data_sets_available = Column(JSON)
    user_roles = Column(JSON)
    stability_score = Column(Float, default=0.0)
    last_validation_date = Column(DateTime(timezone=True))
    known_issues = Column(JSON)
    org_url = Column(String(500))
    credentials_encrypted = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    recommendations = relationship("OrgRecommendation", back_populates="org")

class TestSuite(Base):
    __tablename__ = "test_suites"
    
    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("releases.id"), nullable=False)
    suite_name = Column(String(255), nullable=False)
    suite_type = Column(String(50))
    priority = Column(String(20))
    test_cases = Column(JSON)
    ai_generated = Column(Boolean, default=True)
    confidence_score = Column(Float, default=0.0)
    estimated_duration = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    release = relationship("Release", back_populates="test_suites")

class TestCase(Base):
    __tablename__ = "test_cases"
    
    id = Column(Integer, primary_key=True, index=True)
    test_suite_id = Column(Integer, ForeignKey("test_suites.id"))
    test_id = Column(String(50), unique=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    test_steps = Column(JSON)
    expected_result = Column(Text)
    test_data_requirements = Column(JSON)
    impacted_modules = Column(JSON)
    priority = Column(String(20))
    risk_category = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OrgRecommendation(Base):
    __tablename__ = "org_recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("releases.id"))
    org_id = Column(Integer, ForeignKey("qa_orgs.id"), nullable=False)
    confidence_score = Column(Float, nullable=False)
    reasoning = Column(JSON)
    recommendation_rank = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    org = relationship("QAOrg", back_populates="recommendations")

class TestDataSet(Base):
    __tablename__ = "test_data_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    data_set_name = Column(String(255), unique=True, index=True, nullable=False)
    data_type = Column(String(50))
    org_id = Column(Integer, ForeignKey("qa_orgs.id"))
    data_inventory = Column(JSON)
    last_validated = Column(DateTime(timezone=True))
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    details = Column(JSON)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="audit_logs")

class SavedTestPlan(Base):
    __tablename__ = "saved_test_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    release_versions = Column(String(500), nullable=False, index=True)  # Comma-separated
    test_plan_name = Column(String(255))  # Optional user-provided name
    priority_focus = Column(String(20), default="all")
    ai_enabled = Column(Boolean, default=True)
    
    # Store the complete test plan response as JSON
    test_plan_data = Column(JSON, nullable=False)
    
    # Metadata
    total_test_cases = Column(Integer)
    total_test_suites = Column(Integer)
    estimated_duration_minutes = Column(Integer)
    confidence_score = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    
    def __repr__(self):
        return f"<SavedTestPlan {self.id}: {self.release_versions}>"

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<PasswordResetToken {self.id}: user_id={self.user_id}>"

class QAChatSession(Base):
    __tablename__ = "qa_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New QAbot chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class QAChatMessage(Base):
    __tablename__ = "qa_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("qa_chat_sessions.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_bot = Column(Boolean, default=False, nullable=False)
    message = Column(Text, nullable=False)
    metadata_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
