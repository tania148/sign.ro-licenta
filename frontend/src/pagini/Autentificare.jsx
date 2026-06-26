import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { folosestContextUtilizator } from '../context/ContextUtilizator.jsx'
import { conecteazaUtilizator, inregistreazaUtilizator } from '../servicii/apiServicii.js'

const MOD_CONECTARE = 'conectare'
const MOD_INREGISTRARE = 'inregistrare'
 
const REGULI_PAROLA = [
  { id: 'lungime', descriere: 'Minim 8 caractere', testeaza: (p) => p.length >= 8 },
  { id: 'litera_mare', descriere: 'Cel puțin o literă mare (A-Z)', testeaza: (p) => /[A-Z]/.test(p) },
  { id: 'litera_mica', descriere: 'Cel puțin o literă mică (a-z)', testeaza: (p) => /[a-z]/.test(p) },
  { id: 'cifra', descriere: 'Cel puțin o cifră (0-9)', testeaza: (p) => /[0-9]/.test(p) },
  { id: 'special', descriere: 'Cel puțin un caracter special (!@#$%...)', testeaza: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
]

function valideazaEmail(email) {
  const regex = /^[a-zA-Z0-9._%+\-]{3,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
  return regex.test(email.trim())
}

function calculeazaTariaParolei(parola) {
  const n = REGULI_PAROLA.filter((r) => r.testeaza(parola)).length
  if (n <= 1) return { culoare: 'bg-red-400', latime: '20%', eticheta: 'Slabă', clasa: 'text-red-500' }
  if (n === 2) return { culoare: 'bg-orange-400', latime: '40%', eticheta: 'Medie', clasa: 'text-orange-500' }
  if (n === 3) return { culoare: 'bg-amber-400', latime: '65%', eticheta: 'Bună', clasa: 'text-amber-600' }
  if (n === 4) return { culoare: 'bg-lime-500', latime: '85%', eticheta: 'Puternică', clasa: 'text-lime-600' }
  return { culoare: 'bg-accent-500', latime: '100%', eticheta: 'Excelentă', clasa: 'text-accent-600' }
}

export default function Autentificare() {
  const [modFormular, setModFormular] = useState(MOD_CONECTARE)
  const [campNume, setCampNume] = useState('')
  const [campEmail, setCampEmail] = useState('')
  const [campParola, setCampParola] = useState('')
  const [campConfirmareParola, setCampConfirmareParola] = useState('')
  const [mesajEroare, setMesajEroare] = useState('')
  const [seTrimite, setSeTrimite] = useState(false)
  const [seVedParolele, setSeVedParolele] = useState(false)

  const { salveazaSesiuneUtilizator } = folosestContextUtilizator()
  useEffect(() => {
    const vars = {
      '--primar-50': '#f0f9ff', 
      '--primar-100': '#e0f2fe', 
      '--primar-200': '#bae6fd',
      '--primar-400': '#38bdf8', 
      '--primar-500': '#0ea5e9', 
      '--primar-600': '#0284c7',
      '--primar-700': '#0369a1', 
      '--primar-900': '#0c4a6e',
    }
    Object.entries(vars).forEach(([prop, val]) => {
      document.documentElement.style.setProperty(prop, val)
    })
  }, [])
  const navigheazaLaRuta = useNavigate()

  const tariaParolei = campParola ? calculeazaTariaParolei(campParola) : null
  const paroleleSePotrives = campParola && campConfirmareParola && campParola === campConfirmareParola

  function valideaza() {
    if (modFormular === MOD_INREGISTRARE) {
      if (!campNume.trim()) { setMesajEroare('Numele este obligatoriu.'); return false }
      if (campNume.trim().length < 3) { setMesajEroare('Numele trebuie să aibă cel puțin 3 caractere.'); return false }
      if (!/^[a-zA-ZăâîșțĂÂÎȘȚ\s\-]+$/.test(campNume.trim())) { setMesajEroare('Numele poate conține doar litere și spații.'); return false }
    }
    if (!campEmail.trim()) { setMesajEroare('Adresa de email este obligatorie.'); return false }
    if (!valideazaEmail(campEmail)) { setMesajEroare('Email invalid. Format corect: abc@domeniu.com (minim 3 caractere înainte de @)'); return false }
    if (!campParola) { setMesajEroare('Parola este obligatorie.'); return false }
    if (modFormular === MOD_INREGISTRARE) {
      const neTrecute = REGULI_PAROLA.filter((r) => !r.testeaza(campParola))
      if (neTrecute.length > 0) { setMesajEroare('Parola nu respectă: ' + neTrecute.map((r) => r.descriere.toLowerCase()).join(', ') + '.'); return false }
      if (!campConfirmareParola) { setMesajEroare('Te rugăm să confirmi parola.'); return false }
      if (campParola !== campConfirmareParola) { setMesajEroare('Parolele introduse nu se potrivesc.'); return false }
    } else {
      if (campParola.length < 6) { setMesajEroare('Parola trebuie să aibă cel puțin 6 caractere.'); return false }
    }
    return true
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setMesajEroare('')
    if (!valideaza()) return
    setSeTrimite(true)
    try {
      let raspuns
      if (modFormular === MOD_CONECTARE) {
        raspuns = await conecteazaUtilizator(campEmail.trim(), campParola)
      } else {
        raspuns = await inregistreazaUtilizator(campNume.trim(), campEmail.trim(), campParola)
      }
      salveazaSesiuneUtilizator(raspuns.utilizator, raspuns.token)
      navigheazaLaRuta('/traducere')
    } catch (eroare) {
      if (eroare.code === 'ERR_NETWORK' || !eroare.response) {
        setMesajEroare('Serverul nu răspunde. Backend-ul trebuie să ruleze pe portul 8000.')
      } else if (eroare.response?.status === 409) {
        setMesajEroare('Există deja un cont cu această adresă de email.')
      } else if (eroare.response?.status === 401) {
        setMesajEroare('Email sau parolă incorectă.')
      } else {
        setMesajEroare(eroare.response?.data?.detaliu || 'A apărut o eroare. Încearcă din nou.')
      }
    } finally {
      setSeTrimite(false)
    }
  }

  function schimbaModul(modNou) {
    setModFormular(modNou)
    setMesajEroare('')
    setCampNume(''); setCampEmail(''); setCampParola(''); setCampConfirmareParola('')
  }

  const clasaInput = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primar-400 focus:ring-2 focus:ring-primar-100 outline-none text-sm transition-all'

  return (
    <div className="min-h-screen bg-fundal flex items-center justify-center p-4">
      <div className="w-full max-w-md anima-aparitie">
        <div className="text-center mb-8">
          <h1 className="font-mono text-4xl font-bold text-primar-600 mb-2">sign<span className="text-slate-300">.</span>ro</h1>
          <p className="text-text-secundar text-sm">Recunoaștere ASL în timp real</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            {[{ mod: MOD_CONECTARE, eticheta: 'Conectare' }, { mod: MOD_INREGISTRARE, eticheta: 'Înregistrare' }].map(({ mod, eticheta }) => (
              <button key={mod} type="button" onClick={() => schimbaModul(mod)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${modFormular === mod ? 'bg-white text-primar-600 shadow-sm' : 'text-text-secundar hover:text-text-principal'}`}>
                {eticheta}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">

              {/*Nume*/}
              {modFormular === MOD_INREGISTRARE && (
                <div>
                  <label className="block text-sm font-medium text-text-secundar mb-1.5">Nume complet <span className="text-red-400">*</span></label>
                  <input type="text" value={campNume} onChange={(e) => setCampNume(e.target.value)}
                    placeholder="Ex: Maria Ionescu" autoComplete="name" className={clasaInput} />
                  <p className="text-xs text-text-tertiar mt-1">Minim 3 caractere, doar litere și spații</p>
                </div>
              )}

              {/*Email*/}
              <div>
                <label className="block text-sm font-medium text-text-secundar mb-1.5">Adresă email <span className="text-red-400">*</span></label>
                <input type="email" value={campEmail} onChange={(e) => setCampEmail(e.target.value)}
                  placeholder="exemplu@domeniu.com" autoComplete="email" className={clasaInput} />
              </div>

              {/*Parola*/}
              <div>
                <label className="block text-sm font-medium text-text-secundar mb-1.5">Parolă <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input type={seVedParolele ? 'text' : 'password'} value={campParola}
                    onChange={(e) => setCampParola(e.target.value)}
                    placeholder={modFormular === MOD_INREGISTRARE ? 'Minim 8 caractere' : 'Parola ta'}
                    autoComplete={modFormular === MOD_CONECTARE ? 'current-password' : 'new-password'}
                    className={`${clasaInput} pr-10`} />
                  <button type="button" onClick={() => setSeVedParolele((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiar hover:text-text-secundar"
                    aria-label={seVedParolele ? 'Ascunde parola' : 'Arată parola'}>
                    {seVedParolele ? '🙈' : '👁'}
                  </button>
                </div>

                {/* Taria parolei */}
                {modFormular === MOD_INREGISTRARE && campParola && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-tertiar">Tăria parolei:</span>
                      <span className={`text-xs font-semibold ${tariaParolei?.clasa}`}>{tariaParolei?.eticheta}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${tariaParolei?.culoare}`} style={{ width: tariaParolei?.latime }} />
                    </div>
                  </div>
                )}

                {/* Checklist reguli */}
                {modFormular === MOD_INREGISTRARE && campParola && (
                  <ul className="mt-2 space-y-1">
                    {REGULI_PAROLA.map((regula) => {
                      const ok = regula.testeaza(campParola)
                      return (
                        <li key={regula.id} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-accent-600' : 'text-text-tertiar'}`}>
                          <span>{ok ? '✓' : '○'}</span>{regula.descriere}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Confirmare parola */}
              {modFormular === MOD_INREGISTRARE && (
                <div>
                  <label className="block text-sm font-medium text-text-secundar mb-1.5">Confirmă parola <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input type={seVedParolele ? 'text' : 'password'} value={campConfirmareParola}
                      onChange={(e) => setCampConfirmareParola(e.target.value)}
                      placeholder="Repetă parola" autoComplete="new-password"
                      className={`${clasaInput} pr-10 ${
                        campConfirmareParola && !paroleleSePotrives ? 'border-red-300 focus:border-red-400 focus:ring-red-100' :
                        paroleleSePotrives ? 'border-accent-400 focus:border-accent-500 focus:ring-accent-100' : ''
                      }`} />
                    {campConfirmareParola && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base">
                        {paroleleSePotrives ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                  {campConfirmareParola && !paroleleSePotrives && (
                    <p className="text-xs text-red-500 mt-1">Parolele nu se potrivesc</p>
                  )}
                </div>
              )}

              {/*Mesaj eroare*/}
              {mesajEroare && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {mesajEroare}
                </div>
              )}

              {/*Submit*/}
              <button type="submit" disabled={seTrimite}
                className="w-full bg-primar-600 hover:bg-primar-700 disabled:bg-primar-300 text-white font-medium py-2.5 rounded-xl transition-colors text-sm mt-2">
                {seTrimite ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Se procesează...
                  </span>
                ) : modFormular === MOD_CONECTARE ? 'Intră în cont' : 'Creează cont'}
              </button>
            </div>
          </form>
        </div>

        {/* <p className="text-center text-xs text-text-tertiar mt-6">Aplicație realizată în cadrul lucrării de licență · UBB Cluj</p> */}
      </div>
    </div>
  )
}
