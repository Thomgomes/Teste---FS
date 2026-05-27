from fastapi import FastAPI, Depends  # 🌟 Adicione o ", Depends" aqui!
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import engine
from app.db.base_class import Base
from app.db import models 

from app.api.dependencies import get_db

from app.api.endpoints import auth

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Autenticação"])

# 🚀 Evento que roda assim que o FastAPI inicializa
@app.on_event("startup")
async def startup_event():
    print("====== INICIALIZANDO BANCO DE DADOS ======")
    async with engine.begin() as conn:
        # Esse comando cria FISICAMENTE todas as tabelas no Postgres se elas não existirem
        await conn.run_sync(Base.metadata.create_all)
    print("====== TABELAS CRIADAS COM SUCESSO ======")

@app.get("/")
async def root(db: AsyncSession = Depends(get_db)):
    query = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    result = await db.execute(query)
    tabelas = [row[0] for row in result.fetchall()]
    
    return {
        "status": "A API do FieldOps está viva e com banco estruturado!",
        "tabelas_no_postgres": tabelas
    }