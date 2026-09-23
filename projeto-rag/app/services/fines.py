from datetime import datetime, date
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.db.models import User, Fine, FineType, Role, FineStatus
from app.services import notifications as notif_service


LATE_FEE_PER_DAY = 0.5
AUTO_FINE_ABSENCE_CODE = 1
AUTO_FINE_LATE_CODE = 2
AUTO_FINE_JUSTIFIED_ABSENCE_CODE = 33
JOIA_CODES = (31, 32)


def _get_fine_or_404(session: Session, fine_id: int) -> Fine:
    fine = session.get(Fine, fine_id)
    if not fine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Multa {fine_id} não encontrada.")
    return fine


def _get_fine_type_by_code(session: Session, code: int) -> FineType:
    ft = session.exec(select(FineType).where(FineType.code_number == code)).first()
    if not ft:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Código de multa {code} inválido.")
    return ft


def _next_month_first_day(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def compute_current_amount(fine: Fine, today: Optional[date] = None) -> dict:
    if today is None:
        today = date.today()
    base = fine.calculated_amount
    if fine.status == FineStatus.PAGO or not fine.due_date or today <= fine.due_date:
        return {"base": base, "late_fee": 0.0, "total": base, "days_late": 0}
    days_late = (today - fine.due_date).days
    late_fee = days_late * LATE_FEE_PER_DAY
    return {
        "base": base,
        "late_fee": round(late_fee, 2),
        "total": round(base + late_fee, 2),
        "days_late": days_late,
    }


def _serialize(fine: Fine, user: User, fine_type: FineType) -> dict:
    amount_info = compute_current_amount(fine)
    return {
        "id": fine.id,
        "user_id": fine.user_id,
        "player_name": user.name if user else "Desconhecido",
        "fine_type_id": fine.fine_type_id,
        "reason": fine_type.description if fine_type else "Infração geral",
        "category": fine_type.category if fine_type else "GERAL",
        "quantity": fine.quantity,
        "amount": amount_info["total"],
        "base_amount": amount_info["base"],
        "late_fee": amount_info["late_fee"],
        "days_late": amount_info["days_late"],
        "status": fine.status.value if isinstance(fine.status, FineStatus) else fine.status,
        "auto_generated": fine.auto_generated,
        "related_date": fine.related_date.isoformat() if fine.related_date else None,
        "created_at": fine.created_at.isoformat() if fine.created_at else None,
        "due_date": fine.due_date.isoformat() if fine.due_date else None,
        "updated_at": fine.updated_at.isoformat() if fine.updated_at else None,
        "paid_at": fine.paid_at.isoformat() if fine.paid_at else None,
    }


def list_fines(session: Session, current_user: User) -> list[dict]:
    stmt = select(Fine)
    if current_user.role == Role.JOGADOR:
        stmt = stmt.where(Fine.user_id == current_user.id)
    fines = session.exec(stmt).all()
    result = []
    for f in fines:
        u = session.get(User, f.user_id)
        ft = session.get(FineType, f.fine_type_id)
        result.append(_serialize(f, u, ft))
    return result


def list_fines_of_user(session: Session, target_user_id: int, current_user: User) -> list[dict]:
    if current_user.role == Role.JOGADOR and current_user.id != target_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só podes ver as tuas multas.")
    target = session.get(User, target_user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    fines = session.exec(select(Fine).where(Fine.user_id == target_user_id)).all()
    result = []
    for f in fines:
        ft = session.get(FineType, f.fine_type_id)
        result.append(_serialize(f, target, ft))
    return result


def list_fine_types(session: Session) -> list[dict]:
    types = session.exec(select(FineType).order_by(FineType.code_number)).all()
    return [
        {
            "id": t.id,
            "code_number": t.code_number,
            "category": t.category,
            "description": t.description,
            "calculation_type": t.calculation_type.value,
            "base_value": t.base_value,
        }
        for t in types
    ]


def apply_fine(
    session: Session,
    target_user_id: int,
    fine_code: int,
    quantity: int,
    applied_by: User,
    auto_generated: bool = False,
    related_date: Optional[date] = None,
) -> dict:
    target = session.get(User, target_user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atleta não encontrado.")
    if quantity is None or quantity < 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Quantidade inválida: tem de ser um inteiro >= 1.",
        )
    ft = _get_fine_type_by_code(session, fine_code)
    amount = ft.base_value * quantity
    today = date.today()
    due = _next_month_first_day(today)
    fine = Fine(
        user_id=target_user_id,
        fine_type_id=ft.id,
        applied_by_id=applied_by.id,
        quantity=quantity,
        calculated_amount=amount,
        status=FineStatus.PENDENTE,
        due_date=due,
        auto_generated=auto_generated,
        related_date=related_date,
    )
    session.add(fine)
    session.commit()
    session.refresh(fine)
    result = _serialize(fine, target, ft)
    # Notifica o atleta (multas manuais; as automáticas têm notificação própria
    # em attendance.py) — inclui o prazo de pagamento e a regra dos juros.
    notif_service.notify_fine_applied(session, result)
    return result


def delete_auto_fines_for_day(session: Session, user_id: int, event_date: date) -> int:
    """Apaga multas automáticas de um user relacionadas com um dia (por related_date)."""
    stmt = select(Fine).where(
        Fine.user_id == user_id,
        Fine.auto_generated == True,  # noqa: E712
        Fine.related_date == event_date,
    )
    fines = session.exec(stmt).all()
    count = len(fines)
    for f in fines:
        session.delete(f)
    if count:
        session.commit()
    return count


def delete_all_auto_fines_for_day(session: Session, event_date: date) -> int:
    """Apaga TODAS as multas automáticas relacionadas com um dia (qualquer user)."""
    stmt = select(Fine).where(
        Fine.auto_generated == True,  # noqa: E712
        Fine.related_date == event_date,
    )
    fines = session.exec(stmt).all()
    count = len(fines)
    for f in fines:
        session.delete(f)
    if count:
        session.commit()
    return count


def update_status(session: Session, fine_id: int, new_status: str) -> dict:
    fine = _get_fine_or_404(session, fine_id)
    try:
        status_enum = FineStatus(new_status)
    except ValueError:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Estado inválido. Usa: {[s.value for s in FineStatus]}.",
        )
    fine.status = status_enum
    fine.updated_at = datetime.utcnow()
    fine.paid_at = datetime.utcnow() if status_enum == FineStatus.PAGO else None
    session.add(fine)
    session.commit()
    session.refresh(fine)
    u = session.get(User, fine.user_id)
    ft = session.get(FineType, fine.fine_type_id)
    result = _serialize(fine, u, ft)
    # Avisa o atleta quando o pagamento dele é confirmado.
    if status_enum == FineStatus.PAGO:
        notif_service.notify_fine_paid(session, result)
    return result


def update_type(session: Session, fine_id: int, new_fine_code: int, quantity: Optional[int]) -> dict:
    fine = _get_fine_or_404(session, fine_id)
    if quantity is not None and quantity < 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Quantidade inválida: tem de ser um inteiro >= 1.",
        )
    ft = _get_fine_type_by_code(session, new_fine_code)
    fine.fine_type_id = ft.id
    if quantity is not None:
        fine.quantity = quantity
    fine.calculated_amount = ft.base_value * fine.quantity
    fine.updated_at = datetime.utcnow()
    session.add(fine)
    session.commit()
    session.refresh(fine)
    u = session.get(User, fine.user_id)
    return _serialize(fine, u, ft)


def delete_fine(session: Session, fine_id: int) -> None:
    fine = _get_fine_or_404(session, fine_id)
    session.delete(fine)
    session.commit()


def bulk_delete(session: Session, ids: list[int]) -> int:
    if not ids:
        return 0
    fines = session.exec(select(Fine).where(Fine.id.in_(ids))).all()
    count = len(fines)
    for f in fines:
        session.delete(f)
    session.commit()
    return count


def stats_for_user(session: Session, user_id: int) -> dict:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    fines = session.exec(select(Fine).where(Fine.user_id == user_id)).all()
    total = paid = 0.0
    for f in fines:
        info = compute_current_amount(f)
        total += info["total"]
        if f.status == FineStatus.PAGO:
            paid += info["total"]
    return {
        "user_id": user.id,
        "name": user.name,
        "count": len(fines),
        "total": round(total, 2),
        "paid": round(paid, 2),
        "pending": round(total - paid, 2),
    }


def leaderboard(session: Session) -> dict:
    fines = session.exec(select(Fine)).all()
    per_user: dict[int, dict] = {}
    for f in fines:
        info = compute_current_amount(f)
        d = per_user.setdefault(f.user_id, {"total": 0.0, "paid": 0.0, "pending": 0.0, "count": 0})
        d["total"] += info["total"]
        d["count"] += 1
        if f.status == FineStatus.PAGO:
            d["paid"] += info["total"]
        else:
            d["pending"] += info["total"]
    users = {u.id: u.name for u in session.exec(select(User)).all()}
    rows = [
        {
            "user_id": uid,
            "name": users.get(uid, "?"),
            "total": round(d["total"], 2),
            "paid": round(d["paid"], 2),
            "pending": round(d["pending"], 2),
            "count": d["count"],
        }
        for uid, d in per_user.items()
    ]
    return {
        "top_debtors": sorted(rows, key=lambda r: r["pending"], reverse=True)[:10],
        "top_offenders": sorted(rows, key=lambda r: r["count"], reverse=True)[:10],
        "total_collected": round(sum(r["paid"] for r in rows), 2),
        "total_pending": round(sum(r["pending"] for r in rows), 2),
        "total_fines": len(fines),
    }


