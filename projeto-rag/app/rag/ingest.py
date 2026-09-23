import os

# Oculta o aviso de symlinks do HuggingFace no Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma

DB_DIR = "./chroma_db"

def process_and_index_file(file_path: str, filename: str) -> int:
    if filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif filename.endswith(".txt"):
        loader = TextLoader(file_path, autodetect_encoding=True)
    else:
        raise ValueError("Formato não suportado. Envie um ficheiro .pdf ou .txt")

    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )
    chunks = text_splitter.split_documents(documents)

    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=DB_DIR
    )

    return len(chunks)