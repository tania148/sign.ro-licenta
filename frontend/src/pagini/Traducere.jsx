import { useState, useEffect, useRef, useCallback } from 'react'
import BaraNavigare from '../componente/BaraNavigare.jsx'
import { salveazaCuvantTradus, creeazaConexiuneWebSocket } from '../servicii/apiServicii.js'

//MediaPipe - aceeasi instanta globala ca in Invata.jsx
//Se preincarca la import, camera porneste imediat fara sa astepte
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
    console.warn('[MediaPipe] Fallback la backend:', e)
    return null
  } finally {
    _mpLoading = false
  }
}

incarcaMediaPipe()

const DICTIONAR_AUTOCOMPLETE = [
  //Programare generala
  'ALGORITM','APLICATIE','ARHITECTURA','ARRAY','ATRIBUT',
  'BACKEND','BAZA','BIBLIOTECA','BUG','BUTON',
  'CLASA','CLIENT','COD','COMPILATOR','COMPONENTA','CONEXIUNE','CONFIGURARE','CONSTANTA',
  'DATE','DEBUG','DECLARATIE','DEPENDENTA','DEPLOYMENT','FUNCTIE',
  'EROARE','EVENIMENT','EXECUTIE','EXPRESIE',
  'FISIER','FLUX','FRAMEWORK','FRONTEND',
  'INTEROGARE','INTERFATA','IMPORT',
  'LISTA','LOGARE','LOGICA','LOOP',
  'METODA','MODEL','MODUL',
  'OBIECT','OPERATIE','OPTIMIZARE',
  'PACHET','PARAMETRU','PLATFORMA','POINTER','PROPRIETATE','PROTOCOL',
  'RAMURA','RECURSIVITATE','REFACTORIZARE','REGISTRU','REQUEST','RESPONSE','RETEA',
  'RUTARE','SCRIPT','SECURITATE','SERVER','SERVICIU','SISTEM',
  'SORTARE','STACK','STARE','STRING','STRUCTURA',
  'TABELA','TESTARE','TIP',
  'UTILIZATOR',
  'VALIDARE','VARIABILA','VERSIUNE',
  'GET','SET','POST','PUT','DELETE',
  'FETCH','PUSH','PULL','MERGE','COMMIT','BRANCH','DEPLOY',
  'TOKEN','CACHE','QUERY','INDEX','JOIN','VIEW',
  'INPUT','OUTPUT','UPLOAD','DOWNLOAD',
  'LOGIN','LOGOUT','REGISTER',
  'API','URL','HTTP','JSON','XML','HTML','CSS',
  'NULA','BOOLEAN','INTEGER','FLOAT','VOID',
]

const CUVINTE_CU_VIDEO = new Set([
  'getter','setter','array','layer','clase','limbaj','code','soft',
  'software','programe','economie','coada','secventa','arbore',
  'diagrama','ruta','frontend','backend','browser','algoritm',
  'afisare','user','aplicatie','retea','proces','search','lista',
  'cheie','ordonare','bug','structura','acces','apelare',
])

const PRAG_INCREDERE_MINIM=0.75
const INTARZIERE_INTRE_LITERE=1500
const FRECVENTA_TRIMITERE_MS=100

const CONEXIUNI_SCHELET=[
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
]

