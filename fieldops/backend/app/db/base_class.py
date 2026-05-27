#arquivo da Classe Base do SQLAlchemy para o ORM, garantindo que todas as models herdem dela.

from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass