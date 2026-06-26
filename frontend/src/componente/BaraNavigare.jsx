import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { folosestContextUtilizator } from '../context/ContextUtilizator.jsx'
const ELEMENTE_NAVIGARE = [
  { cale: '/traducere', eticheta: 'Traducere' },
  { cale: '/istoric', eticheta: 'Istoric' },
  { cale: '/invata', eticheta: 'Învață' },
  { cale: '/profil', eticheta: 'Profil' },
] 

const TEME_CULORI = [
  {
    nume: 'Rosu',
    culoare: '#EF4444',
    vars: {
      '--primar-50':  '#fef2f2',
      '--primar-100': '#fee2e2',
      '--primar-200': '#fecaca',
      '--primar-400': '#f87171',
      '--primar-500': '#ef4444',
      '--primar-600': '#dc2626',
      '--primar-700': '#b91c1c',
      '--primar-900': '#7f1d1d'
    }
  },
  {
    nume: 'Portocaliu', 
    culoare: '#FF8500',
    vars: { '--primar-50':'#fff4e6',
            '--primar-100':'#ffe4b8',
            '--primar-200':'#ffd080',
            '--primar-400':'#ffaa30',
            '--primar-500':'#ff9810',
            '--primar-600':'#FF8500',
            '--primar-700':'#e07000',
            '--primar-900':'#a04800' 
          }
  },
  {
    nume: 'Galben', 
    culoare: '#FFCA28',
    vars: { '--primar-50':'#fffde8',
            '--primar-100':'#fff9c4',
            '--primar-200':'#fff380',
            '--primar-400':'#ffdc50',
            '--primar-500':'#FFD835',
            '--primar-600':'#FFCA28',
            '--primar-700':'#e0aa00',
            '--primar-900':'#a07000' 
          }
  },
  {
    nume: 'Verde', 
    culoare: '#00C853',
    vars: { '--primar-50':'#e8fff0',
            '--primar-100':'#c8ffd8',
            '--primar-200':'#90ffb0',
            '--primar-400':'#30e870',
            '--primar-500':'#10d860',
            '--primar-600':'#00C853',
            '--primar-700':'#00a040',
            '--primar-900':'#006028' 
          }
  },
  {
    nume: 'Albastru', 
    culoare: '#00B4D8',
    vars: { '--primar-50':'#e0f8ff',
            '--primar-100':'#b8f0ff',
            '--primar-200':'#80e4ff',
            '--primar-400':'#30ccf0',
            '--primar-500':'#10c0e4',
            '--primar-600':'#00B4D8',
            '--primar-700':'#0090b0',
            '--primar-900':'#006080' 
          }
  },
  {
    nume: 'Violet', 
    culoare: '#7B2FBE',
    vars: { '--primar-50':'#f3e8ff',
            '--primar-100':'#e5ccff',
            '--primar-200':'#cca0ff',
            '--primar-400':'#a060e0',
            '--primar-500':'#8f48cc',
            '--primar-600':'#7B2FBE',
            '--primar-700':'#6020a0',
            '--primar-900':'#400070' 
          }
  },
  {
    nume: 'Fuchsia', 
    culoare: '#FF006E',
    vars: { '--primar-50':'#fff0f7',
            '--primar-100':'#ffd0ea',
            '--primar-200':'#ffa0d4',
            '--primar-400':'#ff50a0',
            '--primar-500':'#ff2088',
            '--primar-600':'#FF006E',
            '--primar-700':'#d80058',
            '--primar-900':'#900038' 
          }
  },
  {
    nume: 'Teal', 
    culoare: '#06D6A0',
    vars: { '--primar-50':'#e0fff5',
            '--primar-100':'#b8ffe8',
            '--primar-200':'#80ffd8',
            '--primar-400':'#30e8b8',
            '--primar-500':'#10dcac',
            '--primar-600':'#06D6A0',
            '--primar-700':'#00b080',
            '--primar-900':'#007058' 
          }
  },
]

function aplicaTema(tema, email) {
  Object.entries(tema.vars).forEach(([prop, val]) => {
    document.documentElement.style.setProperty(prop, val)
  })
  const cheie=email ? `tema-culoare-${email}` : 'tema-culoare'
  localStorage.setItem(cheie, tema.nume)
}

