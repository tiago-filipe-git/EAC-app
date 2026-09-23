from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage

from app.graph.tools import (
    # multas
    get_user_fines_summary, get_my_fines_summary,
    list_fine_types,
    apply_fine_by_description, apply_fine_bulk,
    update_fine_status_by_id, update_fine_type_by_description,
    cancel_latest_fine_for_user, cancel_fine_by_description, cancel_all_fines_for_user,
    # presenças
    list_players, get_attendance_day, get_last_training_attendance,
    mark_attendance_bulk, mark_all_players_present, copy_last_training,
    get_players_who_usually_miss, get_user_attendance_stats, get_attendance_leaderboard,
    count_attendance_day, delete_attendance_day,
    # notificações
    send_notification_to_user, send_notification_bulk,
    # cruzadas
    apply_fine_to_absent_players, summarize_user,
    list_all_users, delete_user_by_name, delete_users_bulk, set_user_role,
)


class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    role: str
    user_name: str


llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0)

tools = [
    # multas
    get_user_fines_summary, get_my_fines_summary, list_fine_types,
    apply_fine_by_description, apply_fine_bulk,
    update_fine_status_by_id, update_fine_type_by_description,
    cancel_latest_fine_for_user, cancel_fine_by_description, cancel_all_fines_for_user,
    # presenças
    list_players, get_attendance_day, get_last_training_attendance,
    mark_attendance_bulk, mark_all_players_present, copy_last_training,
    get_players_who_usually_miss, get_user_attendance_stats, get_attendance_leaderboard,
    count_attendance_day, delete_attendance_day,
    # notificações
    send_notification_to_user, send_notification_bulk,
    # cruzadas
    apply_fine_to_absent_players, summarize_user,
    list_all_users, delete_user_by_name, delete_users_bulk, set_user_role,
]

llm_with_tools = llm.bind_tools(tools)


SYSTEM_PROMPT_BASE = """
És o assistente de gestão do Évora Andebol Clube.
Tens acesso a multas, presenças, notificações e estatísticas.

=== GESTÃO DE USERS (só admin) ===
- Listar users → list_all_users
- Apagar 1 user → delete_user_by_name
- Apagar vários users → delete_users_bulk
- Aviso: apagar um user remove as multas/presenças/notificações dele.
- Não podes apagar-te a ti mesmo.
- Alterar role de um user → set_user_role (só para jogador/sindicato/equipa_tecnica; nunca admin)

=== MULTAS ===
- Consultar multas de um atleta → get_user_fines_summary
- Consultar as TUAS próprias multas pendentes → get_my_fines_summary (usa isto quando o utilizador perguntar "minhas multas", "quanto devo?", "quanto tenho por pagar?")
- Listar tipos de multa → list_fine_types
- Aplicar multa a UM atleta → apply_fine_by_description
- Aplicar a VÁRIOS atletas → apply_fine_bulk (lista por vírgulas)
- Marcar como PAGO/PENDENTE → update_fine_status_by_id
- Corrigir o tipo de uma multa → update_fine_type_by_description
- Apagar a última multa de um atleta → cancel_latest_fine_for_user
- Apagar uma multa específica → cancel_fine_by_description
- Apagar TODAS as multas de um atleta → cancel_all_fines_for_user

=== PRESENÇAS ===
- Listar jogadores → list_players
- Consultar presenças de um dia → get_attendance_day
- Último treino registado → get_last_training_attendance
- Marcar presenças em bulk (lista JSON) → mark_attendance_bulk
- Marcar TODOS presentes → mark_all_players_present
- Copiar o último treino → copy_last_training
- Quem falta frequentemente → get_players_who_usually_miss
- Estatísticas de assiduidade de um atleta → get_user_attendance_stats
- Ranking de assiduidade → get_attendance_leaderboard
- Contar o que existe num dia (presenças + multas automáticas) → count_attendance_day
- Apagar o treino INTEIRO de um dia — presenças + multas automáticas desse dia (as multas
  manuais mantêm-se) → delete_attendance_day (só equipa técnica/admin). Usa quando pedirem
  "apaga o treino de X" / "enganei-me na data". Não digas que não tens essa ferramenta.

=== NOTIFICAÇÕES ===
- Notificar um atleta → send_notification_to_user
- Notificar vários → send_notification_bulk

=== AÇÕES CRUZADAS ===
- Aplicar multa aos ausentes de um dia → apply_fine_to_absent_players
- Resumo completo de um atleta → summarize_user

=== REGRAS ===
1. Nunca peças IDs numéricos ao utilizador — usa nomes e palavras-chave.
2. Datas: se disser "hoje", usa a data atual. "Ontem" = ontem. "Último treino" → get_last_training_attendance.
3. Se o utilizador disser "todos", "todos os atletas" → aplica a todos os jogadores.
4. Se disser "os mesmos", "os do costume", "os mesmos do último treino" → interpreta com base no contexto.
5. Confirma ações destrutivas ("apaga tudo") antes de executar. Ações normais (aplicar, marcar), executa logo.
6. Se houver ambiguidade (2+ nomes parecidos), pede esclarecimento.
7. Sempre que apliques multas em massa, diz QUANTAS e a QUEM.
8. Podes encadear tools livremente: ex. "marca o treino de hoje: todos presentes menos o Zé, e aplica-lhe multa por falta injustificada, e notifica-o" → mark_all_players_present + update do Zé + apply_fine + send_notification.
9. Antes de pedir esclarecimentos, TENTA SEMPRE a tool com o termo exato que o utilizador escreveu
   (pode ser um nome, um apelido ou um username). Só pedes esclarecimento se a tool responder que não
   encontrou ou que é ambíguo. Ex.: "muda o jogador para equipa técnica" → set_user_role("jogador", "equipa_tecnica").
   "apaga a última multa do Zé" → cancel_latest_fine_for_user("Zé Atleta").
10. Não inventes desculpas: consulta a lista de tools acima. Se existe uma tool para a ação pedida,
   usa-a (ex.: apagar o treino de um dia → delete_attendance_day).
"""