def pe_de_meia(session: Session) -> dict:
    paid = session.exec(
        select(Fine).where(Fine.status == FineStatus.PAGO).order_by(Fine.paid_at.desc())
    ).all()
    total = 0.0
    for f in paid:
        total += compute_current_amount(f)["total"]
    users = {u.id: u.name for u in session.exec(select(User)).all()}
    recent = [
        {
            "id": f.id,
            "player_name": users.get(f.user_id, "?"),
            "amount": compute_current_amount(f)["total"],
            "paid_at": f.paid_at.isoformat() if f.paid_at else None,
        }
        for f in paid[:10]
    ]
    return {
        "total": round(total, 2),
        "count": len(paid),
        "recent": recent,
    }

def rankings(session: Session, top: int = 3) -> dict:
    """Três rankings para a página /fines (top 3 de cada, por defeito).

    - top_debtors: por valor pendente (o que falta receber)
    - top_offenders: por número de multas (pagas ou não)
    - top_accumulated: por valor total acumulado (pagas ou não)
    """
    fines = session.exec(select(Fine)).all()
    per_user: dict[int, dict] = {}
    for f in fines:
        info = compute_current_amount(f)
        d = per_user.setdefault(f.user_id, {"pending": 0.0, "count": 0, "total": 0.0})
        d["count"] += 1
        d["total"] += info["total"]
        if f.status == FineStatus.PENDENTE:
            d["pending"] += info["total"]
    users = {u.id: u for u in session.exec(select(User)).all()}
    rows = [
        {
            "user_id": uid,
            "name": users[uid].name if uid in users else "?",
            "photo_url": users[uid].photo_url if uid in users else None,
            "pending": round(d["pending"], 2),
            "count": d["count"],
            "total": round(d["total"], 2),
        }
        for uid, d in per_user.items()
        if uid in users
    ]
    return {
        "top_debtors": sorted(rows, key=lambda r: r["pending"], reverse=True)[:top],
        "top_offenders": sorted(rows, key=lambda r: r["count"], reverse=True)[:top],
        "top_accumulated": sorted(rows, key=lambda r: r["total"], reverse=True)[:top],
        "generated_at": datetime.utcnow().isoformat(),
    }
