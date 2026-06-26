import { useState, useEffect, useRef, useCallback } from 'react'
import BaraNavigare from '../componente/BaraNavigare.jsx'
import { folosestContextUtilizator } from '../context/ContextUtilizator.jsx'
import {
  obtineProgresDinvatareLitere,
  actualizeazaProgresDinvatareLitera,
  creeazaConexiuneWebSocket,
  colecteazaEsantionAntrenament,
  antreneazaModelulMl,
  obtineStatisticiAntrenament,
  stergeEsantioanelitera,
} from '../servicii/apiServicii.js'

//MediaPipe - instanta globala, incarcata o singura data
//Camera porneste IMEDIAT, MP se incarca in fundal
//Daca MP esueaza, scheletul vine de la backend (ca inainte)
let _mpInstance = null
let _mpLoading  = false

async function incarcaMediaPipe() {
  if (_mpInstance) return _mpInstance
  if (_mpLoading)  return null
  _mpLoading = true
  try {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const fs = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    )
    _mpInstance = await HandLandmarker.create(fs, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    return _mpInstance
  } catch (e) {
    console.warn('[MediaPipe] Nu s-a putut incarca, folosesc backend pentru schelet:', e)
    return null
  } finally {
    _mpLoading = false
  }
}

//Preincarca MP la import (nu blocheaza nimic)
incarcaMediaPipe()

const ALFABETUL_LMG = [
  'A','B','C','D','E','F','G','H','I','J',
  'K','L','M','N','O','P','Q','R','S','T',
  'U','V','W','X','Y','Z',
]
const LITERE_DINAMICE = ['J', 'Z']
const esteLiteraDinamica = (litera) => LITERE_DINAMICE.includes(litera)
const LITERE_EXERSABILE = ALFABETUL_LMG.filter((litera) => !esteLiteraDinamica(litera))


const DESCRIERI_SEMNE_LMG = {
  A: 'Pumn inchis, degetul mare asezat pe lateral langa index',
  B: 'Mana deschisa, degete drepte si lipite indreptate in sus, degetul mare pliat spre palma',
  C: 'Toate degetele curbate, mana formeaza forma literei C',
  D: 'Aratatorul drept in sus, celelalte degete formeaza cerc cu degetul mare',
  E: 'Toate degetele indoite spre palma, degetul mare pozitionat sub ele',
  F: 'Aratatorul si degetul mare formeaza cerc, celelalte trei degete drepte in sus',
  G: 'Aratatorul si degetul mare intinse si orientate lateral, paralele intre ele',
  H: 'Aratatorul si mediusul drepte, lipite si orientate lateral',
  I: 'Pumn inchis cu degetul mic ridicat drept in sus',
  J: 'Ca litera I, cu o miscare in aer care deseneaza forma literei J',
  K: 'Aratatorul si mediusul formand un V, degetul mare ridicat intre ele',
  L: 'Aratatorul drept in sus, degetul mare intins lateral, formeaza forma de L',
  M: 'Pumn cu degetul mare ascuns in palma, trei degete indoite peste el, degetul mic liber',
  N: 'Pumn cu degetul mare ascuns in palma, doua degete indoite peste el, ceilalti liber',
  O: 'Toate degetele curbate si unite cu degetul mare, formeaza un cerc complet',
  P: 'Aratatorul si mediusul indreptate in jos spre podea, degetul mare ridicat intre ei',
  Q: 'Aratatorul si degetul mare indreptate in jos spre podea, paralele intre ele',
  R: 'Aratatorul si mediusul drepte in sus si incrucisate unul peste celalalt, degetul mare si celelalte strinse',
  S: 'Pumn strans cu degetul mare asezat peste celelalte degete',
  T: 'Pumn strans cu degetul mare ridicat si apropiat de mana, ca un like',
  U: 'Aratatorul si mediusul drepte, lipite si indreptate in sus',
  V: 'Aratatorul si mediusul drepte si departate, formeaza forma literei V',
  W: 'Aratatorul, mediusul si inelarul drepte si usor departate',
  X: 'Aratatorul indoit ca un carlig, celelalte degete strinse in pumn',
  Y: 'Degetul mare si degetul mic ridicate si departate, celelalte strinse',
  Z: 'Aratatorul drept deseneaza in aer forma literei Z',
}

const urlDlmg = (l) => `https://dlmg.ro/dictionar/?s=${l.toLowerCase()}`

const STATUS_NEINCERCAT='neincercat'
const STATUS_IN_PROGRES='in_progres'
const STATUS_STAPANIT='stapanit'

const PRAG_INCREDERE_VALIDARE=0.80
const MS_TINUTA_PENTRU_SUCCES=2000
const MS_TIMP_LIMITA_INCERCARE=10000
const FRECVENTA_TRIMITERE_MS=100
const MINIM_ESANTIOANE=70

const CONEXIUNI_SCHELET = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
]

const TAB_EXERSEAZA  = 'exerseaza'
const TAB_ANTRENEAZA = 'antreneaza'

