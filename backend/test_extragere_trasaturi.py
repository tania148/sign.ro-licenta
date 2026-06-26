"""
Teste unitare pentru functia de extragere a trasaturilor din
clasificatorServiciu.py. Verifica dimensiunea vectorului rezultat,
absenta valorilor NaN si invarianta la pozitie si scara.
"""
import numpy as np
from servicii.clasificatorServiciu import extrage_trasaturi


def genereaza_mana(offset_x=0.0, offset_y=0.0, scara=1.0):
    """Genereaza 21 de repere 2D fictive, cu deplasare si scalare optionale."""
    baza=[[i*0.02, i*0.03] for i in range(21)]
    return [[x*scara+offset_x, y*scara+offset_y] for x, y in baza]

def test_vectorul_are_66_de_valori():
    repere=genereaza_mana()
    trasaturi=extrage_trasaturi(repere)
    assert trasaturi.shape==(66,)

def test_nu_contine_valori_nan():
    repere=genereaza_mana()
    trasaturi=extrage_trasaturi(repere)
    assert not np.isnan(trasaturi).any()

def test_accepta_si_coordonate_3d():
    #MediaPipe poate returna si coordonata z; functia trebuie sa o ignore
    repere_3d=[[i*0.02, i*0.03, i*0.01] for i in range(21)]
    trasaturi=extrage_trasaturi(repere_3d)
    assert trasaturi.shape==(66,)

def test_invarianta_la_pozitie():
    #Aceeasi mana mutata in alt loc trebuie sa dea acelasi vector
    mana=genereaza_mana()
    mana_mutata=genereaza_mana(offset_x=0.5, offset_y=0.3)
    t1=extrage_trasaturi(mana)
    t2=extrage_trasaturi(mana_mutata)
    assert np.allclose(t1, t2, atol=1e-5)

def test_invarianta_la_scara():
    #Aceeasi mana mai mare sau mai mica trebuie sa dea acelasi vector
    mana=genereaza_mana()
    mana_marita=genereaza_mana(scara=2.0)
    t1=extrage_trasaturi(mana)
    t2=extrage_trasaturi(mana_marita)
    assert np.allclose(t1, t2, atol=1e-5)

def test_intrare_cu_nan_nu_propaga_nan():
    #Daca un punct contine NaN, rezultatul final nu trebuie sa contina NaN
    repere=genereaza_mana()
    repere[5]=[float("nan"), float("nan")]
    trasaturi=extrage_trasaturi(repere)
    assert not np.isnan(trasaturi).any()