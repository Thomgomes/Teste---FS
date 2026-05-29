import asyncio
import pytest
import pytest_asyncio

import random

from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.main import app
from app.api.dependencies import get_db
from app.db.base_class import Base
from app.core import security
from app.db import models

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    from app.db.database import engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)()
    
    try:
        yield async_session
    finally:
        await async_session.rollback()
        await async_session.close()

@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = _override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def test_data(db_session: AsyncSession):
    rand_suffix = random.randint(1000, 9999)
    
    company_a = models.Company(name="Empresa Alfa Logística", cnpj=f"1111111100{rand_suffix}")
    db_session.add(company_a)
    await db_session.flush()

    admin_a = models.User(
        company_id=company_a.id,
        name="Admin Alfa",
        email=f"admin.alfa_{rand_suffix}@fieldops.com.br",
        password_hash=security.get_password_hash("senha123"),
        role=models.UserRole.ADMIN
    )
    tech_a = models.User(
        company_id=company_a.id,
        name="Técnico Alfa",
        email=f"tech.alfa_{rand_suffix}@fieldops.com.br",
        password_hash=security.get_password_hash("senha123"),
        role=models.UserRole.TECHNICIAN
    )
    db_session.add_all([admin_a, tech_a])
    await db_session.flush()

    company_b = models.Company(name="Empresa Beta Vistorias", cnpj=f"2222222200{rand_suffix}")
    db_session.add(company_b)
    await db_session.flush()

    tech_b = models.User(
        company_id=company_b.id,
        name="Técnico Beta",
        email=f"tech.beta_{rand_suffix}@fieldops.com.br",
        password_hash=security.get_password_hash("senha123"),
        role=models.UserRole.TECHNICIAN
    )
    db_session.add(tech_b)
    await db_session.flush()

    token_admin_a = security.create_access_token(subject=str(admin_a.id))
    token_tech_a = security.create_access_token(subject=str(tech_a.id))
    token_tech_b = security.create_access_token(subject=str(tech_b.id))

    await db_session.commit()

    return {
        "company_a": company_a,
        "company_b": company_b,
        "admin_a": admin_a,
        "tech_a": tech_a,
        "tech_b": tech_b,
        "headers_admin_a": {"Authorization": f"Bearer {token_admin_a}"},
        "headers_tech_a": {"Authorization": f"Bearer {token_tech_a}"},
        "headers_tech_b": {"Authorization": f"Bearer {token_tech_b}"}
    }