"""
Service layer for test execution and test runs
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import json

from app.models.test_execution_models import (
    TestRun, TestExecution, TestExecutionComment, BrowserSession,
    TestRunStatus, ExecutionStatus
)
from app.models.models import User
from app.models.test_execution_schemas import (
    TestRunCreate, TestRunUpdate, TestRunDetail,
    TestExecutionCreate, TestExecutionUpdate, TestExecutionDetail, TestExecutionSummary,
    TestExecutionResult, AIAssignmentResponse,
    OrgRecommendationResponse, OrgRecommendation,
    BrowserSessionResponse, ChatMessageResponse,
    AIValidationRequest, AIValidationResponse
)
from app.models.schemas import UserSummary
from app.models.models import SavedTestPlan, Release, User, QAOrg
from app.services.ai_service import AIService
from app.services.testrail_csv_service import testrail_csv_service

class TestExecutionService:
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    # ===== Test Run Methods =====
    
    async def create_test_run(self, test_run_data: TestRunCreate, user_id: int) -> TestRunDetail:
        """
        Create a new test run from a test plan.
        Populates test executions and optionally auto-assigns to collaborators.
        """
        # Validate release exists
        release = self.db.query(Release).filter(Release.id == test_run_data.release_id).first()
        if not release:
            raise ValueError("Release not found")
        
        # Get test plan if specified
        test_plan = None
        test_cases = []
        
        if test_run_data.test_plan_id:
            test_plan = self.db.query(SavedTestPlan).filter(
                SavedTestPlan.id == test_run_data.test_plan_id
            ).first()
            if not test_plan:
                raise ValueError("Test plan not found")
            
            # Extract test cases from test plan
            test_cases = self._extract_test_cases_from_plan(test_plan.test_plan_data)
        
        # Create test run
        test_run = TestRun(
            release_id=test_run_data.release_id,
            test_plan_id=test_run_data.test_plan_id,
            name=test_run_data.name,
            description=test_run_data.description,
            status=TestRunStatus.DRAFT,
            total_test_cases=len(test_cases),
            created_by=user_id
        )
        
        self.db.add(test_run)
        self.db.flush()  # Get test_run.id
        
        # Create test executions for each test case
        for test_case in test_cases:
            # Enrich test case with CSV data
            enriched_case = self._enrich_test_case_from_csv(test_case)
            
            execution = TestExecution(
                test_run_id=test_run.id,
                test_case_id=enriched_case.get('id', 'UNKNOWN'),
                test_case_title=enriched_case.get('title', ''),
                test_case_description=enriched_case.get('description', ''),
                test_steps=enriched_case.get('test_steps', []),
                expected_result=enriched_case.get('expected_result', ''),
                priority=enriched_case.get('priority', 'medium'),
                status=ExecutionStatus.NOT_STARTED
            )
            self.db.add(execution)
        
        self.db.commit()
        
        # Auto-assign if requested
        if test_run_data.auto_assign:
            collaborator_ids = [c.id for c in release.collaborators]
            if collaborator_ids:
                await self.ai_assign_test_cases(test_run.id, collaborator_ids)
        
        self.db.refresh(test_run)
        return TestRunDetail.model_validate(test_run)
    
    def _extract_test_cases_from_plan(self, test_plan_data: Dict) -> List[Dict]:
        """Extract all test cases from test plan JSON (including multi-ticket cases)"""
        test_cases = []
        
        if isinstance(test_plan_data, dict):
            # Handle nested structure: {"success": true, "test_plan": {"test_suites": [...]}}
            if 'test_plan' in test_plan_data:
                test_plan_data = test_plan_data['test_plan']
            
            # Check for test_suites array
            suites = test_plan_data.get('test_suites', [])
            for suite in suites:
                suite_cases = suite.get('test_cases', [])
                test_cases.extend(suite_cases)
        
        # Keep all test cases including ones related to multiple tickets
        # Each ticket relationship should be tested separately
        return test_cases
    
    def _enrich_test_case_from_csv(self, test_case: Dict) -> Dict:
        """
        Enrich test case with detailed data from TestRail CSV
        
        Args:
            test_case: Basic test case from test plan (has id, title, section, related_ticket)
            
        Returns:
            Enriched test case with priority, description, and other fields
        """
        test_case_id = test_case.get('id', test_case.get('test_id', ''))
        related_ticket = test_case.get('related_ticket', '')
        
        # Preserve richer plan details when they already exist.
        existing_steps = test_case.get('test_steps') or test_case.get('steps') or []
        existing_expected_result = test_case.get('expected_result') or test_case.get('expected')
        existing_priority = (test_case.get('priority') or '').lower() or None

        # Try to find the test case in CSV by ID
        all_csv_cases = testrail_csv_service.get_all_test_cases()
        csv_case = next((c for c in all_csv_cases if c.get('ID') == test_case_id), None)
        
        if csv_case:
            # Current CSV only contains section metadata, not executable steps or
            # authoritative expected results, so we avoid fabricating those details.
            priority = existing_priority or 'unclassified'

            description = (
                f"Section: {csv_case.get('Section', '')}\n"
                f"Hierarchy: {csv_case.get('Section Hierarchy', '')}\n"
                "Detail level: CSV metadata only. Open the original TestRail case for full steps and expected outcomes."
            )
            if related_ticket:
                description += f"\nRelated Ticket: {related_ticket}"
            
            return {
                'id': test_case_id,
                'title': csv_case.get('Title', test_case.get('title', '')),
                'description': description,
                'test_steps': existing_steps,
                'expected_result': existing_expected_result,
                'priority': priority,
                'section': csv_case.get('Section', test_case.get('section', '')),
                'section_hierarchy': csv_case.get('Section Hierarchy', ''),
                'related_ticket': related_ticket,
                'detail_source': 'csv_metadata_only',
            }
        else:
            # Fallback if not found in CSV - use only what the plan already has.
            description = f"Section: {test_case.get('section', 'N/A')}\nDetail level: plan-derived metadata."
            if related_ticket:
                description += f"\nRelated Ticket: {related_ticket}"
            
            return {
                'id': test_case_id,
                'title': test_case.get('title', 'Untitled Test Case'),
                'description': description,
                'test_steps': existing_steps,
                'expected_result': existing_expected_result,
                'priority': existing_priority or 'unclassified',
                'section': test_case.get('section', ''),
                'related_ticket': related_ticket,
                'detail_source': 'plan_metadata_only',
            }
    
    def get_test_runs(
        self,
        release_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[TestRunDetail]:
        """Get test runs with optional filters"""
        query = self.db.query(TestRun)
        
        if release_id:
            query = query.filter(TestRun.release_id == release_id)
        if status:
            query = query.filter(TestRun.status == status)
        
        test_runs = query.offset(skip).limit(limit).all()
        return [TestRunDetail.model_validate(tr) for tr in test_runs]
    
    def get_test_run(self, test_run_id: int) -> Optional[TestRunDetail]:
        """Get a single test run"""
        test_run = self.db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if test_run:
            return TestRunDetail.model_validate(test_run)
        return None
    
    def update_test_run(self, test_run_id: int, update_data: TestRunUpdate) -> Optional[TestRunDetail]:
        """Update test run"""
        test_run = self.db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not test_run:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(test_run, key, value)
        
        self.db.commit()
        self.db.refresh(test_run)
        return TestRunDetail.model_validate(test_run)
    
    def delete_test_run(self, test_run_id: int) -> bool:
        """Delete test run"""
        test_run = self.db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not test_run:
            return False
        
        self.db.delete(test_run)
        self.db.commit()
        return True
    
    # ===== Test Execution Methods =====
    
    def get_test_executions(
        self,
        test_run_id: int,
        assigned_to: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[TestExecutionSummary]:
        """Get test executions for a test run"""
        query = self.db.query(TestExecution).filter(TestExecution.test_run_id == test_run_id)
        
        if assigned_to:
            query = query.filter(TestExecution.assigned_to == assigned_to)
        if status:
            query = query.filter(TestExecution.status == status)
        
        executions = query.all()
        
        # Convert to TestExecutionSummary and populate assigned_user
        result = []
        for ex in executions:
            summary = TestExecutionSummary.model_validate(ex)
            
            # Populate assigned_user if assigned_to exists
            if ex.assigned_to:
                user = self.db.query(User).filter(User.id == ex.assigned_to).first()
                if user:
                    summary.assigned_user = UserSummary.model_validate(user)
            
            result.append(summary)
        
        return result
    
    def get_test_execution(self, execution_id: int) -> Optional[TestExecutionDetail]:
        """Get a single test execution"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if execution:
            return TestExecutionDetail.model_validate(execution)
        return None
    
    def update_test_execution(
        self,
        execution_id: int,
        update_data: TestExecutionUpdate
    ) -> Optional[TestExecutionDetail]:
        """Update test execution"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(execution, key, value)
        
        self.db.commit()
        self.db.refresh(execution)
        
        # Update test run progress
        self._update_test_run_progress(execution.test_run_id)
        
        return TestExecutionDetail.model_validate(execution)
    
    def start_test_execution(self, execution_id: int, user_id: int) -> Optional[TestExecutionDetail]:
        """Start a test execution"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            return None
        
        execution.status = ExecutionStatus.IN_PROGRESS
        execution.started_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(execution)
        
        self._update_test_run_progress(execution.test_run_id)
        
        return TestExecutionDetail.model_validate(execution)
    
    async def submit_test_result(
        self,
        execution_id: int,
        result: TestExecutionResult,
        user_id: int
    ) -> Optional[TestExecutionDetail]:
        """Submit test execution result"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            return None
        
        execution.status = result.status
        execution.actual_result = result.actual_result
        execution.tester_notes = result.tester_notes
        execution.screenshots = result.screenshots
        execution.defect_id = result.defect_id
        execution.defect_summary = result.defect_summary
        execution.completed_at = datetime.utcnow().replace(tzinfo=None)
        
        # Calculate duration
        if execution.started_at:
            started = execution.started_at.replace(tzinfo=None) if execution.started_at.tzinfo else execution.started_at
            completed = execution.completed_at
            duration = (completed - started).total_seconds() / 60
            execution.duration_minutes = int(duration)
        
        self.db.commit()
        self.db.refresh(execution)
        
        # Update test run progress
        self._update_test_run_progress(execution.test_run_id)
        
        return TestExecutionDetail.model_validate(execution)
    
    def _update_test_run_progress(self, test_run_id: int):
        """Update test run progress counters"""
        test_run = self.db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not test_run:
            return
        
        executions = self.db.query(TestExecution).filter(
            TestExecution.test_run_id == test_run_id
        ).all()
        
        test_run.total_test_cases = len(executions)
        test_run.executed_count = sum(1 for ex in executions if ex.status != ExecutionStatus.NOT_STARTED)
        test_run.passed_count = sum(1 for ex in executions if ex.status == ExecutionStatus.PASSED)
        test_run.failed_count = sum(1 for ex in executions if ex.status == ExecutionStatus.FAILED)
        test_run.blocked_count = sum(1 for ex in executions if ex.status == ExecutionStatus.BLOCKED)
        test_run.skipped_count = sum(1 for ex in executions if ex.status == ExecutionStatus.SKIPPED)
        
        self.db.commit()
    
    # ===== AI Assignment Methods =====
    
    async def ai_assign_test_cases(
        self,
        test_run_id: int,
        collaborator_ids: List[int]
    ) -> AIAssignmentResponse:
        """Use AI to assign test cases to collaborators"""
        # Get test run and executions
        test_run = self.db.query(TestRun).filter(TestRun.id == test_run_id).first()
        if not test_run:
            raise ValueError("Test run not found")
        
        executions = self.db.query(TestExecution).filter(
            TestExecution.test_run_id == test_run_id
        ).all()
        
        # Get collaborators
        collaborators = self.db.query(User).filter(User.id.in_(collaborator_ids)).all()
        if not collaborators:
            raise ValueError("No valid collaborators found")
        
        # Use AI to assign
        assignments = await self.ai_service.assign_test_cases(
            executions=[{
                'id': ex.id,
                'title': ex.test_case_title,
                'priority': ex.priority,
                'test_steps': ex.test_steps
            } for ex in executions],
            collaborators=[{
                'id': c.id,
                'name': c.full_name or c.username,
                'role': c.role
            } for c in collaborators]
        )
        
        # Apply assignments
        total_assigned = 0
        assignment_records = []
        
        for assignment in assignments:
            execution_id = assignment['execution_id']
            user_id = assignment['user_id']
            reason = assignment.get('reason', 'AI assignment')
            
            execution = self.db.query(TestExecution).filter(
                TestExecution.id == execution_id
            ).first()
            
            if execution:
                execution.assigned_to = user_id
                execution.assigned_at = datetime.utcnow()
                execution.assigned_by_ai = True
                total_assigned += 1
                
                assignment_records.append({
                    'execution_id': execution_id,
                    'user_id': user_id,
                    'reason': reason
                })
        
        # Update test run metadata
        test_run.ai_generated_assignments = True
        test_run.ai_insights = {'assignment_date': datetime.utcnow().isoformat()}
        
        self.db.commit()
        
        return AIAssignmentResponse(
            test_run_id=test_run_id,
            total_assigned=total_assigned,
            assignments=assignment_records
        )
    
    # ===== Org Recommendation Methods =====
    
    async def get_org_recommendations(self, execution_id: int) -> OrgRecommendationResponse:
        """Get AI-recommended orgs for a test case"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            raise ValueError("Test execution not found")
        
        # Get available orgs
        orgs = self.db.query(QAOrg).filter(QAOrg.is_active == True).all()
        
        # Use AI to recommend
        recommendations = await self.ai_service.recommend_orgs(
            test_case={
                'title': execution.test_case_title,
                'description': execution.test_case_description,
                'test_steps': execution.test_steps
            },
            orgs=[{
                'id': org.id,
                'name': org.org_name,
                'enabled_features': org.enabled_features,
                'data_sets': org.data_sets_available,
                'stability_score': org.stability_score
            } for org in orgs]
        )
        
        # Store recommended org
        if recommendations and len(recommendations) > 0:
            top_org_id = recommendations[0]['org_id']
            execution.recommended_org_id = top_org_id
            self.db.commit()
        
        return OrgRecommendationResponse(
            execution_id=execution_id,
            recommendations=[
                OrgRecommendation(
                    org_id=rec['org_id'],
                    org_name=rec['org_name'],
                    confidence_score=rec['confidence_score'],
                    reasons=rec['reasons']
                ) for rec in recommendations
            ]
        )
    
    def select_testing_org(self, execution_id: int, org_id: int) -> Optional[TestExecutionDetail]:
        """Select an org to use for testing"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            return None
        
        execution.selected_org_id = org_id
        self.db.commit()
        self.db.refresh(execution)
        
        return TestExecutionDetail.model_validate(execution)
    
    # ===== Browser Session Methods =====
    
    async def start_browser_session(
        self,
        execution_id: int,
        org_id: int,
        user_id: int
    ) -> BrowserSessionResponse:
        """Start a browser session with auto-login to Salesforce"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            raise ValueError("Test execution not found")
        
        org = self.db.query(QAOrg).filter(QAOrg.id == org_id).first()
        if not org:
            raise ValueError("Org not found")
        
        import uuid
        session_id = str(uuid.uuid4())

        session = BrowserSession(
            test_execution_id=execution_id,
            org_id=org_id,
            user_id=user_id,
            session_id=session_id,
            browser_type="chrome",
            instance_url=org.org_url or "https://login.salesforce.com",
            expires_at=datetime.utcnow() + timedelta(hours=2)
        )
        
        self.db.add(session)
        self.db.commit()
        
        return BrowserSessionResponse(
            session_id=session_id,
            instance_url=session.instance_url,
            expires_at=session.expires_at
        )
    
    # ===== Chat Methods =====
    
    def get_chat_history(self, execution_id: int) -> List[ChatMessageResponse]:
        """Get chat history for a test execution"""
        messages = self.db.query(TestExecutionComment).filter(
            TestExecutionComment.test_execution_id == execution_id
        ).order_by(TestExecutionComment.created_at).all()
        
        return [ChatMessageResponse.model_validate(msg) for msg in messages]
    
    async def send_chat_message(
        self,
        execution_id: int,
        message_data: Any,
        user_id: int
    ) -> ChatMessageResponse:
        """Send a chat message and get AI response"""
        # Save user message
        user_message = TestExecutionComment(
            test_execution_id=execution_id,
            user_id=user_id,
            is_ai_response=False,
            message=message_data.message,
            screenshot_url=message_data.screenshot_url
        )
        self.db.add(user_message)
        self.db.commit()
        
        # Get AI response
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        
        ai_response_text = await self.ai_service.generate_chat_response(
            test_case={
                'title': execution.test_case_title,
                'description': execution.test_case_description,
                'steps': execution.test_steps,
                'expected_result': execution.expected_result
            },
            user_message=message_data.message,
            chat_history=self.get_chat_history(execution_id)
        )
        
        # Save AI response
        ai_message = TestExecutionComment(
            test_execution_id=execution_id,
            is_ai_response=True,
            message=ai_response_text
        )
        self.db.add(ai_message)
        self.db.commit()
        self.db.refresh(ai_message)
        
        return ChatMessageResponse.model_validate(ai_message)
    
    async def request_ai_validation(
        self,
        execution_id: int,
        request: AIValidationRequest
    ) -> AIValidationResponse:
        """Request AI to validate test execution"""
        execution = self.db.query(TestExecution).filter(TestExecution.id == execution_id).first()
        if not execution:
            raise ValueError("Test execution not found")
        
        # Use AI to validate
        validation = await self.ai_service.validate_test_execution(
            test_case={
                'title': execution.test_case_title,
                'description': execution.test_case_description,
                'steps': execution.test_steps,
                'expected_result': execution.expected_result
            },
            user_notes=request.user_notes,
            screenshots=request.screenshots
        )
        
        # Save validation summary
        execution.ai_validation_summary = validation['summary']
        execution.ai_confidence_score = validation['confidence_score']
        self.db.commit()
        
        return AIValidationResponse(
            validation_summary=validation['summary'],
            confidence_score=validation['confidence_score'],
            suggested_status=ExecutionStatus(validation['suggested_status']),
            observations=validation['observations'],
            concerns=validation['concerns']
        )
    
    # ===== User Assignments =====
    
    def get_user_assignments(
        self,
        user_id: int,
        status: Optional[str] = None
    ) -> List[TestExecutionSummary]:
        """Get all test executions assigned to a user"""
        query = self.db.query(TestExecution).filter(TestExecution.assigned_to == user_id)
        
        if status:
            query = query.filter(TestExecution.status == status)
        
        executions = query.all()
        
        # Convert to TestExecutionSummary and populate assigned_user
        result = []
        for ex in executions:
            summary = TestExecutionSummary.model_validate(ex)
            
            # Populate assigned_user
            user = self.db.query(User).filter(User.id == user_id).first()
            if user:
                summary.assigned_user = UserSummary.model_validate(user)
            
            result.append(summary)
        
        return result
