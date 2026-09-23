import hashlib
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt

# Chave secreta simples para assinar os tokens JWT
SECRET_KEY = "EXEMPLO DE CHAVE"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 semana

def get_password_hash(password: str) -> str:
    """Gera um hash simples em SHA-256 (sem dependência do bcrypt)."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a password corresponde ao hash."""
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um token JWT para a sessão do utilizador."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
