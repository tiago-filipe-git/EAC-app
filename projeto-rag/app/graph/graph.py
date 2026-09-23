from langgraph.graph import StateGraph, END
from app.graph.state import GraphState
from app.graph.nodes import router_node, retriever_node, generator_node


def decide_next_node(state: GraphState) -> str:
    """
    Função de decisão (Aresta Condicional):
    Verifica a flag 'needs_rag' definida pelo router_node.
    """
    if state.get("needs_rag"):
        return "retriever"
    return "generator"


def create_graph():
    """
    Monta e compila o Grafo Agêntico com LangGraph.
    """
    workflow = StateGraph(GraphState)

    # 1. Adicionar os Nós
    workflow.add_node("router", router_node)
    workflow.add_node("retriever", retriever_node)
    workflow.add_node("generator", generator_node)

    # 2. Definir o Ponto de Entrada
    workflow.set_entry_point("router")

    # 3. Adicionar a Decisão Condicional a sair do Router
    workflow.add_conditional_edges(
        "router",
        decide_next_node,
        {
            "retriever": "retriever",
            "generator": "generator"
        }
    )

    # 4. Adicionar as Arestas Normais
    workflow.add_edge("retriever", "generator")
    workflow.add_edge("generator", END)

    # 5. Compilar o Grafo
    return workflow.compile()

# Instância pronta a ser usada pela API
app_graph = create_graph()