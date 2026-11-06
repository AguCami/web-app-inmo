import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Logo } from '../../../src/components/Logo';
import fondo from '../../../src/assets/ingreso-fondo.webp';
import { CONTACTO, PROPIEDADES } from '../datos';
import { Inicio } from './Inicio';
import { Listado } from './Listado';
import { Ficha } from './Ficha';

/** Donde vive la web nueva mientras es un adelanto. Al lanzarla pasa a ser la raíz. */
export const BASE = '/adelanto';

/**
 * La web pública, sobre la misma espiral y con el mismo vidrio que la app de
 * gestión: una barra de vidrio arriba, el contenido en tarjetas de vidrio y
 * el pie con los datos de contacto.
 */
export function Sitio() {
  const { pathname } = useLocation();
  // Al cambiar de página se arranca desde arriba, como en un sitio de siempre.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <div className="fondo-app" aria-hidden="true">
        <img src={fondo} alt="" decoding="async" />
      </div>

      <div className="sitio">
        <header className="barra">
          <Link to={BASE} className="barra__marca" aria-label="Inicio">
            <Logo tam={34} />
            <span className="barra__nombre">
              <small>Inversiones Generales</small>
              <strong>M&nbsp;&amp;&nbsp;M</strong>
            </span>
          </Link>
          <nav className="barra__nav" aria-label="Secciones">
            <NavLink to={BASE} end>Inicio</NavLink>
            <NavLink to={`${BASE}/propiedades`}>Propiedades</NavLink>
            <button type="button" className="barra__contacto" onClick={irAContacto}>Contacto</button>
          </nav>
        </header>

        <main className="sitio__main">
          <Routes>
            <Route index element={<Inicio />} />
            <Route path="propiedades" element={<Listado />} />
            <Route path="propiedades/:codigo" element={<Ficha />} />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </main>

        <Pie />
      </div>
    </>
  );
}

/** «Contacto» baja al pie, que está en todas las páginas. */
function irAContacto() {
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
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
