#Endpoint para gerenciamento de visitas, incluindo criação, leitura, atualização e cancelamento de visitas.

import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_db, get_current_user, require_admin, require_any_role
from app.db import models
from app.schemas.visit import VisitCreate, VisitResponse

router = APIRouter()

# Pasta local dentro do container onde as fotos da V1 serão salvas fisicamente
UPLOAD_DIR = "/app/uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# =========================================================================
# 📝 1. ENDPOINT: CRIAR UMA NOVA VISITA (EXCLUSIVO ADMIN - ASYNC)
# =========================================================================
@router.post("/", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    payload: VisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_admin)
) -> models.Visit:
    
    tech_query = select(models.User).where(
        and_(
            models.User.id == payload.technician_id,
            models.User.company_id == current_user.company_id,
            models.User.role == models.UserRole.TECHNICIAN
        )
    )
    result = await db.execute(tech_query)
    technician = result.scalar_one_or_none()
    
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O técnico designado não foi encontrado ou não pertence à sua empresa."
        )

    new_visit = models.Visit(
        company_id=current_user.company_id,
        technician_id=payload.technician_id,
        client_name=payload.client_name,
        address=payload.address,
        status=models.VisitStatus.SCHEDULED,
        scheduled_at=payload.scheduled_at,
        public_token=uuid.uuid4()
    )
    
    initial_event = models.VisitEvent(
        company_id=current_user.company_id,
        visit=new_visit,
        event_type="AGENDADA",
        description=f"Visita agendada pelo administrador: {current_user.name}",
        idempotency_key=f"init-{uuid.uuid4()}"
    )
    
    db.add_all([new_visit, initial_event])
    await db.commit()
    
    # Em vez do refresh cego, fazemos uma query explícita trazendo as tabelas filhas de forma segura
    refresh_query = (
        select(models.Visit)
        .where(models.Visit.id == new_visit.id)
        .options(
            selectinload(models.Visit.events),
            selectinload(models.Visit.attachments),
            selectinload(models.Visit.technician)
        )
    )
    refresh_result = await db.execute(refresh_query)
    visit_pronta = refresh_result.scalar_one()
    
    return visit_pronta

# arrumar o nome escrito nessa coisa aq em cima


# =========================================================================
# 📋 2. ENDPOINT: LISTAR VISITAS COM FILTROS (ADMIN OU TÉCNICO - ASYNC)
# =========================================================================
@router.get("/", response_model=List[VisitResponse])
async def list_visits(
    status_filter: Optional[str] = Query(None, alias="status"),
    tech_id_filter: Optional[str] = Query(None, alias="technician_id"),
    date_filter: Optional[str] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role)
) -> List[models.Visit]:
    
    filters = [models.Visit.company_id == current_user.company_id]
    
    if current_user.role == models.UserRole.TECHNICIAN:
        filters.append(models.Visit.technician_id == current_user.id)
    elif tech_id_filter:
        try:
            filters.append(models.Visit.technician_id == uuid.UUID(tech_id_filter))
        except ValueError:
            pass
        
    if status_filter:
        filters.append(models.Visit.status == status_filter)
        
    if date_filter:
        try:
            from datetime import datetime, time
            # O input type="date" do HTML devolve no formato "YYYY-MM-DD"
            parsed_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            
            # Define o início (00:00:00) e o fim (23:59:59) daquele dia para a busca na tabela
            start_datetime = datetime.combine(parsed_date, time.min)
            end_datetime = datetime.combine(parsed_date, time.max)
            
            filters.append(models.Visit.scheduled_at.between(start_datetime, end_datetime))
        except ValueError:
            # Caso venha uma string de data corrompida, ignora silenciosamente para não quebrar o app
            pass
    # selectinload garante o carregamento assíncrono das tabelas filhas (evita erro de LazyLoading)
    query = (
        select(models.Visit)
        .where(and_(*filters))
        .options(selectinload(models.Visit.events), selectinload(models.Visit.attachments), selectinload(models.Visit.technician))
        .order_by(models.Visit.scheduled_at.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()

# =========================================================================
# 👥 2.1 ENDPOINT: LISTAR TÉCNICOS PARA O COMBO DO FILTRO (COLE AQUI)
# =========================================================================
@router.get("/technicians-list", response_model=List[dict])
async def list_company_technicians(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    query = select(models.User.id, models.User.name).where(
        and_(
            models.User.company_id == current_user.company_id,
            models.User.role == models.UserRole.TECHNICIAN
        )
    )
    result = await db.execute(query)
    rows = result.all()
    return [{"id": str(row.id), "name": row.name} for row in rows]


# =========================================================================
# 📸 3. ENDPOINT: ANEXAR FOTO À VISITA (EXCLUSIVO TÉCNICO - ASYNC DE DISCO)
# =========================================================================
@router.post("/{visit_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_visit_photo(
    visit_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role)
):
    """
    Recebe o binário da foto enviado pelo técnico, salva em disco de forma não-bloqueante
    e vincula o caminho à tabela visit_attachments respeitando o Tenant.
    """
    # 1. Verifica se a visita existe e pertence ao tenant logado
    query = select(models.Visit).where(
        and_(models.Visit.id == visit_id, models.Visit.company_id == current_user.company_id)
    )
    result = await db.execute(query)
    visit = result.scalar_one_or_none()

    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visita não encontrada ou acesso negado."
        )

    # 2. Gera um nome único para o arquivo para evitar colisões em disco
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # 3. Leitura e escrita assíncronas do binário do arquivo
    try:
        contents = await file.read() # Consome o stream de dados de forma async
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao persistir o arquivo de imagem no servidor local."
        )

    # 4. Grava a referência na tabela de anexos do Postgres de forma assíncrona
    new_attachment = models.VisitAttachment(
        company_id=current_user.company_id,
        visit_id=visit.id,
        file_url=f"/static/uploaded_images/{unique_filename}" # URL simulada que o front vai ler
    )
    
    # Gera um log de evento na timeline notificando o anexo
    attachment_event = models.VisitEvent(
        company_id=current_user.company_id,
        visit_id=visit.id,
        event_type="ANEXO_FOTO",
        description=f"Foto de comprovação técnica anexada por: {current_user.name}",
        idempotency_key=f"attach-{uuid.uuid4()}"
    )

    db.add_all([new_attachment, attachment_event])
    await db.commit()

    return {
        "mensagem": "Foto anexada com sucesso absoluto na V1 local!",
        "file_url": new_attachment.file_url
    }
    
# =========================================================================
# 🔍 4. ENDPOINT: BUSCAR UMA VISITA ESPECÍFICA POR ID (ADMIN OU TÉCNICO)
# =========================================================================
@router.get("/{visit_id}", response_model=VisitResponse)
async def get_visit_by_id(
    visit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role)
):
    query = (
        select(models.Visit)
        .where(
            and_(
                models.Visit.id == visit_id, 
                models.Visit.company_id == current_user.company_id
            )
        )
        .options(
            selectinload(models.Visit.events),
            selectinload(models.Visit.attachments),
            selectinload(models.Visit.technician)
        )
    )
    result = await db.execute(query)
    visit = result.scalar_one_or_none()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Ordem de serviço não localizada no sistema."
        )
        
    return visit