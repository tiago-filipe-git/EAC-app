from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    question: str
    session_id: str

class ChatResponse(BaseModel):
    session_id: str
    response: str
    sources: Optional[list[str]] = []

class DocumentUploadResponse(BaseModel):
    filename: str
    chunks_created: int
    message: str