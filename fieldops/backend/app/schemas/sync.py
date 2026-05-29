# Arquivo do schema para validar lote de dados de eventos do PWA.

from pydantic import BaseModel
from datetime import datetime
import uuid
from typing import List, Optional

class OfflineEventSchema(BaseModel):
    visit_id: uuid.UUID
    event_type: str        
    description: Optional[str] = None
    idempotency_key: str
    created_at: datetime

class SyncPayloadSchema(BaseModel):
    events: List[OfflineEventSchema]
    
class SyncActionResponse(BaseModel):
    idempotency_key: str
    status: str            
    detail: str

class SyncSummarySchema(BaseModel):
    sucesso_ou_conflito: int
    ignorados_por_idempotencia: int

class SyncBatchResponseSchema(BaseModel):
    mensagem: str
    resumo: SyncSummarySchema
    detalhes: List[SyncActionResponse]