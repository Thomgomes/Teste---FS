#Arquivo de Criação de tokens JWT e hash de senhas, além de funções de segurança relacionadas.

from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext

# Configura o Passlib para usar o algoritmo bcrypt para hashing de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 🔒 1. Função para gerar o hash seguro da senha do usuário
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# 🔑 2. Função para verificar se a senha digitada bate com o hash salvo no banco
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# 🎟️ 3. Função para gerar o Token de Acesso JWT
def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Importa o tempo padrão definido no nosso arquivo config.py
        from app.core.config import settings
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Monta a carga de dados (payload) do token
    to_encode = {"exp": expire, "sub": str(subject)}
    
    from app.core.config import settings
    # Encripta o token usando a chave secreta e o algoritmo HS256
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt