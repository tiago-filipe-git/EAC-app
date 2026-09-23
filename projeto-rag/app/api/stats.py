from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User, Role
from app.core.deps import get_current_user
from app.services import fines as fines_service


router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/me")
def my_stats(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Estatísticas do próprio utilizador (qualquer role)."""
    return fines_service.stats_for_user(session, current.id)


@router.get("/users/{user_id}")
def user_stats(
    user_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Estatísticas de um user. Jogador só pode ver as suas."""
    if current.role == Role.JOGADOR and current.id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só podes ver as tuas estatísticas.")
    return fines_service.stats_for_user(session, user_id)


@router.get("/leaderboard")
def leaderboard(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Rankings globais. Restrito a sindicato / equipa_tecnica / admin."""
    if current.role == Role.JOGADOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem permissão para ver o ranking global.")
    return fines_service.leaderboard(session)


@router.get("/rankings")
def rankings(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Três tops para a página de multas (devedores, nº de multas, valor acumulado).

    Jogadores veem também — os valores aparecem anonimizados não; são dados da
    equipa, mantidos públicos dentro do clube.
    """
    return fines_service.rankings(session, top=3)