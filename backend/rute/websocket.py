import json
import base64
import numpy as np
import cv2
import mediapipe as mp
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from servicii.autentificareServiciu import decodifica_token_jwt
from servicii.clasificatorServiciu import prezice_litera

router=APIRouter(tags=["WebSocket"])

#Initializare MediaPipe Hands
mp_hands=mp.solutions.hands
detectoare_hands={}  #Un detector per conexiune WebSocket


@router.websocket("/ws/traducere")
async def websocket_traducere(
    websocket: WebSocket,
    token: str = Query(...),
):
    try:
        decodifica_token_jwt(token)
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    #Cream un detector MediaPipe pentru aceasta conexiune
    detector = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    try:
        while True:
            mesajPrimit = await websocket.receive_text()

            try:
                datePrimite = json.loads(mesajPrimit)
            except json.JSONDecodeError:
                continue

            tip_mesaj = datePrimite.get("tip")

            #Procesare frame video
            if tip_mesaj == "cadru_video":
                frame_b64 = datePrimite.get("date", {}).get("frame", "")
                if not frame_b64:
                    continue

                try:
                    #Decodificare imagine
                    frame_bytes=base64.b64decode(frame_b64)
                    frame_np=np.frombuffer(frame_bytes, dtype=np.uint8)
                    imagine=cv2.imdecode(frame_np, cv2.IMREAD_COLOR)
                    if imagine is None:
                        continue
                    #Detectare maini cu MediaPipe
                    imagine_rgb=cv2.cvtColor(imagine, cv2.COLOR_BGR2RGB)
                    rezultat=detector.process(imagine_rgb)
                    if not rezultat.multi_hand_landmarks:
                        await websocket.send_text(json.dumps({"tip": "stare_mana", "date": {"mana_detectata": False}}))
                        continue
                    #Extragem cele 21 repere normalizate (0-1)
                    repere_mana=rezultat.multi_hand_landmarks[0]
                    repere_lista=[
                        [punct.x, punct.y]
                        for punct in repere_mana.landmark
                    ]

                    #Predictie litera
                    litera, incredere=prezice_litera(repere_lista)

                    raspuns=json.dumps({
                        "tip": "predictie",
                        "date": {
                            "litera": litera,
                            "incredere": round(incredere, 4),
                            "repere": repere_lista,
                        },
                    })
                    await websocket.send_text(raspuns)

                except Exception as eroare:
                    print(f"[WebSocket] Eroare procesare frame: {eroare}")
                    continue

            #Format vechi (repere trimise direct)
            elif tip_mesaj == "repere_mana":
                repere = datePrimite.get("date", {}).get("repere", [])
                if len(repere) != 21:
                    continue
                litera, incredere = prezice_litera(repere)
                await websocket.send_text(json.dumps({
                    "tip": "predictie",
                    "date": {"litera": litera, "incredere": round(incredere, 4)},
                }))

    except WebSocketDisconnect:
        pass
    except Exception as eroare:
        print(f"[WebSocket] Eroare neasteptata: {eroare}")
    finally:
        detector.close()