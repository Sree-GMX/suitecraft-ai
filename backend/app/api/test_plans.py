"""
API endpoints for AI-powered test plan generation

⚠️ DEPRECATION NOTICE:
This endpoint is being phased out in favor of the newer service:
/api/v1/ai-enhanced-test-plan/

The old endpoint has limitations:
- Limited to ~100 test cases (data sampling)
- 90%+ data loss on large datasets
- Token limit restrictions

New endpoint supports:
- Unlimited test cases (10,000+)
- 0% data loss
- Complete AI insights
- Better performance

Migration: Replace /api/v1/test-plans/generate with /api/v1/ai-enhanced-test-plan/generate-from-sheets
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.services.test_plan_ai_service import test_plan_ai_service
from app.services.enterprise_ai_service import enterprise_ai_service
from app.services.google_sheets_service import google_sheets_service
from app.services.testrail_csv_service import testrail_csv_service
from app.core.database import get_db
from app.models.models import SavedTestPlan

router = APIRouter(prefix="/test-plans", tags=["test-plans [DEPRECATED]"])

class TestPlanRequest(BaseModel):
    release_versions: List[str]
    priority_focus: str = "all"  # "critical", "high", "medium", "low", or "all"
    include_gap_analysis: bool = True
    use_ai: bool = True  # Use AI for risk analysis (default True)
    use_enterprise_ai: bool = False

class TestPlanResponse(BaseModel):
    success: bool
    test_plan: dict
    gap_analysis: Optional[dict] = None
    processing_time_seconds: Optional[float] = None

@router.post("/generate", response_model=TestPlanResponse, deprecated=True)
async def generate_test_plan(request: TestPlanRequest):
    """
    ⚠️ DEPRECATED - Use /api/v1/ai-enhanced-test-plan/generate-from-sheets instead
    
    Generate an AI-powered regression test plan
    
    LIMITATIONS:
    - Limited to ~100 test cases (samples data)
    - 90%+ data loss on large datasets  
    - Output truncated by token limits
    
    MIGRATION PATH:
    Use the newer endpoint:
    POST /api/v1/ai-enhanced-test-plan/generate-from-sheets
    
    Benefits of new endpoint:
    - ✅ Unlimited test cases (10,000+)
    - ✅ 0% data loss
    - ✅ Complete AI insights
    - ✅ Better performance
    
    Args:
        request: Test plan generation request with release versions and options
        use_enterprise_ai: If True, uses the multi-stakeholder AI approach
    
    Returns:
        Comprehensive test plan with suites, risk analysis, and recommendations
    """
    import time
    start_time = time.time()
    
    try:
        # Fetch tickets for all selected releases
        all_tickets = []
        for version in request.release_versions:
            tickets = google_sheets_service.get_release_tickets(version)
            all_tickets.extend(tickets)
        
        if not all_tickets:
            raise HTTPException(status_code=404, detail="No tickets found for selected releases")
        
        
        # Fetch test cases - USE ALL TEST CASES (not ticket-specific)
        all_test_cases = []
        csv_available = len(testrail_csv_service.test_cases) > 0
        
        if csv_available:
            all_test_cases = testrail_csv_service.get_all_test_cases()
            
            # Format test cases consistently
            formatted_test_cases = []
            for case in all_test_cases:
                priority = case.get('Priority', 'Medium')
                
                # Map priority
                if priority.lower() == 'critical':
                    priority_id = 1
                    priority_color = '#ff1744'
                elif priority.lower() == 'high':
                    priority_id = 2
                    priority_color = '#ff9800'
                elif priority.lower() == 'medium':
                    priority_id = 3
                    priority_color = '#4caf50'
                else:
                    priority_id = 4
                    priority_color = '#9e9e9e'
                
                formatted_test_cases.append({
                    'id': case.get('ID', ''),
                    'ID': case.get('ID', ''),
                    'title': case.get('Title', ''),
                    'Title': case.get('Title', ''),
                    'priority_id': priority_id,
                    'priority_label': priority.title(),
                    'Priority': priority.title(),
                    'priority_color': priority_color,
                    'section': case.get('Section', ''),
                    'Section': case.get('Section', ''),
                    'section_hierarchy': case.get('Section Hierarchy', ''),
                    'Section Hierarchy': case.get('Section Hierarchy', ''),
                    'section_description': case.get('Section Description', '')
                })
            
            all_test_cases = formatted_test_cases
        
        
        # Prepare release info
        release_info = {
            "release_version": ", ".join(request.release_versions),
            "total_tickets": len(all_tickets),
            "stories": len([t for t in all_tickets if t.get('issue_type', '').lower() not in ['bug', 'defect']]),
            "bugs": len([t for t in all_tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]),
            "total_test_cases": len(all_test_cases)
        }
        
        # Choose AI approach based on request
        if request.use_enterprise_ai and request.use_ai:
            test_plan = await enterprise_ai_service.generate_enterprise_test_plan(
                tickets=all_tickets,
                test_cases=all_test_cases,
                release_info=release_info
            )
        else:
            test_plan = await test_plan_ai_service.generate_deterministic_test_plan(
                tickets=all_tickets,
                test_cases=all_test_cases,
                release_info=release_info,
                priority_focus=request.priority_focus,
                use_ai_for_risk_analysis=request.use_ai
            )

        # Optional: Analyze coverage gaps
        gap_analysis = None
        if request.include_gap_analysis:
            gap_analysis = await test_plan_ai_service.analyze_test_coverage_gaps(
                tickets=all_tickets,
                test_cases=all_test_cases
            )

        processing_time = time.time() - start_time
        
        return {
            "success": True,
            "test_plan": test_plan,
            "test_suites": test_plan.get("test_suites", []),
            "gap_analysis": gap_analysis,
            "processing_time_seconds": round(processing_time, 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating test plan: {str(e)}")

@router.get("/quick-generate")
async def quick_generate_test_plan(
    release_versions: str = Query(..., description="Comma-separated release versions"),
    priority_focus: str = Query("all", description="Priority focus: critical, high, medium, low, or all"),
    include_gap_analysis: bool = Query(True, description="Include gap analysis")
):
    """
    Quick endpoint for generating test plans via GET request
    
    Args:
        release_versions: Comma-separated release versions (e.g., "2605-Release,2602-Release")
        priority_focus: Priority focus for the test plan
        include_gap_analysis: Whether to include gap analysis
    """
    versions = [v.strip() for v in release_versions.split(',')]
    
    request = TestPlanRequest(
        release_versions=versions,
        priority_focus=priority_focus,
        include_gap_analysis=include_gap_analysis
    )
    
    return await generate_test_plan(request)

@router.get("/coverage-analysis")
async def analyze_coverage(release_versions: str = Query(..., description="Comma-separated release versions")):
    """
    Analyze test coverage for selected releases
    
    Args:
        release_versions: Comma-separated release versions
    
    Returns:
        Coverage analysis including gaps and recommendations
    """
    try:
        versions = [v.strip() for v in release_versions.split(',')]
        
        # Fetch tickets
        all_tickets = []
        for version in versions:
            tickets = google_sheets_service.get_release_tickets(version)
            all_tickets.extend(tickets)
        
        if not all_tickets:
            raise HTTPException(status_code=404, detail="No tickets found for selected releases")
        
        # Fetch test cases
        all_test_cases = []
        csv_available = len(testrail_csv_service.test_cases) > 0
        
        if csv_available:
            # Use all test cases for comprehensive coverage analysis
            all_test_cases = testrail_csv_service.get_all_test_cases()
            
            # Format test cases consistently
            formatted_test_cases = []
            for case in all_test_cases:
                priority = case.get('Priority', 'Medium')
                
                # Map priority to color and ID
                if priority.lower() == 'critical':
                    priority_id = 1
                    priority_color = '#ff1744'
                elif priority.lower() == 'high':
                    priority_id = 2
                    priority_color = '#ff9800'
                elif priority.lower() == 'medium':
                    priority_id = 3
                    priority_color = '#4caf50'
                else:
                    priority_id = 4
                    priority_color = '#9e9e9e'
                
                formatted_test_cases.append({
                    'id': case.get('ID', ''),
                    'title': case.get('Title', ''),
                    'priority_id': priority_id,
                    'priority_label': priority.title(),
                    'priority_color': priority_color,
                    'section': case.get('Section', ''),
                    'section_hierarchy': case.get('Section Hierarchy', ''),
                    'section_description': case.get('Section Description', '')
                })
            
            all_test_cases = formatted_test_cases
        
        # Try to link test cases to tickets where possible
        for ticket in all_tickets:
            ticket_key = ticket.get('issue_key', '')
            if ticket.get('issue_type', '').lower() not in ['bug', 'defect']:
                # Count test cases that mention this ticket
                ticket['test_cases_count'] = len([
                    tc for tc in all_test_cases 
                    if (ticket_key.lower() in tc.get('title', '').lower() or
                        ticket_key.lower() in tc.get('section', '').lower() or
                        ticket_key.lower() in tc.get('section_hierarchy', '').lower())
                ])
            else:
                ticket['test_cases_count'] = 0
        
        # Analyze gaps
        gap_analysis = await test_plan_ai_service.analyze_test_coverage_gaps(
            tickets=all_tickets,
            test_cases=all_test_cases
        )
        
        return {
            "success": True,
            "release_versions": versions,
            "total_tickets": len(all_tickets),
            "total_test_cases": len(all_test_cases),
            "coverage_analysis": gap_analysis
        }
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error analyzing coverage: {str(e)}")

@router.get("/health")
async def test_plan_health():
    """
    Check health of test plan generation service
    
    Returns:
        Health status and available AI backends
    """
    from app.core.config import settings
    
    # Test Ollama connection
    ollama_available = False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            ollama_available = response.status_code == 200
    except:
        pass
    
    # Check cloud providers
    gemini_available = bool(settings.GEMINI_API_KEY)
    groq_available = bool(settings.GROQ_API_KEY)
    
    return {
        "status": "healthy",
        "ai_backends": {
            "ollama": {
                "available": ollama_available,
                "url": settings.OLLAMA_BASE_URL,
                "model": settings.OLLAMA_MODEL
            },
            "gemini": {
                "available": gemini_available,
                "configured": gemini_available,
                "model": settings.GEMINI_MODEL
            },
            "groq": {
                "available": groq_available,
                "configured": groq_available
            }
        },
        "integrations": {
            "google_sheets": bool(settings.GOOGLE_SHEET_ID),
            "testrail_csv": len(testrail_csv_service.test_cases) > 0
        }
    }

class SaveTestPlanRequest(BaseModel):
    test_plan_data: dict
    test_plan_name: Optional[str] = None

@router.post("/save")
async def save_test_plan(request: SaveTestPlanRequest, db: Session = Depends(get_db)):
    """
    Save a generated test plan for future reference
    
    Args:
        request: Test plan data and optional name
        db: Database session
    
    Returns:
        Saved test plan with ID
    """
    try:
        # Extract metadata from test plan
        test_plan = request.test_plan_data.get('test_plan', {})
        release_versions = test_plan.get('release_version', '')
        
        # Calculate totals
        test_suites = test_plan.get('test_suites', [])
        total_test_cases = sum(
            len(suite.get('test_cases', [])) 
            for suite in test_suites
        )
        
        execution_strategy = test_plan.get('execution_strategy', {})
        
        # Create saved test plan
        saved_plan = SavedTestPlan(
            release_versions=release_versions,
            test_plan_name=request.test_plan_name or f"Test Plan - {release_versions}",
            priority_focus=test_plan.get('priority_filter', 'all'),
            ai_enabled=test_plan.get('ai_insights_available', True),
            test_plan_data=request.test_plan_data,
            total_test_cases=total_test_cases,
            total_test_suites=len(test_suites),
            estimated_duration_minutes=execution_strategy.get('total_estimated_duration_minutes', 0),
            confidence_score=test_plan.get('confidence_score', 0.0),
        )
        
        db.add(saved_plan)
        db.commit()
        db.refresh(saved_plan)
        
        return {
            "success": True,
            "saved_plan_id": saved_plan.id,
            "message": "Test plan saved successfully"
        }
        
    except Exception as e:

        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving test plan: {str(e)}")

@router.get("/saved")
async def list_saved_test_plans(
    release_version: Optional[str] = Query(None, description="Filter by release version"),
    limit: int = Query(50, description="Maximum number of results"),
    offset: int = Query(0, description="Pagination offset"),
    db: Session = Depends(get_db)
):
    """
    List all saved test plans
    
    Args:
        release_version: Optional filter by release version
        limit: Maximum results to return
        offset: Pagination offset
        db: Database session
    
    Returns:
        List of saved test plans
    """
    try:
        query = db.query(SavedTestPlan)
        
        if release_version:
            query = query.filter(SavedTestPlan.release_versions.contains(release_version))
        
        total = query.count()
        saved_plans = query.order_by(SavedTestPlan.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "success": True,
            "total": total,
            "offset": offset,
            "limit": limit,
            "saved_plans": [
                {
                    "id": plan.id,
                    "release_versions": plan.release_versions,
                    "test_plan_name": plan.test_plan_name,
                    "total_test_cases": plan.total_test_cases,
                    "total_test_suites": plan.total_test_suites,
                    "estimated_duration_minutes": plan.estimated_duration_minutes,
                    "confidence_score": plan.confidence_score,
                    "priority_focus": plan.priority_focus,
                    "ai_enabled": plan.ai_enabled,
                    "created_at": plan.created_at.isoformat() if plan.created_at else None,
                }
                for plan in saved_plans
            ]
        }
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error listing saved test plans: {str(e)}")

@router.get("/saved/{plan_id}")
async def get_saved_test_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Get a specific saved test plan by ID
    
    Args:
        plan_id: Test plan ID
        db: Database session
    
    Returns:
        Complete saved test plan data
    """
    try:
        saved_plan = db.query(SavedTestPlan).filter(SavedTestPlan.id == plan_id).first()
        
        if not saved_plan:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        return {
            "success": True,
            "id": saved_plan.id,
            "release_versions": saved_plan.release_versions,
            "test_plan_name": saved_plan.test_plan_name,
            "created_at": saved_plan.created_at.isoformat() if saved_plan.created_at else None,
            **saved_plan.test_plan_data
        }
        
    except HTTPException:
        raise
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error retrieving saved test plan: {str(e)}")

@router.delete("/saved/{plan_id}")
async def delete_saved_test_plan(plan_id: int, db: Session = Depends(get_db)):
    """
    Delete a saved test plan
    
    Args:
        plan_id: Test plan ID
        db: Database session
    
    Returns:
        Success message
    """
    try:
        saved_plan = db.query(SavedTestPlan).filter(SavedTestPlan.id == plan_id).first()
        
        if not saved_plan:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        db.delete(saved_plan)
        db.commit()
        
        return {
            "success": True,
            "message": "Test plan deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:

        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting saved test plan: {str(e)}")
