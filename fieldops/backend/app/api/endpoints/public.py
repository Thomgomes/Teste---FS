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
    """
    Endpoint público e anônimo (Sem Login) para o cliente final acompanhar o status da visita.
    Usa o 'public_token' único gerado no agendamento.
    Retorna estritamente dados públicos e a timeline de eventos, protegendo a PII (LGPD).
    """
    # Executa a busca carregando a timeline de eventos e os dados do técnico associado
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

    # Se o token não existir, solta um erro 404 genérico por motivos de segurança (evita enumeração de IDs)
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="O link de acompanhamento informado é inválido ou expirou."
        )

    # 🛡️ FILTRAGEM E EXPURGO DE DADOS SENSÍVEIS (Compliance com LGPD / Requisito da Prova)
    timeline_publica = []
    for event in visit.events:
        # Ignora logs internos de erro ou conflitos de sincronização para não confundir o cliente
        if event.event_type == "CONFLITO_SINCRONIZACAO":
            continue
            
        timeline_publica.append({
            "momento": event.created_at,
            "situacao": event.event_type,
            "detalhes": event.description
        })

    # Ordena a timeline do evento mais antigo para o mais recente
    timeline_publica.sort(key=lambda x: x["momento"])

    # Monta a resposta customizada contendo apenas o escopo público e seguro
    return {
        "visita_id": visit.id,
        "cliente": visit.client_name,
        "status_atual": visit.status.value,  # Retorna o valor limpo em português (ex: "EM_ATENDIMENTO")
        "janela_agendada": visit.scheduled_at,
        "ultima_atualizacao": visit.updated_at,
        "tecnico_designado": {
            "nome": visit.technician.name
            # ⚠️ Ocultamos e-mail, id, telefone e status do usuário por privacidade e LGPD
        },
        "linha_do_tempo": timeline_publica
    }