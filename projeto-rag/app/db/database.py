import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

TURSO_URL = os.getenv("TURSO_URL")
TURSO_TOKEN = os.getenv("TURSO_TOKEN")

if TURSO_URL and TURSO_TOKEN:
    # Produção: Turso
    url = TURSO_URL.replace("libsql://", "sqlite+libsql://")
    engine = create_engine(
        f"{url}?authToken={TURSO_TOKEN}",
        connect_args={"check_same_thread": False},
    )
    print(f"[DB] Turso: {TURSO_URL}")
else:
    # Local: SQLite em ficheiro
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