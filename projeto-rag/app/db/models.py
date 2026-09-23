from enum import Enum
from typing import Optional
from datetime import datetime, date
from sqlmodel import SQLModel, Field


class Role(str, Enum):
    ADMIN = "admin"
    SINDICATO = "sindicato"
    EQUIPA_TECNICA = "equipa_tecnica"
    JOGADOR = "jogador"


class FineStatus(str, Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"


class FineCalculationType(str, Enum):
    FIXED = "FIXED"
    PER_MINUTE = "PER_MINUTE"
    PER_ITEM = "PER_ITEM"
    PROGRESSIVE = "PROGRESSIVE"


class AttendanceStatus(str, Enum):
    PRESENTE = "PRESENTE"
    JUSTIFICADO = "JUSTIFICADO"
    INJUSTIFICADO = "INJUSTIFICADO"


class NotificationType(str, Enum):
    INFO = "INFO"
    FINE = "FINE"
    ATTENDANCE = "ATTENDANCE"
    WARNING = "WARNING"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    name: str
    phone: Optional[str] = Field(default=None, index=True, unique=True)
    password_hash: str
    role: Role = Field(default=Role.JOGADOR)
    position: Optional[str] = None
    photo_url: Optional[str] = None


class FineType(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code_number: int = Field(index=True, unique=True)
    category: str
    description: str
    calculation_type: FineCalculationType
    base_value: float


class Fine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    fine_type_id: int = Field(foreign_key="finetype.id")
    applied_by_id: int = Field(foreign_key="user.id")
    quantity: int = 1
    calculated_amount: float
    status: FineStatus = Field(default=FineStatus.PENDENTE)
    auto_generated: bool = Field(default=False, index=True)
    related_date: Optional[date] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[date] = None
    paid_at: Optional[datetime] = None


class Attendance(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    event_date: date = Field(index=True)
    status: AttendanceStatus
    minutes_late: Optional[int] = None
    marked_by_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: NotificationType = Field(default=NotificationType.INFO)
    title: str
    message: str
    link: Optional[str] = None
    read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)