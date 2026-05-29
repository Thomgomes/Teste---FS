# Endpoint para sincronização de dados do PWA offline

import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List

from app.api.dependencies import get_db, require_technician
from app.db import models
from app.schemas.sync import SyncPayloadSchema, SyncBatchResponseSchema, SyncActionResponse, SyncSummarySchema

router = APIRouter()
logger = logging.getLogger("fieldops.sync")

async def simulate_external_integrations_async(visit_id: uuid.UUID, event_type: str, company_id: uuid.UUID):
    logger.info(
        f"⚡ [ASYNC MOCK INTEGRATION] Evento '{event_type}' processado para a Visita {visit_id} "
        f"| Tenant: {company_id} | Notificando ERP e disparando WhatsApp via console..."
    )

@router.post("/", response_model=SyncBatchResponseSchema, status_code=status.HTTP_200_OK)
async def sync_offline_events(
    payload: SyncPayloadSchema,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_technician)
):
    sync_results = []
    processed_events_count = 0
    ignored_by_idempotency = 0

    for event_data in payload.events:
        
        idempotency_query = select(models.VisitEvent).where(
            models.VisitEvent.idempotency_key == event_data.idempotency_key
        )
        idempotency_result = await db.execute(idempotency_query)
        if idempotency_result.scalar_one_or_none() is not None:
            ignored_by_idempotency += 1
            sync_results.append(SyncActionResponse(
                idempotency_key=event_data.idempotency_key,
                status="IGNORADO",
                detail="Evento já processado pelo servidor em tentativa anterior."
            ))
            continue

        visit_query = select(models.Visit).where(
            and_(
                models.Visit.id == event_data.visit_id,
                models.Visit.company_id == current_user.company_id
            )
        )
        visit_result = await db.execute(visit_query)
        visit = visit_result.scalar_one_or_none()

        if not visit:
            sync_results.append(SyncActionResponse(
                idempotency_key=event_data.idempotency_key,
                status="ERRO",
                detail="Visita não encontrada ou violação de acesso inter-inquilino."
            ))
            continue

        if visit.status in [models.VisitStatus.CANCELED, models.VisitStatus.COMPLETED]:
            conflict_event = models.VisitEvent(
                company_id=current_user.company_id,
                visit_id=visit.id,
                event_type="CONFLITO_SINCRONIZACAO",
                description=(
                    f"Tentativa offline de transição para '{event_data.event_type}' rejeitada. "
                    f"Motivo: A visita já se encontrava no estado terminal '{visit.status.value}' no servidor."
                ),
                idempotency_key=event_data.idempotency_key,
                created_at=event_data.created_at
            )
            db.add(conflict_event)
            
            sync_results.append(SyncActionResponse(
                idempotency_key=event_data.idempotency_key,
                status="CONFLITO",
                detail=f"Alteração recusada. Visita já encerrada como {visit.status.value} pelo painel Admin."
            ))
            processed_events_count += 1
            continue

        if event_data.event_type == "INICIAR_DESLOCAMENTO":
            visit.status = models.VisitStatus.IN_DISPLACEMENT
        elif event_data.event_type == "INICIAR_ATENDIMENTO":
            visit.status = models.VisitStatus.IN_PROGRESS
        elif event_data.event_type == "CONCLUIR_VISITA":
            visit.status = models.VisitStatus.COMPLETED

        approved_event = models.VisitEvent(
            company_id=current_user.company_id,
            visit_id=visit.id,
            event_type=event_data.event_type,
            description=event_data.description or f"Status atualizado para {visit.status.value}",
            idempotency_key=event_data.idempotency_key,
            created_at=event_data.created_at
        )
        
        db.add(approved_event)
        processed_events_count += 1
        
        await simulate_external_integrations_async(visit.id, event_data.event_type, current_user.company_id)
        
        sync_results.append(SyncActionResponse(
            idempotency_key=event_data.idempotency_key,
            status="SUCESSO",
            detail=f"Transição para {visit.status.value} efetuada com sucesso."
        ))

    if processed_events_count > 0:
        await db.commit()

    return SyncBatchResponseSchema(
        mensagem="Sincronização em lote processada.",
        resumo=SyncSummarySchema(
            sucesso_ou_conflito=processed_events_count,
            ignorados_por_idempotencia=ignored_by_idempotency
        ),
        detalhes=sync_results
    )