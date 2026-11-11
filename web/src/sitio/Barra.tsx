import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Logo } from '../../../src/components/Logo';
import { BASE } from './Sitio';
import { IcoBuscar } from './iconos';

/**
 * La barra de arriba: una pieza de vidrio con el logo, las secciones, una
 * lupa que se abre en buscador y el botón de contacto.
 *
 * - Al pasar el mouse por una sección, se oscurece y le crece una línea abajo;
 *   la sección en la que uno está la tiene fija.
 * - La lupa se estira en un campo de búsqueda. Enter lleva al listado con
 *   esa búsqueda; Esc, la cruz o hacer clic afuera lo cierran.
 */
export function Barra() {
  const navegar = useNavigate();
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buscando) campo.current?.focus();
  }, [buscando]);

  // Clic afuera con el buscador vacío: se cierra.
  useEffect(() => {
    const afuera = (e: PointerEvent) => {
      if (buscando && !texto && caja.current && !caja.current.contains(e.target as Node)) setBuscando(false);
    };
    document.addEventListener('pointerdown', afuera);
    return () => document.removeEventListener('pointerdown', afuera);
  }, [buscando, texto]);

  const cerrar = () => {
    setTexto('');
    setBuscando(false);
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = texto.trim();
    navegar(`${BASE}/propiedades${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    cerrar();
  };

  return (
    <header className={buscando ? 'barra barra--buscando' : 'barra'}>
      <Link to={BASE} className="barra__marca" aria-label="Inicio">
        <Logo tam={30} />
        <span className="barra__nombre">
          <small>Inversiones Generales</small>
          <strong>M&nbsp;&amp;&nbsp;M</strong>
        </span>
      </Link>

      <nav className="barra__nav" aria-label="Secciones">
        <NavLink to={BASE} end className="barra__enlace">Inicio</NavLink>

        <NavLink to={`${BASE}/propiedades`} className="barra__enlace">Propiedades</NavLink>

        <button type="button" className="barra__enlace" onClick={irAContacto}>Contacto</button>
      </nav>

      <div className="barra__acciones">
        <div className="barra__busca" ref={caja}>
          {buscando ? (
            <form className="barra__campo" onSubmit={buscar}>
              <IcoBuscar />
              <input
                ref={campo}
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && cerrar()}
                placeholder="Buscar por barrio o localidad…"
                aria-label="Buscar propiedades"
              />
              <kbd>esc</kbd>
              <button type="button" className="barra__cerrar" onClick={cerrar} aria-label="Cerrar búsqueda">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </form>
          ) : (
            <button type="button" className="barra__lupa" onClick={() => setBuscando(true)} aria-label="Buscar">
              <IcoBuscar />
            </button>
          )}
        </div>
        <button type="button" className="barra__boton" onClick={irAContacto}>Consultar</button>
      </div>
    </header>
  );
}

/** «Contacto» baja al pie, que está en todas las páginas. */
function irAContacto() {
  document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' });
}
