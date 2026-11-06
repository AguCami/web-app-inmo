import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Proximamente } from './Proximamente';
import '../../src/styles/app.css';
import './web.css';

// La web nueva y sus datos se bajan solo al entrar al adelanto: quien ve
// «Próximamente» no se lleva las 122 propiedades en el JavaScript.
const Sitio = lazy(() => import('./sitio/Sitio').then((m) => ({ default: m.Sitio })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: es un sitio estático, sin servidor que reescriba rutas. */}
    <HashRouter>
      <Routes>
        {/* Lo que ve el público hasta el lanzamiento. */}
        <Route path="/" element={<Proximamente />} />
        {/* La web nueva, para mirarla antes de lanzar: /#/adelanto */}
        <Route path="/adelanto/*" element={<Suspense fallback={null}><Sitio /></Suspense>} />
        <Route path="*" element={<Proximamente />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
