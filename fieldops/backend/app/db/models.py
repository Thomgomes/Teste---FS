#Arquivo de definição das models do SQLAlchemy para o ORM.

import enum 
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Text, Boolean, Enum, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TECHNICIAN = "tecnico" 

class VisitStatus(str, enum.Enum):
    SCHEDULED = "AGENDADA"
    IN_DISPLACEMENT = "EM_DESLOCAMENTO"
    IN_PROGRESS = "EM_ATENDIMENTO"
    COMPLETED = "CONCLUIDA"
    CANCELED = "CANCELADA"

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[str] = mapped_column(String(14), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    visits: Mapped[list["Visit"]] = relationship(back_populates="company", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    company: Mapped["Company"] = relationship(back_populates="users")
    assigned_visits: Mapped[list["Visit"]] = relationship(back_populates="technician")

class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    technician_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[VisitStatus] = mapped_column(Enum(VisitStatus), default=VisitStatus.SCHEDULED)
    public_token: Mapped[uuid.UUID] = mapped_column(unique=True, default=uuid.uuid4)

    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company: Mapped["Company"] = relationship(back_populates="visits")
    technician: Mapped["User"] = relationship(back_populates="assigned_visits")
    events: Mapped[list["VisitEvent"]] = relationship(back_populates="visit", cascade="all, delete-orphan")
    attachments: Mapped[list["VisitAttachment"]] = relationship(back_populates="visit", cascade="all, delete-orphan")

class VisitEvent(Base):
    __tablename__ = "visit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("visits.id", ondelete="CASCADE"), nullable=False)
    
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    visit: Mapped["Visit"] = relationship(back_populates="events")

class VisitAttachment(Base):
    __tablename__ = "visit_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("visits.id", ondelete="CASCADE"), nullable=False)
    
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    visit: Mapped["Visit"] = relationship(back_populates="attachments")