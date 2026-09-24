import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import InfoComponent from './components/InfoComponent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InfoComponent />
  </StrictMode>,
)
