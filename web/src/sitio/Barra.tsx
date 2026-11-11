import { Link, NavLink } from 'react-router-dom';
import { Logo } from '../../../src/components/Logo';
import { BASE } from './Sitio';
import { MENSAJE_GENERAL, enlaceWhatsapp } from '../datos';

/**
 * La barra de arriba: una pieza de vidrio con el logo, las secciones y el
 * botón de consulta.
 *
 * Al pasar el mouse por una sección, se oscurece y le crece una línea abajo;
 * la sección en la que uno está la tiene fija.
 */
/**
 * Cómo va el nombre al lado de la espiral. Se elige acá; las tres quedan
 * armadas, con sus estilos en web.css:
 * - 'serif':    «Inversiones Generales» con serifa y «M&M · INMOBILIARIA»
 *               en azul abajo, alineado a la izquierda.
 * - 'centrado': Inversiones Generales / M & M / Inmobiliaria, centrado,
 *               como en la credencial del ingreso.
 * - 'ninguno':  solo la espiral.
 */
const NOMBRE: 'serif' | 'centrado' | 'ninguno' = 'serif';

export function Barra() {
  return (
    <header className="barra">
      <Link to={BASE} className="barra__marca" aria-label="Inversiones Generales M & M, inicio">
        <Logo tam={NOMBRE === 'serif' ? 42 : 44} />
        {NOMBRE === 'serif' && (
          <span className="barra__nombre barra__nombre--serif">
            <strong>Inversiones Generales</strong>
            <small>M&amp;M · Inmobiliaria</small>
          </span>
        )}
        {NOMBRE === 'centrado' && (
          <span className="barra__nombre">
            <small>Inversiones Generales</small>
            <strong>M&nbsp;&amp;&nbsp;M</strong>
            <small>Inmobiliaria</small>
          </span>
        )}
      </Link>

      <nav className="barra__nav" aria-label="Secciones">
        <NavLink to={BASE} end className="barra__enlace">Inicio</NavLink>
        <NavLink to={`${BASE}/propiedades`} className="barra__enlace">Propiedades</NavLink>
        <NavLink to={`${BASE}/tasaciones`} className="barra__enlace">Tasaciones</NavLink>
        <NavLink to={`${BASE}/nosotros`} className="barra__enlace">Nosotros</NavLink>
        <button type="button" className="barra__enlace barra__enlace--contacto" onClick={irAContacto}>Contacto</button>
      </nav>

      <div className="barra__acciones">
        {enlaceWhatsapp(MENSAJE_GENERAL) ? (
          <a className="barra__boton" href={enlaceWhatsapp(MENSAJE_GENERAL)!} target="_blank" rel="noreferrer">Consultar</a>
        ) : (
          <button type="button" className="barra__boton" onClick={irAContacto}>Consultar</button>
        )}
      </div>
    </header>
  );
}

/** «Contacto» baja al pie, que está en todas las páginas. */
function irAContacto() {
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
}
