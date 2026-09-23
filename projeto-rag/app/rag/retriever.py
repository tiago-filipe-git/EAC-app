import os

# Suprime os avisos do HuggingFace no Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

DB_DIR = "./chroma_db"

def get_retriever(k: int = 3):
    """
    Carrega a base de dados ChromaDB existente e devolve um Retriever 
    configurado para procurar os 'k' chunks mais relevantes.
    """
    # Usamos EXATAMENTE o mesmo modelo de embeddings usado na ingestão
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    # Carrega a base de dados a partir do disco
    vector_store = Chroma(
        persist_directory=DB_DIR,
        embedding_function=embeddings
    )

    # Converte a Vector Store num Retriever
    # search_kwargs={"k": k} define quantos chunks de texto queremos recuperar por pergunta
    return vector_store.as_retriever(search_kwargs={"k": k})


def retrieve_context(query: str, k: int = 3) -> list[str]:
    """
    Recebe uma pergunta em texto e devolve uma lista de strings
    com o conteúdo dos chunks mais relevantes encontrados no ChromaDB.
    """
    retriever = get_retriever(k=k)
    # Procura os documentos mais semelhantes à pergunta
    docs = retriever.invoke(query)

    # Extrai apenas o texto puro de cada documento recuperado
    return [doc.page_content for doc in docs]