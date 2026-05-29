#Endpoint público do cliente

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_db
from app.db import models
from app.schemas.visit import PublicVisitTrackResponse

router = APIRouter()

@router.get("/v/{token}", response_model=PublicVisitTrackResponse)
async def get_public_visit_status(
    token: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(models.Visit)
        .where(models.Visit.public_token == token)
        .options(
            selectinload(models.Visit.events),
            selectinload(models.Visit.technician)
        )
    )
    
    result = await db.execute(query)
    visit = result.scalar_one_or_none()

    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O link de acompanhamento informado é inválido ou expirou."
        )

    timeline_publica = []
    for event in visit.events:
        if event.event_type == "CONFLITO_SINCRONIZACAO":
            continue
            
        timeline_publica.append({
            "momento": event.created_at,
            "situacao": event.event_type,
            "detalhes": event.description
        })

    timeline_publica.sort(key=lambda x: x["momento"])

    return {
        "visita_id": visit.id,
        "cliente": visit.client_name,
        "status_atual": visit.status.value,
        "janela_agendada": visit.scheduled_at,
        "ultima_atualizacao": visit.updated_at,
        "tecnico_designado": {
            "nome": visit.technician.name
        },
        "linha_do_tempo": timeline_publica
    }