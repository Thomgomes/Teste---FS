#Endpoint para gerenciamento de visitas, incluindo criação, leitura, atualização e cancelamento de visitas.

from datetime import datetime
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.dependencies import get_db, get_current_user, require_admin, require_any_role
from app.db import models
from app.schemas.visit import VisitCreate, VisitResponse

router = APIRouter()

# =========================================================================
# 📝 1. ENDPOINT: CRIAR UMA NOVA VISITA (EXCLUSIVO ADMIN)
# =========================================================================
@router.post("/", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    payload: VisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_admin) # Garante que apenas administradores acessem
) -> models.Visit:
    """
    Cria e agenda uma nova visita técnica.
    O 'company_id' é injetado automaticamente a partir do token do administrador logado,
    garantindo que ele não possa criar visitas para outra empresa.
    """
    # Valida se o técnico designado pertence à MESMA empresa do administrador
    tech_query = select(models.User).where(
        and_(
            models.User.id == payload.technician_id,
            models.User.company_id == current_user.company_id,
            models.User.role == models.UserRole.TECHNICIAN
        )
    )
    tech_result = await db.execute(tech_query)
    technician = tech_result.scalar_one_or_none()
    
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O técnico designado não foi encontrado ou não pertence à sua empresa."
        )

    # Instancia a visita espelhando os campos exatos do DBML da Parte 1
    new_visit = models.Visit(
        company_id=current_user.company_id, # Injeção automática de tenant
        technician_id=payload.technician_id,
        client_name=payload.client_name,
        address=payload.address,
        status=models.VisitStatus.SCHEDULED, # Toda visita nasce agendada
        scheduled_at=payload.scheduled_at,
        public_token=uuid.uuid4() # Gera o token único de acompanhamento do cliente
    )
    
    # Registra o evento inicial na timeline da visita
    initial_event = models.VisitEvent(
        company_id=current_user.company_id,
        visit=new_visit,
        event_type="AGENDADA",
        description=f"Visita agendada pelo administrador: {current_user.name}",
        idempotency_key=f"init-seed-{uuid.uuid4()}" # Chave única para o evento de criação
    )
    
    db.add_all([new_visit, initial_event])
    await db.commit()
    await db.refresh(new_visit)
    return new_visit


# =========================================================================
# 📋 2. ENDPOINT: LISTAR VISITAS COM FILTROS (ADMIN OU TÉCNICO)
# =========================================================================
@router.get("/", response_model=List[VisitResponse])
async def list_visits(
    status_filter: Optional[models.VisitStatus] = Query(None, alias="status"),
    tech_id_filter: Optional[uuid.UUID] = Query(None, alias="technician_id"),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role) # Qualquer usuário autenticado pode listar
) -> List[models.Visit]:
    """
    Lista as visitas aplicando regras estritas de visibilidade por papel:
    - Admin: Vê todas as visitas da sua respectiva empresa.
    - Técnico: Vê apenas as visitas atribuídas a ele próprio dentro da empresa.
    """
    # Base da query travando o isolamento de Tenant (Multi-tenant)
    filters = [models.Visit.company_id == current_user.company_id]
    
    # Se for técnico, restringe o filtro para trazer apenas os registros dele
    if current_user.role == models.UserRole.TECHNICIAN:
        filters.append(models.Visit.technician_id == current_user.id)
    elif tech_id_filter:
        # Se for admin e passou o filtro de técnico, aplica a busca
        filters.append(models.Visit.technician_id == tech_id_filter)
        
    if status_filter:
        filters.append(models.Visit.status == status_filter)
        
    query = select(models.Visit).where(and_(*filters)).order_by(models.Visit.scheduled_at.asc())
    result = await db.execute(query)
    return result.scalars().all()


# =========================================================================
# 🔍 3. ENDPOINT: DETALHAR UMA VISITA COM TIMELINE (ADMIN OU TÉCNICO)
# =========================================================================
@router.get("/{visit_id}", response_model=VisitResponse)
async def get_visit_by_id(
    visit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(require_any_role)
) -> models.Visit:
    """
    Recupera os dados completos de uma visita específica, incluindo sua timeline.
    Garante que técnicos não acessem visitas alheias.
    """
    query = select(models.Visit).where(
        and_(
            models.Visit.id == visit_id,
            models.Visit.company_id == current_user.company_id
        )
    )
    result = await db.execute(query)
    visit = result.scalar_one_or_none()
    
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visita não encontrada no sistema."
        )
        
    # Barreira de segurança adicional para técnicos
    if current_user.role == models.UserRole.TECHNICIAN and visit.technician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Você não é o técnico designado para esta visita."
        )
        
    return visit