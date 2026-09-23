import unicodedata
from datetime import date, timedelta
from typing import Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from sqlmodel import Session, select

from app.db.database import engine
from app.db.models import (
    User, Fine, FineType, Role, FineStatus,
    Attendance, AttendanceStatus, Notification, NotificationType,
)
from app.services import fines as fines_service
from app.services import attendance as attendance_service
from app.services import notifications as notif_service


# ---------- Helpers ----------

def _normalize(text: str) -> str:
    if not text:
        return ""
    text = text.strip().lower()
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )


def _find_user_flexible(session: Session, user_name: str) -> list[User]:
    """Encontra users por nome OU username (parcial, sem acentos).

    O username também conta porque o agente recebe muitas vezes o termo tal
    como o utilizador o disse (ex.: 'muda o jogador para equipa técnica', em
    que 'jogador' é o username do Zé Atleta).
    """
    norm_input = _normalize(user_name)
    parts = [p for p in norm_input.split() if p]
    if not parts:
        return []
    users = session.exec(select(User)).all()

    def _hit(u: User) -> bool:
        alvo = f"{_normalize(u.name)} {_normalize(u.username)}"
        return all(p in alvo for p in parts)

    matches = [u for u in users if _hit(u)]
    # um match exato (nome ou username) tem prioridade sobre os parciais,
    # senão um termo curto podia ficar "ambíguo" sem motivo
    exatos = [u for u in matches
              if norm_input in (_normalize(u.name), _normalize(u.username))]
    return exatos or matches


