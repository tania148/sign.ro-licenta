import axios from 'axios'

const ADRESA_BACKEND = 'http://localhost:8000'
const ADRESA_WEBSOCKET = 'ws://localhost:8000'

//Instanta Axios cu configurare globala
const instantaApi = axios.create({
  baseURL: ADRESA_BACKEND,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

//Interceptor cerere: adauga token JWT la fiecare request
instantaApi.interceptors.request.use((configurareCerere) => {
  const tokenAutentificare = localStorage.getItem('token_autentificare')
  if (tokenAutentificare) {
    configurareCerere.headers.Authorization = `Bearer ${tokenAutentificare}`
  }
  return configurareCerere
})

//Interceptor raspuns: redirectioneaza la login daca tokenul a expirat
instantaApi.interceptors.response.use(
  (raspunsSuccess) => raspunsSuccess,
  (eroare) => {
    if (eroare.response?.status === 401) {
      localStorage.removeItem('token_autentificare')
      localStorage.removeItem('date_utilizator')
      window.location.href = '/autentificare'
    }
    return Promise.reject(eroare)
  }
)

//AUTENTIFICARE

export async function conecteazaUtilizator(emailUtilizator, parolaUtilizator) {
  const { data: raspuns } = await instantaApi.post('/auth/conectare', {
    email: emailUtilizator,
    parola: parolaUtilizator,
  })
  return raspuns
}

export async function inregistreazaUtilizator(numeUtilizator, emailUtilizator, parolaUtilizator) {
  const { data: raspuns } = await instantaApi.post('/auth/inregistrare', {
    nume: numeUtilizator,
    email: emailUtilizator,
    parola: parolaUtilizator,
  })
  return raspuns
}

//CUVINTE / ISTORIC

export async function obtineCuvinteUtilizator({
  pagina = 1,
  marimePagina = 20,
  textCautare = '',
  filtru = 'toate',
} = {}) {
  const { data: raspuns } = await instantaApi.get('/cuvinte', {
    params: {
      pagina,
      marime_pagina: marimePagina,
      cautare: textCautare,
      filtru,
    },
  })
  return raspuns
}

export async function salveazaCuvantTradus(textCuvant, incredereaMedieDetectie) {
  const { data: raspuns } = await instantaApi.post('/cuvinte', {
    cuvant: textCuvant,
    incredere_medie: incredereaMedieDetectie,
  })
  return raspuns
}

export async function stergeCuvantDinIstoric(idCuvant) {
  const { data: raspuns } = await instantaApi.delete(`/cuvinte/${idCuvant}`)
  return raspuns
}

//PROFIL & STATISTICI

export async function obtineStatisticiUtilizator() {
  const { data: raspuns } = await instantaApi.get('/profil/statistici')
  return raspuns
}

export async function obtineProgresDinvatareLitere() {
  const { data: raspuns } = await instantaApi.get('/profil/progres-invatare')
  return raspuns
}

export async function actualizeazaProgresDinvatareLitera(literaExersata, aReusitValidarea) {
  const { data: raspuns } = await instantaApi.post('/profil/progres-invatare', {
    litera: literaExersata,
    reusita: aReusitValidarea,
  })
  return raspuns
}

export async function obtineActivitateCalendarUtilizator() {
  const { data: raspuns } = await instantaApi.get('/profil/activitate-calendar')
  return raspuns
}


//EXPORT

export async function exportaIstoricCaFisierPDF() {
  const raspunsBlob = await instantaApi.get('/cuvinte/export/pdf', {
    responseType: 'blob',
  })
  const urlFisierDescarcat = URL.createObjectURL(new Blob([raspunsBlob.data]))
  const elementLinkDescarcare = document.createElement('a')
  elementLinkDescarcare.href = urlFisierDescarcat
  const dataCurenta = new Date().toLocaleDateString('ro-RO').replace(/\./g, '-')
  elementLinkDescarcare.download = `istoric_asl_${dataCurenta}.pdf`
  elementLinkDescarcare.click()
  URL.revokeObjectURL(urlFisierDescarcat)
}

//WEBSOCKET

export function creeazaConexiuneWebSocket({
  peRaspunsPrimite,
  peDeschidereConexiune,
  peInchidereConexiune,
  peEroareConexiune,
}) {
  const tokenAutentificare = localStorage.getItem('token_autentificare')
  const conexiuneWS = new WebSocket(
    `${ADRESA_WEBSOCKET}/ws/traducere?token=${tokenAutentificare}`
  )

  conexiuneWS.onopen = peDeschidereConexiune ?? (() => {})
  conexiuneWS.onclose = peInchidereConexiune ?? (() => {})
  conexiuneWS.onerror = peEroareConexiune ?? (() => {})

  conexiuneWS.onmessage = (evenimentMesaj) => {
    try {
      const dateDeserializate = JSON.parse(evenimentMesaj.data)
      peRaspunsPrimite(dateDeserializate)
    } catch {
      console.error('Eroare la deserializarea mesajului WebSocket')
    }
  }

  return conexiuneWS
}

//ANTRENAMENT MODEL

export async function colecteazaEsantionAntrenament(literaInregistrata, repere3D) {
  const { data: raspuns } = await instantaApi.post('/antrenament/colecteaza', {
    litera:  literaInregistrata,
    repere:  repere3D,
  })
  return raspuns
}

export async function antreneazaModelulMl() {
  const { data: raspuns } = await instantaApi.post('/antrenament/antreneaza')
  return raspuns
}

export async function obtineStatisticiAntrenament() {
  const { data: raspuns } = await instantaApi.get('/antrenament/statistici')
  return raspuns
}

export async function stergeEsantioanelitera(literaDeSters) {
  const { data: raspuns } = await instantaApi.delete(`/antrenament/sterge-esantioane/${literaDeSters}`)
  return raspuns
}
