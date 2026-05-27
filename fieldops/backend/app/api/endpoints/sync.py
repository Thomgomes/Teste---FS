#Endpoint para sincronização de dados do PWA offline

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.dependencies import get_db, require_technician
from app.db import models
from app.schemas.sync import SyncPayloadSchema

router = APIRouter()

@router.post("/", status_code=status.HTTP_200_OK)
async def sync_offline_events(
    payload: SyncPayloadSchema,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_technician) # Apenas técnicos sincronizam dados offline
):
    """
    Sincroniza um lote de eventos gerados offline pelo PWA do técnico.
    Aplica deduplicação por chave de idempotência e resolve conflitos de estado com o painel Admin.
    """
    sync_results = []
    processed_events_count = 0
    ignored_by_idempotency = 0

    # Processa cada evento enviado no lote
    for event_data in payload.events:
        
        # 🛡️ PILAR 1: DEDUPLICAÇÃO POR IDEMPOTÊNCIA (Evita duplicação por reenvio de rede)
        idempotency_query = select(models.VisitEvent).where(
            models.VisitEvent.idempotency_key == event_data.idempotency_key
        )
        idempotency_result = await db.execute(idempotency_query)
        if idempotency_result.scalar_one_or_none() is not None:
            ignored_by_idempotency += 1
            sync_results.append({
                "idempotency_key": event_data.idempotency_key,
                "status": "IGNORADO",
                "detail": "Evento já processado anteriormente pelo servidor."
            })
            continue

        # 🔏 PILAR 2: VERIFICAÇÃO DE TENANT E EXISTÊNCIA DA VISITA
        visit_query = select(models.Visit).where(
            and_(
                models.Visit.id == event_data.visit_id,
                models.Visit.company_id == current_user.company_id # Isolamento estrito de Tenant
            )
        )
        visit_result = await db.execute(visit_query)
        visit = visit_result.scalar_one_or_none()

        if not visit:
            sync_results.append({
                "idempotency_key": event_data.idempotency_key,
                "status": "ERRO",
                "detail": f"Visita com ID {event_data.visit_id} não encontrada ou pertence a outra empresa."
            })
            continue

        # ⚖️ PILAR 3: RESOLUÇÃO DE CONFLITO DE CONCORRÊNCIA (Requisito Crítico da Prova)
        # Se o Admin já CANCELOU ou CONCLUIU a visita online, o estado do banco trava.
        if visit.status in [models.VisitStatus.CANCELED, models.VisitStatus.COMPLETED]:
            # Criamos o evento na linha do tempo para auditoria, mas NÃO alteramos o status principal da visita
            conflict_event = models.VisitEvent(
                company_id=current_user.company_id,
                visit_id=visit.id,
                event_type="CONFLITO_SINCRONIZACAO",
                description=(
                    f"Tentativa offline de alterar para {event_data.event_type} rejeitada. "
                    f"Motivo: A visita já estava com status terminal '{visit.status.value}' no servidor. "
                    f"Obs do Técnico: {event_data.description or 'Sem observações.'}"
                ),
                idempotency_key=event_data.idempotency_key,
                created_at=event_data.created_at
            )
            db.add(conflict_event)
            sync_results.append({
                "idempotency_key": event_data.idempotency_key,
                "status": "CONFLITO",
                "detail": f"Alteração rejeitada. A visita já foi finalizada como {visit.status.value} pelo painel Admin."
            })
            processed_events_count += 1
            continue

        # 🔄 PILAR 4: FLUXO FELIZ - APLICA A TRANSIÇÃO DE STATUS
        # Mapeia os tipos de eventos vindos do PWA para os Enums reais do banco
        if event_data.event_type == "INICIAR_DESLOCAMENTO":
            visit.status = models.VisitStatus.IN_DISPLACEMENT
        elif event_data.event_type == "INICIAR_ATENDIMENTO":
            visit.status = models.VisitStatus.IN_PROGRESS
        elif event_data.event_type == "CONCLUIR_VISITA":
            visit.status = models.VisitStatus.COMPLETED

        # Salva o evento legítimo na timeline
        approved_event = models.VisitEvent(
            company_id=current_user.company_id,
            visit_id=visit.id,
            event_type=event_data.event_type,
            description=event_data.description,
            idempotency_key=event_data.idempotency_key,
            created_at=event_data.created_at
        )
        
        db.add(approved_event)
        sync_results.append({
            "idempotency_key": event_data.idempotency_key,
            "status": "SUCESSO",
            "detail": f"Status atualizado para {visit.status.value} com sucesso."
        })
        processed_events_count += 1

    # Salva todas as operações no banco de dados de uma só vez de forma atômica
    if processed_events_count > 0:
        await db.commit()

    return {
        "mensagem": "Sincronização em lote processada.",
        "resumo": {
            "processados_com_sucesso_ou_conflito": processed_events_count,
            "ignorados_por_idempotencia": ignored_by_idempotency
        },
        "detalhes": sync_results
    }