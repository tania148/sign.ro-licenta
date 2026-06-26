from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from configurare import URL_BAZA_DATE

motor_db = create_engine(
    URL_BAZA_DATE,
    connect_args={"check_same_thread": False},  #necesar pentru SQLite cu FastAPI
)

FabricaSesiune = sessionmaker(autocommit=False, autoflush=False, bind=motor_db)


class BazaModele(DeclarativeBase):
    pass


def obtine_sesiune_db():
    """Dependinta FastAPI - furnizeaza o sesiune DB si o inchide dupa request."""
    sesiune = FabricaSesiune()
    try:
        yield sesiune
    finally:
        sesiune.close()
