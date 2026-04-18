from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.schemas import (
    QAOrgCreate, QAOrgResponse, QAOrgUpdate,
    OrgRecommendationRequest, OrgRecommendationResponse
)
from app.services.org_service import OrgService
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/orgs", tags=["organizations"], dependencies=[Depends(get_current_user)])

@router.post("/", response_model=QAOrgResponse, status_code=status.HTTP_201_CREATED)
def create_org(
    org: QAOrgCreate,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    return service.create_org(org)

@router.get("/", response_model=List[QAOrgResponse])
def get_orgs(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    return service.get_orgs(skip, limit, active_only)

@router.get("/{org_id}", response_model=QAOrgResponse)
def get_org(
    org_id: int,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    org = service.get_org(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.put("/{org_id}", response_model=QAOrgResponse)
def update_org(
    org_id: int,
    org_update: QAOrgUpdate,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    org = service.update_org(org_id, org_update)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org(
    org_id: int,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    success = service.delete_org(org_id)
    if not success:
        raise HTTPException(status_code=404, detail="Organization not found")
    return None

@router.put("/{org_id}/stability")
def update_stability(
    org_id: int,
    stability_score: float,
    db: Session = Depends(get_db)
):
    if not 0.0 <= stability_score <= 1.0:
        raise HTTPException(status_code=400, detail="Stability score must be between 0.0 and 1.0")
    
    service = OrgService(db)
    org = service.update_org_stability(org_id, stability_score)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.post("/recommend", response_model=OrgRecommendationResponse)
async def recommend_orgs(
    request: OrgRecommendationRequest,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    try:
        recommendations = await service.recommend_orgs(request)
        return recommendations
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{org_id}/test-data")
def add_test_data_set(
    org_id: int,
    data_set_name: str,
    data_type: str,
    data_inventory: dict,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    try:
        data_set = service.add_test_data_set(org_id, data_set_name, data_type, data_inventory)
        return data_set
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{org_id}/test-data")
def get_test_data_sets(
    org_id: int,
    db: Session = Depends(get_db)
):
    service = OrgService(db)
    return service.get_test_data_sets(org_id)
