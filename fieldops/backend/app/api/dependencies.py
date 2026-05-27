#Arquivo de dependências para o FastAPI, incluindo funções para obter sessão do banco de dados e validar tokens JWT.

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import AsyncSessionLocal

# 🛢️ O Gerenciador de Sessão do Banco que o main.py está procurando
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()