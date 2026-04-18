"""
Authentication and authorization dependencies
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, Release

security = HTTPBearer(auto_error=False)  # Don't auto-error, handle manually

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token"""
    try:
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = credentials.credentials
        payload = decode_access_token(token)

        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from JWT token, or None if not authenticated"""
    try:
        if credentials is None:
            return None
        return get_current_user(credentials=credentials, db=db)
    except Exception:
        return None

def check_release_owner(release_id: int, current_user: User, db: Session) -> bool:
    """Check if current user is the owner of the release"""
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        return False
    return release.created_by == current_user.id

def check_release_collaborator(release_id: int, current_user: User, db: Session) -> bool:
    """Check if current user is a collaborator on the release"""
    release = db.query(Release).filter(Release.id == release_id).first()
    if not release:
        return False
    
    # Check if user is in collaborators list
    collaborator_ids = [collab.id for collab in release.collaborators]
    return current_user.id in collaborator_ids

def check_release_access(release_id: int, current_user: User, db: Session) -> bool:
    """Check if current user can edit the release (owner or collaborator)"""
    return (
        check_release_owner(release_id, current_user, db) or
        check_release_collaborator(release_id, current_user, db)
    )

def require_release_owner(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Release:
    """Dependency that requires user to be the release owner"""
    release = db.query(Release).filter(Release.id == release_id).first()
    
    if not release:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Release not found"
        )
    
    if release.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the release owner can perform this action"
        )
    
    return release

def require_release_access(
    release_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Release:
    """Dependency that requires user to have edit access (owner or collaborator)"""
    release = db.query(Release).filter(Release.id == release_id).first()
    
    if not release:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Release not found"
        )
    
    is_owner = release.created_by == current_user.id
    collaborator_ids = [collab.id for collab in release.collaborators]
    is_collaborator = current_user.id in collaborator_ids
    
    if not (is_owner or is_collaborator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this release"
        )
    
    return release
