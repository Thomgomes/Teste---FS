import pytest
from fastapi import status
from httpx import AsyncClient

# Configura o pytest para tratar todas as funções deste arquivo como assíncronas
pytestmark = pytest.mark.asyncio

# =========================================================================
# 🔐 1. TESTE: FLUXO FELIZ DE AUTENTICAÇÃO (LOGIN COM SUCESSO)
# =========================================================================
async def test_login_success(client: AsyncClient, test_data: dict):
    """
    Garante que o endpoint de login aceita o formulário OAuth2 correto,
    valida a senha criptografada e retorna o token JWT com os metadados.
    """
    # Dados de formulário (form-data) exigidos pelo OAuth2PasswordRequestForm
    payload = {
        "username": test_data["admin_a"].email,
        "password": "senha123"
    }
    
    # Dispara o POST simulando o envio de um formulário web/mobile
    response = await client.post("/api/v1/auth/login", data=payload)
    
    assert response.status_code == status.HTTP_200_OK
    
    json_data = response.json()
    assert "access_token" in json_data
    assert json_data["token_type"] == "bearer"
    assert json_data["role"] == "admin"
    assert json_data["name"] == "Admin Alfa"


# =========================================================================
# ❌ 2. TESTE: REJEIÇÃO DE LOGIN COM CREDENCIAIS INVÁLIDAS
# =========================================================================
async def test_login_invalid_password(client: AsyncClient, test_data: dict):
    """
    Garante que tentativas de login com senhas incorretas sejam barradas
    com erro 400 Bad Request, protegendo a segurança do sistema.
    """
    payload = {
        "username": test_data["admin_a"].email,
        "password": "senha_errada_qualquer"
    }
    
    response = await client.post("/api/v1/auth/login", data=payload)
    
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "E-mail ou senha incorretos."


# =========================================================================
# 🛡️ 3. TESTE: CONTROLE DE ACESSO BASEADO EM PAPÉIS (RBAC)
# =========================================================================
async def test_rbac_technician_blocked_from_admin_route(client: AsyncClient, test_data: dict):
    """
    Garante o bloqueio estrito de privilégios: um Técnico não pode acessar
    uma rota decorada com 'require_admin' (ex: criar uma visita).
    O backend deve responder com 403 Forbidden.
    """
    # Dados para tentar simular o agendamento de uma visita
    visit_payload = {
        "client_name": "Cliente Invasor",
        "address": "Rua Hacker, 404",
        "technician_id": str(test_data["tech_a"].id),
        "scheduled_at": "2026-06-01T10:00:00"
    }
    
    # Dispara a requisição usando as credenciais (Headers JWT) do TÉCNICO
    response = await client.post(
        "/api/v1/visits/", 
        json=visit_payload, 
        headers=test_data["headers_tech_a"]
    )
    
    # O sistema precisa negar o acesso!
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Acesso negado. Seu nível de permissão não autoriza esta operação."