import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';
import './styles/vidrio.css';

// La variante «vidrio líquido» es un experimento y no está prendida. Para
// verla en el celular o mostrarla, se agrega ?vidrio a la dirección:
//   .../web-app-inmo/?vidrio#/
const vidrio = new URLSearchParams(window.location.search).get('vidrio');
if (vidrio !== null) {
  // ?vidrio = con lente; ?vidrio=simple = solo desenfoque, sin refracción.
  // ?vidrio = lente con el fondo sobrio; ?vidrio=max = fondo saturado, que
  // es donde el material se luce; ?vidrio=simple = solo desenfoque.
  const modos = ['simple', 'max'];
  document.documentElement.setAttribute('data-vidrio', modos.includes(vidrio) ? vidrio : '1');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: es un sitio estático, sin servidor que reescriba rutas. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
