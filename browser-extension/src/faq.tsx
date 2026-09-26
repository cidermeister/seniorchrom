import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FaqComponent from './components/FaqComponent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FaqComponent />
  </StrictMode>,
)
