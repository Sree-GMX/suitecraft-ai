"""
API Endpoints for Regression Test Plan Generation
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.services.regression_test_selector import generate_regression_test_plan

router = APIRouter()


class RegressionTestPlanRequest(BaseModel):
    """Request model for regression test plan generation"""
    release_tickets: List[Dict[str, Any]] = Field(
        ...,
        description="List of release tickets with metadata (id, summary, type, priority, module, etc.)"
    )
    impacted_modules: List[str] = Field(
        ...,
        description="List of modules/components impacted by this release"
    )
    available_test_cases: List[Dict[str, Any]] = Field(
        ...,
        description="All available test cases with metadata (id, title, priority, module, etc.)"
    )
    historical_failures: Optional[Dict[str, int]] = Field(
        None,
        description="Optional mapping of test_id -> failure_count for historical failure data"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "release_tickets": [
                    {
                        "id": "PROJ-123",
                        "summary": "Add user authentication flow",
                        "issue_type": "Story",
                        "priority": "High",
                        "module": "auth",
                        "components": ["backend", "frontend"]
                    },
                    {
                        "id": "PROJ-124",
                        "summary": "Fix login redirect bug",
                        "issue_type": "Bug",
                        "priority": "Critical",
                        "module": "auth"
                    }
                ],
                "impacted_modules": ["auth", "user", "session"],
                "available_test_cases": [
                    {
                        "id": "TC-001",
                        "title": "Verify user login with valid credentials",
                        "priority": "Critical",
                        "module": "auth",
                        "section": "Authentication > Login",
                        "historical_failures": 2,
                        "tags": ["smoke", "critical"]
                    },
                    {
                        "id": "TC-002",
                        "title": "Test session timeout",
                        "priority": "High",
                        "module": "session",
                        "section": "Session Management"
                    }
                ],
                "historical_failures": {
                    "TC-001": 2,
                    "TC-005": 8
                }
            }
        }


class RegressionTestPlanResponse(BaseModel):
    """Response model for regression test plan"""
    success: bool
    message: str
    test_plan: Dict[str, Any]


@router.post("/generate", response_model=RegressionTestPlanResponse)
async def generate_regression_test_plan_endpoint(
    request: RegressionTestPlanRequest
) -> RegressionTestPlanResponse:
    """
    Generate a comprehensive regression test plan using risk-based analysis.
    
    This endpoint implements strict selection rules:
    - Minimum 20% of total test cases OR 100 test cases (whichever is higher)
    - ALL P0 (Critical) test cases MUST be included
    - ALL P1 (High) test cases related to impacted modules MUST be included
    - Coverage of ALL impacted modules
    - Inclusion of integration and end-to-end flows
    
    Returns:
        Comprehensive test plan with:
        - Summary statistics
        - Selected test cases grouped by priority
        - Coverage report by module
        - Risk justification
        - Gaps and recommendations
        - Execution strategy
    """
    try:
        # Generate test plan
        test_plan = generate_regression_test_plan(
            release_tickets=request.release_tickets,
            impacted_modules=request.impacted_modules,
            available_test_cases=request.available_test_cases,
            historical_failures=request.historical_failures
        )
        
        # Verify minimum requirements
        summary = test_plan['summary']
        if not summary['selection_meets_requirements']:
            return RegressionTestPlanResponse(
                success=False,
                message=f"Failed to meet minimum requirements. Selected {summary['total_selected']} tests, but {summary['minimum_required']} required.",
                test_plan=test_plan
            )
        
        return RegressionTestPlanResponse(
            success=True,
            message=f"Successfully generated regression test plan with {summary['total_selected']} test cases ({summary['coverage_percentage']}% coverage)",
            test_plan=test_plan
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate regression test plan: {str(e)}"
        )


@router.post("/validate")
async def validate_test_plan_requirements(
    request: RegressionTestPlanRequest
) -> Dict[str, Any]:
    """
    Validate that input data meets requirements without generating full plan.
    
    Returns:
        Validation results including:
        - Input data statistics
        - Minimum requirements calculation
        - Preliminary feasibility check
    """
    try:
        total_tests = len(request.available_test_cases)
        min_required = max(int(total_tests * 0.20), 100)
        
        # Count critical and high priority tests
        critical_tests = [
            tc for tc in request.available_test_cases
            if tc.get('priority', '').lower() in ['critical', 'p0']
        ]
        
        high_tests = [
            tc for tc in request.available_test_cases
            if tc.get('priority', '').lower() in ['high', 'p1']
        ]
        
        # Check impacted module coverage
        available_modules = set(tc.get('module', 'unknown') for tc in request.available_test_cases)
        impacted_modules = set(request.impacted_modules)
        uncovered_modules = impacted_modules - available_modules
        
        return {
            "validation": {
                "total_test_cases": total_tests,
                "minimum_required": min_required,
                "feasibility": "pass" if total_tests >= min_required else "fail",
                "critical_tests_available": len(critical_tests),
                "high_tests_available": len(high_tests),
                "mandatory_tests_count": len(critical_tests) + len([
                    tc for tc in high_tests if tc.get('module') in impacted_modules
                ])
            },
            "coverage_check": {
                "impacted_modules": list(impacted_modules),
                "modules_with_tests": list(impacted_modules & available_modules),
                "modules_without_tests": list(uncovered_modules),
                "coverage_risk": "high" if uncovered_modules else "low"
            },
            "release_info": {
                "total_tickets": len(request.release_tickets),
                "bugs": len([t for t in request.release_tickets if t.get('issue_type', '').lower() == 'bug']),
                "stories": len([t for t in request.release_tickets if t.get('issue_type', '').lower() == 'story'])
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Validation failed: {str(e)}"
        )
