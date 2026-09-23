import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SetupComponent from './components/SetupComponent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SetupComponent />
  </StrictMode>,
)
