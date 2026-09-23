from datetime import date, datetime
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.db.models import (
    User, Attendance, AttendanceStatus, Role, FineType,
    NotificationType,
)
from app.services import fines as fines_service
from app.services import notifications as notif_service


TRAINING_WEEKDAYS = {1, 2, 4}


def _eur(x: float) -> str:
    return f"{x:.2f}".replace(".", ",") + "€"


def get_all_players(session: Session) -> list[User]:
    """
    Todos os que comparecem aos treinos:
    jogadores, sindicato e admin.
    Equipa técnica não entra (só treina/marca).
    """
    return session.exec(
        select(User)
        .where(User.role.in_([Role.JOGADOR, Role.SINDICATO, Role.ADMIN]))
        .order_by(User.name)
    ).all()


def _apply_attendance_side_effects(
    session: Session,
    user: User,
    event_date: date,
    new_status: AttendanceStatus,
    minutes_late: Optional[int],
    marked_by: User,
) -> Optional[str]:
    """Apaga multas auto anteriores desse dia + aplica as que se aplicam.

    Nunca deixa uma falha na multa impedir a presença de ficar guardada:
    se o tipo de multa não existir (ex.: falta correr o seed), devolve uma
    mensagem de erro em vez de rebentar o pedido todo.
    """
    fines_service.delete_auto_fines_for_day(session, user.id, event_date)

    try:
        if new_status == AttendanceStatus.INJUSTIFICADO:
            result = fines_service.apply_fine(
                session,
                target_user_id=user.id,
                fine_code=fines_service.AUTO_FINE_ABSENCE_CODE,
                quantity=1,
                applied_by=marked_by,
                auto_generated=True,
                related_date=event_date,
            )
            notif_service.create(
                session,
                user_id=user.id,
                title="Falta ao treino",
                message=(f"Faltaste ao treino de {event_date.isoformat()}. "
                         f"Multa: {_eur(result['amount'])}. "
                         f"Paga até {result['due_date']} — depois: +0,50€/dia de atraso."),
                type=NotificationType.ATTENDANCE,
            )

        elif new_status == AttendanceStatus.JUSTIFICADO:
            result = fines_service.apply_fine(
                session,
                target_user_id=user.id,
                fine_code=fines_service.AUTO_FINE_JUSTIFIED_ABSENCE_CODE,
                quantity=1,
                applied_by=marked_by,
                auto_generated=True,
                related_date=event_date,
            )
            notif_service.create(
                session,
                user_id=user.id,
                title="Falta justificada ao treino",
                message=(f"Falta justificada ao treino de {event_date.isoformat()}. "
                         f"Multa: {_eur(result['amount'])}. "
                         f"Paga até {result['due_date']} — depois: +0,50€/dia de atraso."),
                type=NotificationType.ATTENDANCE,
            )

        elif new_status == AttendanceStatus.PRESENTE and minutes_late and minutes_late > 0:
            result = fines_service.apply_fine(
                session,
                target_user_id=user.id,
                fine_code=fines_service.AUTO_FINE_LATE_CODE,
                quantity=minutes_late,
                applied_by=marked_by,
                auto_generated=True,
                related_date=event_date,
            )
            notif_service.create(
                session,
                user_id=user.id,
                title="Atraso no treino",
                message=(f"Chegaste {minutes_late} min atrasado ao treino de "
                         f"{event_date.isoformat()}. Multa: {_eur(result['amount'])}. "
                         f"Paga até {result['due_date']} — depois: +0,50€/dia de atraso."),
                type=NotificationType.ATTENDANCE,
            )
    except HTTPException as exc:
        # Não deixa a presença ficar por guardar por causa de um tipo de
        # multa em falta — reporta o erro para o chamador decidir o que fazer.
        return f"{user.name}: {exc.detail}"

    return None


