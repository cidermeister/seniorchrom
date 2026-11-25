import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import WhitelistComponent from './components/WhitelistComponent';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WhitelistComponent />
  </StrictMode>,
);
