import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_session
from app.db.models import User, Role
from app.core.security import verify_password, get_password_hash, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,20}$")
PHONE_RE = re.compile(r"^9\d{8}$")


class UserRegister(BaseModel):
    name: str
    username: str
    password: str
    phone: Optional[str] = None


def _user_to_dict(user: User) -> dict:
    role_value = user.role.value if isinstance(user.role, Role) else user.role
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "phone": user.phone,
        "role": role_value,
        "position": user.position,
        "photo_url": user.photo_url,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegister, session: Session = Depends(get_session)):
    name = user_data.name.strip()
    username = user_data.username.strip().lower()
    password = user_data.password
    phone = (user_data.phone or "").strip() or None

    # Validações
    if len(name) < 5 or " " not in name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Indica nome e apelido.")
    if not USERNAME_RE.match(username):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Username inválido (3-20 caracteres: letras, números, . _ -).",
        )
    if phone and not PHONE_RE.match(phone):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Telefone inválido (9 dígitos, começa por 9).",
        )
    if len(password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password tem de ter 6+ caracteres.")

    # Unicidade — username já em lowercase, phone opcional
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username já existe.")
    if phone and session.exec(select(User).where(User.phone == phone)).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Telefone já registado.")

    new_user = User(
        username=username,
        name=name,
        phone=phone,
        password_hash=get_password_hash(password),
        role=Role.JOGADOR,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    access_token = create_access_token(
        data={"sub": str(new_user.id), "role": new_user.role.value}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _user_to_dict(new_user),
    }


class UpdateMeRequest(BaseModel):
    """O próprio user só pode alterar username, telemóvel e palavra-passe.

    Nome/apelido NÃO é alterável — nem é aceito neste endpoint.
    """
    username: Optional[str] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


def get_current_user_local(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Versão local de get_current_user.

    O import é tardio de propósito: `app.core.deps` importa `oauth2_scheme`
    deste módulo, por isso um import no topo criaria um ciclo.
    """
    from app.core.deps import get_current_user

    return get_current_user(token=token, session=session)


@router.patch("/me")
def update_me(
    payload: UpdateMeRequest,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user_local),
):
    """Cada user altera os próprios dados: username, telemóvel e password."""
    user = session.get(User, current.id)
    mudou = []

    # --- username -----------------------------------------------------------
    if payload.username is not None:
        new_username = payload.username.strip().lower()
        if new_username != user.username:
            if not USERNAME_RE.match(new_username):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Username inválido (3-20 caracteres: letras, números, . _ -).",
                )
            if session.exec(select(User).where(User.username == new_username)).first():
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Username já existe."
                )
            user.username = new_username
            mudou.append("username")

    # --- telemóvel ----------------------------------------------------------
    if payload.phone is not None:
        phone = payload.phone.strip() or None  # "" -> remover o telemóvel
        if phone:
            if not PHONE_RE.match(phone):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Telefone inválido (9 dígitos, começa por 9).",
                )
            existente = session.exec(select(User).where(User.phone == phone)).first()
            if existente and existente.id != user.id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Telefone já registado."
                )
        if phone != user.phone:
            user.phone = phone
            mudou.append("telefone")

    # --- palavra-passe --------------------------------------------------------
    if payload.new_password:
        if not payload.current_password or not verify_password(
            payload.current_password, user.password_hash
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Palavra-passe atual incorreta."
            )
        if len(payload.new_password) < 6:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "A nova palavra-passe tem de ter 6+ caracteres.",
            )
        if verify_password(payload.new_password, user.password_hash):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "A nova palavra-passe é igual à atual.",
            )
        user.password_hash = get_password_hash(payload.new_password)
        mudou.append("password")

    if mudou:
        session.add(user)
        session.commit()
        session.refresh(user)

    return {"user": _user_to_dict(user), "updated": mudou}


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    identifier = form_data.username.strip().lower()
    user = session.exec(
        select(User).where(
            (User.username == identifier) | (User.phone == identifier)
        )
    ).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais incorretas.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    role_value = user.role.value if isinstance(user.role, Role) else user.role
    access_token = create_access_token(data={"sub": str(user.id), "role": role_value})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _user_to_dict(user),
    }