export default function Traducere() {
  const [literaCurenta, setLiteraCurenta]=useState('')
  const [incredereDetectieProcentual, setIncredereDetectieProcentual]=useState(0)
  const [litereCuvantCurent, setLitereCuvantCurent]=useState([])
  const [cuvinteSesiuneCurenta, setCuvinteSesiuneCurenta]=useState([])
  const [sugestiiAutocomplete, setSugestiiAutocomplete]=useState([])
  const [esteActiva, setEsteActiva]= useState(false)
  const [esteMainaDetectata, setEsteMainaDetectata]= useState(false)
  const [esteWebSocketConectat, setEsteWebSocketConectat]=useState(false)
  const [mesajEroareCamera, setMesajEroareCamera]=useState('')
  const [seSalveazaCuvantul, setSeSalveazaCuvantul]=useState(false)

  const refElementVideo=useRef(null)
  const refElementCanvas=useRef(null)
  const refBuclaProcesareCadre=useRef(null)
  const refConexiuneWebSocket=useRef(null)
  const refTimestampUltimaLitera=useRef(0)
  const refTimestampUltimTrimitere=useRef(0)
  const refIncrederiCumulate=useRef([])
  const refLitereCuvantCurent=useRef([])
  const refMainaDetectataState=useRef(false)
  const refAsteaptaRaspuns=useRef(false)

  const [videoActiv, setVideoActiv] = useState(null)

  useEffect(() => { refLitereCuvantCurent.current = litereCuvantCurent }, [litereCuvantCurent])

  useEffect(() => {
    return () => opresteCameraVideo()
  }, [])

  //WS - primeste predictie de la backend
  useEffect(() => {
    const refHandler = { current: null }
    refHandler.current = (datePrimite) => {
      refAsteaptaRaspuns.current = false
      if (datePrimite.tip === 'predictie') {
        const { litera, incredere, repere } = datePrimite.date
        //Schelet din backend doar daca MP nu e disponibil
        if (repere?.length === 21 && !_mpInstance) {
          deseneazaScheletDinRepere(repere)
          if (!refMainaDetectataState.current) {
            refMainaDetectataState.current = true
            setEsteMainaDetectata(true)
          }
        }
        procesheazaPredictieBackend(litera, incredere)
      } else if (datePrimite.tip === 'stare_mana' && !datePrimite.date.mana_detectata) {
        if (!_mpInstance) {
          refMainaDetectataState.current = false
          setEsteMainaDetectata(false)
          setLiteraCurenta('')
          setIncredereDetectieProcentual(0)
          const ctx = refElementCanvas.current?.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, refElementCanvas.current.width, refElementCanvas.current.height)
        }
      }
    }
    const conexiune = creeazaConexiuneWebSocket({
      peRaspunsPrimite: (d) => refHandler.current(d),
      peDeschidereConexiune: () => setEsteWebSocketConectat(true),
      peInchidereConexiune: () => setEsteWebSocketConectat(false),
      peEroareConexiune: () => setEsteWebSocketConectat(false),
    })
    refConexiuneWebSocket.current = conexiune
    return () => { if (refConexiuneWebSocket.current) refConexiuneWebSocket.current.close() }
  }, [])

  //Pornire camera 
  async function pornesteCameraVideo() {
    setMesajEroareCamera('')
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      refElementVideo.current.srcObject = flux
      await new Promise((r) => { refElementVideo.current.onloadedmetadata = r })
      await refElementVideo.current.play()
      setEsteActiva(true)
      refMainaDetectataState.current = false
      refBuclaProcesareCadre.current = requestAnimationFrame(buclaProcesare)
    } catch (err) {
      if (err.name === 'NotAllowedError') setMesajEroareCamera('Accesul la cameră a fost refuzat.')
      else setMesajEroareCamera('Nu s-a putut accesa camera.')
    }
  }

  function opresteCameraVideo() {
    if (refBuclaProcesareCadre.current) cancelAnimationFrame(refBuclaProcesareCadre.current)
    if (refElementVideo.current?.srcObject) {
      refElementVideo.current.srcObject.getTracks().forEach((t) => t.stop())
      refElementVideo.current.srcObject = null
    }
    const ctx = refElementCanvas.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, refElementCanvas.current.width, refElementCanvas.current.height)
    setEsteActiva(false)
    setLiteraCurenta('')
    setIncredereDetectieProcentual(0)
    setEsteMainaDetectata(false)
    refMainaDetectataState.current = false
  }

  //Desenare schelet
  function deseneazaScheletDinRepere(repere) {
    const canvas = refElementCanvas.current
    const video  = refElementVideo.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    ctx.clearRect(0, 0, w, h)
    const pts = repere.map(([x, y]) => ({ x: x * w, y: y * h }))
    ctx.strokeStyle = 'rgba(99,102,241,0.7)'; ctx.lineWidth = 2
    CONEXIUNI_SCHELET.forEach(([a, b]) => {
      if (pts[a] && pts[b]) {
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y)
        ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke()
      }
    })
    pts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 6 : 4, 0, 2 * Math.PI)
      ctx.fillStyle = i === 0 ? '#6366f1' : '#10b981'; ctx.fill()
    })
  }

  //Captura cadru JPEG (fallback cand MP nu e disponibil) 
  function captureazaCadruVideo() {
    const video = refElementVideo.current
    if (!video || video.readyState < 2) return null
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 240
    canvas.getContext('2d').drawImage(video, 0, 0, 320, 240)
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
  }

  //Bucla principala
  //Daca MP e disponibil: schelet local instant, trimite repere
  //Daca MP nu e disponibil: trimite cadru JPEG (ca inainte)
  const buclaProcesare = useCallback(() => {
    const v = refElementVideo.current
    if (!v || v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      refBuclaProcesareCadre.current = requestAnimationFrame(buclaProcesare); return
    }

    const hl  = _mpInstance
    const now = Date.now()

    if (hl) {
      //Mod MediaPipe local (schelet instant, zero delay)
      const rezultat = hl.detectForVideo(v, now)
      if (rezultat.landmarks.length > 0) {
        const repere = rezultat.landmarks[0].map(p => [p.x, p.y])
        deseneazaScheletDinRepere(repere)
        if (!refMainaDetectataState.current) {
          refMainaDetectataState.current = true
          setEsteMainaDetectata(true)
        }
        if (now - refTimestampUltimTrimitere.current >= FRECVENTA_TRIMITERE_MS) {
          refTimestampUltimTrimitere.current = now
          if (refConexiuneWebSocket.current?.readyState === WebSocket.OPEN) {
            refConexiuneWebSocket.current.send(JSON.stringify({
              tip: 'repere_mana', date: { repere },
            }))
          }
        }
      } else {
        if (refMainaDetectataState.current) {
          refMainaDetectataState.current = false
          setEsteMainaDetectata(false)
          setLiteraCurenta('')
          setIncredereDetectieProcentual(0)
        }
        const ctx = refElementCanvas.current?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, refElementCanvas.current.width, refElementCanvas.current.height)
      }
    } else {
      //Fallback: trimite cadru JPEG la backend
      if (now - refTimestampUltimTrimitere.current >= FRECVENTA_TRIMITERE_MS) {
        refTimestampUltimTrimitere.current = now
        if (!refAsteaptaRaspuns.current) {
          try {
            const frame = captureazaCadruVideo()
            if (frame && refConexiuneWebSocket.current?.readyState === WebSocket.OPEN) {
              refAsteaptaRaspuns.current = true
              refConexiuneWebSocket.current.send(JSON.stringify({
                tip: 'cadru_video', date: { frame, timestamp: now },
              }))
            }
          } catch { /* */ }
        }
      }
    }

    refBuclaProcesareCadre.current = requestAnimationFrame(buclaProcesare)
  }, [])

  //Procesare predictie
  function procesheazaPredictieBackend(literaDetectata, incredere) {
    setLiteraCurenta(literaDetectata)
    setIncredereDetectieProcentual(Math.round(incredere * 100))
    if (incredere < PRAG_INCREDERE_MINIM) return
    const acum = Date.now()
    if (acum - refTimestampUltimaLitera.current < INTARZIERE_INTRE_LITERE) return
    refTimestampUltimaLitera.current = acum
    refIncrederiCumulate.current.push(incredere)
    setLitereCuvantCurent((prev) => {
      const nou = [...prev, literaDetectata]
      actualizeazaSugestii(nou)
      return nou
    })
  }

  function actualizeazaSugestii(litere) {
    if (!litere.length) { setSugestiiAutocomplete([]); return }
    const prefix = litere.join('')
    setSugestiiAutocomplete(DICTIONAR_AUTOCOMPLETE.filter((c) => c.startsWith(prefix)).slice(0, 4))
  }

  async function confirmasiSalveazaCuvantulCurent() {
    if (!litereCuvantCurent.length) return
    const text = litereCuvantCurent.join('')
    const medie = refIncrederiCumulate.current.length
      ? refIncrederiCumulate.current.reduce((s, v) => s + v, 0) / refIncrederiCumulate.current.length : 0
    setSeSalveazaCuvantul(true)
    try { await salveazaCuvantTradus(text, medie) } catch { /* continuam local */ }
    finally { setSeSalveazaCuvantul(false) }
    setCuvinteSesiuneCurenta((prev) => [{
      textCuvant: text,
      incredereProcentual: Math.round(medie * 100),
      timestampAdaugare: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev])
    reseteazaCuvantulCurent()
  }

  function aplicaCuvantulSugerat(cuvant) {
    const medie = refIncrederiCumulate.current.length
      ? refIncrederiCumulate.current.reduce((s, v) => s + v, 0) / refIncrederiCumulate.current.length : 0.9
    setCuvinteSesiuneCurenta((prev) => [{
      textCuvant: cuvant,
      incredereProcentual: Math.round(medie * 100),
      timestampAdaugare: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev])
    salveazaCuvantTradus(cuvant, medie).catch(() => {})
    reseteazaCuvantulCurent()
  }

  function stergeUltimaLitera() {
    setLitereCuvantCurent((l) => { const n = l.slice(0, -1); actualizeazaSugestii(n); return n })
    if (refIncrederiCumulate.current.length) refIncrederiCumulate.current = refIncrederiCumulate.current.slice(0, -1)
  }

  function reseteazaCuvantulCurent() {
    setLitereCuvantCurent([]); refIncrederiCumulate.current = []; setSugestiiAutocomplete([])
  }

  function pronuntaCuvantul() {
    const text = litereCuvantCurent.join('').toLowerCase()
    if (!text || !window.speechSynthesis) return
    const enunt = new SpeechSynthesisUtterance(text)
    enunt.lang = 'ro-RO'; enunt.rate = 0.85
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(enunt)
  }

  function clasaCuloareIncredere(v) {
    if (v >= 85) return 'bg-primar-500'
    if (v >= 65) return 'bg-amber-400'
    return 'bg-red-400'
  }

  const textCuvantFormat = litereCuvantCurent.join('')

  return (
    <div className="min-h-screen bg-fundal"> 
      <BaraNavigare />
      {videoActiv && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setVideoActiv(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-text-principal uppercase font-mono">{videoActiv}</p>
              <button onClick={() => setVideoActiv(null)} className="text-text-tertiar hover:text-text-principal text-xl leading-none">×</button>
            </div>
            <video
              key={videoActiv}
              src={`/semne-cuvinte/${videoActiv}.mp4`}
              className="w-full"
              autoPlay
              controls 
              onError={() => setVideoActiv(null)}
              muted
            />
          </div>
        </div>
      )}

      <main className="anima-aparitie">

      <div className="max-w-[1500px] mx-auto px-6 xl:px-8 pt-5 pb-4 mb-4">
        <h1 className="text-2xl font-semibold text-text-principal">Traducere în timp real</h1>
        <p className="text-sm mt-1 text-primar-600">Plasează mâna în fața camerei și formează literele LMG</p>
      </div>
      

      <div className="max-w-[1500px] mx-auto px-6 xl:px-8 pb-10">
        <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-6 items-stretch">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="relative aspect-video xl:aspect-auto xl:h-[560px] 2xl:h-[610px] bg-slate-900">
                <video ref={refElementVideo} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
                <canvas ref={refElementCanvas} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                {!esteActiva && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                    <p className="text-sm font-medium">Camera este oprită. Apasă butonul de mai jos pentru a porni camera.</p>
                  </div>
                )}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  {esteActiva && (
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${esteMainaDetectata ? 'bg-primar-500/90 text-white' : 'bg-black/50 text-white/60'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${esteMainaDetectata ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                      {esteMainaDetectata ? 'Mână detectată' : 'Nicio mână'}
                    </span>
                  )}
                </div>
              </div>
              {esteActiva && literaCurenta && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-text-secundar">Nivel de încredere</span>
                    <span className="text-xs font-semibold text-text-principal">{incredereDetectieProcentual}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${clasaCuloareIncredere(incredereDetectieProcentual)}`} style={{ width: `${incredereDetectieProcentual}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <button onClick={esteActiva ? opresteCameraVideo : pornesteCameraVideo}
                className={`w-full py-2.5 rounded-xl font-medium text-sm transition-colors ${esteActiva ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-primar-600 text-white hover:bg-primar-700'}`}>
                {esteActiva ? 'Oprește camera' : 'Pornește camera'}
              </button>
            </div>
            {mesajEroareCamera && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{mesajEroareCamera}</div>
            )}
          </div>

          <div className="space-y-4 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[150px]">
              <p className="text-xs font-medium text-text-tertiar uppercase tracking-wider mb-3">Litera detectată</p>
              <div className="flex items-end justify-center gap-4">
                <span className="font-mono text-8xl font-bold text-primar-600 leading-none select-none">{literaCurenta || '-'}</span>
                {literaCurenta && (
                  <span className={`mb-1 text-xs font-medium px-2.5 py-1 rounded-lg ${incredereDetectieProcentual >= 80 ? 'bg-primar-50 text-primar-600' : 'bg-amber-50 text-amber-600'}`}>
                    {incredereDetectieProcentual}% sigur
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[285px]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-text-tertiar uppercase tracking-wider">Cuvânt în formare</p>
                <div className="flex gap-1.5">
                  <button onClick={stergeUltimaLitera} disabled={!litereCuvantCurent.length} className="px-2.5 py-1 rounded-lg text-xs text-text-secundar hover:bg-slate-100 disabled:opacity-30">Șterge</button>
                  <button onClick={reseteazaCuvantulCurent} disabled={!litereCuvantCurent.length} className="px-2.5 py-1 rounded-lg text-xs text-red-500 hover:bg-red-50 disabled:opacity-30">Golește</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[40px] mb-3">
                {!litereCuvantCurent.length ? (
                  <span className="text-text-tertiar text-sm italic self-center">Nicio literă detectată încă...</span>
                ) : litereCuvantCurent.map((l, i) => (
                  <span key={`${l}-${i}`} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-mono font-bold text-sm border ${i === litereCuvantCurent.length - 1 ? 'bg-primar-50 border-primar-300 text-primar-700' : 'bg-slate-50 border-slate-200 text-text-principal'}`}>{l}</span>
                ))}
              </div>
              {textCuvantFormat && (
                <div className="py-3 border-y border-slate-100 mb-3">
                  <p className="text-xs text-text-tertiar mb-1">Cuvânt format:</p>
                  <p className="font-mono text-xl font-bold text-text-principal">{textCuvantFormat}</p>
                </div>
              )}
              {sugestiiAutocomplete.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-text-tertiar mb-1.5">Sugestii:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sugestiiAutocomplete.map((c) => (
                      <button key={c} onClick={() => aplicaCuvantulSugerat(c)} className="px-3 py-1 rounded-full border border-primar-200 text-primar-600 text-xs hover:bg-primar-50 font-medium">{c}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={confirmasiSalveazaCuvantulCurent} disabled={!litereCuvantCurent.length || seSalveazaCuvantul}
                  className="flex-1 bg-primar-500 hover:bg-primar-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
                  {seSalveazaCuvantul ? <span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Se salvează...</span> : 'Confirmă cuvântul'}
                </button>
              </div>
            </div>
            {cuvinteSesiuneCurenta.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 min-h-[170px]">
                <p className="text-xs font-medium text-text-tertiar uppercase tracking-wider mb-3">Traduse în sesiunea curentă</p>
                <div className="flex flex-wrap gap-2 max-h-[135px] overflow-y-auto pr-1">
                  {cuvinteSesiuneCurenta.map((el, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-primar-50 rounded-full">
                      <span className="font-semibold text-primar-700 text-sm">{el.textCuvant}</span>
                      <span className="text-xs text-primar-500">{el.incredereProcentual}%</span>
                      {CUVINTE_CU_VIDEO.has(el.textCuvant.toLowerCase()) && (
                        <button
                          onClick={() => setVideoActiv(el.textCuvant.toLowerCase())}
                        className="text-primar-400 hover:text-primar-600 text-xs leading-none ml-0.5"
                        title="Vezi semnul">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                      </button>
                      )}
                      <button onClick={() => { const e = new SpeechSynthesisUtterance(el.textCuvant.toLowerCase()); e.lang='ro-RO'; e.rate=0.85; window.speechSynthesis.cancel(); window.speechSynthesis.speak(e) }} className="text-primar-400 hover:text-primar-600 text-xs leading-none ml-0.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </main>
    </div>
  )
}