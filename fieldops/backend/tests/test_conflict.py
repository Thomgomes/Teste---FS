import uuid
import pytest
from datetime import datetime, timezone
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select
from app.db import models

pytestmark = pytest.mark.asyncio

# =========================================================================
# ⚖️ TESTE: RESOLUÇÃO DO CONFLITO CRÍTICO DA PROVA (ERRO 409)
# =========================================================================
async def test_sync_conflict_admin_canceled_vs_tech_completed(client: AsyncClient, db_session):
    """
    Simula o cenário onde o Admin cancela a visita na central enquanto o técnico
    está offline tentando concluí-la. A API deve recusar a conclusão e registrar o conflito.
    """
    # 1. Prepara a massa: Cria uma empresa e dois usuários (Admin e Técnico) via API
    import random
    rand_suffix = random.randint(1000, 9999)
    
    # Usamos o conftest db_session indiretamente criando os atores estruturados
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

    # Cria a visita original como SCHEDULED
    visit = models.Visit(
        company_id=company.id, technician_id=tech.id,
        client_name="Cliente Conflituoso", address="Rua da Disputa, 12",
        status=models.VisitStatus.SCHEDULED, public_token=uuid.uuid4(),
        scheduled_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(visit)
    await db_session.commit()

    # Gera os tokens de autenticação fake para o teste simular os cabeçalhos
    from app.core import security
    token_tech = security.create_access_token(subject=str(tech.id))
    headers_tech = {"Authorization": f"Bearer {token_tech}"}

    # 2. A central age online: O Admin cancela a visita diretamente no banco de dados
    visit.status = models.VisitStatus.CANCELED
    await db_session.commit()

    # 3. O campo age offline: O técnico tenta sincronizar um evento de conclusão gerado no dispositivo
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

    # Dispara a sincronização do lote contra a API
    response = await client.post("/api/v1/sync/", json=conflict_payload, headers=headers_tech)
    
    # A resposta deve vir com sucesso HTTP 200 na rota de lote, mas o detalhe interno
    # do item deve cravar o status de "CONFLITO" conforme nossa regra de negócio V1
    assert response.status_code == status.HTTP_200_OK
    
    json_data = response.json()
    assert json_data["resumo"]["sucesso_ou_conflito"] == 1
    assert json_data["detalhes"][0]["status"] == "CONFLITO"
    assert "recusada" in json_data["detalhes"][0]["detail"].lower()

    # 4. Auditoria: Valida se o evento de conflito foi realmente gravado no banco de dados para rastro
    events_query = select(models.VisitEvent).where(
        models.VisitEvent.visit_id == visit.id,
        models.VisitEvent.event_type == "CONFLITO_SINCRONIZACAO"
    )
    events_result = await db_session.execute(events_query)
    conflict_row = events_result.scalar_one_or_none()
    
    assert conflict_row is not None
    assert "estado terminal" in conflict_row.description