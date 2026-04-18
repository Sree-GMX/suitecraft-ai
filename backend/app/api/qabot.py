from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.models import User
from app.models.schemas import (
    QABotMessageCreate,
    QABotMessageResponse,
    QABotSessionCreate,
    QABotSessionResponse,
    QABotTurnResponse,
)
from app.services.qabot_service import QABotService

router = APIRouter(prefix="/qabot", tags=["qabot"])


@router.get("/sessions", response_model=List[QABotSessionResponse])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = QABotService(db, current_user)
    return service.list_sessions()


@router.post("/sessions", response_model=QABotSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: QABotSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = QABotService(db, current_user)
    return service.create_session(payload.title)


@router.get("/sessions/{session_id}/messages", response_model=List[QABotMessageResponse])
def get_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = QABotService(db, current_user)
    try:
        return service.get_messages(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/sessions/{session_id}/messages", response_model=QABotTurnResponse)
async def send_message(
    session_id: int,
    payload: QABotMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = QABotService(db, current_user)
    try:
        user_message, bot_message = await service.handle_message(session_id, payload)
        return QABotTurnResponse(user_message=user_message, bot_message=bot_message)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