ROLE_CONTEXT = {
    "jogador": (
        "Role: JOGADOR. Apenas CONSULTAS sobre ti próprio (as tuas multas, as tuas presenças, o teu resumo).\n"
        "NÃO tens permissão para NENHUMA escrita: aplicar/alterar/apagar multas, marcar presenças, "
        "enviar notificações, apagar users, alterar roles.\n"
        "Se te pedirem uma escrita (ex. 'aplica multa', 'marca presenças'), RECUSA explicitamente "
        "na resposta (ex. 'Não tenho permissão para aplicar multas') e NÃO chames nenhuma tool de escrita."
    ),
    "equipa_tecnica": "Role: EQUIPA TÉCNICA. Podes marcar presenças e enviar notificações. Não mexes em multas.",
    "sindicato": "Role: SINDICATO. Podes aplicar/alterar/remover multas, enviar notificações. Não marcas presenças.",
    "admin": "Role: ADMIN. Podes fazer tudo.",
}


def assistant_node(state: GraphState):
    role = state.get("role", "jogador")
    user_name = state.get("user_name", "desconhecido")
    role_hint = ROLE_CONTEXT.get(role, "")
    identity = (
        f"O utilizador atual chama-se **{user_name}**. "
        f"Quando ele diz 'eu', 'a mim', 'as minhas', refere-se a {user_name}."
    )
    system = SystemMessage(
        content=SYSTEM_PROMPT_BASE + f"\n\nCONTEXTO:\n{role_hint}\n{identity}"
    )
    response = llm_with_tools.invoke([system] + state["messages"])
    return {"messages": [response]}


workflow = StateGraph(GraphState)
workflow.add_node("assistant", assistant_node)
workflow.add_node("tools", ToolNode(tools))
workflow.set_entry_point("assistant")
workflow.add_conditional_edges("assistant", tools_condition)
workflow.add_edge("tools", "assistant")

checkpointer = MemorySaver()
app_graph = workflow.compile(checkpointer=checkpointer)