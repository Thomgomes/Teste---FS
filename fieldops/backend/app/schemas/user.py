#Arquivo do schema para validar os dados do usuário (Login/Cadastro).

from uuid import UUID
from pydantic import BaseModel, EmailStr, Field
from app.db.models import UserRole

class UserBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    email: EmailStr = Field(..., max_length=255)
    role: UserRole

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=50)
    company_id: UUID

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str

class UserResponse(UserBase):
    id: UUID
    company_id: UUID
    is_active: bool

    class Config:
        from_attributes = True