from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.schemas import (
    ReleaseCreate, ReleaseResponse, ReleaseUpdate,
    FeatureCreate, FeatureResponse,
    RegressionSuiteRequest, RegressionSuiteResponse,
    AddCollaboratorRequest, RemoveCollaboratorRequest, UserSummary
)
from app.models.models import User
from app.services.release_service import ReleaseService
from app.api.dependencies import get_current_user, require_release_access, require_release_owner

router = APIRouter(prefix="/releases", tags=["releases"])

@router.post("/", response_model=ReleaseResponse, status_code=status.HTTP_201_CREATED)
def create_release(
    release: ReleaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new release (requires authentication)"""
    service = ReleaseService(db)
    try:
        return service.create_release(release, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/", response_model=List[ReleaseResponse])
def get_releases(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get releases visible to the current user (owner or collaborator)."""
    service = ReleaseService(db)
    return service.get_accessible_releases(current_user.id, skip, limit)

@router.get("/{release_id}", response_model=ReleaseResponse)
def get_release(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get release details when the current user has access."""
    service = ReleaseService(db)
    release = service.get_accessible_release(release_id, current_user.id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found or not accessible")
    return release

@router.put("/{release_id}", response_model=ReleaseResponse)
def update_release(
    release_id: int,
    release_update: ReleaseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update release (requires owner or collaborator access)"""
    # Check if user has edit access
    from app.api.dependencies import check_release_access
    if not check_release_access(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this release"
        )
    
    service = ReleaseService(db)
    try:
        release = service.update_release(release_id, release_update)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    return release

@router.delete("/{release_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_release(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete release (requires owner permission only)"""
    # Check if user is the owner
    from app.api.dependencies import check_release_owner
    if not check_release_owner(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the release owner can delete this release"
        )
    
    service = ReleaseService(db)
    success = service.delete_release(release_id)
    if not success:
        raise HTTPException(status_code=404, detail="Release not found")
    return None

@router.post("/{release_id}/features", response_model=FeatureResponse, status_code=status.HTTP_201_CREATED)
async def add_feature_with_analysis(
    release_id: int,
    ticket_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.api.dependencies import check_release_access
    if not check_release_access(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this release"
        )
    service = ReleaseService(db)
    try:
        feature = await service.analyze_and_add_feature(release_id, ticket_data)
        return feature
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not add the feature to this release")

@router.get("/{release_id}/features", response_model=List[FeatureResponse])
def get_release_features(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.api.dependencies import check_release_access
    if not check_release_access(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this release"
        )
    service = ReleaseService(db)
    return service.get_features_by_release(release_id)

@router.post("/{release_id}/regression-suite", response_model=RegressionSuiteResponse)
async def generate_regression_suite(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate regression suite (requires authentication)"""
    service = ReleaseService(db)
    try:
        suite = await service.generate_regression_suite(release_id)
        return suite
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate a regression suite for this release")

# Collaborator Management Endpoints

@router.post("/{release_id}/collaborators", response_model=ReleaseResponse)
def add_collaborator(
    release_id: int,
    request: AddCollaboratorRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a collaborator to release (requires owner permission)"""
    from app.api.dependencies import check_release_owner
    from app.models.models import Release
    
    if not check_release_owner(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the release owner can add collaborators"
        )
    
    # Get release
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    
    # Get user to add
    user_to_add = db.query(User).filter(User.id == request.user_id).first()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already a collaborator
    if user_to_add in release.collaborators:
        raise HTTPException(status_code=400, detail="User is already a collaborator")
    
    # Check if user is the owner
    if release.created_by == request.user_id:
        raise HTTPException(status_code=400, detail="Owner is automatically a collaborator")
    
    # Add collaborator
    release.collaborators.append(user_to_add)
    db.commit()
    db.refresh(release)
    
    return ReleaseResponse.model_validate(release)

@router.delete("/{release_id}/collaborators/{user_id}", response_model=ReleaseResponse)
def remove_collaborator(
    release_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a collaborator from release (requires owner permission)"""
    from app.api.dependencies import check_release_owner
    from app.models.models import Release
    
    if not check_release_owner(release_id, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the release owner can remove collaborators"
        )
    
    # Get release
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        raise HTTPException(status_code=404, detail="Release not found")
    
    # Get user to remove
    user_to_remove = db.query(User).filter(User.id == user_id).first()
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is a collaborator
    if user_to_remove not in release.collaborators:
        raise HTTPException(status_code=400, detail="User is not a collaborator")
    
    # Remove collaborator
    release.collaborators.remove(user_to_remove)
    db.commit()
    db.refresh(release)
    
    return ReleaseResponse.model_validate(release)

@router.get("/{release_id}/collaborators", response_model=List[UserSummary])
def get_collaborators(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all collaborators for a release"""
    service = ReleaseService(db)
    release = service.get_accessible_release(release_id, current_user.id)
    if not release:
        raise HTTPException(status_code=404, detail="Release not found or not accessible")

    return [UserSummary.model_validate(collab) for collab in release.collaborators]

@router.get("/{release_id}/permissions")
def get_user_permissions(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's permissions for this release"""
    from app.api.dependencies import check_release_owner, check_release_access
    
    is_owner = check_release_owner(release_id, current_user, db)
    can_edit = check_release_access(release_id, current_user, db)
    
    return {
        "is_owner": is_owner,
        "can_edit": can_edit,
        "can_delete": is_owner,
        "can_add_collaborators": is_owner
    }