def _find_finetype_flexible(session: Session, keyword: str) -> Optional[FineType]:
    norm_kw = _normalize(keyword)
    fine_types = session.exec(select(FineType)).all()
    for ft in fine_types:
        if norm_kw in _normalize(ft.description):
            return ft
    STOPWORDS = {"de","da","do","das","dos","a","o","as","os","e","ou","em","por","para","com","sem","multa"}
    tokens = [t for t in norm_kw.split() if t not in STOPWORDS and len(t) >= 3]
    if tokens:
        best, best_score = None, 0
        for ft in fine_types:
            desc = _normalize(ft.description)
            score = sum(1 for t in tokens if t in desc)
            if score > best_score:
                best_score, best = score, ft
        if best and best_score >= max(1, len(tokens) // 2):
            return best
    synonyms = {
        "injustificad": ["sem justificacao", "sem aviso"],
        "justificad": ["com justificacao"],
        "atraso": ["atraso"],
    }
    for key, values in synonyms.items():
        if key in norm_kw:
            for ft in fine_types:
                if any(v in _normalize(ft.description) for v in values):
                    return ft
    return None


def _current_user(session: Session, config: Optional[RunnableConfig]) -> Optional[User]:
    if not config:
        return None
    cfg = config.get("configurable", {}) if isinstance(config, dict) else {}
    uid = cfg.get("user_id", 0)
    return session.get(User, int(uid)) if uid else None


def _require_roles(current: Optional[User], *roles: Role) -> Optional[str]:
    if not current:
        return "Sessão inválida."
    if current.role not in roles:
        return f"Sem permissão. Roles permitidos: {[r.value for r in roles]}."
    return None


# ============ TOOLS DE MULTAS ============

@tool
def get_user_fines_summary(user_name: str, config: RunnableConfig) -> str:
    """Consulta o resumo e valor total de multas pendentes de um jogador pelo nome."""
    with Session(engine) as session:
        current = _current_user(session, config)
        matches = _find_user_flexible(session, user_name)
        if not matches:
            return f"Não encontrei nenhum atleta chamado '{user_name}'."
        if len(matches) > 1:
            return f"Encontrei mais do que um atleta: {', '.join(u.name for u in matches)}."
        user = matches[0]
        if current and current.role == Role.JOGADOR and current.id != user.id:
            return "Sem permissão: só podes consultar as tuas próprias multas."

        fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
        pending = [f for f in fines if f.status == FineStatus.PENDENTE]
        total = sum(fines_service.compute_current_amount(f)["total"] for f in pending)
        return f"O atleta {user.name} tem {len(pending)} multa(s) pendente(s), num total de {total:.2f}€."


@tool
def get_my_fines_summary(config: RunnableConfig = None) -> str:
    """Consulta as TUAS próprias multas pendentes (quantas, valor, prazos). Usa isto
    sempre que o utilizador perguntar 'minhas multas', 'quanto devo?', 'quanto tenho por pagar?'.
    Não precisa de nome — devolve as multas do utilizador autenticado neste momento."""
    with Session(engine) as session:
        current = _current_user(session, config)
        if not current:
            return "Sessão inválida."
        fines = session.exec(select(Fine).where(Fine.user_id == current.id)).all()
        pending = [f for f in fines if f.status == FineStatus.PENDENTE]
        total = sum(fines_service.compute_current_amount(f)["total"] for f in pending)
        stats = fines_service.stats_for_user(session, current.id)
        if not pending:
            return (f"Não tens multas pendentes. "
                    f"({stats['count']} multa(s) no total, {stats['paid']:.2f}€ já pagas.)")
        lines = []
        for f in sorted(pending, key=lambda x: x.created_at, reverse=True):
            ft = session.get(FineType, f.fine_type_id)
            desc = ft.description if ft else "?"
            amount = fines_service.compute_current_amount(f)
            due = f.due_date.isoformat() if f.due_date else "sem prazo"
            lines.append(f"- #{f.id}: {desc} — {amount['total']:.2f}€ (vence {due})")
        return (f"Tens {len(pending)} multa(s) pendente(s), total {total:.2f}€:\n"
                + "\n".join(lines))


@tool
def list_fine_types(config: RunnableConfig = None) -> str:
    """Lista todos os tipos de multa disponíveis (código + descrição + valor)."""
    with Session(engine) as session:
        types = fines_service.list_fine_types(session)
        lines = [f"#{t['code_number']} - {t['description']} ({t['base_value']}€)" for t in types]
        return "Tipos de multa:\n" + "\n".join(lines)


@tool
def apply_fine_by_description(
    user_name: str, infraction_keyword: str, quantity: int = 1, config: RunnableConfig = None
) -> str:
    """Aplica uma multa a um atleta pesquisando pelo nome e por palavra-chave da infração."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        if quantity is None or quantity < 1:
            return "Quantidade inválida: tem de ser um inteiro >= 1."

        matches = _find_user_flexible(session, user_name)
        if not matches:
            return f"Erro: Não encontrei nenhum atleta chamado '{user_name}'."
        if len(matches) > 1:
            return f"Encontrei vários atletas: {', '.join(u.name for u in matches)}."
        user = matches[0]
        ft = _find_finetype_flexible(session, infraction_keyword)
        if not ft:
            all_types = fines_service.list_fine_types(session)
            lista = "\n".join(f"- #{t['code_number']}: {t['description']}" for t in all_types)
            return f"Não encontrei a infração '{infraction_keyword}'. Opções:\n{lista}"

        result = fines_service.apply_fine(session, user.id, ft.code_number, quantity, current)
        return f"Multa aplicada a {user.name}: '{ft.description}' ({result['amount']:.2f}€)."


@tool
def apply_fine_bulk(
    user_names_csv: str, infraction_keyword: str, quantity: int = 1, config: RunnableConfig = None
) -> str:
    """Aplica a mesma multa a vários atletas. user_names_csv é uma lista separada por vírgulas."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        if quantity is None or quantity < 1:
            return "Quantidade inválida: tem de ser um inteiro >= 1."

        ft = _find_finetype_flexible(session, infraction_keyword)
        if not ft:
            return f"Não encontrei a infração '{infraction_keyword}'."

        names = [n.strip() for n in user_names_csv.split(",") if n.strip()]
        applied, not_found = [], []
        for name in names:
            matches = _find_user_flexible(session, name)
            if len(matches) == 1:
                fines_service.apply_fine(session, matches[0].id, ft.code_number, quantity, current)
                applied.append(matches[0].name)
            else:
                not_found.append(name)

        msg = f"Multa '{ft.description}' aplicada a {len(applied)} atleta(s): {', '.join(applied)}."
        if not_found:
            msg += f"\nNão encontrei: {', '.join(not_found)}."
        return msg


@tool
def update_fine_status_by_id(fine_id: int, new_status: str, config: RunnableConfig = None) -> str:
    """Altera o estado de uma multa (PAGO ou PENDENTE)."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        try:
            result = fines_service.update_status(session, fine_id, new_status.upper())
            return f"Estado da multa #{result['id']} alterado para '{result['status']}'."
        except Exception as e:
            return f"Erro: {getattr(e, 'detail', e)}"


@tool
def update_fine_type_by_description(
    user_name: str, old_keyword: str, new_keyword: str, config: RunnableConfig = None
) -> str:
    """Altera o TIPO de uma multa existente (corrige enganos)."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err

        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Não encontrei (ou encontrei vários) atleta(s) '{user_name}'."
        user = matches[0]
        new_ft = _find_finetype_flexible(session, new_keyword)
        if not new_ft:
            return f"Não encontrei o novo tipo '{new_keyword}'."

        norm_old = _normalize(old_keyword)
        target = None
        user_fines = session.exec(
            select(Fine).where(Fine.user_id == user.id).order_by(Fine.id.desc())
        ).all()
        for f in user_fines:
            ft = session.get(FineType, f.fine_type_id)
            if ft and norm_old in _normalize(ft.description):
                target = f
                break
        if not target:
            return f"Não encontrei multa '{old_keyword}' para {user.name}."

        result = fines_service.update_type(session, target.id, new_ft.code_number, None)
        return f"Multa #{target.id} de {user.name} alterada para '{new_ft.description}' ({result['amount']:.2f}€)."


@tool
def cancel_latest_fine_for_user(user_name: str, config: RunnableConfig = None) -> str:
    """Elimina a multa mais recente de um atleta."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        user = matches[0]
        fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
        if not fines:
            return f"{user.name} não tem multas."
        latest = max(fines, key=lambda f: f.id)
        ft = session.get(FineType, latest.fine_type_id)
        desc = ft.description if ft else "?"
        fid = latest.id
        session.delete(latest)
        session.commit()
        return f"Última multa de {user.name} removida: '{desc}' (#{fid})."


@tool
def cancel_fine_by_description(user_name: str, infraction_keyword: str, config: RunnableConfig = None) -> str:
    """Anula uma multa específica pelo nome + palavra-chave."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        user = matches[0]
        user_fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
        if not user_fines:
            return f"{user.name} não tem multas."
        norm_kw = _normalize(infraction_keyword)
        search_terms = [norm_kw]
        if "injustificad" in norm_kw:
            search_terms.extend(["sem justificacao", "sem aviso"])
        target = None
        for f in sorted(user_fines, key=lambda x: x.id, reverse=True):
            ft = session.get(FineType, f.fine_type_id)
            if ft and any(t in _normalize(ft.description) for t in search_terms):
                target = f
                break
        if not target:
            return f"Não encontrei multa '{infraction_keyword}' para {user.name}."
        desc = session.get(FineType, target.fine_type_id).description
        fid = target.id
        session.delete(target)
        session.commit()
        return f"Multa '{desc}' (#{fid}) de {user.name} removida."


@tool
def cancel_all_fines_for_user(user_name: str, config: RunnableConfig = None) -> str:
    """Elimina TODAS as multas de um atleta."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        user = matches[0]
        fines = session.exec(select(Fine).where(Fine.user_id == user.id)).all()
        if not fines:
            return f"{user.name} não tem multas."
        count = len(fines)
        for f in fines:
            session.delete(f)
        session.commit()
        return f"{count} multa(s) de {user.name} eliminadas."


# ============ TOOLS DE PRESENÇAS ============

@tool
def list_players(config: RunnableConfig = None) -> str:
    """Lista todos os jogadores registados (nome + ID)."""
    with Session(engine) as session:
        players = attendance_service.get_all_players(session)
        return "Jogadores:\n" + "\n".join(f"- {p.name} (ID {p.id})" for p in players)


@tool
def get_attendance_day(date_str: str, config: RunnableConfig = None) -> str:
    """Consulta as presenças de um dia (formato YYYY-MM-DD)."""
    with Session(engine) as session:
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'. Usa YYYY-MM-DD."
        day = attendance_service.get_day(session, d)
        lines = [f"Presenças de {date_str} ({day['marked']}/{day['total_players']} marcados):"]
        for r in day["records"]:
            lines.append(f"- {r['name']}: {r['status'] or 'não marcado'}")
        return "\n".join(lines)


@tool
def get_last_training_attendance(config: RunnableConfig = None) -> str:
    """Devolve o último treino registado (para 'os mesmos do último treino')."""
    with Session(engine) as session:
        last = attendance_service.get_last_training(session)
        if not last:
            return "Ainda não há treinos registados."
        lines = [f"Último treino: {last['date']}"]
        for r in last["records"]:
            if r["status"]:
                lines.append(f"- {r['name']}: {r['status']}")
        return "\n".join(lines)


@tool
def mark_attendance_bulk(
    date_str: str, records_json: str, config: RunnableConfig = None
) -> str:
    """
    Marca presenças em bulk. records_json = JSON list de {"name": "...", "status": "PRESENTE|JUSTIFICADO|INJUSTIFICADO"}.
    """
    import json
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        try:
            records_raw = json.loads(records_json)
        except json.JSONDecodeError:
            return "records_json inválido (não é JSON)."

        records = []
        unmatched = []
        for r in records_raw:
            name = r.get("name", "")
            status_val = r.get("status", "").upper()
            matches = _find_user_flexible(session, name)
            if len(matches) == 1:
                records.append({"user_id": matches[0].id, "status": status_val})
            else:
                unmatched.append(name)

        if not records:
            return f"Nenhum nome reconhecido. Não encontrados: {unmatched}"
        result = attendance_service.mark_bulk(session, d, records, current)
        msg = f"Marcados {result['total']} atletas em {date_str} (criados {result['created']}, atualizados {result['updated']})."
        if unmatched:
            msg += f"\nNão encontrei: {', '.join(unmatched)}."
        return msg


@tool
def mark_all_players_present(date_str: str, config: RunnableConfig = None) -> str:
    """Marca TODOS os jogadores como PRESENTE numa data."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        players = attendance_service.get_all_players(session)
        records = [{"user_id": p.id, "status": "PRESENTE"} for p in players]
        result = attendance_service.mark_bulk(session, d, records, current)
        return f"Todos os {result['total']} jogadores marcados como PRESENTE em {date_str}."


@tool
def copy_last_training(date_str: str, config: RunnableConfig = None) -> str:
    """Copia as presenças do último treino para a data indicada."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        last = attendance_service.get_last_training(session, before=d)
        if not last:
            return "Não há treino anterior para copiar."
        records = [
            {"user_id": r["user_id"], "status": r["status"]}
            for r in last["records"] if r["status"]
        ]
        result = attendance_service.mark_bulk(session, d, records, current)
        return f"Copiei {result['total']} registos do treino {last['date']} para {date_str}."


@tool
def get_players_who_usually_miss(config: RunnableConfig = None) -> str:
    """Lista jogadores que faltam frequentemente (>=40% de faltas)."""
    with Session(engine) as session:
        rows = attendance_service.get_players_who_usually_miss(session)
        if not rows:
            return "Ninguém acima do limiar de faltas."
        lines = [f"- {r['name']}: {r['miss_pct']}% faltas ({r['missed']}/{r['total']})" for r in rows]
        return "Jogadores que faltam frequentemente:\n" + "\n".join(lines)


@tool
def get_user_attendance_stats(user_name: str, year: int = 0, config: RunnableConfig = None) -> str:
    """Estatísticas de presenças de um atleta. year=0 significa todos os anos."""
    with Session(engine) as session:
        current = _current_user(session, config)
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        user = matches[0]
        if current and current.role == Role.JOGADOR and current.id != user.id:
            return "Sem permissão."
        stats = attendance_service.user_stats(session, user.id, year or None)
        return (
            f"{user.name}: {stats['present']} presenças, {stats['justified']} justificadas, "
            f"{stats['unjustified']} injustificadas ({stats['attendance_rate']}% de assiduidade)."
        )


@tool
def get_attendance_leaderboard(config: RunnableConfig = None) -> str:
    """Ranking de assiduidade (top assíduos e top faltosos)."""
    with Session(engine) as session:
        board = attendance_service.leaderboard(session)
        top = "\n".join(f"- {r['name']}: {r['attendance_rate']}%" for r in board["top_attendance"][:5])
        worst = "\n".join(
            f"- {r['name']}: {r['total_faltas']} faltas no total "
            f"({r['unjustified']} injustificadas, {r['justified']} justificadas)"
            for r in board["top_absent"][:5]
        )
        return f"Top assíduos:\n{top}\n\nTop faltosos:\n{worst}"


# ============ TOOLS DE NOTIFICAÇÕES ============

@tool
def send_notification_to_user(
    user_name: str, title: str, message: str, config: RunnableConfig = None
) -> str:
    """Envia uma notificação in-app a um atleta."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        notif_service.create(session, matches[0].id, title, message, NotificationType.INFO)
        return f"Notificação enviada a {matches[0].name}."


@tool
def send_notification_bulk(
    user_names_csv: str, title: str, message: str, config: RunnableConfig = None
) -> str:
    """Envia notificação a vários atletas. user_names_csv separado por vírgulas."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        names = [n.strip() for n in user_names_csv.split(",") if n.strip()]
        ids, not_found = [], []
        for name in names:
            matches = _find_user_flexible(session, name)
            if len(matches) == 1:
                ids.append(matches[0].id)
            else:
                not_found.append(name)
        count = notif_service.create_bulk(session, ids, title, message, NotificationType.INFO)
        msg = f"Notificação enviada a {count} atleta(s)."
        if not_found:
            msg += f"\nNão encontrei: {', '.join(not_found)}."
        return msg


# ============ TOOLS CRUZADAS ============

@tool
def apply_fine_to_absent_players(
    date_str: str, infraction_keyword: str, config: RunnableConfig = None
) -> str:
    """Aplica uma multa a todos os jogadores AUSENTES (JUSTIFICADO ou INJUSTIFICADO) de uma data."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        ft = _find_finetype_flexible(session, infraction_keyword)
        if not ft:
            return f"Tipo '{infraction_keyword}' não encontrado."
        day = attendance_service.get_day(session, d)
        absent = [r for r in day["records"] if r["status"] in ("JUSTIFICADO", "INJUSTIFICADO")]
        if not absent:
            return f"Não há ausentes em {date_str}."
        for r in absent:
            fines_service.apply_fine(session, r["user_id"], ft.code_number, 1, current)
        names = ", ".join(r["name"] for r in absent)
        return f"Multa '{ft.description}' aplicada a {len(absent)} ausente(s) de {date_str}: {names}."


@tool
def count_attendance_day(date_str: str, config: RunnableConfig = None) -> str:
    """Conta o que existe num dia (presenças + multas automáticas). Usado antes de apagar."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        c = attendance_service.count_day(session, d)
        return (
            f"Dia {date_str} tem {c['attendance_count']} registo(s) de presença "
            f"e {c['auto_fines_count']} multa(s) automática(s) (total {c['auto_fines_total']:.2f}€)."
        )


@tool
def delete_attendance_day(date_str: str, config: RunnableConfig = None) -> str:
    """Apaga o treino INTEIRO de um dia: presenças + multas automáticas associadas.
    Usa quando o utilizador diz 'apaga o treino de X' ou 'enganei-me na data'."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.EQUIPA_TECNICA, Role.ADMIN)
        if err: return err
        try:
            d = date.fromisoformat(date_str)
        except ValueError:
            return f"Data inválida: '{date_str}'."
        result = attendance_service.delete_day(session, d, current)
        return (
            f"Treino de {date_str} apagado: {result['attendance_deleted']} presença(s) "
            f"e {result['auto_fines_deleted']} multa(s) automática(s) "
            f"({result['auto_fines_total']:.2f}€). Multas manuais mantidas."
        )

@tool
def summarize_user(user_name: str, config: RunnableConfig = None) -> str:
    """Resumo completo de um atleta: multas pendentes + assiduidade."""
    with Session(engine) as session:
        current = _current_user(session, config)
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"Atleta '{user_name}' não encontrado ou ambíguo."
        user = matches[0]
        if current and current.role == Role.JOGADOR and current.id != user.id:
            return "Sem permissão."
        f_stats = fines_service.stats_for_user(session, user.id)
        a_stats = attendance_service.user_stats(session, user.id)
        return (
            f"Resumo de {user.name}:\n"
            f"- Multas: {f_stats['count']} no total, {f_stats['pending']:.2f}€ pendente.\n"
            f"- Assiduidade: {a_stats['attendance_rate']}% "
            f"({a_stats['present']} presenças, {a_stats['unjustified']} injustificadas)."
        )

@tool
def list_all_users(config: RunnableConfig = None) -> str:
    """Lista todos os users registados (nome + role + telefone)."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.SINDICATO, Role.ADMIN)
        if err: return err
        users = session.exec(select(User).order_by(User.name)).all()
        lines = [f"- {u.name} ({u.role.value if hasattr(u.role, 'value') else u.role}) · {u.phone}" for u in users]
        return f"Users registados ({len(users)}):\n" + "\n".join(lines)


@tool
def delete_user_by_name(user_name: str, config: RunnableConfig = None) -> str:
    """Apaga um user e todos os dados dele (multas, presenças, notificações)."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.ADMIN)
        if err: return err
        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"User '{user_name}' não encontrado ou ambíguo."
        target = matches[0]
        if target.id == current.id:
            return "Não podes apagar a tua própria conta."
        from app.services import users as users_service
        result = users_service.delete_user(session, target, current)
        return (
            f"{result['name']} apagado: {result['deleted']['fines']} multas, "
            f"{result['deleted']['attendance']} presenças, {result['deleted']['notifications']} notificações."
        )


@tool
def delete_users_bulk(user_names_csv: str, config: RunnableConfig = None) -> str:
    """Apaga vários users. user_names_csv separado por vírgulas."""
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.ADMIN)
        if err: return err
        names = [n.strip() for n in user_names_csv.split(",") if n.strip()]
        ids = []
        not_found = []
        for name in names:
            matches = _find_user_flexible(session, name)
            if len(matches) == 1:
                ids.append(matches[0].id)
            else:
                not_found.append(name)
        from app.services import users as users_service
        result = users_service.bulk_delete_users(session, ids, current)
        msg = f"Apagados {result['total']} users."
        if not_found:
            msg += f"\nNão encontrei: {', '.join(not_found)}."
        if result["errors"]:
            msg += f"\nErros: {'; '.join(result['errors'])}"
        return msg
@tool
def set_user_role(user_name: str, new_role: str, config: RunnableConfig = None) -> str:
    """
    Altera o role de um user. new_role = 'jogador' | 'sindicato' | 'equipa_tecnica'.
    Não funciona para admins nem para ti próprio.
    """
    with Session(engine) as session:
        current = _current_user(session, config)
        err = _require_roles(current, Role.ADMIN)
        if err: return err

        matches = _find_user_flexible(session, user_name)
        if len(matches) != 1:
            return f"User '{user_name}' não encontrado ou ambíguo."
        target = matches[0]

        if target.id == current.id:
            return "Não podes alterar o teu próprio role."
        if target.role == Role.ADMIN:
            return "O role de um admin não pode ser alterado."

        try:
            role_enum = Role(new_role.lower().strip())
        except ValueError:
            return f"Role inválido: '{new_role}'. Usa: jogador, sindicato, equipa_tecnica."

        if role_enum == Role.ADMIN:
            return "Não podes promover ninguém a admin."
        if role_enum not in (Role.JOGADOR, Role.SINDICATO, Role.EQUIPA_TECNICA):
            return "Role não permitido."

        target.role = role_enum
        session.add(target)
        session.commit()
        return f"{target.name} agora é {role_enum.value}."