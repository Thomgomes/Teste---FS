#Arquivo do schema para validar os dados da visita.

from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field
from app.db.models import VisitStatus

class VisitBase(BaseModel):
    client_name: str = Field(..., max_length=255)
    address: str
    scheduled_at: datetime

class VisitCreate(VisitBase):
    technician_id: UUID

class VisitEventResponse(BaseModel):
    id: UUID
    company_id: UUID
    event_type: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class VisitResponse(VisitBase):
    id: UUID
    company_id: UUID
    technician_id: UUID
    status: VisitStatus
    public_token: UUID
    updated_at: datetime
    events: List[VisitEventResponse] = []

    class Config:
        from_attributes = True