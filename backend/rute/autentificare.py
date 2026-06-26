from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from baza_date.conexiune import obtine_sesiune_db
from baza_date.modele import Utilizator
from scheme.autentificare import CerereInregistrare, CerereConectare, RaspunsAutentificare, RaspunsUtilizator
from servicii.autentificareServiciu import hash_parola, verifica_parola, creeaza_token_jwt

router=APIRouter(prefix="/auth", tags=["Autentificare"])


@router.post("/inregistrare", response_model=RaspunsAutentificare, status_code=status.HTTP_201_CREATED)
def inregistreaza_utilizator(
    cerere: CerereInregistrare,
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Creeaza un cont nou. Returneaza utilizatorul creat si un token JWT."""
    # Verificam daca email-ul exista deja
    utilizatorExistent=sesiune_db.query(Utilizator).filter(
        Utilizator.email==cerere.email.lower()
    ).first()

    if utilizatorExistent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Exista deja un cont cu aceasta adresa de email.",
        )

    utilizatorNou=Utilizator(
        nume=cerere.nume.strip(),
        email=cerere.email.lower().strip(),
        parola_hash=hash_parola(cerere.parola),
    )
    sesiune_db.add(utilizatorNou)
    sesiune_db.commit()
    sesiune_db.refresh(utilizatorNou)

    tokenJWT=creeaza_token_jwt({"sub": str(utilizatorNou.id)})

    return RaspunsAutentificare(
        utilizator=RaspunsUtilizator.model_validate(utilizatorNou),
        token=tokenJWT,
    )


@router.post("/conectare", response_model=RaspunsAutentificare)
def conecteaza_utilizator(
    cerere: CerereConectare,
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Autentifica un utilizator existent. Returneaza token JWT."""
    utilizatorGasit=sesiune_db.query(Utilizator).filter(
        Utilizator.email==cerere.email.lower()
    ).first()

    if not utilizatorGasit or not verifica_parola(cerere.parola, utilizatorGasit.parola_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email sau parola incorecta.",
        )

    tokenJWT=creeaza_token_jwt({"sub": str(utilizatorGasit.id)})

    return RaspunsAutentificare(
        utilizator=RaspunsUtilizator.model_validate(utilizatorGasit),
        token=tokenJWT,
    )
