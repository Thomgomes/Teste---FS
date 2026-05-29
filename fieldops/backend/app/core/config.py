#Arquivo de configuração,validação e carregamento de variáveis de ambiente.

import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "FieldOps Platform"
    

    JWT_SECRET: str = os.getenv("JWT_SECRET", "super_segredo_temporario_desenvolvimento_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  


    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "http://storage:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minio_admin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minio_password")

settings = Settings()