import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

TURSO_URL = os.getenv("TURSO_URL")
TURSO_TOKEN = os.getenv("TURSO_TOKEN")

if TURSO_URL and TURSO_TOKEN:
    # Limpar espaços
    token = TURSO_TOKEN.strip()
    host = TURSO_URL.strip().replace("libsql://", "").rstrip("/")

    # URL no formato OFICIAL da Turso
    # Exemplo: sqlite+libsql://your-db.turso.io?authToken=JWT_HERE&secure=true
    db_url = f"sqlite+libsql://{host}/?authToken={token}&secure=true"

    print(f"[DB] Turso host: {host}")
    print(f"[DB] Token len: {len(token)}")

    engine = create_engine(
        db_url,
        connect_args={
            "check_same_thread": False,
        },
    )
else:
    # Local
    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    sqlite_file = BASE_DIR / "database.db"
    engine = create_engine(
        f"sqlite:///{sqlite_file}",
        connect_args={"check_same_thread": False},
    )
    print(f"[DB] Local: {sqlite_file}")


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session