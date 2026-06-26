from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


#Cuvinte traduse

class CerereSalvareCuvant(BaseModel):
    cuvant: str = Field(min_length=1, max_length=200)
    incredere_medie: float = Field(ge=0.0, le=1.0, default=0.0)


class RaspunsCuvant(BaseModel):
    id:  int
    text_cuvant: str
    incredere_medie: float
    nr_litere: int
    data_adaugare: datetime

    model_config = {"from_attributes": True}


class RaspunsListaCuvinte(BaseModel):
    cuvinte: list[RaspunsCuvant]
    total: int
    pagina: int
    pagini: int


#Date antrenament

class CerereColectareEsantion(BaseModel):
    litera: str  = Field(min_length=1, max_length=1)
    repere: list[list[float]]  #[[x,y,z] × 21 puncte]


class RaspunsColectare(BaseModel):
    mesaj: str
    litera: str
    total_esantioane: int


class StatisticiAntrenament(BaseModel):
    esantioane_per_litera: dict[str, int]
    total_esantioane: int
    litere_gata_de_antrenare: list[str]
    model_antrenat: bool
    acuratete_model: Optional[float] = None


#Progres invatare

class CerereActualizareProgres(BaseModel):
    litera: str = Field(min_length=1, max_length=1)
    reusita: bool
