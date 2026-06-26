import { useState, useEffect, useCallback } from 'react'
import BaraNavigare from '../componente/BaraNavigare.jsx'
import {
  obtineCuvinteUtilizator,
  stergeCuvantDinIstoric,
  exportaIstoricCaFisierPDF,
} from '../servicii/apiServicii.js'

const FILTRE_DISPONIBILE = [
  { valoare: 'toate', eticheta: 'Toate' },
  { valoare: 'azi', eticheta: 'Azi' },
  { valoare: 'saptamana', eticheta: 'Săptămâna asta' },
  { valoare: 'luna', eticheta: 'Luna asta' }
]

const MARIME_PAGINA = 8

export default function Istoric() {
  const [listaCuvinte, setListaCuvinte] = useState([])
  const [totalCuvinte, setTotalCuvinte] = useState(0)
  const [paginaCurenta, setPaginaCurenta] = useState(1)
  const [textCautare, setTextCautare] = useState('')
  const [filtrulActiv, setFiltrulActiv] = useState('toate')
  const [seIncarcaDatele, setSeIncarcaDatele] = useState(true)
  const [idCuvantDeConfirmatStergere, setIdCuvantDeConfirmatStergere] = useState(null)
  const [seExportaPDF, setSeExportaPDF] = useState(false)
  const [mesajEroare, setMesajEroare] = useState('')

  const incarcaCuvintele = useCallback(async () => {
    setSeIncarcaDatele(true)
    setMesajEroare('')
    try {
      const raspuns = await obtineCuvinteUtilizator({
        pagina: paginaCurenta,
        marimePagina: MARIME_PAGINA,
        textCautare: textCautare.trim(),
        filtru: filtrulActiv,
      })
      setListaCuvinte(raspuns.cuvinte ?? [])
      setTotalCuvinte(raspuns.total ?? 0)
    } catch {
      setMesajEroare('Nu s-au putut încărca cuvintele. Verifică conexiunea.')
    } finally {
      setSeIncarcaDatele(false)
    }
  }, [paginaCurenta, textCautare, filtrulActiv])

  useEffect(() => {
    incarcaCuvintele()
  }, [incarcaCuvintele])

  //Resetam la prima pagina cand se schimba cautarea sau filtrul
  useEffect(() => {
    setPaginaCurenta(1)
  }, [textCautare, filtrulActiv])

  async function handleStergereCuvant(idCuvant) {
    if (idCuvantDeConfirmatStergere!==idCuvant) {
      setIdCuvantDeConfirmatStergere(idCuvant)
      return
    }
    try {
      await stergeCuvantDinIstoric(idCuvant)
      setListaCuvinte((listaVeche) =>
        listaVeche.filter((cuvant) => cuvant.id!==idCuvant)
      )
      setTotalCuvinte((total) => total-1)
    } catch {
      setMesajEroare('Nu s-a putut șterge cuvântul. Încearcă din nou.')
    } finally {
      setIdCuvantDeConfirmatStergere(null)
    }
  }

  async function handleExportPDF() {
    setSeExportaPDF(true)
    try {
      await exportaIstoricCaFisierPDF()
    } catch {
      setMesajEroare('Nu s-a putut genera fișierul PDF.')
    } finally {
      setSeExportaPDF(false)
    }
  }

  function copiazaIstoricInClipboard() {
    const textFormatat = listaCuvinte
      .map(
        (cuvant) =>
          `${cuvant.text_cuvant} (${cuvant.incredere_medie}%) - ${new Date(
            cuvant.data_adaugare
          ).toLocaleDateString('ro-RO')}`
      )
      .join('\n')
    navigator.clipboard.writeText(textFormatat).catch(() => {})
  }

  function formateazaDataOra(stringData) {
    const dataObiect = new Date(stringData)

    const azi = new Date()
    const ieri = new Date(azi)
    ieri.setDate(ieri.getDate() - 1)

    const ora = dataObiect.toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit'
    })

    if (dataObiect.toDateString() === azi.toDateString()) return `Azi, ${ora}`
    if (dataObiect.toDateString() === ieri.toDateString()) return `Ieri, ${ora}`

    return `${dataObiect.toLocaleDateString('ro-RO')} · ${ora}`
  }

  //valoarea vine 0-1 de la backend, o inmultim cu 100
  function clasaCuloareIncredere(val) {
    const v = val > 1 ? val : val * 100
    if (v >= 85) return 'text-accent-600 bg-accent-50'
    if (v >= 65) return 'text-amber-600 bg-amber-50'
    return 'text-red-500 bg-red-50'
  }

  function filtreazaDupaData(lista) {
    if (filtrulActiv === 'toate') return lista
    const acum = new Date()
    return lista.filter((c) => {
      const d = new Date(c.data_adaugare)
      if (filtrulActiv === 'azi') {
        return d.toDateString() === acum.toDateString()
      }
      if (filtrulActiv === 'saptamana') {
        const acum7 = new Date(acum); acum7.setDate(acum7.getDate() - 7)
        return d >= acum7
      }
      if (filtrulActiv === 'luna') {
        return d.getMonth() === acum.getMonth() && d.getFullYear() === acum.getFullYear()
      }
      return true
    })
  }

  const cuvinteDeAfisat = seIncarcaDatele ? [] : listaCuvinte
  const numarTotalPagini = Math.ceil((totalCuvinte || 1) / MARIME_PAGINA)

  return (
    <div className="min-h-screen bg-fundal">
      <BaraNavigare />

      <main className="max-w-[1150px] mx-auto px-6 xl:px-8 py-8 anima-aparitie">
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-3xl font-semibold text-text-principal">Istoric traduceri</h1>
            <p className="text-text-secundar text-sm mt-1">
              {totalCuvinte} cuvinte traduse în total
            </p>
          </div>

          {/*Butoane export*/}
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={seExportaPDF}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primar-600 text-white text-sm font-medium hover:bg-primar-700 disabled:bg-primar-300 transition-colors"
            >
              {seExportaPDF ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Se generează...
                </>
              ) : (
                'Export PDF'
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          {/*Bara de cautare si filtre*/}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 mb-4">
              <span className="text-text-tertiar text-lg" aria-hidden="true">{/*🔍*/}</span>
              <input
                type="text"
                value={textCautare}
                onChange={(e) => setTextCautare(e.target.value)}
                placeholder="Caută un cuvânt tradus..."
                className="flex-1 bg-transparent text-base text-text-principal placeholder-text-tertiar outline-none"
              />
              {textCautare && (
                <button
                  onClick={() => setTextCautare('')}
                  className="text-text-tertiar hover:text-text-secundar text-lg leading-none"
                  aria-label="Sterge textul din cautare"
                >
                  x
                </button>
              )}
            </div>

            {/*Filtre de timp*/}
            <div className="flex gap-2 flex-wrap">
              {FILTRE_DISPONIBILE.map(({ valoare, eticheta }) => (
                <button
                  key={valoare}
                  onClick={() => setFiltrulActiv(valoare)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filtrulActiv === valoare
                      ? 'bg-primar-600 text-white'
                      : 'border border-slate-200 text-text-secundar hover:bg-slate-50'
                  }`}
                >
                  {eticheta}
                </button>
              ))}
            </div>
          </div>

          {/*Mesaj eroare*/}
          {mesajEroare && (
            <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
              {mesajEroare}
            </div>
          )}

          {/*Lista cuvinte*/}
          {seIncarcaDatele ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-3 border-primar-200 border-t-primar-500 rounded-full animate-spin mb-3" />
                <p className="text-text-secundar text-sm">Se încarcă istoricul...</p>
              </div>
            </div>
          ) : cuvinteDeAfisat.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiar">
              <span className="text-4xl mb-3" aria-hidden="true"></span>
              <p className="font-medium text-text-secundar">Niciun cuvânt găsit</p>
              <p className="text-sm mt-1">
                {textCautare
                  ? 'Încearcă o altă căutare'
                  : 'Traduce primul cuvânt în pagina de traducere'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cuvinteDeAfisat.map((cuvant) => (
                <li
                  key={cuvant.id}
                  className="flex items-center gap-5 px-7 py-5 hover:bg-slate-50 transition-colors group"
                >
                  {/*Index si cuvant*/}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-text-principal text-lg">
                      {cuvant.text_cuvant}
                    </p>
                    <p className="text-sm text-text-tertiar mt-1">
                      {formateazaDataOra(cuvant.data_adaugare)}
                      {cuvant.nr_litere && ` · ${cuvant.nr_litere} litere`}
                    </p>
                  </div>

                  {/*Incredere*/}
                  <span
                    className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${clasaCuloareIncredere(
                      cuvant.incredere_medie
                    )}`}
                  >
                    {cuvant.incredere_medie > 1
                      ? Math.round(cuvant.incredere_medie)
                      : Math.round(cuvant.incredere_medie * 100)}%
                  </span>

                  {/*Buton stergere*/}
                  <button
                    onClick={() => handleStergereCuvant(cuvant.id)}
                    className={`opacity-0 group-hover:opacity-100 transition-all text-xs px-2.5 py-1 rounded-lg ${
                      idCuvantDeConfirmatStergere === cuvant.id
                        ? 'bg-red-100 text-red-600 opacity-100'
                        : 'text-text-tertiar hover:text-red-500 hover:bg-red-50'
                    }`}
                    title={
                      idCuvantDeConfirmatStergere === cuvant.id
                        ? 'Click din nou pentru a confirma'
                        : 'Șterge cuvântul'
                    }
                  >
                    {idCuvantDeConfirmatStergere === cuvant.id ? 'Confirmi?' : '🗑'}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/*Paginare*/}
          {numarTotalPagini >= 1 && (
            <div className="flex items-center justify-between px-7 py-4 border-t border-slate-100">
              <button
                onClick={() => setPaginaCurenta((p) => Math.max(1, p - 1))}
                disabled={paginaCurenta === 1}
                className="px-4 py-2 rounded-lg text-sm text-text-secundar hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-sm text-text-secundar">
                Pagina {paginaCurenta} din {numarTotalPagini}
              </span>
              <button
                onClick={() => setPaginaCurenta((p) => Math.min(numarTotalPagini, p + 1))}
                disabled={paginaCurenta === numarTotalPagini}
                className="px-4 py-2 rounded-lg text-sm text-text-secundar hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Următor →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
