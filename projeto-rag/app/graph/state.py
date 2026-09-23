from typing import List, TypedDict

class GraphState(TypedDict):
    """
    Representa o estado do nosso grafo agêntico.

    Atributos:
        question: A pergunta original do utilizador.
        generation: A resposta final gerada pelo LLM.
        documents: Lista de trechos de texto recuperados do ChromaDB.
        needs_rag: Decisão do roteador (True se precisar de RAG, False caso contrário).
    """
    question: str
    generation: str
    documents: List[str]
    needs_rag: bool