export default function BaraNavigare() {
  const { utilizatorCurent, stergeseSesiuneUtilizator } = folosestContextUtilizator()
  const navigheazaLaRuta = useNavigate()
  const [meniuDeschis, setMeniuDeschis] = useState(false)
  const [pickerDeschis, setPickerDeschis] = useState(false)
  const [temaActiva, setTemaActiva] = useState('Rosu')

  useEffect(() => {
    const email = utilizatorCurent?.email
    const cheie = email ? `tema-culoare-${email}` : 'tema-culoare'
    const salvata = localStorage.getItem(cheie)
    if (salvata) {
      const tema = TEME_CULORI.find(t => t.nume === salvata)
      if (tema) { aplicaTema(tema, email); setTemaActiva(tema.nume) }
    }
  }, [utilizatorCurent])

  function handleDeconectare() {
    stergeseSesiuneUtilizator()
    navigheazaLaRuta('/autentificare')
  }

  function handleAlegeTema(tema) {
    aplicaTema(tema, utilizatorCurent?.email)
    setTemaActiva(tema.nume)
    setPickerDeschis(false)
  }

  const initialaNumeUtilizator = utilizatorCurent?.nume
    ? utilizatorCurent.nume.charAt(0).toUpperCase()
    : '?'

  return (
    <nav className="sticky top-0 z-50" style={{backgroundColor: '#eae8e3', borderBottom: '1px solid #d8d4c8'}}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/*Logo*/}
        <span className="font-mono text-lg font-bold text-primar-600 tracking-tight select-none">
          sign<span className="text-slate-300">.</span>ro
        </span>

        {/*Linkuri de navigare*/}
        <div className="flex items-center gap-1">
          {ELEMENTE_NAVIGARE.map(({ cale, eticheta, iconita }) => (
            <NavLink
              key={cale}
              to={cale}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primar-50 text-primar-600'
                    : 'text-text-secundar hover:bg-slate-100 hover:text-text-principal'
                }`
              }
            >
              <span className="hidden sm:inline">{eticheta}</span>
            </NavLink>
          ))}
        </div>

        {/*Dreapta: picker + avatar*/}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secundar hidden md:block truncate max-w-[120px]">
            {utilizatorCurent?.nume}
          </span>

          {/*Avatar*/}
          <div className="relative">
            <button
              onClick={() => { setMeniuDeschis(s => !s); setPickerDeschis(false) }}
              className="w-8 h-8 rounded-full bg-primar-100 text-primar-700 font-semibold text-sm flex items-center justify-center hover:bg-primar-200 transition-colors"
              aria-label="Meniu utilizator"
              aria-expanded={meniuDeschis}
            >
              {initialaNumeUtilizator}
            </button>

            {meniuDeschis && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMeniuDeschis(false)} />
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <NavLink
                    to="/profil"
                    onClick={() => setMeniuDeschis(false)}
                    className="block px-4 py-2.5 text-sm text-text-secundar hover:bg-slate-50 transition-colors"
                  >
                    Profilul meu
                  </NavLink>
                  <div className="border-t border-slate-100" />
                  <button
                    onClick={handleDeconectare}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Deconectare
                  </button>
                </div>
              </>
            )}
          </div>
        
        {/*Buton picker culori*/}
          <div className="relative">
            <button
              onClick={() => { setPickerDeschis(p => !p); setMeniuDeschis(false) }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors text-text-secundar text-sm font-medium"
              title="Schimbă culoarea temei"
            >
              <span
                style={{ backgroundColor: TEME_CULORI.find(t => t.nume === temaActiva)?.culoare ?? '#6366f1' }}
                className="w-3 h-3 rounded-full flex-shrink-0"
              />
              Aspect
            </button>

            {pickerDeschis && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPickerDeschis(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 p-3 w-52">
                  <p className="text-xs font-medium text-text-tertiar mb-2 px-1">Culoarea temei</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TEME_CULORI.map(tema => (
                      <button
                        key={tema.nume}
                        onClick={() => handleAlegeTema(tema)}
                        title={tema.nume}
                        style={{ backgroundColor: tema.culoare }}
                        className={`w-9 h-9 rounded-xl transition-transform hover:scale-110 ${
                          temaActiva === tema.nume
                            ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}