#Arquivo de seeds ( Dados iniciais ) para o banco de dados

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core import security
from app.db import models

async def run_seeds(db: AsyncSession) -> None:
    """
    Executa a carga inicial de dados exigida pelo escopo da prova.
    Garante o provisionamento automático de 1 Empresa, 2 Usuários e 10 Visitas.
    """
    # 1. Checa se o banco já possui dados para evitar duplicidade no reload
    query_check = select(models.Company)
    result_check = await db.execute(query_check)
    if result_check.scalars().first() is not None:
        print("🌱 [SEEDS] Banco de dados já possui registros. Operação abortada.")
        return

    print("🌱 [SEEDS] Banco vazio detectado. Injetando massa de teste obrigatória...")

    # 2. Criar 1 Empresa Piloto
    company = models.Company(
        name="FieldOps Soluções Industriais",
        cnpj="12345678000199"
    )
    db.add(company)
    await db.flush()  # Gera o UUID da empresa na memória

    # 3. Criar 2 Usuários (1 Admin e 1 Técnico)
    admin_user = models.User(
        company_id=company.id,
        name="Thomás Administrador",
        email="admin@fieldops.com.br",
        password_hash=security.get_password_hash("admin123"),
        role=models.UserRole.ADMIN
    )
    tech_user = models.User(
        company_id=company.id,
        name="Carlos Técnico de Campo",
        email="tech@fieldops.com.br",
        password_hash=security.get_password_hash("tech123"),
        role=models.UserRole.TECHNICIAN
    )
    db.add_all([admin_user, tech_user])
    await db.flush()

    # 4. Criar 10 Visitas distribuídas nos estados do seu Enum
    status_list = [
        (models.VisitStatus.SCHEDULED, "Instalação de Roteador Comercial", "Clínica Sorriso - Av. Paulista, 1000"),
        (models.VisitStatus.SCHEDULED, "Manutenção Preventiva de Ar Condicionado", "Banco Central - Rua da Aurora, 450"),
        (models.VisitStatus.IN_DISPLACEMENT, "Reparo de Fibra Óptica", "Escola Aprendiz - Av. Norte, 2300"),
        (models.VisitStatus.IN_DISPLACEMENT, "Troca de Disjuntor Geral", "Condomínio Alvorada - Bloco B Apt 104"),
        (models.VisitStatus.IN_PROGRESS, "Vistoria Técnico de Segurança", "Supermercado Preço Bom - Galpão 3"),
        (models.VisitStatus.IN_PROGRESS, "Configuração de Servidor Local", "Advocacia Associados - Sala 402"),
        (models.VisitStatus.COMPLETED, "Auditoria de Equipamentos", "Indústria Metalúrgica - Distrito Industrial"),
        (models.VisitStatus.COMPLETED, "Reparo em Sistema de Câmeras", "Residência Cláudio - Rua das Flores, 88"),
        (models.VisitStatus.CANCELED, "Chamado Técnico Urgente - Cancelado", "Logística Express - Galpão Central"),
        (models.VisitStatus.CANCELED, "Substituição de Cabeamento Técnico", "Shopping Center - Loja 15")
    ]

    for i, (status_type, client, addr) in enumerate(status_list):
        visit = models.Visit(
            company_id=company.id,
            technician_id=tech_user.id,
            client_name=client,
            address=addr,
            status=status_type,
            scheduled_at=datetime.utcnow() + timedelta(days=i - 5)
        )
        db.add(visit)

    await db.commit()
    print("[SEEDS] Carga inicial realizada com sucesso absoluto!")