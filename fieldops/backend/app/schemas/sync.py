#Arquivo do schema para validar lote de dados de eventos do PWA.

from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field

class OfflineEventSchema(BaseModel):
    visit_id: UUID
    event_type: str
    description: Optional[str] = None
    idempotency_key: str = Field(..., max_length=255)
    created_at: datetime

class SyncPayloadSchema(BaseModel):
    events: List[OfflineEventSchema]