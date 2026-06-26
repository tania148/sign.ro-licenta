import bcrypt
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from configurare import CHEIE_SECRETA_JWT, ALGORITM_JWT, EXPIRARE_TOKEN_MINUTE
from baza_date.conexiune import obtine_sesiune_db
from baza_date.modele import Utilizator

schemaBearerToken=HTTPBearer()


def hash_parola(parola_clara: str) -> str:
    """Returneaza hash-ul bcrypt al unei parole in clar."""
    parola_bytes = parola_clara.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(parola_bytes, salt).decode('utf-8')


def verifica_parola(parola_clara: str, parola_hash: str) -> bool:
    """Verifica daca o parola in clar corespunde hash-ului salvat."""
    try:
        return bcrypt.checkpw(
            parola_clara.encode('utf-8'),
            parola_hash.encode('utf-8')
        )
    except Exception:
        return False


def creeaza_token_jwt(date_payload: dict) -> str:
    """Genereaza un token JWT cu data de expirare."""
    payload_de_semnat = date_payload.copy()
    data_expirare = datetime.now(timezone.utc) + timedelta(minutes=EXPIRARE_TOKEN_MINUTE)
    payload_de_semnat["exp"] = data_expirare
    return jwt.encode(payload_de_semnat, CHEIE_SECRETA_JWT, algorithm=ALGORITM_JWT)


def decodifica_token_jwt(token: str) -> dict:
    """Decodifica si valideaza un token JWT."""
    try:
        payload = jwt.decode(token, CHEIE_SECRETA_JWT, algorithms=[ALGORITM_JWT])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid sau expirat.",
        )


def obtine_utilizator_curent(
    credentiale: HTTPAuthorizationCredentials = Depends(schemaBearerToken),
    sesiune_db: Session = Depends(obtine_sesiune_db),
) -> Utilizator:
    """Dependinta FastAPI — extrage utilizatorul autentificat din token-ul JWT."""
    payload = decodifica_token_jwt(credentiale.credentials)
    id_utilizator = payload.get("sub")

    if id_utilizator is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalid.")

    utilizator = sesiune_db.get(Utilizator, int(id_utilizator))
    if utilizator is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilizatorul nu mai exista.")

    return utilizator