async function stergeUltimulEsantion(litera) {
  const token = localStorage.getItem('token_autentificare') || ''
  const res = await fetch(`http://localhost:8000/antrenament/sterge-ultimul/${litera}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function clearCanvas(ref) {
  const c = ref.current
  if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height)
}

function deseneazaSchelet(canvasRef, videoRef, repere) {
  const canvas = canvasRef.current, video = videoRef.current
  if (!canvas || !video || !repere?.length) return
  const ctx = canvas.getContext('2d')
  const w = video.videoWidth || 640
  const h = video.videoHeight || 480
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  ctx.clearRect(0, 0, w, h)
  const pts = repere.map(([x, y]) => ({ x: x * w, y: y * h }))
  ctx.strokeStyle = 'rgba(99,102,241,0.85)'; ctx.lineWidth = 2
  CONEXIUNI_SCHELET.forEach(([a, b]) => {
    if (!pts[a] || !pts[b]) return
    ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke()
  })
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, 2 * Math.PI)
    ctx.fillStyle = i === 0 ? '#6366f1' : '#10b981'; ctx.fill()
  })
}

export default function Invata() {
  const { utilizatorCurent } = folosestContextUtilizator()
  const esteAdmin = utilizatorCurent?.email === 'admin@gmail.com'

  const [progresPeLitera, setProgresPeLitera] = useState(() => {
    const init = {}
    ALFABETUL_LMG.forEach((l) => { init[l] = { status: STATUS_NEINCERCAT, incercari: 0, reusit: 0 } })
    return init
  })

  const [tabActiv, setTabActiv] = useState(TAB_EXERSEAZA)
  const [literaSelectata, setLiteraSelectata] = useState(null)
  const [esteModPractica, setEsteModPractica] = useState(false)
  const [esteActiva, setEsteActiva] = useState(false)
  const [wsConectat, setWsConectat] = useState(false)
  const [numarStreak, setNumarStreak] = useState(0)
  const [literaDetectata, setLiteraDetectata] = useState('')
  const [incredereDetectata, setIncredereDetectata] = useState(0)
  const [procentajTinuta, setProcentajTinuta] = useState(0)
  const [rezultatValidare, setRezultatValidare] = useState(null)
  const [repereExerseaza, setRepereExerseaza] = useState(null)

  const [statistici, setStatistici] = useState(null)
  const [seIncarcaStats, setSeIncarcaStats] = useState(false)
  const [seAntreneaza, setSeAntreneaza] = useState(false)
  const [mesajTrain, setMesajTrain] = useState('')
  const [esteEroare, setEsteEroare] = useState(false)

  const [literaCol, setLiteraCol] = useState('A')
  const [activaCol, setActivaCol] = useState(false)
  const [wsCol, setWsCol] = useState(false)
  const [salveaza, setSalveaza] = useState(false)
  const [stergeUlt, setStergeUlt] = useState(false)
  const [mainDetectata, setMainDetectata] = useState(false)
  const [literaDetCol, setLiteraDetCol] = useState('')
  const [incredereCol, setIncredereCol] = useState(0)
  const [flash, setFlash] = useState(false)
  const [contorLocal, setContorLocal] = useState({})

  //Refs exerseaza
  const refVideo = useRef(null)
  const refCanvas = useRef(null)
  const refBucla = useRef(null)
  const refWS = useRef(null)
  const refFlux = useRef(null)
  const refTs = useRef(0)
  const refTsTinere = useRef(null)
  const refTsIncercare = useRef(null)
  const refRezultatValidare = useRef(null)
  const refLitera = useRef(null)

  //Refs colectare
  const refVideoCol = useRef(null)
  const refCanvasCol = useRef(null)
  const refBuclaCol = useRef(null)
  const refWSCol = useRef(null)
  const refFluxCol = useRef(null)
  const refTsCol = useRef(0)
  const refRepereCol = useRef(null)

  //Refs stare detectie (fara re-render)
  const refMainDetectataCol = useRef(false)
  const refCooldownLitera   = useRef(0)
  //Folosit cand MP nu e disponibil (fallback backend)
  const refAsteaptaRaspunsEx  = useRef(false)
  const refAsteaptaRaspunsCol = useRef(false)

  //Layout sync
  const refColStanga  = useRef(null)
  const refColDreapta = useRef(null)

  useEffect(() => {
    if (!refColStanga.current || !refColDreapta.current) return
    function sync() {
      if (refColStanga.current && refColDreapta.current)
        refColDreapta.current.style.height = refColStanga.current.offsetHeight + 'px'
    }
    sync()
    const obs = new ResizeObserver(sync)
    obs.observe(refColStanga.current)
    window.addEventListener('resize', sync)
    return () => { obs.disconnect(); window.removeEventListener('resize', sync) }
  }, [tabActiv])

  useEffect(() => { refLitera.current = literaSelectata }, [literaSelectata])

  useEffect(() => {
    refRezultatValidare.current = rezultatValidare
  }, [rezultatValidare])

  useEffect(() => {
    async function load() {
      try {
        const d = await obtineProgresDinvatareLitere()
        if (d?.progres) {
          setProgresPeLitera((prev) => {
            if (d?.streak != null) setNumarStreak(d.streak)
            const n = { ...prev }
            Object.entries(d.progres).forEach(([l, v]) => {
              if (n[l]) n[l] = { status: v.status ?? STATUS_NEINCERCAT, incercari: v.incercari ?? 0, reusit: v.reusit ?? 0 }
            })
            return n
          })
        }
      } catch { /* local */ }
    }
    load()
    return () => { stopPractica(); stopColectare() }
  }, [])

  //WS Exerseaza
  useEffect(() => {
    const h = { fn: null }
    h.fn = (d) => {
      refAsteaptaRaspunsEx.current = false   //deblocam trimiterea urmatoarei cadru
      if (d.tip === 'predictie') {
        const { litera, incredere, repere } = d.date
        //Schelet din backend doar daca MP nu e disponibil
        if (repere?.length === 21 && !_mpInstance) setRepereExerseaza(repere)
        setLiteraDetectata(litera)
        setIncredereDetectata(Math.round(incredere * 100))
        evalValidare(litera, incredere)
      } else if (d.tip === 'stare_mana' && !d.date.mana_detectata) {
        if (!_mpInstance) { clearCanvas(refCanvas); setRepereExerseaza(null) }
        setLiteraDetectata('')
        setIncredereDetectata(0)
        reseteazaTimerIncercare()
      }
    }
    const ws = creeazaConexiuneWebSocket({
      peRaspunsPrimite: (d) => h.fn(d),
      peDeschidereConexiune: () => setWsConectat(true),
      peInchidereConexiune: () => setWsConectat(false),
      peEroareConexiune: () => setWsConectat(false),
    })
    refWS.current = ws
    return () => refWS.current?.close()
  }, [])

  //WS Colectare
  useEffect(() => {
    if (!esteAdmin) return
    const h = { fn: null }
    h.fn = (d) => {
      refAsteaptaRaspunsCol.current = false
      if (d.tip === 'predictie') {
        const { litera, incredere, repere } = d.date
        //Schelet din backend doar daca MP nu e disponibil
        if (repere?.length === 21 && !_mpInstance) {
          refRepereCol.current = repere
          deseneazaSchelet(refCanvasCol, refVideoCol, repere)
        }
        if (Date.now() > refCooldownLitera.current) {
          if (!refMainDetectataCol.current) {
            refMainDetectataCol.current = true
            setMainDetectata(true)
          }
          setLiteraDetCol(litera)
          setIncredereCol(Math.round(incredere * 100))
        }
      } else if (d.tip === 'stare_mana' && !d.date.mana_detectata) {
        if (!_mpInstance) { clearCanvas(refCanvasCol); refRepereCol.current = null }
        refMainDetectataCol.current = false
        setMainDetectata(false); setLiteraDetCol(''); setIncredereCol(0)
      }
    }
    const ws = creeazaConexiuneWebSocket({
      peRaspunsPrimite: (d) => h.fn(d),
      peDeschidereConexiune: () => setWsCol(true),
      peInchidereConexiune: () => setWsCol(false),
      peEroareConexiune: () => setWsCol(false),
    })
    refWSCol.current = ws
    return () => refWSCol.current?.close()
  }, [esteAdmin])

  //Schelet din backend (cand MP nu e disponibil)
  useEffect(() => {
    if (repereExerseaza && esteActiva && !_mpInstance)
      deseneazaSchelet(refCanvas, refVideo, repereExerseaza)
  }, [repereExerseaza, esteActiva])

  async function loadStats() {
    setSeIncarcaStats(true)
    try { setStatistici(await obtineStatisticiAntrenament()) } catch { /* */ }
    finally { setSeIncarcaStats(false) }
  }
  useEffect(() => { loadStats() }, [])
  useEffect(() => { if (tabActiv === TAB_ANTRENEAZA) loadStats() }, [tabActiv])

  function reseteazaTimerIncercare() {
    refTsIncercare.current = null
    refTsTinere.current = null
    setProcentajTinuta(0)
  }
  
  function evalValidare(literaDet, incredere) {
    const lp = refLitera.current

    if (!lp || refRezultatValidare.current || esteLiteraDinamica(lp)) return

    //timerul incepe cand exista o predictie, adica mana este detectata
    if (!refTsIncercare.current) {
      refTsIncercare.current = Date.now()
    }

    const timpIncercare = Date.now() - refTsIncercare.current

    if (literaDet === lp && incredere >= PRAG_INCREDERE_VALIDARE) {
      if (!refTsTinere.current) refTsTinere.current = Date.now()

      const timpCorect = Date.now() - refTsTinere.current
      setProcentajTinuta(Math.min(100, Math.round((timpCorect / MS_TINUTA_PENTRU_SUCCES) * 100)))

      if (timpCorect >= MS_TINUTA_PENTRU_SUCCES) {
        finValidare(true)
      }

      return
    }

    //daca semnul detectat nu este cel corect, se reseteaza bara de succes
    refTsTinere.current = null
    setProcentajTinuta(0)

    //dupa 10 secunde fara validare corecta, incercarea devine gresita
    if (timpIncercare >= MS_TIMP_LIMITA_INCERCARE) {
      finValidare(false)
    }
  }

  function capturaCadru(v) {
    if (!v || v.readyState < 2) return null
    const c = document.createElement('canvas'); c.width = 320; c.height = 240
    c.getContext('2d').drawImage(v, 0, 0, 320, 240)
    return c.toDataURL('image/jpeg', 0.7).split(',')[1]
  }

  //Exerseaza
  async function startPractica() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
      })
      refFlux.current = flux
      refVideo.current.srcObject = flux
      await new Promise((r) => { refVideo.current.onloadedmetadata = r })
      await refVideo.current.play()
      setEsteActiva(true)
      refBucla.current = requestAnimationFrame(buclaPractica)
    } catch (e) { console.error(e) }
  }

 function stopPractica() {
  if (refBucla.current) cancelAnimationFrame(refBucla.current)
  if (refFlux.current) { refFlux.current.getTracks().forEach((t) => t.stop()); refFlux.current = null }
  if (refVideo.current) refVideo.current.srcObject = null

  setEsteActiva(false)
  setLiteraDetectata('')
  setIncredereDetectata(0)
  setProcentajTinuta(0)
  setRezultatValidare(null)
  refRezultatValidare.current = null
  reseteazaTimerIncercare()
  setRepereExerseaza(null)
  clearCanvas(refCanvas)
}

  //Bucla exerseaza
  //Daca MP e disponibil: schelet local instant, trimite repere la backend
  //Daca MP nu e disponibil: trimite cadru JPEG la backend (ca inainte)
  const buclaPractica = useCallback(() => {
    const v = refVideo.current
    if (!v || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      refBucla.current = requestAnimationFrame(buclaPractica); return
    }

    const hl = _mpInstance

    if (hl) {
      //Mod MediaPipe local (schelet instant)
      const rezultat = hl.detectForVideo(v, Date.now())
      if (rezultat.landmarks.length > 0) {
        const repere = rezultat.landmarks[0].map(p => [p.x, p.y])
        deseneazaSchelet(refCanvas, refVideo, repere)
        const now = Date.now()
        if (now - refTs.current >= FRECVENTA_TRIMITERE_MS) {
          refTs.current = now
          if (refWS.current?.readyState === WebSocket.OPEN) {
            refWS.current.send(JSON.stringify({ 
              tip: 'repere_mana', 
              date: { repere, litera_tinta: refLitera.current ?? '' } 
            }))
          }
        }
      } else {
          clearCanvas(refCanvas)
          setLiteraDetectata('')
          setIncredereDetectata(0)
          reseteazaTimerIncercare()
        }
    } else {
      //Fallback: trimite cadru JPEG la backend
      const now = Date.now()
      if (now - refTs.current >= FRECVENTA_TRIMITERE_MS) {
        refTs.current = now
        if (!refAsteaptaRaspunsEx.current) {
          try {
            const f = capturaCadru(v)
            if (f && refWS.current?.readyState === WebSocket.OPEN) {
              refAsteaptaRaspunsEx.current = true
              refWS.current.send(JSON.stringify({ tip: 'cadru_video', date: { frame: f, timestamp: now } }))
            }
          } catch { /* */ }
        }
      }
    }

    refBucla.current = requestAnimationFrame(buclaPractica)
  }, [])

  //Colectare
  async function startColectare() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
      })
      refFluxCol.current = flux
      refVideoCol.current.srcObject = flux
      await new Promise((r) => { refVideoCol.current.onloadedmetadata = r })
      await refVideoCol.current.play()
      setActivaCol(true)
      refMainDetectataCol.current = false
      refBuclaCol.current = requestAnimationFrame(buclaColectare)
    } catch (e) { console.error('Camera eroare:', e) }
  }

  function stopColectare() {
    if (refBuclaCol.current) cancelAnimationFrame(refBuclaCol.current)
    if (refFluxCol.current) { refFluxCol.current.getTracks().forEach((t) => t.stop()); refFluxCol.current = null }
    if (refVideoCol.current) refVideoCol.current.srcObject = null
    setActivaCol(false); setMainDetectata(false)
    setLiteraDetCol(''); setIncredereCol(0)
    refRepereCol.current = null
    refMainDetectataCol.current = false
    clearCanvas(refCanvasCol)
  }

  //Bucla colectare
  const buclaColectare = useCallback(() => {
    const v = refVideoCol.current
    if (!v || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      refBuclaCol.current = requestAnimationFrame(buclaColectare); return
    }

    const hl = _mpInstance

    if (hl) {
      //Mod MediaPipe local (schelet instant)
      const rezultat = hl.detectForVideo(v, Date.now())
      if (rezultat.landmarks.length > 0) {
        const repere = rezultat.landmarks[0].map(p => [p.x, p.y])
        refRepereCol.current = repere
        deseneazaSchelet(refCanvasCol, refVideoCol, repere)
        if (!refMainDetectataCol.current) {
          refMainDetectataCol.current = true
          setMainDetectata(true)
        }
        const now = Date.now()
        if (now - refTsCol.current >= FRECVENTA_TRIMITERE_MS) {
          refTsCol.current = now
          if (refWSCol.current?.readyState === WebSocket.OPEN) {
            refWSCol.current.send(JSON.stringify({ tip: 'repere_mana', date: { repere } }))
          }
        }
      } else {
        refRepereCol.current = null
        clearCanvas(refCanvasCol)
        if (refMainDetectataCol.current) {
          refMainDetectataCol.current = false
          setMainDetectata(false)
          setLiteraDetCol(''); setIncredereCol(0)
        }
      }
    } else {
      //Fallback: trimite cadru JPEG la backend
      const now = Date.now()
      if (now - refTsCol.current >= FRECVENTA_TRIMITERE_MS) {
        refTsCol.current = now
        if (!refAsteaptaRaspunsCol.current) {
          try {
            const f = capturaCadru(v)
            if (f && refWSCol.current?.readyState === WebSocket.OPEN) {
              refAsteaptaRaspunsCol.current = true
              refWSCol.current.send(JSON.stringify({ tip: 'cadru_video', date: { frame: f, timestamp: now } }))
            }
          } catch { /* */ }
        }
      }
    }

    refBuclaCol.current = requestAnimationFrame(buclaColectare)
  }, [])

  async function finValidare(reusit) {
    if (refRezultatValidare.current) return

    const rezultat = reusit ? 'succes' : 'gresit'
    refRezultatValidare.current = rezultat
    setRezultatValidare(rezultat)

    refTsTinere.current = null
    refTsIncercare.current = null
    setProcentajTinuta(0)

    const litera = refLitera.current
    if (!litera) return
      setProgresPeLitera((prev) => {
        const d = { ...prev[litera] }; d.incercari += 1; if (reusit) d.reusit += 1
        d.status = d.reusit >= 3 ? STATUS_STAPANIT : d.reusit >= 1 ? STATUS_IN_PROGRES : STATUS_NEINCERCAT
        return { ...prev, [litera]: d }
      })
  try { await actualizeazaProgresDinvatareLitera(litera, reusit) } catch { /* */ }
    setTimeout(() => {
      refRezultatValidare.current = null
      setRezultatValidare(null)
      setLiteraDetectata('')
      setIncredereDetectata(0)
      refTsIncercare.current = null
      refTsTinere.current = null
      setProcentajTinuta(0)
    }, 2500)
  }

  async function handleSalveaza() {
    if (!refRepereCol.current) { alert('Mâna nu e detectată.'); return }
    const repere = refRepereCol.current.slice(0, 21)
    if (repere.length !== 21) { alert('Date incomplete.'); return }
    const nrCurent = getNr(literaCol)
    setContorLocal((p) => ({ ...p, [literaCol]: nrCurent + 1 }))
    setFlash(true); setTimeout(() => setFlash(false), 300)
    try {
      const r = await colecteazaEsantionAntrenament(literaCol, repere)
      setContorLocal((p) => ({ ...p, [literaCol]: r.total_esantioane }))
    } catch (e) {
      console.error(e)
      setContorLocal((p) => ({ ...p, [literaCol]: nrCurent }))
      alert('Eroare la salvare.')
    }
  }

  async function handleStergeUltimul() {
    if (getNr(literaCol) === 0) return
    setStergeUlt(true)
    try { const r = await stergeUltimulEsantion(literaCol); setContorLocal((p) => ({ ...p, [literaCol]: r.total_esantioane })) }
    catch (e) { console.error(e); alert('Eroare la stergere.') }
    finally { setStergeUlt(false) }
  }

  async function handleStergeTot(litera) {
    if (!confirm(`Stergi TOATE esantioanele pentru ${litera}?`)) return
    try { await stergeEsantioanelitera(litera); setContorLocal((p) => ({ ...p, [litera]: 0 })); loadStats() } catch { /* */ }
  }

  async function handleTrain() {
    setSeAntreneaza(true); setMesajTrain(''); setEsteEroare(false)
    try {
      const r = await antreneazaModelulMl()
      setMesajTrain(`Antrenat! Acuratete: ${Math.round(r.acuratete * 100)}% · ${r.total_esantioane} esantioane`)
      await loadStats()
    } catch (e) { setEsteEroare(true); setMesajTrain(e.response?.data?.detail || 'Eroare la antrenare.') }
    finally { setSeAntreneaza(false) }
  }


  function culoareLitera(l) {
    if (esteLiteraDinamica(l)) {
      return 'bg-slate-100 border-dashed border-slate-300 text-slate-400 hover:bg-slate-100'
    }

    const s = progresPeLitera[l]?.status
    if (s === STATUS_STAPANIT) return 'bg-emerald-50 border-emerald-400 text-emerald-700 hover:bg-emerald-100'
    if (s === STATUS_IN_PROGRES) return 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
    return 'bg-slate-50 border-slate-200 text-text-secundar hover:bg-slate-100'
  }

  function getNr(l) {
    if (contorLocal[l] != null) return contorLocal[l]
    return statistici?.esantioane_per_litera?.[l] ?? 0
  }
  const culBara = (n) => n >= MINIM_ESANTIOANE ? 'bg-emerald-500' : n >= 10 ? 'bg-amber-400' : 'bg-red-300'
  const culText = (n) => n >= MINIM_ESANTIOANE ? 'text-emerald-600' : n >= 10 ? 'text-amber-600' : 'text-red-500'

  const progresLitereExersabile = LITERE_EXERSABILE.map((l) => progresPeLitera[l])

  const nrStapanite = progresLitereExersabile.filter((p) => p.status === STATUS_STAPANIT).length
  const nrInProgres = progresLitereExersabile.filter((p) => p.status === STATUS_IN_PROGRES).length
  const procentGen = Math.round((nrStapanite / LITERE_EXERSABILE.length) * 100)


  const progresL = literaSelectata ? progresPeLitera[literaSelectata] : null
  const nrCol = getNr(literaCol)
  const procentCol = Math.min(100, Math.round((nrCol / MINIM_ESANTIOANE) * 100))
  const nrLitereGata = statistici?.litere_gata_de_antrenare?.length ?? 0

  const gridLitere = (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-text-tertiar uppercase tracking-wider">Litera selectata</p>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${culBara(nrCol)}`} style={{ width: `${procentCol}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums ${culText(nrCol)}`}>{nrCol}/{MINIM_ESANTIOANE}</span>
        </div>
      </div>
      <div className="grid grid-cols-9 gap-1">
        {ALFABETUL_LMG.map((l) => {
          const nr = getNr(l), gata = nr >= MINIM_ESANTIOANE, part = nr > 0 && !gata
          return (
            <button key={l}
              onClick={() => {
                setLiteraCol(l)
                setMainDetectata(false)
                refMainDetectataCol.current = false
                setLiteraDetCol(''); setIncredereCol(0)
                refCooldownLitera.current = Date.now() + 1500
              }}
              title={`${l}: ${nr}/${MINIM_ESANTIOANE}`}
              className={`relative aspect-square rounded-md border font-mono font-bold text-xs transition-all
              ${gata ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : part ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}                ${literaCol === l ? 'ring-2 ring-primar-500 ring-offset-1 scale-110 z-10' : ''}`}>
              {l}
              {gata && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-tertiar mt-3">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 border border-emerald-300" />≥70</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-50 border border-amber-300" />1–69</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-200" />0</span>
        <span className="ml-auto font-medium">{nrLitereGata}/26 complete</span>
      </div>
    </div>
  )

  const ButoaneCamera = (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
      {!activaCol ? (
        <button onClick={startColectare}
          className="w-full bg-primar-600 hover:bg-primar-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          Porneste camera
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <button onClick={handleSalveaza} disabled={!mainDetectata}
              className="flex-1 bg-primar-500 hover:bg-primar-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              Salveaza <span className="font-mono bg-primar-600/60 px-1.5 py-0.5 rounded text-xs">{nrCol}</span>
            </button>
            <button onClick={stopColectare} className="w-12 bg-slate-200 hover:bg-slate-300 text-slate-600 py-3 rounded-xl text-sm flex items-center justify-center">⏹</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleStergeUltimul} disabled={stergeUlt || nrCol === 0}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-amber-600 hover:bg-amber-50 disabled:text-slate-300 disabled:cursor-not-allowed py-2 rounded-lg border border-amber-200 disabled:border-slate-100 transition-colors">
              {stergeUlt ? <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" /> : '↩'} Sterge ultimul
            </button>
            <button onClick={() => handleStergeTot(literaCol)} disabled={nrCol === 0}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-500 hover:bg-red-50 disabled:text-slate-300 disabled:cursor-not-allowed py-2 rounded-lg border border-red-200 disabled:border-slate-100 transition-colors">
              Sterge tot ({nrCol})
            </button>
          </div>
        </>
      )}
      {!activaCol && nrCol > 0 && (
        <button onClick={() => handleStergeTot(literaCol)} className="w-full text-xs text-red-400 hover:text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition-colors">
          Sterge toate pentru <strong>{literaCol}</strong> ({nrCol})
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-fundal">
      <BaraNavigare />
      <main className="max-w-[1450px] mx-auto px-6 xl:px-8 py-8 anima-aparitie">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-text-principal">Invata alfabetul LMG</h1> 
            <p className="text-text-secundar text-base mt-1">Limbaj Mimico-Gestual romanesc · 26 litere</p>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1.5 gap-1.5">
            <button onClick={() => { setTabActiv(TAB_EXERSEAZA); stopColectare() }}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${tabActiv === TAB_EXERSEAZA ? 'bg-primar-600 text-white' : 'text-text-secundar hover:bg-slate-100'}`}>
              Exerseaza
            </button>
            {esteAdmin && (
              <button onClick={() => { setTabActiv(TAB_ANTRENEAZA); stopPractica() }}
               className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${tabActiv === TAB_ANTRENEAZA ? 'bg-primar-600 text-white' : 'text-text-secundar hover:bg-slate-100'}`}>
                Antreneaza model
              </button>
            )}
          </div>
        </div>

        {/*TAB EXERSEAZA*/}
        {tabActiv === TAB_EXERSEAZA && (
          <div className="grid grid-cols-1 xl:grid-cols-[440px_1fr] gap-8 items-start">
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-7 min-h-[185px]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-text-tertiar uppercase tracking-wider">Progres general</p>
                  <span className="text-base font-semibold">
                    
                    {numarStreak}</span>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-5xl font-bold font-mono text-primar-600">{nrStapanite}</span>
                  <span className="text-text-tertiar text-base">/ {LITERE_EXERSABILE.length} litere exersabile</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-primar-500 rounded-full transition-all duration-500" style={{ width: `${procentGen}%` }} />
                </div>
                <div className="flex gap-5 text-sm">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primar-400" /><span className="text-text-secundar">{nrStapanite} stapanite</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-text-secundar">{nrInProgres} in progres</span></span>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-7">
                <p className="text-sm font-medium text-text-tertiar uppercase tracking-wider mb-5">Selecteaza litera</p>
                <div className="grid grid-cols-7 gap-2.5">
                  {ALFABETUL_LMG.map((l) => (
                    <button key={l}
                      onClick={() => {
                        if (esteActiva) stopPractica()
                        setEsteModPractica(false)
                        setLiteraSelectata(l)
                        setRezultatValidare(null)
                        setLiteraDetectata('')
                        setProcentajTinuta(0)
                        refTsTinere.current = null
                        refRezultatValidare.current = null
                        reseteazaTimerIncercare()
                      }}
                      title={esteLiteraDinamica(l) ? `${l}: semn dinamic, doar vizualizare` : `${l}: semn exersabil`}
                      className={`relative aspect-square rounded-2xl border font-mono font-bold text-lg transition-all ${culoareLitera(l)} ${literaSelectata === l ? 'ring-2 ring-primar-400 ring-offset-1' : ''}`}>
                      {l}
                      {esteLiteraDinamica(l) && (
                        <span className="absolute -top-1.5 -right-1.5 text-[11px] bg-slate-300 text-white rounded-full w-5 h-5 flex items-center justify-center">
                          ~
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      ['bg-accent-100 border-accent-400','Stapanita'],
                      ['bg-amber-50 border-amber-300','In progres'],
                      ['bg-slate-50 border-slate-200','Neincercata'],
                      ['bg-slate-100 border-slate-300 border-dashed','Semn dinamic']
                    ].map(([cls,txt]) => (
                    <div key={txt} className="flex items-center gap-2 text-sm text-text-tertiar">
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 ${cls}`} />{txt}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              {!literaSelectata ? (
                <div className="bg-white rounded-2xl border border-slate-200 min-h-[620px] xl:min-h-[680px] flex flex-col items-center justify-center py-20">
                  <span className="text-5xl mb-4">
                    </span>
                  <p className="text-xl font-medium text-text-secundar">Selecteaza o litera din grila</p>
                  <p className="text-base text-text-tertiar mt-2">pentru a vedea semnul si a exersa</p>
                </div>
              ) : (
                <div className="space-y-5 min-h-[620px] xl:min-h-[680px]">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-7xl font-bold text-primar-600 leading-none">{literaSelectata}</span>
                        <div>
                          <p className="text-lg font-semibold text-text-principal">Litera {literaSelectata}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {progresL?.status === STATUS_STAPANIT && <span className="text-xs bg-primar-50 text-primar-600 px-2 py-0.5 rounded-full font-medium">
                              Stapanita</span>}
                            {progresL?.status === STATUS_IN_PROGRES && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                              In progres</span>}
                            {(progresL?.incercari ?? 0) > 0 && <span className="text-xs text-text-tertiar">{progresL.reusit}/{progresL.incercari} reusit</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-primar-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-primar-700 mb-1">Cum se face semnul (LMG):</p>
                      <p className="text-base text-primar-600">{DESCRIERI_SEMNE_LMG[literaSelectata]}</p>

                      {esteLiteraDinamica(literaSelectata) && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-amber-700">
                            Acest semn presupune miscare, de aceea este disponibil doar pentru vizualizare in versiunea actuala.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[390px]">
                      <div className="p-3 border-b border-slate-100"><p className="text-xs font-medium text-text-tertiar">Semnul de referinta</p></div>
                      <div className="aspect-square flex flex-col items-center justify-center bg-white p-5">
                        <img src={`/semne-litere/${literaSelectata}.png`} alt={`Semn LMG ${literaSelectata}`} className="w-full h-full object-contain"
                          onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                        <div className="hidden flex-col items-center gap-3 text-center">
                          <span className="font-mono text-5xl font-bold text-slate-200">{literaSelectata}</span>
                          <a href={urlDlmg(literaSelectata)} target="_blank" rel="noopener noreferrer" className="text-xs text-primar-600 underline">Vezi video 
                            </a>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[390px]">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-xs font-medium text-text-tertiar">Incearca live</p>
                      </div>
                      <div className="aspect-square relative overflow-hidden bg-slate-900">
                        <video ref={refVideo} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" style={{ display: esteModPractica ? 'block' : 'none' }} playsInline muted />
                        <canvas ref={refCanvas} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" style={{ display: esteModPractica ? 'block' : 'none' }} />
                        {rezultatValidare && esteModPractica && (
                          <div className={`absolute inset-0 flex flex-col items-center justify-center z-20 backdrop-blur-[2px] ${rezultatValidare === 'succes' ? 'bg-emerald-500/80' : 'bg-red-500/80'}`}>
                            <span className="text-white text-5xl mb-2">{rezultatValidare === 'succes' ? '✓' : '✗'}</span>
                            <span className="text-white text-sm font-semibold">{rezultatValidare === 'succes' ? 'Corect!' : 'Mai incearca'}</span>
                          </div>
                        )}
                        {!rezultatValidare && esteActiva && (
                          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent z-10">
                            {literaDetectata ? (
                              <>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-white text-xs">Detectat: <span className="font-mono font-bold text-lg">{literaDetectata}</span>
                                    {literaDetectata === literaSelectata ? <span className="text-primar-400 ml-1">✓</span> : <span className="text-red-400 ml-1"> =! {literaSelectata}</span>}
                                  </span>
                                  <span className="text-white/70 text-xs">{incredereDetectata}%</span>
                                </div>
                                {literaDetectata === literaSelectata && (
                                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-primar-400 rounded-full transition-all duration-100" style={{ width: `${procentajTinuta}%` }} />
                                  </div>
                                )}
                              </>
                            ) : <p className="text-white/60 text-xs text-center">Arata mana la camera...</p>}
                          </div>
                        )}
                          {!esteModPractica && !esteLiteraDinamica(literaSelectata) && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <span className="text-3xl">
                                </span>
                                <p className="text-xs text-white/60">Apasa Exerseaza semn</p>
                              </div>
                            )}

                            {!esteModPractica && esteLiteraDinamica(literaSelectata) && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white/70 font-mono text-xl">
                                  {literaSelectata}
                                </div>
                                <p className="text-sm text-white/70 font-medium">Semn dinamic</p>
                                <p className="text-xs text-white/50">
                                  Poza poate fi vizualizata, dar exersarea prin camera nu este disponibila pentru aceasta litera.
                                </p>
                              </div>
                            )}
                        {!wsConectat && esteActiva && <div className="absolute top-2 left-2 right-2 bg-amber-500/90 text-white text-xs px-3 py-1.5 rounded-lg text-center z-10">Backend offline</div>}
                      </div>
                    </div>
                  </div>
                  {esteModPractica && !rezultatValidare && wsConectat && (
                    <div className="bg-primar-50 border border-primar-100 rounded-xl px-4 py-2.5">
                      <p className="text-xs text-primar-600 text-center">
                        Tine semnul corect 2 secunde - validarea e automata</p>
                    </div>
                  )}
                  {esteLiteraDinamica(literaSelectata) ? (
                    <button disabled
                      className="w-full bg-slate-200 text-slate-500 font-medium py-3.5 rounded-2xl text-base cursor-not-allowed">
                      Exersare indisponibila pentru semn dinamic
                    </button>
                  ) : !esteModPractica ? (
                    <button onClick={async () => {
                        setEsteModPractica(true)
                        setRezultatValidare(null)
                        refRezultatValidare.current = null
                        reseteazaTimerIncercare()
                        await startPractica()
                      }}
                      className="w-full bg-primar-500 hover:bg-primar-600 text-white font-medium py-3.5 rounded-2xl transition-colors text-base">
                      ▶ Exerseaza semn
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {!wsConectat && (
                        <div className="grid grid-cols-2 gap-2">
                        </div>
                      )}
                      <button onClick={() => { setEsteModPractica(false); stopPractica() }} 
                      className="w-full py-3 rounded-2xl text-base text-text-secundar hover:bg-slate-100 border border-slate-200">
                        ⏹ Opreste camera</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/*TAB ANTRENEAZA*/}
        {tabActiv === TAB_ANTRENEAZA && (
          <div className="hidden lg:flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-primar-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <div>
                  <p className="text-sm font-semibold text-text-principal">Colecteaza date de antrenament</p>
                  <p className="text-xs text-text-tertiar">Selecteaza litera · porneste camera · salveaza</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 bg-primar-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <div>
                  <p className="text-sm font-semibold text-text-principal">Antreneaza modelul ML</p>
                  <p className="text-xs text-text-tertiar">Dupa ce ai min. {MINIM_ESANTIOANE} esantioane per litera</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 items-start">
              <div ref={refColStanga} className="flex flex-col gap-4">
                {gridLitere}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="font-mono font-bold text-lg text-primar-600 leading-none">{literaCol}</span>
                      </div>
                      <p className="text-xs text-text-secundar truncate">{DESCRIERI_SEMNE_LMG[literaCol]}</p>
                    </div>
                  </div>
                  <div className="relative bg-slate-900 overflow-hidden" style={{ aspectRatio: '4/3' }}>
                    <div className="absolute inset-0" style={{ transform: 'scaleX(-1)' }}>
                      <video ref={refVideoCol} className="w-full h-full object-cover" playsInline muted autoPlay />
                      <canvas ref={refCanvasCol} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    {flash && <div className="absolute inset-0 bg-primar-400/45 z-30 pointer-events-none" />}
                    {activaCol && (
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-10">
                        {mainDetectata ? (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-white text-xs">
                              Detectat: <span className="font-mono font-bold text-base">{literaDetCol}</span>
                              <span className="text-white/40">{incredereCol}%</span>
                            </span>
                            <span className="text-primar-300 text-xs">↓ Salveaza</span>
                          </div>
                        ) : (
                          <p className="text-white/50 text-xs text-center">Arata semnul <strong className="text-white font-mono">{literaCol}</strong> la camera</p>
                        )}
                      </div>
                    )}
                    {!activaCol && (
                      <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-3 z-10">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center"><span className="text-2xl">
                          </span></div>
                        <p className="text-white/50 text-sm">Camera oprita</p>
                      </div>
                    )} 
                  </div>
                </div>
              </div>

              <div ref={refColDreapta} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${statistici?.model_antrenat ? 'bg-primar-50 border-primar-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-principal">
                      {statistici?.model_antrenat ? 'Model activ' : 'Niciun model antrenat'}
                    </span>
                    {statistici?.acuratete_model != null && (
                      <span className="text-xs text-text-tertiar">{Math.round(statistici.acuratete_model * 100)}% acuratete</span>
                    )}
                  </div>
                  <span className="text-sm font-bold font-mono text-text-principal">
                    {nrLitereGata}<span className="text-text-tertiar text-xs font-normal">/26</span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100 flex-shrink-0">
                  <p className="text-sm font-semibold text-text-principal">Progres colectare</p>
                  <div className="flex items-center gap-2">
                    {statistici && <span className="text-xs text-text-tertiar font-mono">{statistici.total_esantioane} total</span>}
                    <button onClick={loadStats} disabled={seIncarcaStats}
                      className="w-6 h-6 flex items-center justify-center text-primar-500 hover:bg-primar-50 rounded-lg transition-colors disabled:opacity-40">
                      {seIncarcaStats ? <span className="w-3 h-3 border border-primar-400 border-t-transparent rounded-full animate-spin" /> : <span className="text-sm">↻</span>}
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 px-3 py-2">
                  {!statistici ? (
                    <p className="text-xs text-text-tertiar text-center py-6">Conecteaza-te la backend.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {ALFABETUL_LMG.map((l) => {
                        const nr = getNr(l), pc = Math.min(100, Math.round((nr / MINIM_ESANTIOANE) * 100)), sel = l === literaCol
                        return (
                          <button key={l}
                            onClick={() => {
                              setLiteraCol(l)
                              setMainDetectata(false)
                              refMainDetectataCol.current = false
                              setLiteraDetCol(''); setIncredereCol(0)
                              refCooldownLitera.current = Date.now() + 1500
                            }}
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors text-left ${sel ? 'bg-primar-50 border border-primar-100' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <span className={`font-mono font-bold text-xs w-4 flex-shrink-0 ${sel ? 'text-primar-600' : 'text-text-secundar'}`}>{l}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-300 ${culBara(nr)}`} style={{ width: `${pc}%` }} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums w-9 text-right flex-shrink-0 ${culText(nr)}`}>{nr}/{MINIM_ESANTIOANE}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {ButoaneCamera}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                {mesajTrain && (
                  <div className={`rounded-xl px-3 py-2.5 text-xs font-medium ${esteEroare ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-primar-50 border border-primar-100 text-primar-700'}`}>
                    {mesajTrain}
                  </div>
                )}
                <button onClick={handleTrain} disabled={seAntreneaza}
                  className="w-full bg-primar-600 hover:bg-primar-700 disabled:bg-primar-300 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm shadow-sm">
                  {seAntreneaza
                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Se antreneaza...</span>
                    : 'Antreneaza modelul ML acum'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/*Fallback mobile*/}
        {tabActiv === TAB_ANTRENEAZA && (
          <div className="lg:hidden space-y-4">
            {gridLitere}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="relative bg-slate-900" style={{ aspectRatio: '4/3' }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center"><span className="text-2xl">
                    </span></div>
                  <p className="text-white/50 text-sm">Foloseste desktop pentru colectare</p>
                </div>
              </div>
            </div>
            {ButoaneCamera}
            <button onClick={handleTrain} disabled={seAntreneaza}
              className="w-full bg-primar-600 hover:bg-primar-700 disabled:bg-primar-300 text-white font-semibold py-3.5 rounded-xl transition-colors text-sm">
              {seAntreneaza ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Se antreneaza...</span> : 'Antreneaza modelul ML acum'}
            </button>
          </div>
        )}

      </main>
    </div>
  )
}