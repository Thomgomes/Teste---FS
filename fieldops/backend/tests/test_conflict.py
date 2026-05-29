import uuid
import pytest
from datetime import datetime, timezone
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from app.db import models

pytestmark = pytest.mark.asyncio

#TESTE: RESOLUÇÃO DO CONFLITO CRÍTICO DA PROVA (ERRO 409)
async def test_sync_conflict_admin_canceled_vs_tech_completed(client: AsyncClient, db_session):
    import random
    rand_suffix = random.randint(1000, 9999)
    
    company = models.Company(name="Empresa Conflitos S/A", cnpj=f"3333333300{rand_suffix}")
    db_session.add(company)
    await db_session.flush()

    admin = models.User(
        company_id=company.id, name="Admin Central", email=f"admin_{rand_suffix}@ops.com",
        password_hash="...", role=models.UserRole.ADMIN
    )
    tech = models.User(
        company_id=company.id, name="Técnico de Campo", email=f"tech_{rand_suffix}@ops.com",
        password_hash="...", role=models.UserRole.TECHNICIAN
    )
    db_session.add_all([admin, tech])
    await db_session.flush()

    visit = models.Visit(
        company_id=company.id, technician_id=tech.id,
        client_name="Cliente Conflituoso", address="Rua da Disputa, 12",
        status=models.VisitStatus.SCHEDULED, public_token=uuid.uuid4(),
        scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(visit)
    await db_session.commit()

    from app.core import security
    token_tech = security.create_access_token(subject=str(tech.id))
    headers_tech = {"Authorization": f"Bearer {token_tech}"}

    visit.status = models.VisitStatus.CANCELED
    await db_session.commit()

    key_conflito = f"idemp-conf-{uuid.uuid4()}"
    conflict_payload = {
        "events": [
            {
                "visit_id": str(visit.id),
                "event_type": "CONCLUIR_VISITA",
                "description": "Técnico jura que consertou o equipamento antes de saber do cancelamento.",
                "idempotency_key": key_conflito,
                "created_at": "2026-05-28T14:00:00"
            }
        ]
    }

    response = await client.post("/api/v1/sync/", json=conflict_payload, headers=headers_tech)
 
    assert response.status_code == status.HTTP_200_OK
    
    json_data = response.json()
    assert json_data["resumo"]["sucesso_ou_conflito"] == 1
    assert json_data["detalhes"][0]["status"] == "CONFLITO"
    assert "recusada" in json_data["detalhes"][0]["detail"].lower()
    
    events_query = select(models.VisitEvent).where(
        models.VisitEvent.visit_id == visit.id,
        models.VisitEvent.event_type == "CONFLITO_SINCRONIZACAO"
    )
    events_result = await db_session.execute(events_query)
    conflict_row = events_result.scalar_one_or_none()
    
    assert conflict_row is not None
    assert "estado terminal" in conflict_row.description