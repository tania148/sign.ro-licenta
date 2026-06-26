import math
from io import BytesIO
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from baza_date.conexiune import obtine_sesiune_db
from baza_date.modele import Utilizator, CuvantTradus
from scheme.cuvinte import CerereSalvareCuvant, RaspunsCuvant, RaspunsListaCuvinte
from servicii.autentificareServiciu import obtine_utilizator_curent

router=APIRouter(prefix="/cuvinte", tags=["Cuvinte"])


@router.get("", response_model=RaspunsListaCuvinte)
def obtine_cuvinte_utilizator(
    pagina: int=Query(default=1, ge=1),
    marime_pagina: int=Query(default=20, ge=1, le=100),
    cautare: str=Query(default=""),
    filtru: str=Query(default="toate"),
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Returneaza lista paginata de cuvinte traduse de utilizatorul curent."""
    interogare=sesiune_db.query(CuvantTradus).filter(
        CuvantTradus.id_utilizator==utilizator_curent.id
    )

    if cautare.strip():
        interogare=interogare.filter(
            CuvantTradus.text_cuvant.ilike(f"%{cautare.strip()}%")
        )
    if filtru=="azi":
        acum_local= datetime.utcnow() + timedelta(hours=3)
        inceput_azi=datetime(acum_local.year, acum_local.month, acum_local.day, 0, 0, 0)
        sfarsit_azi=inceput_azi + timedelta(days=1)
        interogare=interogare.filter(
            CuvantTradus.data_adaugare>=inceput_azi,
            CuvantTradus.data_adaugare<sfarsit_azi,
        )
    elif filtru=="saptamana":
        acum7=datetime.utcnow() - timedelta(days=7)
        interogare=interogare.filter(
            CuvantTradus.data_adaugare>=acum7
        )
    elif filtru=="luna":
        acum_local=datetime.utcnow() + timedelta(hours=3)
        inceput_luna=acum_local.replace(day=1, hour=0, minute=0, second=0) - timedelta(hours=3)
        interogare=interogare.filter(
            CuvantTradus.data_adaugare >= inceput_luna
        )

    total=interogare.count()

    cuvinte = ( interogare.order_by(CuvantTradus.data_adaugare.desc()).offset((pagina - 1) * marime_pagina).limit(marime_pagina).all())

    return RaspunsListaCuvinte(
        cuvinte=[RaspunsCuvant.model_validate(c) for c in cuvinte],
        total=total,
        pagina=pagina,
        pagini=max(1, math.ceil(total / marime_pagina)),
    )


@router.post("", response_model=RaspunsCuvant, status_code=status.HTTP_201_CREATED)
def salveaza_cuvant_tradus(
    cerere: CerereSalvareCuvant,
    utilizator_curent: Utilizator =Depends(obtine_utilizator_curent),
    sesiune_db: Session =Depends(obtine_sesiune_db),
):
    """Salveaza un cuvant nou tradus in baza de date."""
    cuvantNou = CuvantTradus(
        id_utilizator=utilizator_curent.id,
        text_cuvant=cerere.cuvant.strip().upper(),
        incredere_medie=round(cerere.incredere_medie, 4),
        nr_litere=len(cerere.cuvant.strip()),
        data_adaugare=datetime.utcnow() + timedelta(hours=3),
    )
    sesiune_db.add(cuvantNou)
    sesiune_db.commit()
    sesiune_db.refresh(cuvantNou)
    return RaspunsCuvant.model_validate(cuvantNou)


@router.delete("/{id_cuvant}", status_code=status.HTTP_200_OK)
def sterge_cuvant_din_istoric(
    id_cuvant: int,
    utilizator_curent: Utilizator = Depends(obtine_utilizator_curent),
    sesiune_db: Session = Depends(obtine_sesiune_db),
):
    """Sterge un cuvant din istoricul utilizatorului curent."""
    cuvantDeSters=sesiune_db.query(CuvantTradus).filter(
        CuvantTradus.id==id_cuvant,
        CuvantTradus.id_utilizator==utilizator_curent.id,
    ).first()

    if not cuvantDeSters:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuvantul nu a fost gasit.")

    sesiune_db.delete(cuvantDeSters)
    sesiune_db.commit()
    return {"mesaj": "Cuvantul a fost sters cu succes."}


@router.get("/export/pdf")
def exporta_istoric_pdf(
    utilizator_curent: Utilizator=Depends(obtine_utilizator_curent),
    sesiune_db: Session=Depends(obtine_sesiune_db),
):
    """Genereaza un fisier PDF cu istoricul complet de traduceri."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(status_code=500, detail="Biblioteca reportlab nu este instalata.")

    toateCuvintele=(sesiune_db.query(CuvantTradus).filter(CuvantTradus.id_utilizator == utilizator_curent.id).order_by(CuvantTradus.data_adaugare.desc()).all())

    buffer=BytesIO()
    document=SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm)
    stiluri=getSampleStyleSheet()
    elemente=[]

    # Titlu
    elemente.append(Paragraph(f"Istoric Traduceri LMG - {utilizator_curent.nume}", stiluri["Title"]))
    elemente.append(Paragraph(f"Exportat la: {datetime.now().strftime('%d.%m.%Y %H:%M')}", stiluri["Normal"]))
    elemente.append(Spacer(1, 0.5*cm))

    # Tabel
    dateTabl=[["Nr.", "Cuvant", "Incredere", "Data"]]
    for index, cuvant in enumerate(toateCuvintele, start=1):
        dateTabl.append([
            str(index),
            cuvant.text_cuvant,
            f"{round(cuvant.incredere_medie * 100)}%",
            cuvant.data_adaugare.strftime("%d.%m.%Y %H:%M"),
        ])

    tabel=Table(dateTabl, colWidths=[1.5*cm, 8*cm, 3*cm, 5*cm])
    tabel.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6)
    ]))
    elemente.append(tabel)

    document.build(elemente)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=istoric_lmg_{datetime.now().strftime('%d-%m-%Y')}.pdf"}
    )
