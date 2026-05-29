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

UPLOAD_DIR = "/app/uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
    visit_complete = refresh_result.scalar_one()
    
    return visit_complete

# arrumar o nome escrito nessa coisa aq em cima


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
            parsed_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            
            start_datetime = datetime.combine(parsed_date, time.min)
            end_datetime = datetime.combine(parsed_date, time.max)
            
            filters.append(models.Visit.scheduled_at.between(start_datetime, end_datetime))
        except ValueError:
            pass
    query = (
        select(models.Visit)
        .where(and_(*filters))
        .options(selectinload(models.Visit.events), selectinload(models.Visit.attachments), selectinload(models.Visit.technician))
        .order_by(models.Visit.scheduled_at.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()

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


@router.post("/{visit_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_visit_photo(
    visit_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role)
):
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

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao persistir o arquivo de imagem no servidor local."
        )

    new_attachment = models.VisitAttachment(
        company_id=current_user.company_id,
        visit_id=visit.id,
        file_url=f"/static/uploaded_images/{unique_filename}" 
    )
    
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

@router.patch("/{visit_id}/cancel", response_model=VisitResponse)
async def cancel_visit(
    visit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    query = (
        select(models.Visit)
        .where(and_(models.Visit.id == visit_id, models.Visit.company_id == current_user.company_id))
        .options(selectinload(models.Visit.events), selectinload(models.Visit.attachments), selectinload(models.Visit.technician))
    )
    result = await db.execute(query)
    visit = result.scalar_one_or_none()

    if not visit:
        raise HTTPException(status_code=404, detail="Visita não localizada.")

    if visit.status == models.VisitStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Impossível cancelar uma ordem de serviço já concluída.")

    visit.status = models.VisitStatus.CANCELED
    
    cancel_event = models.VisitEvent(
        company_id=current_user.company_id,
        visit_id=visit.id,
        event_type="CANCELADA",
        description=f"Ordem de serviço cancelada via Central Admin por: {current_user.name}",
        idempotency_key=f"cancel-{uuid.uuid4()}"
    )
    
    db.add(cancel_event)
    await db.commit()
    return visit