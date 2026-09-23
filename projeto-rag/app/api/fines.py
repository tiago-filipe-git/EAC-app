from typing import Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User, Role
from app.core.deps import get_current_user, require_roles
from app.services import fines as fines_service


router = APIRouter(prefix="/fines", tags=["fines"])


class ApplyFineRequest(BaseModel):
    user_id: int
    fine_code: int
    quantity: int = Field(default=1, ge=1)


class StatusUpdateRequest(BaseModel):
    status: str


class TypeUpdateRequest(BaseModel):
    fine_code: int
    quantity: Optional[int] = Field(default=None, ge=1)


class BulkDeleteRequest(BaseModel):
    ids: list[int]


@router.get("")
def list_fines(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return fines_service.list_fines(session, current)


@router.get("/mine")
def list_my_fines(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Devolve apenas as multas do próprio utilizador (para o sindicato ver as suas)."""
    return fines_service.list_fines_of_user(session, current.id, current)


@router.get("/types")
def list_fine_types(
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    """Lista tipos de multa. Qualquer user autenticado pode ver (a IA precisa)."""
    return fines_service.list_fine_types(session)


@router.get("/user/{user_id}")
def list_fines_of_user(
    user_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    return fines_service.list_fines_of_user(session, user_id, current)


@router.post("/apply", status_code=status.HTTP_201_CREATED)
def apply_fine(
    payload: ApplyFineRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    return fines_service.apply_fine(
        session=session,
        target_user_id=payload.user_id,
        fine_code=payload.fine_code,
        quantity=payload.quantity,
        applied_by=current,
    )


@router.patch("/{fine_id}/status")
def update_status(
    fine_id: int,
    payload: StatusUpdateRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    return fines_service.update_status(session, fine_id, payload.status)


@router.patch("/{fine_id}")
def update_type(
    fine_id: int,
    payload: TypeUpdateRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    return fines_service.update_type(
        session=session,
        fine_id=fine_id,
        new_fine_code=payload.fine_code,
        quantity=payload.quantity,
    )


@router.delete("/{fine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fine(
    fine_id: int,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    fines_service.delete_fine(session, fine_id)
    return None


@router.post("/bulk-delete")
def bulk_delete(
    payload: BulkDeleteRequest,
    session: Session = Depends(get_session),
    current: User = Depends(require_roles(Role.SINDICATO, Role.ADMIN)),
):
    count = fines_service.bulk_delete(session, payload.ids)
    return {"deleted": count}