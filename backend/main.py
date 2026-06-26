from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from baza_date.conexiune import motor_db
from baza_date.modele import BazaModele
from rute import autentificare, cuvinte, profil, antrenament, websocket
from servicii.clasificatorServiciu import incarca_model_de_pe_disc

#Creare tabele la pornire
BazaModele.metadata.create_all(bind=motor_db)

#Aplicatia FastAPI
aplicatie = FastAPI(
    title = "Backend LMG - Recunoastere Semne",
    description = "API pentru traducerea Limbajului Mimico-Gestual romanesc in timp real",
    version = "1.0.0",
)

#CORS - permite requesturi de la frontend (React pe portul 3000)
aplicatie.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = False,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

#Inregistrare rute
aplicatie.include_router(autentificare.router)
aplicatie.include_router(cuvinte.router)
aplicatie.include_router(profil.router)
aplicatie.include_router(antrenament.router)
aplicatie.include_router(websocket.router)


@aplicatie.on_event("startup")
async def la_pornirea_serverului():
    """La pornire: incarcam modelul antrenat daca exista deja pe disc."""
    model_gasit = incarca_model_de_pe_disc()
    if model_gasit:
        print("[Server] Model ML incarcat cu succes.")
    else:
        print("[Server] Niciun model gasit - colecteaza date si antreneaza din pagina Invata.")


@aplicatie.get("/")
def radacina():
    return {
        "mesaj": "Backend LMG functional",
        "docs": "http://localhost:8000/docs",
        "status": "ok",
    }
