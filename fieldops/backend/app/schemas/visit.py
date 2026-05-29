#Arquivo do schema para validar os dados da visita.

from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid
from typing import List, Optional
from app.db.models import VisitStatus


class UserResponseMini(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)
class VisitCreate(BaseModel):
    client_name: str
    address: str
    technician_id: uuid.UUID
    scheduled_at: datetime

class VisitEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    description: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class VisitAttachmentResponse(BaseModel):
    id: uuid.UUID
    file_url: str
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class VisitResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    technician_id: uuid.UUID
    status: VisitStatus
    client_name: str
    address: str
    public_token: uuid.UUID
    scheduled_at: datetime
    updated_at: datetime
    events: List[VisitEventResponse] = []
    attachments: List[VisitAttachmentResponse] = []
    technician: Optional[UserResponseMini] = None

    model_config = ConfigDict(from_attributes=True)