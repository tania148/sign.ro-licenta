import { Navigate } from 'react-router-dom'
import { folosestContextUtilizator } from '../context/ContextUtilizator.jsx'
import IncarcareSpin from './IncarcareSpin.jsx'

export default function ProtejatRuta({ children }) {
  const { utilizatorCurent, seVerificaSesiunea } = folosestContextUtilizator()

  if (seVerificaSesiunea) {
    return <IncarcareSpin mesaj="Se verifică sesiunea..." />
  }

  if (!utilizatorCurent) {
    return <Navigate to="/autentificare" replace />
  }

  return children
}
