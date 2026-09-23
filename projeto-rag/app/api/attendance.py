from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User, Role
from app.core.deps import get_current_user, require_roles
from app.services import attendance as attendance_service
from app.services import fines as fines_service


router = APIRouter(prefix="/attendance", tags=["attendance"])


class MarkRecord(BaseModel):
    user_id: int
    status: str
    minutes_late: Optional[int] = None


class MarkRequest(BaseModel):
    date: date
    records: list[MarkRecord]


@router.post("/mark")
def mark(
    payload: MarkRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.EQUIPA_TECNICA, Role.ADMIN)),
):
    records = [
        {"user_id": r.user_id, "status": r.status, "minutes_late": r.minutes_late}
        for r in payload.records
    ]
    return attendance_service.mark_bulk(session, payload.date, records, current)


@router.get("/day")
def get_day(
    date_str: str,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida (YYYY-MM-DD).")
    return attendance_service.get_day(session, d)


@router.get("/day/count")
def count_day(
    date_str: str,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.EQUIPA_TECNICA, Role.ADMIN)),
):
    """Contagens do que será apagado — para confirmação antes de apagar."""
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida (YYYY-MM-DD).")
    return attendance_service.count_day(session, d)


@router.delete("/day")
def delete_day(
    date_str: str,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.EQUIPA_TECNICA, Role.ADMIN)),
):
    """Apaga o treino inteiro: presenças + multas automáticas desse dia."""
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Data inválida (YYYY-MM-DD).")
    return attendance_service.delete_day(session, d, current)


@router.get("/summary")
def summary(
    year: int,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return attendance_service.get_summary(session, year)


@router.get("/user/{user_id}/stats")
def user_stats(
    user_id: int,
    year: Optional[int] = None,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    if current.role == Role.JOGADOR and current.id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só podes ver as tuas estatísticas.")
    return attendance_service.user_stats(session, user_id, year)


@router.get("/leaderboard")
def leaderboard(
    year: Optional[int] = None,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return attendance_service.leaderboard(session, year)


@router.get("/pe-de-meia")
def pe_de_meia(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return fines_service.pe_de_meia(session)