import uuid
import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# =========================================================================
# 📱 TESTE: BATCH SYNC OFFLINE & DEDUPLICAÇÃO POR IDEMPOTÊNCIA
# =========================================================================
async def test_pwa_batch_sync_and_idempotency(client: AsyncClient, test_data: dict):
    """
    Simula o descarregamento da fila FIFO local do IndexedDB para a API.
    Valida a transição de estados e garante a rejeição de duplicatas via chave de idempotência.
    """
    # 1. Primeiro criamos uma visita no sistema usando o Admin Alfa para servir de alvo
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

    # 2. Montamos o lote de eventos (Batch Payload) simulando as ações gravadas no IndexedDB
    # Geramos chaves de idempotência únicas para simular o primeiro envio legítimo
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

    # 3. Dispara a primeira sincronização legítima usando o token do TÉCNICO ALFA
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

    # 4. 🔥 TESTE DE IDEMPOTÊNCIA: Reenvia EXATAMENTE o mesmo lote para simular falha ou oscilação de rede
    response_sync_2 = await client.post(
        "/api/v1/sync/",
        json=sync_payload,
        headers=test_data["headers_tech_a"]
    )
    assert response_sync_2.status_code == status.HTTP_200_OK
    
    data_sync_2 = response_sync_2.json()
    # O backend deve ignorar o processamento dos 3 eventos porque as chaves já constam no banco
    assert data_sync_2["resumo"]["sucesso_ou_conflito"] == 0
    assert data_sync_2["resumo"]["ignorados_por_idempotencia"] == 3
    assert data_sync_2["detalhes"][0]["status"] == "IGNORADO"