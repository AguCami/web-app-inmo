import { Link, NavLink } from 'react-router-dom';
import { Logo } from '../../../src/components/Logo';
import { BASE } from './Sitio';

/**
 * La barra de arriba: una pieza de vidrio con el logo, las secciones y el
 * botón de consulta.
 *
 * Al pasar el mouse por una sección, se oscurece y le crece una línea abajo;
 * la sección en la que uno está la tiene fija.
 */
/**
 * El nombre al lado del logo (Inversiones Generales / M & M / Inmobiliaria).
 * Por ahora va solo la espiral; el nombre queda armado, con sus estilos en
 * web.css (.barra__nombre), por si se vuelve a usar: alcanza con poner true.
 */
const CON_NOMBRE = false;

export function Barra() {
  return (
    <header className="barra">
      <Link to={BASE} className="barra__marca" aria-label="Inversiones Generales M & M, inicio">
        <Logo tam={44} />
        {CON_NOMBRE && (
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
        <button type="button" className="barra__boton" onClick={irAContacto}>Consultar</button>
      </div>
    </header>
  );
}

/** «Contacto» baja al pie, que está en todas las páginas. */
function irAContacto() {
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
}
