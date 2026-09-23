import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

# Carrega a GROQ_API_KEY do ficheiro .env
load_dotenv()

def get_llm():
    """
    Devolve a instância do LLM configurada com o Llama 3.3 70B via Groq.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY não foi encontrada no ficheiro .env")

    return ChatGroq(
        model_name="openai/gpt-oss-120b",
        temperature=0,
        groq_api_key=api_key
    )