import os

#Setari JWT
CHEIE_SECRETA_JWT = os.getenv("CHEIE_SECRETA", "schimba_asta_cu_ceva_random_in_productie_123!")
ALGORITM_JWT = "HS256"
EXPIRARE_TOKEN_MINUTE = 60 * 24 * 7  # 7 zile

#Baza de date
URL_BAZA_DATE = "sqlite:///./licenta_asl.db"

#Model clasificator
CALE_FISIER_MODEL = "./clasificator_lmg.pkl"
MINIM_ESANTIOANE_LITERA = 30  #minim 30 esantioane per litera inainte de antrenare
LITERE_VALIDE = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
NUMAR_REPERE_MANA = 21  #MediaPipe returneaza 21 puncte
DIMENSIUNE_INTRARE_MODEL = NUMAR_REPERE_MANA * 3  #x, y, z per punct = 63 valori

EMAIL_ADMIN = "admin@gmail.com"