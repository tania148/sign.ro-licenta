import { useState, useEffect } from 'react'
import BaraNavigare from '../componente/BaraNavigare.jsx'
import { folosestContextUtilizator } from '../context/ContextUtilizator.jsx'
import {
  obtineStatisticiUtilizator,
  obtineActivitateCalendarUtilizator,
  exportaIstoricCaFisierPDF,
  obtineProgresDinvatareLitere,
} from '../servicii/apiServicii.js'

const DATE_STATISTICI_MOCK = {
  totalCuvinteTradusse: 47,
  totalLitereDetectate: 312,
  litereDinstinctStapanite: 14,
  acurateteaMedieGlobala: 89,
  minutePractica: 73,
  zileCuActivitate: 18,
}

export default function Profil() {
  const { utilizatorCurent } = folosestContextUtilizator()

  const LITERE_DINAMICE = ['J', 'Z']
  const esteLiteraDinamica = (litera) => LITERE_DINAMICE.includes(litera)
  const LITERE_EXERSABILE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    .split('')
    .filter((litera) => !esteLiteraDinamica(litera))

  const [statistici, setStatistici] = useState(DATE_STATISTICI_MOCK)
  const [celuleActivitateCalendar, setCeluleActivitateCalendar] = useState([])
  const [seIncarcaDatele, setSeIncarcaDatele] = useState(true)
  const [seExportaPDF, setSeExportaPDF] = useState(false)
  const [progresPeLitera, setProgresPeLitera] = useState({})
  const [lunaAfisata, setLunaAfisata] = useState(() => {
    const azi = new Date()
    return { an: azi.getFullYear(), luna: azi.getMonth() }
  })

  useEffect(() => {
    async function incarcaDateleProfilului() {
      setSeIncarcaDatele(true)
      try {
        const [dateStatistici, dateCalendar, dateProgres] = await Promise.allSettled([
          obtineStatisticiUtilizator(),
          obtineActivitateCalendarUtilizator(),
          obtineProgresDinvatareLitere(),
        ])
        if (dateStatistici.status === 'fulfilled') setStatistici(dateStatistici.value)
        if (dateCalendar.status === 'fulfilled') {
          setCeluleActivitateCalendar(dateCalendar.value.activitate ?? [])
        } else {
          setCeluleActivitateCalendar(genereazaCeluleCalendarMock())
        }
        if (dateProgres.status === 'fulfilled' && dateProgres.value?.progres) {
          setProgresPeLitera(dateProgres.value.progres)
        }
      } catch {
        setCeluleActivitateCalendar(genereazaCeluleCalendarMock())
      } finally {
        setSeIncarcaDatele(false)
      }
    }
    incarcaDateleProfilului()
  }, [])

  function genereazaCeluleCalendarMock() {
    return Array.from({ length: 91 }, (_, index) => ({
      data: new Date(Date.now() - index * 86400000).toISOString().split('T')[0],
      numarActivitati: Math.random() > 0.6 ? Math.floor(Math.random() * 10) + 1 : 0,
    })).reverse()
  }

  async function handleExportPDF() {
    setSeExportaPDF(true)
    try { await exportaIstoricCaFisierPDF() } catch { /* */ }
    finally { setSeExportaPDF(false) }
  }

  function clasaCuloareCelulaCalendar(numarActivitati) {
    if (numarActivitati===0) return 'bg-slate-100'
    if (numarActivitati<=2) return 'bg-primar-100'
    if (numarActivitati<=5) return 'bg-primar-300'
    if (numarActivitati<=8) return 'bg-primar-500'
    return 'bg-primar-600'
  }

  function genereazaZileLuna(an, luna) {
    const azi = new Date()
    const aziMidnight = new Date(azi.getFullYear(), azi.getMonth(), azi.getDate())
    const zileInLuna = new Date(an, luna + 1, 0).getDate()
    const primaZiSaptamana = new Date(an, luna, 1).getDay()
    const offsetStart = primaZiSaptamana === 0 ? 6 : primaZiSaptamana - 1
    const zile = []
    for (let i = 0; i < offsetStart; i++) zile.push(null)
    for (let z = 1; z <= zileInLuna; z++) {
      const dataString = `${an}-${String(luna + 1).padStart(2, '0')}-${String(z).padStart(2, '0')}`
      const celula = celuleActivitateCalendar.find((c) => c.data === dataString)
      zile.push({
        zi: z,
        data: dataString,
        numarActivitati: celula?.numarActivitati ?? 0,
        esteViitor: new Date(an, luna, z) > aziMidnight,
      })
    }
    console.log('Total zile:', zile.length, 'Prima zi:', zile.find(z => z?.zi === 7))

    return zile
  }

  const ZILE_SAPTAMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const LUNI_RO = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

  function poateMergeLunaUrmatoare() {
    const azi = new Date()
    return !(lunaAfisata.an === azi.getFullYear() && lunaAfisata.luna === azi.getMonth())
  }

  const initialaUtilizator = utilizatorCurent?.nume
    ? utilizatorCurent.nume.charAt(0).toUpperCase()
    : '?'

  const CARDURI_STATISTICI = [
    { eticheta: 'Cuvinte traduse',   valoare: statistici.totalCuvinteTradusse,    
      culoareCard: 'bg-pink-100 border-pink-200',     culoareText: 'text-pink-800',   culoareFundal: 'bg-pink-200' },

    { eticheta: 'Litere stăpânite',  valoare: `${statistici.litereDinstinctStapanite}/${LITERE_EXERSABILE.length}`,
    culoareCard: 'bg-blue-100 border-blue-200',   culoareText: 'text-blue-800',   culoareFundal: 'bg-blue-200' },

    { eticheta: 'Acuratețe medie',   valoare: `${statistici.acurateteaMedieGlobala}%`, 
    culoareCard: 'bg-green-100 border-green-200',  culoareText: 'text-green-800',  culoareFundal: 'bg-green-200' }, 

    { eticheta: 'Zile active', valoare: statistici.zileCuActivitate ?? 0, 
    culoareCard: 'bg-yellow-100 border-yellow-200', culoareText: 'text-yellow-800', culoareFundal: 'bg-yellow-200' },

    { eticheta: 'Litere detectate',  valoare: statistici.totalLitereDetectate,
    culoareCard: 'bg-violet-100 border-violet-200',  culoareText: 'text-violet-800', culoareFundal: 'bg-violet-200' },

    { eticheta: 'Streak zilnic',     valoare: `${statistici.streakCurent ?? 0}`, 
    culoareCard: 'bg-red-100 border-red-200',      culoareText: 'text-red-800',    culoareFundal: 'bg-red-200' }
  ]

  return (
    <div className="min-h-screen bg-fundal">
      <BaraNavigare /> 

      <main className="max-w-[1500px] mx-auto px-6 xl:px-8 py-8 anima-aparitie">

        {/*Header profil compact*/}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primar-100 text-primar-700 font-bold text-2xl flex items-center justify-center flex-shrink-0">
              {initialaUtilizator}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-text-principal">
                {utilizatorCurent?.nume ?? 'Utilizator'}
              </h1>
              <p className="text-base text-text-secundar">{utilizatorCurent?.email}</p>
              <p className="text-xs text-text-tertiar mt-0.5">
                Activ din {new Date(utilizatorCurent?.data_inregistrare ?? Date.now()).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={seExportaPDF}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primar-600 text-white text-base font-medium hover:bg-primar-700 disabled:bg-primar-300 transition-colors"
          >
            {seExportaPDF ? (
              <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Se generează...</>
            ) : '⬇ Exportă istoricul'}
          </button>
        </div>

        {/*Layout principal: stanga (stats + litere) | dreapta (calendar)*/}
        <div className="grid grid-cols-1 xl:grid-cols-[560px_1fr] gap-7 items-start">

          {/*Coloana stanga*/}
          <div className="flex flex-col gap-6">

            {/*Grid statistici 3x2*/}
            <div className="grid grid-cols-3 gap-5">
              {CARDURI_STATISTICI.map(({ eticheta, valoare, iconita, culoareFundal, culoareText, culoareCard }) => (
                <div key={eticheta} className={`rounded-2xl border p-6 min-h-[145px] ${culoareCard}`}>
                  <div className={`w-11 h-11 rounded-xl ${culoareFundal} flex items-center justify-center text-sm font-bold mb-4 ${culoareText}`}>
                    {valoare}
                  </div>
                  <p className="text-base font-medium text-text-secundar leading-snug">{eticheta}</p>
                </div>
              ))}
            </div>

            {/*Progres per literă*/}
            <div className="bg-white rounded-2xl border border-slate-200 p-7 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-principal">Progres per literă</h2>
                <span className="text-sm text-text-tertiar">
                  {statistici.litereDinstinctStapanite} din {LITERE_EXERSABILE.length} stăpânite
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((litera) => {
                const dinamica = esteLiteraDinamica(litera)
                const status = progresPeLitera[litera]?.status ?? 'neincercat'

                return (
                  <div
                    key={litera}
                    className={`relative w-12 h-12 rounded-xl border flex items-center justify-center font-mono text-sm font-bold ${
                      dinamica
                        ? 'bg-slate-100 border-dashed border-slate-300 text-slate-400'
                        : status === 'stapanit'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                        : status === 'in_progres'
                        ? 'bg-amber-50 border-amber-300 text-amber-600'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                    title={dinamica ? `${litera} - semn dinamic` : `${litera} - ${status}`}
                  >
                    {litera}

                    {dinamica && (
                      <span className="absolute -top-1.5 -right-1.5 text-[11px] bg-slate-300 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        ~
                      </span>
                    )}
                  </div>
                )
              })}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 pt-4 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-sm text-text-tertiar">
                  <span className="w-3 h-3 rounded border bg-emerald-50 border-emerald-300 flex-shrink-0" />Stăpânită
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-tertiar">
                  <span className="w-3 h-3 rounded border bg-amber-50 border-amber-300 flex-shrink-0" />În progres
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-tertiar">
                  <span className="w-3 h-3 rounded border bg-slate-50 border-slate-200 flex-shrink-0" />Neîncercat
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-tertiar">
                  <span className="w-3 h-3 rounded border border-dashed bg-slate-100 border-slate-300 flex-shrink-0" />Semn dinamic
                </span>
              </div>
            </div>
          </div>

          {/*Coloana dreapta: calendar*/}
          <div className="bg-white rounded-2xl border border-slate-200 p-7 min-h-[690px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-text-principal">Activitate lunară</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLunaAfisata(prev => {
                    const d = new Date(prev.an, prev.luna - 1)
                    return { an: d.getFullYear(), luna: d.getMonth() }
                  })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-secundar transition-colors">←</button>
                <span className="text-base font-semibold text-text-principal w-40 text-center">
                  {LUNI_RO[lunaAfisata.luna]} {lunaAfisata.an}
                </span>
                <button
                  onClick={() => setLunaAfisata(prev => {
                    const d = new Date(prev.an, prev.luna + 1)
                    return { an: d.getFullYear(), luna: d.getMonth() }
                  })}
                  disabled={!poateMergeLunaUrmatoare()}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-text-secundar transition-colors disabled:opacity-30 disabled:cursor-not-allowed">→</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {ZILE_SAPTAMANA.map((z, i) => (
                <div key={i} className="text-center text-sm text-text-tertiar font-medium py-2">{z}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {genereazaZileLuna(lunaAfisata.an, lunaAfisata.luna).map((celula, index) => (
              celula === null
                ? <div key={`empty-${index}`} className="w-full aspect-square" />
                  : <div key={celula.data}
                      title={`${celula.data}: ${celula.numarActivitati} activități`}
                     className={`w-full aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-colors cursor-default'
                        ${celula.esteViitor ? 'bg-slate-100 text-slate-300' :
                          celula.numarActivitati === 0 ? 'bg-slate-100 text-slate-400' :
                          celula.numarActivitati <= 2 ? 'bg-primar-100 text-primar-700' :
                          celula.numarActivitati <= 5 ? 'bg-primar-500 text-white' :
                          'bg-primar-500 text-white'}

                      `}>
                      {celula.zi}
                    </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
              <div className="w-3 h-3 rounded-sm bg-slate-200" />
              <span className="text-xs text-text-tertiar">Nicio activitate</span>
              <div className="w-3 h-3 rounded-sm bg-primar-200 ml-3" />
              <span className="text-xs text-text-tertiar">Puțin</span>
              <div className="w-3 h-3 rounded-sm bg-primar-500 ml-3" />
              <span className="text-xs text-text-tertiar">Mult</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}