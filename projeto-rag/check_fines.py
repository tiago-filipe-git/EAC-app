from sqlmodel import Session, select
from app.db.database import engine
from app.db.models import FineType

with Session(engine) as session:
    types = session.exec(select(FineType)).all()
    if not types:
        print("A tabela FineType está vazia!")
    for ft in types:
        print(f"{ft.code_number} | {ft.description} | {ft.base_value}€")