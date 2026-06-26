import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from configurare import CALE_FISIER_MODEL

pipelineAntrenat=None
acurateateUltimuluiAntrenament=None


def extrage_trasaturi(repere_brute: list[list[float]]) -> np.ndarray:
    """
    Extrage trasaturi din 21 puncte 2D ale mainii:
    - Coordonate normalizate la bounding box (42 valori)
    - Distante intre varfurile degetelor si incheietura (5 valori)
    - Distante intre varfurile degetelor vecine (4 valori)
    - Rapoarte intre lungimile segmentelor degetelor (15 valori)
    Total: 66 trasaturi robuste
    """
    pts = np.array(repere_brute, dtype=np.float64)
    pts = np.nan_to_num(pts, nan=0.0, posinf=0.0, neginf=0.0)

    #Asiguram 21 puncte cu 2 coordonate
    if pts.shape==(21, 3):
        pts=pts[:, :2]
    elif pts.shape==(21, 2):
        pass
    else:
        pts=pts.reshape(21, -1)[:, :2]

    #Normalizare la bounding box

    x_min, y_min=pts.min(axis=0)
    x_max, y_max=pts.max(axis=0)
    latime =max(x_max-x_min, 1e-8)
    inaltime=max(y_max-y_min, 1e-8)
    pts_norm=pts.copy()
    pts_norm[:, 0]=(pts[:, 0]-x_min)/latime
    pts_norm[:, 1]=(pts[:, 1]-y_min)/inaltime
    coordonate_norm=pts_norm.flatten()  
    
    #42 valori
    #2. Distante varfuri degete -> incheietura (punct 0)
    #Varfuri: police=4, aratator=8, medius=12, inelar=16, mic=20
    varfuri=[4, 8, 12, 16, 20]
    incheietura=pts_norm[0]
    distante_la_incheietura=np.array([
        np.linalg.norm(pts_norm[v] - incheietura) for v in varfuri
    ])  #5 valori

    #3. Distante intre varfuri vecine
    distante_intre_varfuri=np.array([
        np.linalg.norm(pts_norm[varfuri[i]] - pts_norm[varfuri[i+1]])
        for i in range(4)
    ])  #4 valori

    #4. Rapoarte lungimi segmente per deget
    #Fiecare deget are 3 segmente: MCP-PIP, PIP-DIP, DIP-TIP
    degete = [
        [1, 2, 3, 4], #degetul mare
        [5, 6, 7, 8], #aratator
        [9, 10, 11, 12], #mijlociu
        [13, 14, 15, 16], #inelar
        [17, 18, 19, 20] #mic
    ]
    rapoarte=[]
    for deget in degete:
        seg1=np.linalg.norm(pts_norm[deget[1]] - pts_norm[deget[0]])
        seg2=np.linalg.norm(pts_norm[deget[2]] - pts_norm[deget[1]])
        seg3=np.linalg.norm(pts_norm[deget[3]] - pts_norm[deget[2]])
        lungime_totala=seg1 + seg2 + seg3 + 1e-8
        rapoarte.extend([seg1/lungime_totala, seg2/lungime_totala, seg3/lungime_totala])
    rapoarte_np=np.array(rapoarte)  #15 valori

    trasaturi=np.concatenate([
        coordonate_norm,
        distante_la_incheietura,
        distante_intre_varfuri,
        rapoarte_np,
    ])

    return np.nan_to_num(trasaturi, nan=0.0).astype(np.float32)


def incarca_model_de_pe_disc():
    global pipelineAntrenat
    cale=CALE_FISIER_MODEL
    print(f"[Clasificator] Caut model la: {os.path.abspath(cale)}")
    if os.path.exists(cale):
        try:
            pipelineAntrenat=joblib.load(cale)
            print(f"[Clasificator] Model incarcat cu succes.")
            return True
        except Exception as e:
            print(f"[Clasificator] Eroare incarcare: {e}")
            pipelineAntrenat=None
    print("[Clasificator] Fisier nu exista.")
    return False


def antreneaza_model(
    esantioane_repere: list[list[list[float]]],
    etichete_litere: list[str],
) -> dict:
    global pipelineAntrenat, acurateateUltimuluiAntrenament

    print(f"[Clasificator] Pregatire {len(esantioane_repere)} esantioane...")

    X_lista=[]
    etichete_valide=[]
    for i, repere in enumerate(esantioane_repere):
        try:
            trasaturi=extrage_trasaturi(repere)
            if not np.any(np.isnan(trasaturi)):
                X_lista.append(trasaturi)
                etichete_valide.append(etichete_litere[i])
        except Exception as e:
            print(f"[Clasificator] Esantion {i} ignorat: {e}")

    print(f"[Clasificator] {len(X_lista)} esantioane valide")
    print(f"[Clasificator] Litere unice: {sorted(set(etichete_valide))}")

    if len(X_lista) < 10:
        raise ValueError(f"Prea putine esantioane valide: {len(X_lista)}")

    X=np.array(X_lista, dtype=np.float32)

    encoder = LabelEncoder()
    y=encoder.fit_transform(etichete_valide)

    test_size=0.2 if len(X) > 50 else 0.15
    stratify=y if min(np.bincount(y)) >= 2 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    pipeline=Pipeline([
        ('scaler', StandardScaler()),
        ('model', RandomForestClassifier(
            n_estimators=300,
            max_depth=None,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        ))
    ])

    pipeline.fit(X_train, y_train)

    acuratete=accuracy_score(y_test, pipeline.predict(X_test))
    acurateateUltimuluiAntrenament=acuratete

    joblib.dump({'pipeline': pipeline, 'encoder': encoder}, CALE_FISIER_MODEL)
    pipelineAntrenat={'pipeline': pipeline, 'encoder': encoder}

    print(f"[Clasificator] Antrenare completa! Acuratete: {acuratete:.2%}")
    return {
        "acuratete": round(acuratete, 4),
        "total_esantioane": len(X),
        "esantioane_antrenare": len(X_train),
        "esantioane_test": len(X_test),
        "litere_antrenate": sorted(set(etichete_valide)),
    }


def prezice_litera(repere_brute: list[list[float]]) -> tuple[str, float]:
    global pipelineAntrenat
    if pipelineAntrenat is None:
        return "?", 0.0
    try:
        pipeline=pipelineAntrenat['pipeline']
        encoder=pipelineAntrenat['encoder']
        trasaturi=extrage_trasaturi(repere_brute).reshape(1, -1)
        if np.any(np.isnan(trasaturi)):
            return "?", 0.0
        probabilitati=pipeline.predict_proba(trasaturi)[0]
        index_max=int(np.argmax(probabilitati))
        return encoder.inverse_transform([index_max])[0], float(probabilitati[index_max])
    except Exception as e:
        print(f"[Clasificator] Eroare predictie: {e}")
        return "?", 0.0


def obtine_acuratete_model():
    return acurateateUltimuluiAntrenament

def este_model_antrenat():
    return pipelineAntrenat is not None
    