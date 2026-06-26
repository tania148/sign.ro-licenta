from datetime import datetime
from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from baza_date.conexiune import BazaModele


class Utilizator(BazaModele):
    """Contul unui utilizator inregistrat in aplicatie."""
    __tablename__ = "utilizatori"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nume: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    parola_hash: Mapped[str]= mapped_column(String(256), nullable=False)
    data_inregistrare: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    #Relatii
    cuvinte_traduse: Mapped[list["CuvantTradus"]] = relationship("CuvantTradus", back_populates="utilizator", cascade="all, delete")
    progres_invatare: Mapped[list["ProgresInvatare"]] = relationship("ProgresInvatare", back_populates="utilizator", cascade="all, delete")
    date_antrenament: Mapped[list["DateAntrenament"]] = relationship("DateAntrenament", back_populates="utilizator", cascade="all, delete")
    streak_curent: Mapped[int] = mapped_column(Integer, default=0)
    data_ultima_activitate: Mapped[datetime|None] = mapped_column(DateTime, nullable=True)

class CuvantTradus(BazaModele):
    """Un cuvant format prin traducerea literelor ASL/LMG."""
    __tablename__ = "cuvinte_traduse"

    id:  Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_utilizator: Mapped[int] = mapped_column(Integer, ForeignKey("utilizatori.id"), nullable=False)
    text_cuvant: Mapped[str] = mapped_column(String(200), nullable=False)
    incredere_medie: Mapped[float] = mapped_column(Float, default=0.0)
    nr_litere: Mapped[int] = mapped_column(Integer, default=0)
    data_adaugare: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    utilizator: Mapped["Utilizator"] = relationship("Utilizator", back_populates="cuvinte_traduse")


class ProgresInvatare(BazaModele):
    """Progresul unui utilizator la invatarea unei anumite litere."""
    __tablename__ = "progres_invatare"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_utilizator: Mapped[int] = mapped_column(Integer, ForeignKey("utilizatori.id"), nullable=False)
    litera: Mapped[str] = mapped_column(String(1), nullable=False)
    incercari: Mapped[int] = mapped_column(Integer, default=0)
    reusit: Mapped[int] = mapped_column(Integer, default=0)
    data_actualizare: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    utilizator: Mapped["Utilizator"] = relationship("Utilizator", back_populates="progres_invatare")


class DateAntrenament(BazaModele):
    """Un esantion de repere (landmarks) inregistrat pentru antrenarea modelului."""
    __tablename__ = "date_antrenament"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_utilizator: Mapped[int] = mapped_column(Integer, ForeignKey("utilizatori.id"), nullable=False)
    litera: Mapped[str] = mapped_column(String(1), nullable=False, index=True)
    repere_json: Mapped[str] = mapped_column(Text, nullable=False)  #JSON: [[x,y,z]×21]
    data_inregistrare: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    utilizator: Mapped["Utilizator"] = relationship("Utilizator", back_populates="date_antrenament")
