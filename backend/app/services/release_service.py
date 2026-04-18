from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import List, Dict, Any, Optional
from app.models.models import Release, Feature, TestSuite, Defect, OrgRecommendation, User, release_collaborators
from app.models.test_execution_models import TestRun, TestExecution, TestExecutionComment, BrowserSession
from app.models.schemas import (
    ReleaseCreate, ReleaseUpdate, FeatureCreate, TestSuiteCreate,
    RegressionSuiteResponse, TestCaseSchema
)
from app.services.ai_service import ai_service
from datetime import datetime

class ReleaseService:
    def __init__(self, db: Session):
        self.db = db

    def _accessible_release_by_version(self, user_id: int, release_version: str) -> Optional[Release]:
        return (
            self.db.query(Release)
            .filter(
                Release.release_version == release_version,
                or_(
                    Release.created_by == user_id,
                    Release.collaborators.any(User.id == user_id),
                ),
            )
            .first()
        )
    
    def create_release(self, release_data: ReleaseCreate, user_id: int) -> Release:
        existing_release = self._accessible_release_by_version(user_id, release_data.release_version)
        if existing_release:
            raise ValueError(
                "You already have access to a release with this version. Open the existing release or use a different version."
            )

        db_release = Release(
            **release_data.model_dump(),
            created_by=user_id
        )
        self.db.add(db_release)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            if "release_version" in str(exc.orig).lower():
                raise ValueError(
                    "This release version is already reserved by another workspace. Try a different version or ask the owner to share access."
                )
            raise ValueError("Could not create release due to a database constraint")
        self.db.refresh(db_release)
        return db_release
    
    def get_release(self, release_id: int) -> Optional[Release]:
        return self.db.query(Release).filter(Release.id == release_id).first()

    def get_accessible_release(self, release_id: int, user_id: int) -> Optional[Release]:
        return (
            self.db.query(Release)
            .filter(
                Release.id == release_id,
                or_(
                    Release.created_by == user_id,
                    Release.collaborators.any(User.id == user_id),
                ),
            )
            .first()
        )
    
    def get_releases(self, skip: int = 0, limit: int = 100) -> List[Release]:
        return self.db.query(Release).offset(skip).limit(limit).all()

    def get_accessible_releases(self, user_id: int, skip: int = 0, limit: int = 100) -> List[Release]:
        return (
            self.db.query(Release)
            .filter(
                or_(
                    Release.created_by == user_id,
                    Release.collaborators.any(User.id == user_id),
                )
            )
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def update_release(self, release_id: int, release_update: ReleaseUpdate) -> Optional[Release]:
        release = self.db.query(Release).filter(Release.id == release_id).first()
        if not release:
            return None
        
        # Update only provided fields
        update_data = release_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(release, field, value)
        
        release.updated_at = datetime.utcnow()
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            if "release_version" in str(exc.orig).lower():
                raise ValueError(
                    "This release version is already reserved by another workspace. Try a different version or ask the owner to share access."
                )
            raise ValueError("Could not update release due to a database constraint")
        self.db.refresh(release)
        return release
    
    def delete_release(self, release_id: int) -> bool:
        release = self.db.query(Release).filter(Release.id == release_id).first()
        if not release:
            return False
        
        # Get all test runs for this release
        test_runs = self.db.query(TestRun).filter(TestRun.release_id == release_id).all()
        
        # For each test run, delete related records
        for test_run in test_runs:
            # Get all test executions for this test run
            test_executions = self.db.query(TestExecution).filter(
                TestExecution.test_run_id == test_run.id
            ).all()
            
            # For each test execution, delete related records
            for test_execution in test_executions:
                # Delete browser sessions
                self.db.query(BrowserSession).filter(
                    BrowserSession.test_execution_id == test_execution.id
                ).delete()
                
                # Delete test execution comments
                self.db.query(TestExecutionComment).filter(
                    TestExecutionComment.test_execution_id == test_execution.id
                ).delete()
            
            # Delete test executions
            self.db.query(TestExecution).filter(
                TestExecution.test_run_id == test_run.id
            ).delete()
        
        # Delete test runs
        self.db.query(TestRun).filter(TestRun.release_id == release_id).delete()
        
        # Delete org recommendations
        self.db.query(OrgRecommendation).filter(
            OrgRecommendation.release_id == release_id
        ).delete()
        
        # Delete associated features (and their defects will cascade)
        features = self.db.query(Feature).filter(Feature.release_id == release_id).all()
        for feature in features:
            # Delete defects for this feature
            self.db.query(Defect).filter(Defect.feature_id == feature.id).delete()
        
        # Delete features
        self.db.query(Feature).filter(Feature.release_id == release_id).delete()
        
        # Delete associated test suites
        self.db.query(TestSuite).filter(TestSuite.release_id == release_id).delete()
        
        # Remove collaborators (many-to-many relationship)
        self.db.execute(
            release_collaborators.delete().where(
                release_collaborators.c.release_id == release_id
            )
        )
        
        # Delete the release
        self.db.delete(release)
        self.db.commit()
        return True
    
    def add_feature(self, feature_data: FeatureCreate) -> Feature:
        db_feature = Feature(**feature_data.model_dump())
        self.db.add(db_feature)
        self.db.commit()
        self.db.refresh(db_feature)
        return db_feature
    
    async def analyze_and_add_feature(
        self,
        release_id: int,
        ticket_data: Dict[str, Any]
    ) -> Feature:
        ai_analysis = await ai_service.analyze_release_ticket(ticket_data)
        
        feature_data = FeatureCreate(
            release_id=release_id,
            ticket_id=ticket_data['ticket_id'],
            ticket_type=ticket_data.get('ticket_type', 'feature'),
            title=ticket_data['title'],
            description=ticket_data.get('description', ''),
            impacted_modules=ai_analysis.get('impacted_modules', []),
            dependencies=ai_analysis.get('dependencies', []),
            priority=ticket_data.get('priority', 'medium')
        )
        
        db_feature = Feature(**feature_data.model_dump())
        db_feature.risk_score = ai_analysis.get('risk_score', 0.5)
        
        self.db.add(db_feature)
        self.db.commit()
        self.db.refresh(db_feature)
        
        return db_feature
    
    def get_features_by_release(self, release_id: int) -> List[Feature]:
        return self.db.query(Feature).filter(Feature.release_id == release_id).all()
    
    def get_historical_defects_by_module(
        self,
        modules: List[str],
        limit: int = 10
    ) -> List[Defect]:
        query = self.db.query(Defect)
        
        defects = []
        for module in modules:
            module_defects = query.filter(
                Defect.impacted_modules.contains([module])
            ).order_by(Defect.created_at.desc()).limit(limit).all()
            defects.extend(module_defects)
        
        return defects[:limit]
    
    async def generate_regression_suite(
        self,
        release_id: int
    ) -> RegressionSuiteResponse:
        release = self.get_release(release_id)
        if not release:
            raise ValueError(f"Release {release_id} not found")
        
        features = self.get_features_by_release(release_id)
        
        suites = {
            "high_priority": [],
            "medium_priority": [],
            "smoke": [],
            "sanity": [],
            "full_regression": []
        }
        
        total_confidence = 0.0
        feature_count = 0
        
        for feature in features:
            feature_data = {
                'title': feature.title,
                'description': feature.description,
                'impacted_modules': feature.impacted_modules or []
            }
            
            historical_defects = self.get_historical_defects_by_module(
                feature.impacted_modules or [],
                limit=5
            )
            
            historical_data = [
                {
                    'defect_id': d.defect_id,
                    'title': d.title,
                    'severity': d.severity
                }
                for d in historical_defects
            ]
            
            if feature.risk_score >= 0.7:
                test_cases = await ai_service.generate_test_scenarios(
                    feature_data,
                    historical_data,
                    priority="high"
                )
                suites["high_priority"].extend(test_cases)
                suites["full_regression"].extend(test_cases)
                
                smoke_cases = [tc for tc in test_cases[:2]]
                suites["smoke"].extend(smoke_cases)
            
            elif feature.risk_score >= 0.4:
                test_cases = await ai_service.generate_test_scenarios(
                    feature_data,
                    historical_data,
                    priority="medium"
                )
                suites["medium_priority"].extend(test_cases)
                suites["full_regression"].extend(test_cases)
                
                sanity_cases = [tc for tc in test_cases[:1]]
                suites["sanity"].extend(sanity_cases)
            
            else:
                test_cases = await ai_service.generate_test_scenarios(
                    feature_data,
                    historical_data,
                    priority="low"
                )
                suites["full_regression"].extend(test_cases)
            
            total_confidence += (1.0 - feature.risk_score)
            feature_count += 1
        
        overall_confidence = (total_confidence / feature_count) if feature_count > 0 else 0.5
        
        for suite_type, test_cases in suites.items():
            if test_cases:
                suite_data = TestSuiteCreate(
                    release_id=release_id,
                    suite_name=f"{release.release_version} - {suite_type.replace('_', ' ').title()}",
                    suite_type=suite_type,
                    priority=suite_type.split('_')[0] if '_' in suite_type else suite_type,
                    test_cases=test_cases,
                    ai_generated=True,
                    confidence_score=overall_confidence
                )
                
                db_suite = TestSuite(**suite_data.model_dump())
                self.db.add(db_suite)
        
        self.db.commit()
        
        return RegressionSuiteResponse(
            release_id=release_id,
            release_version=release.release_version,
            suites=suites,
            overall_confidence=overall_confidence,
            analysis_summary={
                "total_features": feature_count,
                "high_risk_features": len([f for f in features if f.risk_score >= 0.7]),
                "medium_risk_features": len([f for f in features if 0.4 <= f.risk_score < 0.7]),
                "low_risk_features": len([f for f in features if f.risk_score < 0.4]),
                "total_test_cases": sum(len(cases) for cases in suites.values())
            }
        )
