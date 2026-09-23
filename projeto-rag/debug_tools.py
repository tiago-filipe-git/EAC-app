from dotenv import load_dotenv
load_dotenv()

from app.graph.workflow import app_graph
from langchain_core.messages import HumanMessage, SystemMessage

user_context = SystemMessage(
    content="[Contexto de Segurança: O utilizador atual tem o username 'joaopinheiro', chama-se 'joao pinheiro', e tem o cargo 'Sindicato'.]"
)
inputs = {"messages": [user_context, HumanMessage(content="Marca a multa a joaopinheiro por falta ao treino")]}

result = app_graph.invoke(inputs)

for m in result["messages"]:
    print(type(m).__name__, "->", repr(m))
    print("---")