import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# =========================================================================
# 🛡️ TESTE: ISOLAMENTO E BLINDAGEM MULTI-TENANT (ADR 02)
# =========================================================================
async def test_cross_tenant_data_isolation(client: AsyncClient, test_data: dict):
    """
    Garante que as visitas criadas pela Empresa A fiquem invisíveis 
    quando a Empresa B (Técnico Beta) tentar listar os dados.
    """
    # 1. Cria a visita via API logado como o Administrador da Empresa A (Alfa)
    visit_payload = {
        "client_name": "Cliente Exclusivo Alfa",
        "address": "Avenida das Nações, 1000",
        "technician_id": str(test_data["tech_a"].id),
        "scheduled_at": "2026-06-01T10:00:00"
    }
    
    create_response = await client.post(
        "/api/v1/visits/", 
        json=visit_payload, 
        headers=test_data["headers_admin_a"]
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    # 2. Faz uma requisição GET para listar visitas usando o Token do Técnico da Empresa B (Beta)
    response = await client.get("/api/v1/visits/", headers=test_data["headers_tech_b"])
    assert response.status_code == status.HTTP_200_OK
    
    # O payload retornado DEVE ser uma lista vazia, pois a Empresa B não possui registros
    listagem_retornada = response.json()
    assert len(listagem_retornada) == 0


# =========================================================================
# 🚫 TESTE: TENTATIVA DE ACESSO DIRETO A RESOURCE DE OUTRO TENANT
# =========================================================================
async def test_get_visit_by_id_violating_tenant_returns_404(client: AsyncClient, test_data: dict):
    """
    Garante que se um usuário tentar buscar o ID exato de uma visita de outra empresa
    diretamente na URL, o sistema barra e retorna 404 por segurança (enumeração forçada).
    """
    # 1. Cria a visita via API na Empresa A
    visit_payload = {
        "client_name": "Cliente Alfa Protegido",
        "address": "Rua Secreta, 123",
        "technician_id": str(test_data["tech_a"].id),
        "scheduled_at": "2026-06-01T10:00:00"
    }
    
    create_response = await client.post(
        "/api/v1/visits/", 
        json=visit_payload, 
        headers=test_data["headers_admin_a"]
    )
    assert create_response.status_code == status.HTTP_201_CREATED
    visit_id = create_response.json()["id"]

    # 2. O Técnico B tenta ler o ID específico da visita da Empresa A
    response = await client.get(
        f"/api/v1/visits/{visit_id}", 
        headers=test_data["headers_tech_b"]
    )
    
    # Retorna 404 Not Found para ocultar a existência do dado do outro inquilino
    assert response.status_code == status.HTTP_404_NOT_FOUND