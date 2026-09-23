from sqlmodel import Session, select
from app.db.database import engine
from app.db.models import User

with Session(engine) as session:
    users = session.exec(select(User)).all()
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"  id={u.id} username={u.username!r} phone={u.phone!r} role={u.role!r}")
        print(f"     hash={u.password_hash[:16]}...")