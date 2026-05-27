#Arquivo de dependências para o FastAPI, incluindo funções para obter sessão do banco de dados e validar tokens JWT.

from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import User, UserRole

# Configura o FastAPI para extrair o Token do cabeçalho "Authorization: Bearer <TOKEN>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


# =========================================================================
# 🛢️ 1. GERENCIADOR SÉNIOR DE SESSÃO DO BANCO DE DADOS
# =========================================================================
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Cria uma sessão assíncrona com o Postgres para cada requisição HTTP
    e garante o fechamento automático da conexão ao final do ciclo.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# =========================================================================
# 🔒 2. PROTETOR DE ROTAS: VALIDADOR DE TOKEN E RECUPERADOR DE USUÁRIO
# =========================================================================
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Guarda de trânsito da API. Descriptografa o JWT, valida a assinatura,
    verifica a expiração e busca o usuário dono do token no banco de dados.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido, expirado ou ausente. Autenticação necessária.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Descriptografa o token usando nossa chave secreta única do Docker
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        
        if user_id_str is None:
            raise credentials_exception
            
        # Converte a string de volta para o objeto UUID do Python
        user_id = uuid.UUID(user_id_str)
        
    except (JWTError, ValidationError, ValueError):
        raise credentials_exception
    
    # Executa a query assíncrona no Postgres para achar o usuário
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Este usuário foi desativado no sistema."
        )
        
    return user


# =========================================================================
# 🛡️ 3. VERIFICADORES DE CARGOS (ROLE-BASED ACCESS CONTROL - RBAC)
# =========================================================================
class RoleChecker:
    """
    Classe utilitária para travar rotas com base no cargo do usuário.
    Garante que técnicos não acessem rotas administrativas.
    """
    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado. Seu nível de permissão não autoriza esta operação."
            )
        return current_user

# Atalhos limpos para usar direto nos parâmetros das rotas:
require_admin = RoleChecker([UserRole.ADMIN])
require_technician = RoleChecker([UserRole.TECHNICIAN])
require_any_role = RoleChecker([UserRole.ADMIN, UserRole.TECHNICIAN])