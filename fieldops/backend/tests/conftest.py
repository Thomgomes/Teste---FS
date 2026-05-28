import asyncio
import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGIIterport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.core.config import settings
from app.db.base_class import Base
from app.api.dependencies import get_db
from app.core import security
from app.db import models

# Força o pytest a rodar os testes assíncronos no mesmo loop de eventos
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# 🛢️ Fixture para criar uma sessão de banco isolada para os testes
@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    # Usaremos o mesmo engine configurado, mas abrindo uma transação isolada
    from app.db.database import engine
    async with engine.begin() as conn:
        # Garante que as tabelas estão limpas/prontas para o cenário do teste
        await conn.run_sync(Base.metadata.create_all)
        
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)()
    try:
        yield async_session
    finally:
        # Dá rollback forçado para o teste anterior não sujar o próximo
        await async_session.rollback()
        await async_session.close()

# 🚀 Fixture que monta o cliente HTTP para disparar requisições contra o FastAPI
@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    # Sobrescreve a dependência do get_db do FastAPI para usar a nossa sessão controlada de teste
    async def _override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = _override_get_db
    
    # Criamos o cliente HTTP assíncrono apontando para o app FastAPI
    async with AsyncClient(transport=ASGIIterport(app), base_url="http://test") as ac:
        yield ac
        
    # Limpa a sobrescrita após o término do teste
    app.dependency_overrides.clear()

# 👥 FIXTURE EXTRA: Cria uma empresa e usuários fake para os testes usarem de munição
@pytest.fixture(scope="function")
async def test_data(db_session: AsyncSession):
    # Empresa Teste
    company = models.Company(name="Empresa Teste LTDA", cnpj="99999999000199")
    db_session.add(company)
    await db_session.flush()

    # Admin Teste
    admin = models.User(
        company_id=company.id,
        name="Admin Teste",
        email="admin.teste@test.com",
        password_hash=security.get_password_hash("senha123"),
        role=models.UserRole.ADMIN
    )
    # Técnico Teste
    tech = models.User(
        company_id=company.id,
        name="Tech Teste",
        email="tech.teste@test.com",
        password_hash=security.get_password_hash("senha123"),
        role=models.UserRole.TECHNICIAN
    )
    db_session.add_all([admin, tech])
    await db_session.flush()

    # Cria os tokens JWT correspondentes para os cabeçalhos de autorização
    admin_token = security.create_access_token(subject=str(admin.id))
    tech_token = security.create_access_token(subject=str(tech.id))

    await db_session.commit()

    return {
        "company": company,
        "admin": admin,
        "tech": tech,
        "headers_admin": {"Authorization": f"Bearer {admin_token}"},
        "headers_tech": {"Authorization": f"Bearer {tech_token}"}
    }