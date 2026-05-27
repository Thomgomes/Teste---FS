#Endpoint para Login

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.dependencies import get_db
from app.core import security
from app.core.config import settings
from app.db.models import User
from app.schemas.user import Token

router = APIRouter()

# =========================================================================
# 🎟️ ENDPOINT: LOGIN / GERAÇÃO DE TOKEN JWT
# =========================================================================
@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Token:
    """
    Rota de autenticação padrão OAuth2. 
    Recebe 'username' (que será o e-mail) e 'password', valida as credenciais
    e retorna um token JWT assinado para o cliente.
    """
    # 1. Busca o usuário no banco de dados pelo e-mail informado
    query = select(User).where(User.email == form_data.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    
    # 2. Valida se o usuário existe e se a senha digitada bate com o hash criptografado
    if user is None or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail ou senha incorretos."
        )
    
    # 3. Verifica se o usuário está ativo no sistema
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este usuário foi desativado pelo administrador."
        )
    
    # 4. Define o tempo de expiração do token (configurado para 7 dias no core/config)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # 5. Cria o token passando o ID (UUID) do usuário convertido para string como 'subject'
    token_jwt = security.create_access_token(
        subject=str(user.id), 
        expires_delta=access_token_expires
    )
    
    # 6. Retorna o schema Token preenchido exatamente como o front-end espera
    return Token(
        access_token=token_jwt,
        token_type="bearer",
        role=user.role.value,  # Retorna o valor em português ('admin' ou 'tecnico')
        name=user.name
    )