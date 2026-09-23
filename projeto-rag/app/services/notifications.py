from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.db.models import User, Notification, NotificationType, Role


REMINDER_DAYS_BEFORE = 3  # avisa quando faltam <= N dias para o prazo


def create(
    session: Session,
    user_id: int,
    title: str,
    message: str,
    type: NotificationType = NotificationType.INFO,
    link: Optional[str] = None,
) -> Notification:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"User {user_id} não encontrado.")
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    session.add(n)
    session.commit()
    session.refresh(n)
    return n


def _exists_unread(session: Session, user_id: int, title: str) -> bool:
    """Dedupe anti-spam: já existe notificação não lida com o mesmo título?"""
    stmt = select(Notification).where(
        Notification.user_id == user_id,
        Notification.title == title,
        Notification.read == False,  # noqa: E712
    )
    return session.exec(stmt).first() is not None


def _eur(x: float) -> str:
    return f"{x:.2f}".replace(".", ",") + "€"


# ---------- Notificações ligadas a multas (timers de pagamento) ----------

def notify_fine_applied(session: Session, serialized: dict) -> None:
    """Notifica o atleta quando lhe aplicam uma multa/joia — com prazo de pagamento.

    `serialized` é o dict devolvido por fines_service.apply_fine.
    Multas automáticas (faltas/atrasos de treino) têm a sua própria notificação
    em attendance.py, por isso aqui só notificamos as manuais.
    """
    if serialized.get("auto_generated"):
        return
    due = serialized.get("due_date")
    prazo = ""
    if due:
        try:
            dias = (date.fromisoformat(due) - date.today()).days
            prazo = (f" Paga até {due} ({dias} dia{'s' if dias != 1 else ''}). "
                     f"Depois do prazo: +0,50€/dia de atraso.")
        except ValueError:
            prazo = f" Paga até {due}."
    create(
        session,
        user_id=serialized["user_id"],
        title=f"💰 Multa #{serialized['id']}: {serialized['reason']}",
        message=(f"Aplicaram-te uma multa de {_eur(serialized['base_amount'])} "
                 f"({serialized['reason']}).{prazo}"),
        type=NotificationType.FINE,
        link="/fines",
    )


def notify_fine_paid(session: Session, serialized: dict) -> None:
    """Confirma ao atleta que a multa foi marcada como paga."""
    create(
        session,
        user_id=serialized["user_id"],
        title=f"✅ Pagamento recebido — multa #{serialized['id']}",
        message=(f"{serialized['reason']} — {_eur(serialized['base_amount'])} marcada como paga. "
                 "Obrigado!"),
        type=NotificationType.FINE,
        link="/fines",
    )


def generate_payment_reminders(session: Session) -> int:
    """Varre multas pendentes e cria lembretes de prazo/atraso para cada atleta.

    - Prazo dentro de REMINDER_DAYS_BEFORE dias (ou hoje) → aviso ⏰
    - Prazo passado → alerta 🚨 com juros acumulados (0,50€/dia)
    Dedupe: só cria se ainda não houver notificação não lida com o mesmo título.
    Chamado de forma "lazy" pelo frontend (POST /notifications/generate-reminders).
    """
    from app.db.models import Fine, FineStatus, FineType
    from app.services.fines import compute_current_amount

    today = date.today()
    soon_limit = today + timedelta(days=REMINDER_DAYS_BEFORE)
    pending = session.exec(select(Fine).where(Fine.status == FineStatus.PENDENTE)).all()
    created = 0

    for f in pending:
        if not f.due_date:
            continue
        user = session.get(User, f.user_id)
        if not user:
            continue
        ft = session.get(FineType, f.fine_type_id)
        reason = ft.description if ft else "Infração geral"

        if f.due_date < today:
            days_late = (today - f.due_date).days
            info = compute_current_amount(f)
            title = f"🚨 Multa #{f.id} em atraso ({days_late}d)"
            if _exists_unread(session, f.user_id, title):
                continue
            create(
                session,
                user_id=f.user_id,
                title=title,
                message=(f"{reason}: o prazo era {f.due_date.isoformat()} "
                         f"({days_late} dia{'s' if days_late != 1 else ''} de atraso). "
                         f"Juros: +{_eur(info['late_fee'])} → total {_eur(info['total'])}. "
                         "Paga ao sindicato para parar os juros!"),
                type=NotificationType.WARNING,
                link="/fines",
            )
            created += 1

        elif f.due_date <= soon_limit:
            dias = (f.due_date - today).days
            title = f"⏰ Prazo: multa #{f.id} ({f.due_date.isoformat()})"
            if _exists_unread(session, f.user_id, title):
                continue
            msg = (f"Faltam {dias} dia{'s' if dias != 1 else ''} para pagar "
                   f"{_eur(f.calculated_amount)} ({reason}). Prazo: "
                   f"{f.due_date.isoformat()}. Após isso: +0,50€/dia.")
            if dias == 0:
                msg = (f"ÚLTIMO DIA para pagar {_eur(f.calculated_amount)} "
                       f"({reason}). Prazo: {f.due_date.isoformat()}. "
                       "Amanhã começam os juros de 0,50€/dia!")
            create(
                session,
                user_id=f.user_id,
                title=title,
                message=msg,
                type=NotificationType.WARNING,
                link="/fines",
            )
            created += 1

    return created


def create_bulk(
    session: Session,
    user_ids: list[int],
    title: str,
    message: str,
    type: NotificationType = NotificationType.INFO,
    link: Optional[str] = None,
) -> int:
    count = 0
    for uid in user_ids:
        user = session.get(User, uid)
        if not user:
            continue
        session.add(Notification(
            user_id=uid,
            type=type,
            title=title,
            message=message,
            link=link,
        ))
        count += 1
    session.commit()
    return count


def list_for_user(session: Session, user_id: int, unread_only: bool = False) -> list[dict]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read == False)  # noqa: E712
    stmt = stmt.order_by(Notification.created_at.desc()).limit(100)
    notifications = session.exec(stmt).all()
    return [
        {
            "id": n.id,
            "type": n.type.value,
            "title": n.title,
            "message": n.message,
            "link": n.link,
            "read": n.read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


def unread_count(session: Session, user_id: int) -> int:
    stmt = select(Notification).where(
        Notification.user_id == user_id,
        Notification.read == False,  # noqa: E712
    )
    return len(session.exec(stmt).all())


def mark_read(session: Session, notification_id: int, user: User) -> dict:
    n = session.get(Notification, notification_id)
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificação não encontrada.")
    if n.user_id != user.id and user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Não podes marcar isto como lido.")
    n.read = True
    session.add(n)
    session.commit()
    return {"id": n.id, "read": n.read}


def mark_all_read(session: Session, user: User) -> int:
    stmt = select(Notification).where(
        Notification.user_id == user.id,
        Notification.read == False,  # noqa: E712
    )
    notifs = session.exec(stmt).all()
    for n in notifs:
        n.read = True
        session.add(n)
    session.commit()
    return len(notifs)