import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.db.models import User, Fine, Attendance, Notification, Role


BACKUP_DIR = Path(__file__).resolve().parent.parent.parent / "backups"


def _backup_user(session: Session, user: User) -> dict:
    """Cria ficheiro JSON com todos os dados do user antes de apagar."""
    fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
    attendance = session.exec(select(Attendance).where(Attendance.user_id == user.id)).all()
    notifications = session.exec(select(Notification).where(Notification.user_id == user.id)).all()

    data = {
        "backed_up_at": datetime.utcnow().isoformat(),
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "phone": user.phone,
            "role": user.role.value if isinstance(user.role, Role) else user.role,
            "position": user.position,
            "photo_url": user.photo_url,
        },
        "fines": [
            {
                "id": f.id,
                "fine_type_id": f.fine_type_id,
                "quantity": f.quantity,
                "calculated_amount": f.calculated_amount,
                "status": f.status.value if hasattr(f.status, "value") else f.status,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in fines
        ],
        "attendance": [
            {
                "id": a.id,
                "event_date": a.event_date.isoformat(),
                "status": a.status.value if hasattr(a.status, "value") else a.status,
                "minutes_late": a.minutes_late,
            }
            for a in attendance
        ],
        "notifications": [
            {"id": n.id, "title": n.title, "message": n.message}
            for n in notifications
        ],
    }

    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    path = BACKUP_DIR / f"user_{user.id}_{ts}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"path": str(path), "fines": len(fines), "attendance": len(attendance), "notifications": len(notifications)}


def count_user_data(session: Session, user: User) -> dict:
    fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
    attendance = session.exec(select(Attendance).where(Attendance.user_id == user.id)).all()
    notifications = session.exec(select(Notification).where(Notification.user_id == user.id)).all()
    return {
        "fines": len(fines),
        "attendance": len(attendance),
        "notifications": len(notifications),
    }


def delete_user(session: Session, target: User, actor: User, do_backup: bool = True) -> dict:
    """
    Apaga um user e os seus dados.
    - Multas onde ele é o dono (user_id) → apagadas
    - Presenças onde ele é o dono (user_id) → apagadas
    - Notificações dele → apagadas
    - Multas que ele aplicou a outros → MANTIDAS (applied_by_id fica órfão)
    - Presenças que ele marcou a outros → MANTIDAS (marked_by_id fica órfão)
    """
    if actor.role != Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só admins podem apagar users.")
    if actor.id == target.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não podes apagar a tua própria conta.")

    backup_info = None
    if do_backup:
        backup_info = _backup_user(session, target)

    fines = session.exec(select(Fine).where(Fine.user_id == target.id)).all()
    for f in fines:
        session.delete(f)

    attendance = session.exec(select(Attendance).where(Attendance.user_id == target.id)).all()
    for a in attendance:
        session.delete(a)

    notifications = session.exec(select(Notification).where(Notification.user_id == target.id)).all()
    for n in notifications:
        session.delete(n)

    session.delete(target)
    session.commit()

    return {
        "user_id": backup_info and target.id,
        "name": target.name,
        "deleted": {
            "fines": len(fines),
            "attendance": len(attendance),
            "notifications": len(notifications),
        },
        "backup": backup_info,
    }


def bulk_delete_users(
    session: Session, user_ids: list[int], actor: User, do_backup: bool = True
) -> dict:
    deleted = []
    errors = []
    for uid in user_ids:
        target = session.get(User, uid)
        if not target:
            errors.append(f"User {uid} não encontrado.")
            continue
        if target.id == actor.id:
            errors.append(f"Não podes apagar a tua própria conta (ID {uid}).")
            continue
        try:
            result = delete_user(session, target, actor, do_backup=do_backup)
            deleted.append({"id": uid, "name": target.name, **result["deleted"]})
        except HTTPException as e:
            errors.append(f"User {uid}: {e.detail}")
        except Exception as e:
            errors.append(f"User {uid}: {e}")
    return {"deleted": deleted, "errors": errors, "total": len(deleted)}