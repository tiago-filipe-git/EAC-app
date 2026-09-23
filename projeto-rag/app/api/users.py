from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import User, Role
from app.core.deps import require_roles
from app.services import users as users_service


router = APIRouter(prefix="/users", tags=["users"])


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class RoleUpdateRequest(BaseModel):
    role: str  # "jogador" | "sindicato" | "equipa_tecnica"


ASSIGNABLE_ROLES = {Role.JOGADOR, Role.SINDICATO, Role.EQUIPA_TECNICA}


@router.get("")
def list_users(
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    users = session.exec(select(User).order_by(User.name)).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "phone": u.phone,
            "role": u.role.value if isinstance(u.role, Role) else u.role,
            "position": u.position,
            "photo_url": u.photo_url,
        }
        for u in users
    ]


@router.get("/{user_id}/data-count")
def user_data_count(
    user_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.ADMIN)),
):
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    return users_service.count_user_data(session, target)


@router.patch("/{user_id}/role")
def update_role(
    user_id: int,
    payload: RoleUpdateRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.ADMIN)),
):
    """Admin altera o role de outro user. Nunca do próprio, nunca para admin, nunca de admin."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    if target.id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não podes alterar o teu próprio role.")
    if target.role == Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "O role de um admin não pode ser alterado.")

    try:
        new_role = Role(payload.role)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Role inválido.")
    if new_role not in ASSIGNABLE_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só podes atribuir jogador, sindicato ou equipa_tecnica.")

    target.role = new_role
    session.add(target)
    session.commit()
    session.refresh(target)
    return {
        "id": target.id,
        "name": target.name,
        "role": target.role.value if isinstance(target.role, Role) else target.role,
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.ADMIN)),
):
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilizador não encontrado.")
    if target.id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não podes apagar a tua própria conta.")
    if target.role == Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Não podes apagar um admin.")
    return users_service.delete_user(session, target, current)


@router.post("/bulk-delete")
def bulk_delete(
    payload: BulkDeleteRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.ADMIN)),
):
    # Filtra admins e o próprio user
    safe_ids = []
    skipped = []
    for uid in payload.ids:
        t = session.get(User, uid)
        if not t:
            skipped.append({"id": uid, "reason": "não encontrado"})
            continue
        if t.id == current.id:
            skipped.append({"id": uid, "reason": "é a tua conta"})
            continue
        if t.role == Role.ADMIN:
            skipped.append({"id": uid, "reason": "é admin"})
            continue
        safe_ids.append(uid)

    result = users_service.bulk_delete_users(session, safe_ids, current)
    result["skipped"] = skipped
    return result