import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: es un sitio estático, sin servidor que reescriba rutas. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