def mark_bulk(
    session: Session,
    event_date: date,
    records: list[dict],
    marked_by: User,
) -> dict:
    if marked_by.role not in (Role.EQUIPA_TECNICA, Role.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem permissão para marcar presenças.")

    saved = updated = 0
    fine_errors: list[str] = []

    for r in records:
        user_id = r["user_id"]
        try:
            new_status = AttendanceStatus(r["status"])
        except (ValueError, KeyError):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Status inválido: {r.get('status')}.",
            )
        minutes_late = r.get("minutes_late")
        if minutes_late is not None:
            try:
                minutes_late = int(minutes_late)
            except (TypeError, ValueError):
                minutes_late = None

        target = session.get(User, user_id)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"User {user_id} não encontrado.")

        existing = session.exec(
            select(Attendance).where(
                Attendance.user_id == user_id,
                Attendance.event_date == event_date,
            )
        ).first()

        if existing:
            existing.status = new_status
            existing.minutes_late = minutes_late if new_status == AttendanceStatus.PRESENTE else None
            existing.marked_by_id = marked_by.id
            existing.updated_at = datetime.utcnow()
            session.add(existing)
            updated += 1
        else:
            session.add(Attendance(
                user_id=user_id,
                event_date=event_date,
                status=new_status,
                minutes_late=minutes_late if new_status == AttendanceStatus.PRESENTE else None,
                marked_by_id=marked_by.id,
            ))
            saved += 1

        session.commit()
        err = _apply_attendance_side_effects(
            session, target, event_date, new_status, minutes_late, marked_by
        )
        if err:
            fine_errors.append(err)

    return {
        "date": event_date.isoformat(),
        "created": saved,
        "updated": updated,
        "total": saved + updated,
        "fine_errors": fine_errors,
    }


def count_day(session: Session, event_date: date) -> dict:
    """Contagens do que existe nesse dia — usado antes de apagar."""
    from app.db.models import Fine

    attendance_count = len(session.exec(
        select(Attendance).where(Attendance.event_date == event_date)
    ).all())

    auto_fines = session.exec(
        select(Fine).where(
            Fine.auto_generated == True,  # noqa: E712
            Fine.related_date == event_date,
        )
    ).all()
    auto_total = sum(f.calculated_amount for f in auto_fines)

    return {
        "date": event_date.isoformat(),
        "attendance_count": attendance_count,
        "auto_fines_count": len(auto_fines),
        "auto_fines_total": round(auto_total, 2),
    }


def delete_day(session: Session, event_date: date, by_user: User) -> dict:
    """Apaga o treino inteiro: attendance + multas automáticas desse dia."""
    if by_user.role not in (Role.EQUIPA_TECNICA, Role.ADMIN):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem permissão para apagar um treino.")

    from app.db.models import Fine

    attendance_records = session.exec(
        select(Attendance).where(Attendance.event_date == event_date)
    ).all()
    attendance_deleted = len(attendance_records)
    for a in attendance_records:
        session.delete(a)

    auto_fines = session.exec(
        select(Fine).where(
            Fine.auto_generated == True,  # noqa: E712
            Fine.related_date == event_date,
        )
    ).all()
    fines_deleted = len(auto_fines)
    fines_total = sum(f.calculated_amount for f in auto_fines)
    for f in auto_fines:
        session.delete(f)

    session.commit()

    return {
        "date": event_date.isoformat(),
        "attendance_deleted": attendance_deleted,
        "auto_fines_deleted": fines_deleted,
        "auto_fines_total": round(fines_total, 2),
    }


def get_day(session: Session, event_date: date) -> dict:
    players = get_all_players(session)
    records = session.exec(
        select(Attendance).where(Attendance.event_date == event_date)
    ).all()
    by_user = {r.user_id: r for r in records}

    result = []
    for p in players:
        rec = by_user.get(p.id)
        result.append({
            "user_id": p.id,
            "name": p.name,
            "photo_url": p.photo_url,
            "status": rec.status.value if rec else None,
            "minutes_late": rec.minutes_late if rec else None,
            "marked_at": rec.created_at.isoformat() if rec else None,
        })

    present = sum(1 for r in result if r["status"] == "PRESENTE")
    justified = sum(1 for r in result if r["status"] == "JUSTIFICADO")
    unjustified = sum(1 for r in result if r["status"] == "INJUSTIFICADO")
    marked = present + justified + unjustified
    return {
        "date": event_date.isoformat(),
        "total_players": len(players),
        "marked": marked,
        "present": present,
        "justified": justified,
        "unjustified": unjustified,
        "pct": round((present / len(players)) * 100, 1) if players else 0.0,
        "records": result,
    }


def get_last_training(session: Session, before: Optional[date] = None) -> Optional[dict]:
    stmt = select(Attendance.event_date).order_by(Attendance.event_date.desc())
    if before:
        stmt = stmt.where(Attendance.event_date < before)
    dates = session.exec(stmt).all()
    if not dates:
        return None
    return get_day(session, dates[0])


