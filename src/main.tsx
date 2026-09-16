import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: la app es estática y tiene que andar abierta desde el disco. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
