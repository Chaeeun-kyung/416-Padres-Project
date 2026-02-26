import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui/styles.css'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import { applyThemeVars } from './ui/theme'

applyThemeVars()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
