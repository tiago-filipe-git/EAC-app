import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

TURSO_URL = os.getenv("TURSO_URL")
TURSO_TOKEN = os.getenv("TURSO_TOKEN")

if TURSO_URL and TURSO_TOKEN:
    # Produção: Turso
    host = TURSO_URL.replace("libsql://", "").rstrip("/")
    db_url = f"sqlite+libsql://{host}/?authToken={TURSO_TOKEN}&secure=true"
    engine = create_engine(
        db_url,
        connect_args={
            "check_same_thread": False,
            "auth_token": TURSO_TOKEN,
        },
    )
    print(f"[DB] Turso: {host}")
    print(f"[DB] Token presente: {bool(TURSO_TOKEN)} (len={len(TURSO_TOKEN) if TURSO_TOKEN else 0})")
else:
    # Local: SQLite
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