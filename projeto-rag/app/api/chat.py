import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from sqlmodel import Session

from app.db.database import get_session
from app.db.models import User, Role
from app.core.deps import get_current_user
from app.graph.workflow import app_graph


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatIn(BaseModel):
    message: str


def _extract_text(content) -> str:
    """Normaliza o conteúdo de um chunk do LLM para texto simples."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


def _sse(payload: dict) -> str:
    """Formata um payload como Server-Sent Event."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("")
def chat(
    payload: ChatIn,
    session: Session = Depends(get_session),
    current: User = Depends(get_current_user),
):
    role_value = current.role.value if isinstance(current.role, Role) else current.role

    # Lê os dados do user ANTES de começar o streaming: a sessão da BD é
    # fechada quando a resposta começa a ser enviada, pelo que aceder aos
    # atributos do objeto `current` dentro do generator falharia (detached).
    user_id = current.id
    user_name = current.name

    # O thread_id é único por utilizador → histórico separado por user.
    config = {
        "configurable": {
            "thread_id": f"user-{user_id}",
            "user_id": user_id,
            "role": role_value,
        },
        "recursion_limit": 12,  # trava loops agente->tools->agente (loop infinito = erro, nao stream eterno)
    }

    human_msg = HumanMessage(content=payload.message)

    def event_generator():
        # stream_mode="messages" emite os tokens à medida que o LLM os gera,
        # incluindo a resposta final depois de eventuais chamadas a tools.
        try:
            for chunk, metadata in app_graph.stream(
                {
                    "messages": [human_msg],
                    "role": role_value,
                    "user_name": user_name,
                },
                config,
                stream_mode="messages",
            ):
                # Apenas os tokens produzidos pelo nó "assistant" (não os das tools).
                if metadata.get("langgraph_node") != "assistant":
                    continue

                text = _extract_text(getattr(chunk, "content", None))
                if text:
                    yield _sse({"token": text})
        except Exception as e:
            msg = str(e)
            if "recursion" in msg.lower() or "graphrecursion" in type(e).__name__.lower():
                msg = ("O pedido era demasiado complexo e excedeu o limite de passos. "
                       "Tenta dividir em pedidos mais pequenos.")
            yield _sse({"error": f"Erro no agente: {msg}"})
        finally:
            yield _sse({"done": True})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )