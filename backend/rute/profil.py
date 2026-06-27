from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from baza_date.conexiune import obtine_sesiune_db
from baza_date.modele import Utilizator, CuvantTradus, ProgresInvatare
from scheme.cuvinte import CerereActualizareProgres
from servicii.autentificareServiciu import obtine_utilizator_curent
from configurare import LITERE_VALIDE


router=APIRouter(prefix="/profil", tags=["Profil"])

STATUS_NEINCERCAT="neincercat"
STATUS_IN_PROGRES="in_progres"
STATUS_STAPANIT="stapanit"


def calculeaza_status_litera(incercari: int, reusit: int) -> str:
    if reusit >= 3:
        return STATUS_STAPANIT
    if reusit >= 1:
        return STATUS_IN_PROGRES
    return STATUS_NEINCERCAT


@router.get("/statistici")
def obtine_statistici_utilizator(
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    """Returneaza statisticile generale ale utilizatorului."""
    totalCuvinteTradusse = sesiune_db.query(func.count(CuvantTradus.id)).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id
    ).scalar() or 0

    totalLitereDetectate = sesiune_db.query(func.sum(CuvantTradus.nr_litere)).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id
    ).scalar() or 0

    acurateateaMedie = sesiune_db.query(func.avg(CuvantTradus.incredere_medie)).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id
    ).scalar() or 0.0

    progresLitere = sesiune_db.query(ProgresInvatare).filter(
        ProgresInvatare.id_utilizator == utilizator_curent.id
    ).all()

    litereDinstinctStapanite = sum(
        1 for p in progresLitere
        if calculeaza_status_litera(p.incercari, p.reusit) == STATUS_STAPANIT
    )

    #Zile cu activitate (cate zile distincte au aparut cuvinte)
    zileCuActivitate = sesiune_db.query(
        func.date(CuvantTradus.data_adaugare)
    ).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id
    ).distinct().count()
    
    #Luam zilele distincte în care utilizatorul a avut activitate
    randuriZileActive = sesiune_db.query(
        func.date(CuvantTradus.data_adaugare)
    ).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id
    ).distinct().all()

    #Transformam zilele intr-un set, ca sa putem verifica rapid zilele consecutive
    zileActive = {
        datetime.strptime(str(rand[0]), "%Y-%m-%d").date()
        for rand in randuriZileActive
        if rand[0] is not None
    }

    #Calculam streak-ul pornind de la ziua de azi si mergand inapoi
    ziCurenta = datetime.utcnow().date()
    streakCurent = 0

    while ziCurenta in zileActive:
        streakCurent += 1
        ziCurenta = ziCurenta - timedelta(days=1)
        
    

    return {
        "totalCuvinteTradusse": totalCuvinteTradusse,
        "totalLitereDetectate": int(totalLitereDetectate),
        "litereDinstinctStapanite": litereDinstinctStapanite,
        "acurateteaMedieGlobala": round(acurateateaMedie * 100),
        "minutePractica": zileCuActivitate * 4,
        "zileCuActivitate": zileCuActivitate,
        "streakCurent": streakCurent 
    }


@router.get("/progres-invatare")
def obtine_progres_invatare(
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    """Returneaza progresul la invatarea fiecarei litere."""
    randuri = sesiune_db.query(ProgresInvatare).filter(
        ProgresInvatare.id_utilizator == utilizator_curent.id
    ).all()

    progresDict = {}
    for rand in randuri:
        progresDict[rand.litera] = {
            "status": calculeaza_status_litera(rand.incercari, rand.reusit),
            "incercari": rand.incercari,
            "reusit": rand.reusit,
        }

    return {
        "progres": progresDict,
        "streak": utilizator_curent.streak_curent,  #linie noua 
    }


@router.post("/progres-invatare")
def actualizeaza_progres_litera(
    cerere: CerereActualizareProgres,
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    """Actualizeaza progresul la o litera dupa o incercare de exersare."""
    litera = cerere.litera.upper().strip()
    if litera not in LITERE_VALIDE:
        return {"mesaj": "Litera ignorata (nu face parte din alfabetul LMG)."}

    randExistent = sesiune_db.query(ProgresInvatare).filter(
        ProgresInvatare.id_utilizator == utilizator_curent.id,
        ProgresInvatare.litera== litera,
    ).first()

    if randExistent:
        randExistent.incercari += 1
        if cerere.reusita:
            randExistent.reusit += 1
    else:
        randNou = ProgresInvatare(
            id_utilizator = utilizator_curent.id,
            litera = litera,
            incercari = 1,
            reusit = 1 if cerere.reusita else 0,
        )
        sesiune_db.add(randNou)

    sesiune_db.commit()
    #Daca nu a mai practicat azi, actualizeaza streak-ul
    azi = datetime.utcnow().date()
    ultima = utilizator_curent.data_ultima_activitate
    if ultima is None or ultima.date() < azi:
        if ultima is not None and (azi - ultima.date()).days > 1:
            utilizator_curent.streak_curent = 1  #resetare
        else:
            utilizator_curent.streak_curent += 1
        utilizator_curent.data_ultima_activitate = datetime.utcnow()
        sesiune_db.commit()
    return {"mesaj": f"Progres actualizat pentru litera {litera}."}


@router.get("/activitate-calendar")
def obtine_activitate_calendar(
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    dataLimita = datetime.utcnow() - timedelta(days=91)

    #Luam datele in UTC din baza de date
    cuvinteDinPerioadaSelectata = sesiune_db.query(
        func.date(CuvantTradus.data_adaugare).label("data"),
        func.count(CuvantTradus.id).label("numar"),
    ).filter(
        CuvantTradus.id_utilizator == utilizator_curent.id,
        CuvantTradus.data_adaugare >= dataLimita,
    ).group_by(func.date(CuvantTradus.data_adaugare)).all()

    #Convertim in Python din UTC in ora locala (+3)


    activitatePerData={}
    for rand in cuvinteDinPerioadaSelectata:
        data_utc=datetime.strptime(str(rand.data), "%Y-%m-%d")
        data_locala=data_utc + timedelta(hours=3)
        dataString=data_locala.strftime("%Y-%m-%d")
        activitatePerData[dataString]=activitatePerData.get(dataString, 0) + rand.numar

    #Generam toate cele 91 zile in ora locala
    listaZile=[]
    for numarZileTrecut in range(90, -1, -1):
        data_locala=datetime.utcnow() + timedelta(hours=3) - timedelta(days=numarZileTrecut)
        dataString=data_locala.strftime("%Y-%m-%d")
        listaZile.append({
            "data": dataString,
            "numarActivitati": activitatePerData.get(dataString, 0),
        })

    return {"activitate": listaZile}

@router.get("/confuzii-litere")
def obtine_confuzii_litere(
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    randuri = sesiune_db.query(ProgresInvatare).filter(
        ProgresInvatare.id_utilizator == utilizator_curent.id,
        ProgresInvatare.incercari > 0,
    ).all()

    #Litere cu rata de esec ridicata (incercari - reusit/incercari)
    rezultate = []
    for r in randuri:
        if r.incercari >= 2:
            rata_esec = round(((r.incercari - r.reusit) / r.incercari) * 100)
            if rata_esec > 0:
                rezultate.append({"litera": r.litera, "rata_esec": rata_esec, "incercari": r.incercari})

    rezultate.sort(key=lambda x: x["rata_esec"], reverse=True)
    return {"confuzii": rezultate[:5]}
