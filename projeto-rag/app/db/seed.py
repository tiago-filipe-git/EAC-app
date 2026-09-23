from sqlmodel import Session, select

from app.db.database import engine, create_db_and_tables
from app.db.models import User, Role, FineType, Fine, FineCalculationType, FineStatus
from app.core.security import get_password_hash


USERS = [
    # ⬇️ EDITA O USERNAME ABAIXO ANTES DE CORRER
    {"username": "tiagofilipe", "name": "Tiago Filipe",  "phone": "932580653", "password": "Filipe123", "role": Role.ADMIN},
    {"username": "sindicato",   "name": "João Pinheiro", "phone": "910000001", "password": "sind123",   "role": Role.SINDICATO},
    {"username": "tecnica",     "name": "Rui Barrenho",  "phone": "910000002", "password": "tec123",    "role": Role.EQUIPA_TECNICA},
    {"username": "jogador",     "name": "Zé Atleta",     "phone": "910000003", "password": "jog123",    "role": Role.JOGADOR},
]

F = FineCalculationType.FIXED
PM = FineCalculationType.PER_MINUTE
PI = FineCalculationType.PER_ITEM
PR = FineCalculationType.PROGRESSIVE

FINE_TYPES = [
    {"code_number": 1, "category": "TREINO", "description": "Falta a treino - Sem justificação ou aviso", "calculation_type": F, "base_value": 5.0},
    {"code_number": 2, "category": "TREINO", "description": "Atraso a treino (por minuto)", "calculation_type": PM, "base_value": 0.5},
    {"code_number": 3, "category": "TREINO", "description": "Falta a treino com justificação tardia (após as 13h) - Exceto motivos maiores", "calculation_type": F, "base_value": 1.5},
    {"code_number": 4, "category": "TREINO", "description": "Falta do equipamento de treino", "calculation_type": PI, "base_value": 1.0},
    {"code_number": 5, "category": "TREINO", "description": "Esquecimento de material no final do treino", "calculation_type": PI, "base_value": 0.5},
    {"code_number": 6, "category": "TREINO", "description": "Treinar de fios, brincos, jóias", "calculation_type": F, "base_value": 1.0},
    {"code_number": 7, "category": "TREINO", "description": "Brigas no treino", "calculation_type": F, "base_value": 5.0},
    {"code_number": 8, "category": "TREINO", "description": "Faltas de atenção durante o treino", "calculation_type": F, "base_value": 0.5},
    {"code_number": 9, "category": "JOGO", "description": "Atraso em dia de jogo (5 min de tolerância)", "calculation_type": PM, "base_value": 0.5},
    {"code_number": 10, "category": "JOGO", "description": "Falta de equipamento de passeio (jogo em casa e fora)", "calculation_type": F, "base_value": 5.0},
    {"code_number": 11, "category": "JOGO", "description": "Falta a jogo sem justificação (consultar Direção)", "calculation_type": F, "base_value": 0.0},
    {"code_number": 12, "category": "JOGO", "description": "Falta de ténis para o jogo", "calculation_type": F, "base_value": 5.0},
    {"code_number": 13, "category": "JOGO", "description": "Falta de blusa para o jogo", "calculation_type": F, "base_value": 2.5},
    {"code_number": 14, "category": "JOGO", "description": "Falta de meias para o jogo", "calculation_type": F, "base_value": 2.5},
    {"code_number": 15, "category": "JOGO", "description": "Exclusões sem nexo e sem justificação (repetir dobra, 3x triplica)", "calculation_type": PR, "base_value": 10.0},
    {"code_number": 16, "category": "JOGO", "description": "Não estar pronto para o aquecimento 30 min antes do jogo", "calculation_type": F, "base_value": 1.5},
    {"code_number": 17, "category": "GERAL", "description": "Fumar no balneário", "calculation_type": F, "base_value": 2.0},
    {"code_number": 18, "category": "GERAL", "description": "Meias curtas", "calculation_type": F, "base_value": 1.0},
    {"code_number": 19, "category": "GERAL", "description": "Falta de material de higiene (chinelos, shampoo, gel, desodorizante)", "calculation_type": PI, "base_value": 0.5},
    {"code_number": 20, "category": "GERAL", "description": "Não trazer bolo/grade em semana de aniversário", "calculation_type": F, "base_value": 15.0},
    {"code_number": 21, "category": "GERAL", "description": "Não assinar a convocatória", "calculation_type": F, "base_value": 1.5},
    {"code_number": 22, "category": "GERAL", "description": "Perder jogo pré-desportivo ou situação competitiva durante o treino", "calculation_type": F, "base_value": 0.5},
    {"code_number": 23, "category": "GERAL", "description": "Apanhado a sair no dia anterior ao jogo", "calculation_type": F, "base_value": 25.0},
    {"code_number": 24, "category": "GERAL", "description": "Não responder a sondagens da Equipa Técnica e Capitães em menos de 24h", "calculation_type": F, "base_value": 2.0},
    {"code_number": 25, "category": "GERAL", "description": "Desrespeitar a Equipa Técnica, Capitães, Direção", "calculation_type": F, "base_value": 10.0},
    {"code_number": 26, "category": "GERAL", "description": "Deixar equipamentos espalhados fora do saco após jogo", "calculation_type": F, "base_value": 1.0},
    {"code_number": 27, "category": "GERAL", "description": "Não reunir depois do jogo sem justificação", "calculation_type": F, "base_value": 1.0},
    {"code_number": 28, "category": "GERAL", "description": "Ir embora do convívio sem pagar o que consumiu", "calculation_type": F, "base_value": 2.0},
    {"code_number": 29, "category": "GERAL", "description": "Publicar conteúdos inapropriados no grupo da equipa técnica", "calculation_type": F, "base_value": 5.0},
    {"code_number": 30, "category": "GERAL", "description": "Multas adicionais (consultar Sindicato)", "calculation_type": F, "base_value": 0.0},
    {"code_number": 31, "category": "GERAL", "description": "Joia mensal", "calculation_type": F, "base_value": 3.0},
    {"code_number": 33, "category": "TREINO", "description": "Falta a treino - Com justificação", "calculation_type": F, "base_value": 1.0},
]


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        for u in USERS:
            existing = session.exec(select(User).where(User.username == u["username"])).first()
            if not existing:
                session.add(User(
                    username=u["username"],
                    name=u["name"],
                    phone=u["phone"],
                    password_hash=get_password_hash(u["password"]),
                    role=u["role"],
                ))
        session.commit()

        for ft in FINE_TYPES:
            existing = session.exec(select(FineType).where(FineType.code_number == ft["code_number"])).first()
            if existing:
                existing.category = ft["category"]
                existing.description = ft["description"]
                existing.calculation_type = ft["calculation_type"]
                existing.base_value = ft["base_value"]
                session.add(existing)
            else:
                session.add(FineType(**ft))
        session.commit()

        print(f"Seed concluído: {len(USERS)} users, {len(FINE_TYPES)} tipos de multa.")
        print("\nLogins (username ou telefone):")
        for u in USERS:
            print(f"  {u['username']:14s} / {u['password']:10s}  -> {u['role'].value}")


if __name__ == "__main__":
    seed()