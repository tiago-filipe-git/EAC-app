from app.graph.state import GraphState
from app.rag.retriever import retrieve_context
from app.rag.llm import get_llm

def router_node(state: GraphState) -> dict:
    """
    Nó 1: Avalia se a pergunta precisa de RAG (busca em documentos) 
    ou se é uma conversa geral.
    """
    question = state["question"]
    llm = get_llm()

    prompt = f"""És um classificador de intenções.
Analisa a pergunta do utilizador e responde APENAS com 'YES' se ela precisar de consulta a documentos técnicos/específicos, ou 'NO' se for apenas um cumprimento, despedida ou conversa geral.

Pergunta: {question}
Resposta (YES/NO):"""

    response = llm.invoke(prompt).content.strip().upper()
    needs_rag = "YES" in response

    return {"needs_rag": needs_rag}


def retriever_node(state: GraphState) -> dict:
    """
    Nó 2: Vai ao ChromaDB e procura os trechos de texto relevantes.
    """
    question = state["question"]
    docs = retrieve_context(question, k=3)
    return {"documents": docs}


def generator_node(state: GraphState) -> dict:
    """
    Nó 3: Gera a resposta final usando o LLM.
    Se usou RAG, baseia-se nos documentos. Caso contrário, responde diretamente.
    """
    question = state["question"]
    documents = state.get("documents", [])
    needs_rag = state.get("needs_rag", False)
    llm = get_llm()

    if needs_rag and documents:
        context = "\n\n".join(documents)
        prompt = f"""Responde à pergunta do utilizador com base EXCLUSIVAMENTE no contexto fornecido abaixo.
Se a informação não estiver no contexto, diz claramente que não sabes.

Contexto:
{context}

Pergunta: {question}
Resposta:"""
    else:
        prompt = f"Responde de forma amigável e prestável à seguinte mensagem do utilizador:\n\n{question}"

    response = llm.invoke(prompt).content.strip()
    return {"generation": response}