import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';
import './styles/vidrio.css';

// La variante «vidrio líquido» es un experimento y no está prendida. Para
// verla en el celular o mostrarla, se agrega ?vidrio a la dirección:
//   .../web-app-inmo/?vidrio#/
if (new URLSearchParams(window.location.search).has('vidrio')) {
  document.documentElement.setAttribute('data-vidrio', '1');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: es un sitio estático, sin servidor que reescriba rutas. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
