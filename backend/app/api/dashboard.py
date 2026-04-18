from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/{release_id}")
async def get_dashboard_metrics(
    release_id: int,
    db: Session = Depends(get_db)
):
    service = DashboardService(db)
    try:
        metrics = await service.get_dashboard_metrics(release_id)
        return metrics
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not load dashboard metrics for this release")
