from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User, Role
from app.api.auth import oauth2_scheme
from app.core.security import SECRET_KEY, ALGORITHM


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    user = session.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


def require_roles(*allowed: Role):
    """Dependency factory: exige que o user tenha um dos roles indicados."""
    allowed_values = {r.value if isinstance(r, Role) else r for r in allowed}

    def checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.value if isinstance(current_user.role, Role) else current_user.role
        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sem permissão. Roles permitidos: {sorted(allowed_values)}.",
            )
        return current_user

    return checker