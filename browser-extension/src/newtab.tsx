import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NewTabComponent from './NewTabComponent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewTabComponent />
  </StrictMode>,
)
