"""
API endpoints for external integrations (Jira, TestRail)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.services.google_sheets_service import google_sheets_service
from app.services.testrail_service import testrail_service
from app.services.testrail_csv_service import testrail_csv_service
from app.services.ai_errors import ActualAIRequiredError
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/integrations", tags=["integrations"], dependencies=[Depends(get_current_user)])

class TicketResponse(BaseModel):
    issue_type: str
    issue_key: str
    summary: str
    status: str
    priority: str
    fix_versions: str

class TestCaseResponse(BaseModel):
    id: int
    title: str
    priority_id: Optional[int] = None
    section_id: Optional[int] = None

class IntegrationStatus(BaseModel):
    type: str
    name: str
    is_active: bool
    status: str
    config: dict

class TestImpactAnalysisRequest(BaseModel):
    selected_tickets: List[Dict[str, Any]]
    all_test_cases: Optional[List[Dict[str, Any]]] = None

class GenerateTestPlanRequest(BaseModel):
    selected_tickets: List[Dict[str, Any]]
    selected_test_cases: List[Dict[str, Any]]
    release_info: Dict[str, Any]
    force_refresh: bool = False


@router.get("/")
async def list_integrations():
    """
    List all available integrations and their status
    
    Returns:
        List of configured integrations with their status
    """
    integrations = []
    
    # Check Jira integration (live API preferred, CSV fallback supported)
    try:
        jira_connection = google_sheets_service.get_connection_status()
        integrations.append({
            "type": "jira",
            "name": "Jira",
            "is_active": bool(jira_connection["connected"]),
            "status": jira_connection["status"],
            "config": {
                "source": jira_connection["source"],
                "live_api_enabled": google_sheets_service.is_live_api_enabled(),
                "csv_fallback_available": jira_connection["csv_fallback_available"],
                "error": jira_connection["error"],
            }
        })
    except Exception as e:
        integrations.append({
            "type": "jira",
            "name": "Jira",
            "is_active": False,
            "status": "error",
            "config": {"error": str(e)}
        })
    
    # Check TestRail CSV integration
    try:
        csv_available = len(testrail_csv_service.test_cases) > 0
        integrations.append({
            "type": "testrail_csv",
            "name": "TestRail CSV",
            "is_active": csv_available,
            "status": "connected" if csv_available else "no_data",
            "config": {
                "test_cases_count": len(testrail_csv_service.test_cases)
            }
        })
    except Exception as e:
        integrations.append({
            "type": "testrail_csv",
            "name": "TestRail CSV",
            "is_active": False,
            "status": "error",
            "config": {"error": str(e)}
        })
    
    return integrations


@router.get("/jira/connection-test")
async def test_jira_connection():
    """Check live Jira connectivity and whether CSV fallback is being used."""
    try:
        return google_sheets_service.get_connection_status()
    except Exception as e:
        return {
            "configured": google_sheets_service.is_live_api_enabled(),
            "connected": False,
            "source": "unknown",
            "status": "error",
            "csv_fallback_available": len(google_sheets_service.get_csv_data()) > 0,
            "error": str(e),
        }

@router.get("/google-sheets/tickets", response_model=List[TicketResponse])
async def get_sheets_tickets(release_version: Optional[str] = None):
    """
    Get release tickets from live Jira when configured, otherwise from CSV fallback.
    
    Args:
        release_version: Optional filter by release version (e.g., "2605-Release")
    """
    try:
        tickets = google_sheets_service.get_release_tickets(release_version)
        return tickets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching tickets: {str(e)}")

@router.get("/google-sheets/releases", response_model=List[str])
async def get_sheets_releases():
    """Get list of unique release versions from live Jira when configured, otherwise CSV fallback."""
    try:
        releases = google_sheets_service.get_releases()
        return releases
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching releases: {str(e)}")

@router.get("/testrail/connection-test")
async def test_testrail_connection():
    """Test TestRail connection and configuration"""
    try:
        # Check if credentials are configured
        if not testrail_service.url or not testrail_service.api_key or not testrail_service.user:
            return {
                "status": "not_configured",
                "message": "TestRail credentials not configured",
                "url": testrail_service.url or "Not set",
                "user": testrail_service.user or "Not set"
            }
        
        # Try to connect
        connected = testrail_service.connect()
        
        if connected:
            # Get projects to verify
            projects = testrail_service.get_projects()
            
            # Get UCP suite (292) information
            from app.core.config import settings
            suites = testrail_service.get_test_suites(settings.TESTRAIL_PROJECT_ID)
            ucp_suite = next((s for s in suites if s.get('id') == settings.TESTRAIL_SUITE_ID), None)
            
            return {
                "status": "connected",
                "message": "TestRail connection successful",
                "url": testrail_service.url,
                "user": testrail_service.user,
                "projects_count": len(projects),
                "ucp_suite": {
                    "id": settings.TESTRAIL_SUITE_ID,
                    "name": ucp_suite.get('name') if ucp_suite else "Not found",
                    "found": ucp_suite is not None
                } if suites else None
            }
        else:
            return {
                "status": "connection_failed",
                "message": "Failed to connect to TestRail",
                "url": testrail_service.url
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "error_type": type(e).__name__
        }

@router.get("/testrail/projects")
async def get_testrail_projects():
    """Get TestRail projects (READ ONLY)"""
    try:
        projects = testrail_service.get_projects()
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching projects: {str(e)}")

@router.get("/testrail/test-cases")
async def get_testrail_test_cases(
    project_id: int,
    suite_id: Optional[int] = None,
    search: Optional[str] = None
):
    """
    Get test cases from TestRail (READ ONLY)
    
    Args:
        project_id: TestRail project ID
        suite_id: Optional test suite ID to filter
        search: Optional search term to filter test cases
    """
    try:
        if search:
            cases = testrail_service.search_test_cases_by_title(project_id, search)
        else:
            cases = testrail_service.get_test_cases(project_id, suite_id)
        
        return {"test_cases": cases, "count": len(cases)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching test cases: {str(e)}")

@router.get("/testrail/test-suites")
async def get_testrail_test_suites(project_id: int):
    """Get test suites from TestRail project (READ ONLY)"""
    try:
        suites = testrail_service.get_test_suites(project_id)
        return {"suites": suites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching suites: {str(e)}")

@router.get("/testrail/release-tests")
async def get_testrail_release_tests(project_id: int, release_version: str):
    """
    Get test cases for a specific release version (READ ONLY)
    
    Args:
        project_id: TestRail project ID
        release_version: Release version to search for (e.g., "2605-Release")
    """
    try:
        cases = testrail_service.get_test_cases_for_release(project_id, release_version)
        return {
            "release_version": release_version,
            "test_cases": cases,
            "count": len(cases)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching release tests: {str(e)}")


@router.get("/tickets-with-testcases")
async def get_tickets_with_testcases(
    release_versions: Optional[str] = None,
    testrail_project_id: int = 1,
    testrail_suite_id: int = 292
):
    """
    Get tickets from Jira (live API or CSV fallback) and associated test cases from TestRail CSV
    
    Args:
        release_versions: Comma-separated release versions (e.g., "2605-Release,2602-Release")
        testrail_project_id: TestRail project ID (default: 1)
        testrail_suite_id: TestRail suite ID (default: 292 for UCP)
        
    Returns:
        Segregated tickets (stories with test cases, bugs without)
    """
    try:
        all_tickets = []
        versions = [v.strip() for v in (release_versions or "").split(',') if v.strip()]
        if not versions:
            raise HTTPException(status_code=400, detail="release_versions is required")

        for version in versions:
            tickets = google_sheets_service.get_release_tickets(version)
            all_tickets.extend(tickets)

        csv_service = testrail_csv_service
        csv_available = len(csv_service.test_cases) > 0
        
        # Segregate tickets by type
        story_tickets = []
        bug_tickets = []
        total_test_cases = 0
        
        for ticket in all_tickets:
            issue_type = ticket.get('issue_type', '').lower()
            ticket_key = ticket.get('issue_key', '')
            
            if 'bug' in issue_type or 'defect' in issue_type:
                # Bugs don't have test cases
                bug_tickets.append({
                    **ticket,
                    'test_cases': [],
                    'test_cases_count': 0
                })
            else:
                # For stories, fetch test cases from CSV
                test_cases = []
                if csv_available:
                    test_cases = csv_service.get_test_cases_for_ticket(
                        ticket_key,
                        ticket.get('summary', '')
                    )
                
                story_tickets.append({
                    **ticket,
                    'test_cases': test_cases,
                    'test_cases_count': len(test_cases)
                })
                total_test_cases += len(test_cases)
        
        return {
            "releases": versions,
            "testrail_enabled": csv_available,
            "testrail_suite_id": testrail_suite_id,
            "testrail_source": "CSV file (testrail_testcases.csv)",
            "summary": {
                "total_tickets": len(all_tickets),
                "story_tickets": len(story_tickets),
                "bug_tickets": len(bug_tickets),
                "total_test_cases": total_test_cases
            },
            "stories": story_tickets,
            "bugs": bug_tickets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching tickets with test cases: {str(e)}")

@router.get("/testrail-csv/stats")
async def get_testrail_csv_stats():
    """
    Get statistics about test cases from CSV
    
    Returns:
        Test case statistics including counts by priority
    """
    try:
        stats = testrail_csv_service.get_stats()
        return stats
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error fetching test case statistics: {str(e)}")

@router.get("/testrail-csv/all")
async def get_all_testrail_csv_cases(limit: int = 1000, offset: int = 0):
    """
    Get all test cases from CSV with pagination
    
    Args:
        limit: Maximum number of test cases to return (default 1000)
        offset: Number of test cases to skip (default 0)
        
    Returns:
        List of test cases
    """
    try:
        all_cases = testrail_csv_service.get_all_test_cases()
        total = len(all_cases)
        
        # Apply pagination
        paginated_cases = all_cases[offset:offset + limit]
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "test_cases": paginated_cases
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching test cases: {str(e)}")

@router.get("/testrail-csv/search")
async def search_testrail_csv(search_term: str):
    """
    Search test cases by title from CSV
    
    Args:
        search_term: Search term to match in test case titles
        
    Returns:
        List of matching test cases
    """
    try:
        if not search_term:
            return {"error": "search_term parameter is required"}
        
        test_cases = testrail_csv_service.search_test_cases_by_title(search_term)
        
        return {
            "search_term": search_term,
            "total_matches": len(test_cases),
            "test_cases": test_cases[:100]  # Limit to 100 results
        }
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Error searching test cases: {str(e)}")

@router.get("/testrail-csv/by-ids")
async def get_testrail_csv_by_ids(
    ids: str = Query(..., description="Comma-separated TestRail case IDs"),
):
    """Resolve one or more TestRail CSV case IDs."""
    try:
        test_case_ids = [value.strip() for value in ids.split(',') if value.strip()]
        test_cases = testrail_csv_service.get_test_cases_by_ids(test_case_ids)
        return {
            "requested": len(test_case_ids),
            "returned": len(test_cases),
            "test_cases": test_cases,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching test cases by id: {str(e)}")

@router.post("/ai/analyze-test-impact")
async def analyze_test_impact(request: TestImpactAnalysisRequest):
    """
    Phase 3: Use AI to analyze selected tickets and recommend additional test cases
    
    Args:
        request: Request containing selected_tickets and optional all_test_cases
        
    Returns:
        AI analysis with recommended test cases grouped by section
    """
    
    try:
        from app.services.ai_service import ai_service
        
        # If test cases not provided, fetch from CSV
        all_test_cases = request.all_test_cases
        if not all_test_cases:
            all_test_cases = testrail_csv_service.get_all_test_cases()
        
        # Call AI service
        analysis = await ai_service.analyze_test_impact(request.selected_tickets, all_test_cases)
        
        return {
            "status": "success",
            "analysis": analysis,
            "tickets_analyzed": len(request.selected_tickets),
            "total_test_cases_available": len(all_test_cases)
        }
    except ActualAIRequiredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing test impact: {str(e)}")

@router.post("/ai/generate-test-plan")
async def generate_test_plan(request: GenerateTestPlanRequest):
    """
    Generate a release test plan from the selected Step 1 scope.
    
    Args:
        request: Contains selected_tickets, selected_test_cases, and release_info
        
    Returns:
        A test plan including new scenarios and selected test cases organized by section

    NOTE: This endpoint receives the selected Step 1 test cases rather than the
    full TestRail inventory.
    """
    
    try:
        from app.services.enterprise_ai_service import enterprise_ai_service
        
        # Format tickets and test cases for strategy planning
        formatted_tickets = [
            {
                'issue_key': t.get('issue_key', t.get('key', 'N/A')),
                'summary': t.get('summary', 'No summary'),
                'issue_type': t.get('issue_type', t.get('type', 'Story')),
                'priority': t.get('priority', 'Medium'),
                'description': t.get('description', ''),
                'status': t.get('status', 'To Do')
            }
            for t in request.selected_tickets
        ]
        
        # Test cases are already in the correct format from Step 1
        formatted_test_cases = request.selected_test_cases
        
        # Build release info
        release_info = {
            "release_name": request.release_info.get('release_name', request.release_info.get('release_version', 'Release')),
            "release_version": request.release_info.get('release_version', 'v1.0'),
            "total_tickets": len(formatted_tickets),
            "stories": len([t for t in formatted_tickets if t.get('issue_type', '').lower() not in ['bug', 'defect']]),
            "bugs": len([t for t in formatted_tickets if t.get('issue_type', '').lower() in ['bug', 'defect']]),
            "total_test_cases": len(formatted_test_cases)
        }
        
        # Call the planning service with the selected Step 1 scope
        test_plan = await enterprise_ai_service.generate_enterprise_test_plan(
            tickets=formatted_tickets,
            test_cases=formatted_test_cases,
            release_info=release_info,
            force_refresh=request.force_refresh
        )
        
        
        return {
            "status": "success",
            "test_plan": test_plan,
            "tickets_analyzed": len(request.selected_tickets),
            "test_cases_included": len(request.selected_test_cases)
        }
    except ActualAIRequiredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating test plan: {str(e)}")
