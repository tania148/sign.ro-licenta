import { Routes, Route, Navigate } from 'react-router-dom'
import Autentificare from './pagini/Autentificare.jsx'
import Traducere from './pagini/Traducere.jsx'
import Istoric from './pagini/Istoric.jsx'
import Invata from './pagini/Invata.jsx'
import Profil from './pagini/Profil.jsx'
import ProtejatRuta from './componente/ProtejatRuta.jsx'


export default function App() {
  return (
    <Routes>
      <Route path="/autentificare" element={<Autentificare />} />

      <Route
        path="/"
        element={
          <ProtejatRuta>
            <Traducere />
          </ProtejatRuta>
        }
      />
      <Route
        path="/traducere"
        element={
          <ProtejatRuta>
            <Traducere />
          </ProtejatRuta>
        }
      />
      <Route
        path="/istoric"
        element={
          <ProtejatRuta>
            <Istoric />
          </ProtejatRuta>
        }
      />
      <Route
        path="/invata"
        element={
          <ProtejatRuta>
            <Invata />
          </ProtejatRuta>
        }
      />
      <Route
        path="/profil"
        element={
          <ProtejatRuta>
            <Profil />
          </ProtejatRuta>
        }
      />

      {/*Orice alta ruta redirectioneaza la pagina principala*/}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
