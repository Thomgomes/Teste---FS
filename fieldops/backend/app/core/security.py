#Arquivo de Criação de tokens JWT e hash de senhas, além de funções de segurança relacionadas.

from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
import bcrypt  # <--- Usaremos o pacote nativo direto, eliminando o passlib que está quebrado

# 🔒 1. Função para gerar o hash seguro da senha do usuário
def get_password_hash(password: str) -> str:
    # Converte a senha em texto puro para bytes
    password_bytes = password.encode('utf-8')
    # Gera o salt e o hash de forma nativa e performática
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    # Devolve como string para salvar no Postgres
    return hashed.decode('utf-8')

# 🔑 2. Função para verificar se a senha digitada bate com o hash salvo no banco
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

# 🎟️ 3. Função para gerar o Token de Acesso JWT (Continua igual)
def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        from app.core.config import settings
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    
    from app.core.config import settings
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)
    return encoded_jwt