import uuid
import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# TESTE: BATCH SYNC OFFLINE & DEDUPLICAÇÃO POR IDEMPOTÊNCIA
async def test_pwa_batch_sync_and_idempotency(client: AsyncClient, test_data: dict):
    visit_payload = {
        "client_name": "Cliente Fluxo Offline",
        "address": "Rua do PWA, 777",
        "technician_id": str(test_data["tech_a"].id),
        "scheduled_at": "2026-06-01T14:00:00"
    }
    create_response = await client.post(
        "/api/v1/visits/", 
        json=visit_payload, 
        headers=test_data["headers_admin_a"]
    )
    assert create_response.status_code == status.HTTP_201_CREATED
    visit_id = create_response.json()["id"]

    key_deslocamento = f"idemp-desl-{uuid.uuid4()}"
    key_atendimento = f"idemp-atend-{uuid.uuid4()}"
    key_conclusao = f"idemp-concl-{uuid.uuid4()}"

    sync_payload = {
        "events": [
            {
                "visit_id": visit_id,
                "event_type": "INICIAR_DESLOCAMENTO",
                "description": "Técnico iniciou o trajeto físico.",
                "idempotency_key": key_deslocamento,
                "created_at": "2026-05-28T12:00:00"
            },
            {
                "visit_id": visit_id,
                "event_type": "INICIAR_ATENDIMENTO",
                "description": "Chegou no local e iniciou os reparos.",
                "idempotency_key": key_atendimento,
                "created_at": "2026-05-28T12:15:00"
            },
            {
                "visit_id": visit_id,
                "event_type": "CONCLUIR_VISITA",
                "description": "Serviço finalizado com sucesso.",
                "idempotency_key": key_conclusao,
                "created_at": "2026-05-28T13:00:00"
            }
        ]
    }

    response_sync_1 = await client.post(
        "/api/v1/sync/",
        json=sync_payload,
        headers=test_data["headers_tech_a"]
    )
    assert response_sync_1.status_code == status.HTTP_200_OK
    
    data_sync_1 = response_sync_1.json()
    assert data_sync_1["resumo"]["sucesso_ou_conflito"] == 3
    assert data_sync_1["resumo"]["ignorados_por_idempotencia"] == 0
    assert data_sync_1["detalhes"][2]["status"] == "SUCESSO"

    response_sync_2 = await client.post(
        "/api/v1/sync/",
        json=sync_payload,
        headers=test_data["headers_tech_a"]
    )
    assert response_sync_2.status_code == status.HTTP_200_OK
    
    data_sync_2 = response_sync_2.json()
    assert data_sync_2["resumo"]["sucesso_ou_conflito"] == 0
    assert data_sync_2["resumo"]["ignorados_por_idempotencia"] == 3
    assert data_sync_2["detalhes"][0]["status"] == "IGNORADO"