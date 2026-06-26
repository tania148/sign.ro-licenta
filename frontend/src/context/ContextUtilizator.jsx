import { createContext, useContext, useState, useEffect } from 'react'

const ContextUtilizator = createContext(null)

export function FurnizorUtilizator({ children }) {
  const [utilizatorCurent, setUtilizatorCurent] = useState(null)
  const [seVerificaSesiunea, setSeVerificaSesiunea] = useState(true)

  //La prima incarcare: verificam daca exista o sesiune salvata
  useEffect(() => {
    const tokenSalvat = localStorage.getItem('token_autentificare')
    const dateUtilizatorSalvate = localStorage.getItem('date_utilizator')

    if (tokenSalvat && dateUtilizatorSalvate) {
      try {
        const dateUtilizatorParsate = JSON.parse(dateUtilizatorSalvate)
        setUtilizatorCurent(dateUtilizatorParsate)
      } catch {
        //Date corupte - stergem
        localStorage.removeItem('token_autentificare')
        localStorage.removeItem('date_utilizator')
      }
    }

    setSeVerificaSesiunea(false)
  }, [])

  function salveazaSesiuneUtilizator(dateUtilizator, tokenJWT) {
    localStorage.setItem('token_autentificare', tokenJWT)
    localStorage.setItem('date_utilizator', JSON.stringify(dateUtilizator))
    setUtilizatorCurent(dateUtilizator)
  }

  function stergeseSesiuneUtilizator() {
    localStorage.removeItem('token_autentificare')
    localStorage.removeItem('date_utilizator')
    setUtilizatorCurent(null)
  }

  const valoareContext = {
    utilizatorCurent,
    salveazaSesiuneUtilizator,
    stergeseSesiuneUtilizator,
    seVerificaSesiunea,
  }

  return (
    <ContextUtilizator.Provider value={valoareContext}>
      {children}
    </ContextUtilizator.Provider>
  )
}

export function folosestContextUtilizator() {
  const context = useContext(ContextUtilizator)
  if (!context) {
    throw new Error(
      'folosestContextUtilizator trebuie apelat în interiorul unui FurnizorUtilizator'
    )
  }
  return context
}
