import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { FurnizorUtilizator } from './context/ContextUtilizator.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('radacina')).render(
  <React.StrictMode>
    <BrowserRouter>
      <FurnizorUtilizator>
        <App />
      </FurnizorUtilizator>
    </BrowserRouter>
  </React.StrictMode>
)
