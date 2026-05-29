import pytest
from fastapi import status
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# TESTE: FLUXO FELIZ DE AUTENTICAÇÃO (LOGIN COM SUCESSO)
async def test_login_success(client: AsyncClient, test_data: dict):
    payload = {
        "username": test_data["admin_a"].email,
        "password": "senha123"
    }
    response = await client.post("/api/v1/auth/login", data=payload)
    
    assert response.status_code == status.HTTP_200_OK
    
    json_data = response.json()
    assert "access_token" in json_data
    assert json_data["token_type"] == "bearer"
    assert json_data["role"] == "admin"
    assert json_data["name"] == "Admin Alfa"


# TESTE: REJEIÇÃO DE LOGIN COM CREDENCIAIS INVÁLIDAS
async def test_login_invalid_password(client: AsyncClient, test_data: dict):

    payload = {
        "username": test_data["admin_a"].email,
        "password": "senha_errada_qualquer"
    }
    
    response = await client.post("/api/v1/auth/login", data=payload)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "E-mail ou senha incorretos."



# TESTE: CONTROLE DE ACESSO BASEADO EM PAPÉIS (RBAC)

async def test_rbac_technician_blocked_from_admin_route(client: AsyncClient, test_data: dict):
    visit_payload = {
        "client_name": "Cliente Invasor",
        "address": "Rua Hacker, 404",
        "technician_id": str(test_data["tech_a"].id),
        "scheduled_at": "2026-06-01T10:00:00"
    }
    
    response = await client.post(
        "/api/v1/visits/", 
        json=visit_payload, 
        headers=test_data["headers_tech_a"]
    )
    
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Acesso negado. Seu nível de permissão não autoriza esta operação."