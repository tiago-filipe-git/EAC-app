from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User
from app.core.deps import get_current_user
from app.services import notifications as notif_service


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_my(
    unread_only: bool = False,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return notif_service.list_for_user(session, current.id, unread_only)


@router.get("/unread-count")
def unread_count(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return {"count": notif_service.unread_count(session, current.id)}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return notif_service.mark_read(session, notification_id, current)


@router.post("/read-all")
def mark_all_read(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    count = notif_service.mark_all_read(session, current)
    return {"marked": count}


@router.post("/generate-reminders")
def generate_reminders(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Gera lembretes de prazo de pagamento para o próprio user.

    Chamado pelo frontend ao abrir a app (lazy scheduler). Cria notificações
    ⏰ (prazo <= 3 dias) e 🚨 (em atraso, com juros 0,50€/dia) — com dedupe
    para não repetir enquanto não forem lidas.
    """
    created = notif_service.generate_payment_reminders(session)
    return {"created": created}