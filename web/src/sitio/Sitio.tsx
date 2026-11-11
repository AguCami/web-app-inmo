import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Barra } from './Barra';
import { Logo } from '../../../src/components/Logo';
import { CONTACTO, PROPIEDADES } from '../datos';
import { Inicio } from './Inicio';
import { Listado } from './Listado';
import { Ficha } from './Ficha';
import { Nosotros } from './Nosotros';
import { Tasaciones } from './Tasaciones';

/** Donde vive la web nueva mientras es un adelanto. Al lanzarla pasa a ser la raíz. */
export const BASE = '/adelanto';

/**
 * La web pública: fondo claro liso, siempre en claro aunque el sistema esté
 * en oscuro. Una barra arriba, el contenido en tarjetas y el pie con los
 * datos de contacto.
 */
export function Sitio() {
  const { pathname } = useLocation();
  // Al cambiar de página se arranca desde arriba, como en un sitio de siempre.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <div className="sitio tema-claro">
        <Barra />

        <main className="sitio__main">
          <Routes>
            <Route index element={<Inicio />} />
            <Route path="propiedades" element={<Listado />} />
            <Route path="propiedades/:codigo" element={<Ficha />} />
            <Route path="tasaciones" element={<Tasaciones />} />
            <Route path="nosotros" element={<Nosotros />} />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </main>

        <Pie />
      </div>
    </>
  );
}

function Pie() {
  const anio = new Date().getFullYear();
  return (
    <footer className="pie" id="contacto">
      <div className="pie__marca">
        <Logo tam={44} />
        <div>
          <strong>Inversiones Generales M &amp; M</strong>
          <span>Inmobiliaria · {PROPIEDADES.length} propiedades publicadas</span>
        </div>
      </div>
      <div className="pie__datos">
        <div>
          <span className="pie__et">Oficina</span>
          <a href={CONTACTO.mapa} target="_blank" rel="noreferrer">
            {CONTACTO.direccion}, {CONTACTO.localidad}
          </a>
        </div>
        {CONTACTO.whatsapp && (
          <div>
            <span className="pie__et">WhatsApp</span>
            <a href={`https://wa.me/${CONTACTO.whatsapp}`} target="_blank" rel="noreferrer">{CONTACTO.telefono || CONTACTO.whatsapp}</a>
          </div>
        )}
        {CONTACTO.email && (
          <div>
            <span className="pie__et">Email</span>
            <a href={`mailto:${CONTACTO.email}`}>{CONTACTO.email}</a>
          </div>
        )}
        {CONTACTO.instagram && (
          <div>
            <span className="pie__et">Instagram</span>
            <a href={`https://instagram.com/${CONTACTO.instagram}`} target="_blank" rel="noreferrer">@{CONTACTO.instagram}</a>
          </div>
        )}
      </div>
      <p className="pie__legal">© {anio} Inversiones Generales M &amp; M</p>
    </footer>
  );
}
