import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from baza_date.conexiune import obtine_sesiune_db
from baza_date.modele import Utilizator, DateAntrenament
from scheme.cuvinte import CerereColectareEsantion, RaspunsColectare, StatisticiAntrenament
from servicii.autentificareServiciu import obtine_utilizator_curent
from servicii import clasificatorServiciu
from configurare import LITERE_VALIDE, MINIM_ESANTIOANE_LITERA, EMAIL_ADMIN

router=APIRouter(prefix="/antrenament", tags=["Antrenament"])


def verifica_admin(utilizator_curent: Utilizator):
    """Verifica daca utilizatorul curent este administratorul aplicatiei."""
    if utilizator_curent.email!=EMAIL_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces permis doar administratorului.",
        )


@router.post("/colecteaza", response_model=RaspunsColectare)
def colecteaza_esantion_antrenament(
    cerere: CerereColectareEsantion,
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Salveaza un esantion de repere pentru o litera. Doar admin."""
    verifica_admin(utilizator_curent)

    litera=cerere.litera.upper().strip()

    if litera not in LITERE_VALIDE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Litera '{litera}' nu este valida. Litere acceptate: A-Z.",
        )

    if len(cerere.repere) != 21:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sunt necesare exact 21 repere. Primit: {len(cerere.repere)}.",
        )

    esantionNou=DateAntrenament(
        id_utilizator=utilizator_curent.id,
        litera=litera,
        repere_json=json.dumps(cerere.repere),
    )
    sesiune_db.add(esantionNou)
    sesiune_db.commit()

    totalEsantioanePentruLitera=sesiune_db.query(func.count(DateAntrenament.id)).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id,
        DateAntrenament.litera==litera,
    ).scalar()

    return RaspunsColectare(
        mesaj=f"Esantion salvat pentru litera {litera}.",
        litera=litera,
        total_esantioane=totalEsantioanePentruLitera,
    )


@router.post("/antreneaza")
def antreneaza_modelul(
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Antreneaza modelul pe esantioanele colectate. Doar admin."""
    verifica_admin(utilizator_curent)

    toateEsantioanele=sesiune_db.query(DateAntrenament).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id
    ).all()

    if not toateEsantioanele:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nu exista esantioane. Colecteaza date mai intai.",
        )

    esantioanePeLitera = {}
    for esantion in toateEsantioanele:
        esantioanePeLitera[esantion.litera]=esantioanePeLitera.get(esantion.litera, 0) + 1

    litereInsuficiente = [
        f"{l} ({n}/{MINIM_ESANTIOANE_LITERA})"
        for l, n in esantioanePeLitera.items()
        if n < MINIM_ESANTIOANE_LITERA
    ]

    if litereInsuficiente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Esantioane insuficiente pentru: {', '.join(litereInsuficiente)}. Necesar: {MINIM_ESANTIOANE_LITERA} per litera.",
        )

    listaRepere=[json.loads(e.repere_json) for e in toateEsantioanele]
    listaEtichete=[e.litera for e in toateEsantioanele]

    try:
        rezultatAntrenare=clasificatorServiciu.antreneaza_model(listaRepere, listaEtichete)
    except Exception as eroare:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la antrenare: {str(eroare)}",
        )

    return {"mesaj": "Modelul a fost antrenat cu succes!", **rezultatAntrenare}


@router.get("/statistici", response_model=StatisticiAntrenament)
def obtine_statistici_antrenament(
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Returneaza statisticile despre datele colectate. Doar admin."""
    verifica_admin(utilizator_curent)

    randuri=sesiune_db.query(
        DateAntrenament.litera,
        func.count(DateAntrenament.id).label("nr"),
    ).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id
    ).group_by(DateAntrenament.litera).all()

    esantioanePeLitera={rand.litera: rand.nr for rand in randuri}
    totalEsantioane=sum(esantioanePeLitera.values())
    litereGata=[l for l, n in esantioanePeLitera.items() if n >= MINIM_ESANTIOANE_LITERA]

    return StatisticiAntrenament(
        esantioane_per_litera=esantioanePeLitera,
        total_esantioane=totalEsantioane,
        litere_gata_de_antrenare=sorted(litereGata),
        model_antrenat=clasificatorServiciu.este_model_antrenat(),
        acuratete_model=clasificatorServiciu.obtine_acuratete_model(),
    )

@router.delete("/sterge-esantioane/{litera}")
def sterge_esantioane_litera(
    litera: str,
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Sterge esantioanele pentru o litera. Doar admin."""
    verifica_admin(utilizator_curent)

    litera = litera.upper().strip()
    nr_sterse = sesiune_db.query(DateAntrenament).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id,
        DateAntrenament.litera==litera,
    ).delete()
    sesiune_db.commit()
    return {"mesaj": f"Au fost sterse {nr_sterse} esantioane pentru litera {litera}."} 

@router.delete("/sterge-ultimul/{litera}")
def sterge_ultimul_esantion(
    litera: str,
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Sterge ultimul esantion colectat pentru o litera. Doar admin."""
    verifica_admin(utilizator_curent)

    litera=litera.upper().strip()
    ultimul=sesiune_db.query(DateAntrenament).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id,
        DateAntrenament.litera==litera,
    ).order_by(DateAntrenament.id.desc()).first()

    if not ultimul:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nu exista esantioane pentru litera {litera}.",
        )

    sesiune_db.delete(ultimul)
    sesiune_db.commit()

    total=sesiune_db.query(func.count(DateAntrenament.id)).filter(
        DateAntrenament.id_utilizator==utilizator_curent.id,
        DateAntrenament.litera==litera,
    ).scalar()

    return {"mesaj": f"Ultimul esantion pentru {litera} a fost sters.", "total_esantioane": total}