def get_summary(session: Session, year: int) -> dict:
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    records = session.exec(
        select(Attendance).where(
            Attendance.event_date >= start,
            Attendance.event_date <= end,
        )
    ).all()
    denom = len(get_all_players(session)) or 1

    by_date: dict[date, dict] = {}
    for r in records:
        d = by_date.setdefault(r.event_date, {"present": 0, "justified": 0, "unjustified": 0})
        if r.status == AttendanceStatus.PRESENTE:
            d["present"] += 1
        elif r.status == AttendanceStatus.JUSTIFICADO:
            d["justified"] += 1
        elif r.status == AttendanceStatus.INJUSTIFICADO:
            d["unjustified"] += 1

    days = []
    for d, counts in sorted(by_date.items()):
        days.append({
            "date": d.isoformat(),
            "present": counts["present"],
            "justified": counts["justified"],
            "unjustified": counts["unjustified"],
            "total_marked": counts["present"] + counts["justified"] + counts["unjustified"],
            "pct": round((counts["present"] / denom) * 100, 1),
        })
    return {
        "year": year,
        "total_players": denom,
        "training_days": len(days),
        "days": days,
    }


def user_stats(session: Session, user_id: int, year: Optional[int] = None) -> dict:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    stmt = select(Attendance).where(Attendance.user_id == user_id)
    if year:
        stmt = stmt.where(
            Attendance.event_date >= date(year, 1, 1),
            Attendance.event_date <= date(year, 12, 31),
        )
    records = session.exec(stmt).all()
    present = sum(1 for r in records if r.status == AttendanceStatus.PRESENTE)
    justified = sum(1 for r in records if r.status == AttendanceStatus.JUSTIFICADO)
    unjustified = sum(1 for r in records if r.status == AttendanceStatus.INJUSTIFICADO)
    total = len(records)
    return {
        "user_id": user.id,
        "name": user.name,
        "total_marked": total,
        "present": present,
        "justified": justified,
        "unjustified": unjustified,
        "attendance_rate": round((present / total) * 100, 1) if total else 0.0,
    }


def leaderboard(session: Session, year: Optional[int] = None) -> dict:
    players = get_all_players(session)
    rows = []
    for p in players:
        stmt = select(Attendance).where(Attendance.user_id == p.id)
        if year:
            stmt = stmt.where(
                Attendance.event_date >= date(year, 1, 1),
                Attendance.event_date <= date(year, 12, 31),
            )
        recs = session.exec(stmt).all()
        total = len(recs)
        present = sum(1 for r in recs if r.status == AttendanceStatus.PRESENTE)
        justified = sum(1 for r in recs if r.status == AttendanceStatus.JUSTIFICADO)
        unjustified = sum(1 for r in recs if r.status == AttendanceStatus.INJUSTIFICADO)
        rows.append({
            "user_id": p.id,
            "name": p.name,
            "photo_url": p.photo_url,
            "total": total,
            "present": present,
            "justified": justified,
            "unjustified": unjustified,
            "total_faltas": justified + unjustified,
            "attendance_rate": round((present / total) * 100, 1) if total else 0.0,
            "total_faltas_pct": round((justified + unjustified) / total * 100, 1) if total else 0.0,
            "justified_pct": round(justified / total * 100, 1) if total else 0.0,
            "unjustified_pct": round(unjustified / total * 100, 1) if total else 0.0,
        })
    return {
        "top_attendance": sorted(rows, key=lambda r: r["attendance_rate"], reverse=True)[:10],
        "top_absent": sorted(rows, key=lambda r: r["total_faltas"], reverse=True)[:10],
        "top_unjustified": sorted(rows, key=lambda r: r["unjustified"], reverse=True)[:10],
        "top_justified": sorted(rows, key=lambda r: r["justified"], reverse=True)[:10],
    }


def get_players_who_usually_miss(
    session: Session, threshold_pct: float = 40.0, min_trainings: int = 5
) -> list[dict]:
    players = get_all_players(session)
    result = []
    for p in players:
        recs = session.exec(select(Attendance).where(Attendance.user_id == p.id)).all()
        total = len(recs)
        if total < min_trainings:
            continue
        missed = sum(1 for r in recs if r.status in (AttendanceStatus.JUSTIFICADO, AttendanceStatus.INJUSTIFICADO))
        miss_pct = (missed / total) * 100
        if miss_pct >= threshold_pct:
            result.append({
                "user_id": p.id,
                "name": p.name,
                "total": total,
                "missed": missed,
                "miss_pct": round(miss_pct, 1),
            })
    return sorted(result, key=lambda r: r["miss_pct"], reverse=True)