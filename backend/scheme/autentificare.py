from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class CerereInregistrare(BaseModel):
    nume: str = Field(min_length=3, max_length=100)
    email: EmailStr
    parola: str = Field(min_length=6)


class CerereConectare(BaseModel):
    email: EmailStr
    parola: str


class RaspunsUtilizator(BaseModel):
    id: int
    nume: str
    email: str
    data_inregistrare:  datetime

    model_config = {"from_attributes": True}


class RaspunsAutentificare(BaseModel):
    utilizator: RaspunsUtilizator
    token: str
