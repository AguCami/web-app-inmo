import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { SELECCION, foto, porCodigo, slug, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { IcoFlecha, IcoUbicacion } from './iconos';

/**
 * La portada del inicio: una selección de propiedades en tarjetas.
 *
 * Al abrir, las tarjetas llegan volando de a una y se acomodan en abanico,
 * con la del medio adelante. Después se pasan como un carrusel: con las
 * flechas, arrastrando (o deslizando en el celular), con el teclado o
 * tocando una de los costados. Tocar la del medio abre la propiedad.
 *
 * Es un carrusel circular: después de la última vuelve la primera. Las que
 * quedan lejos del medio se esconden, así el salto de una punta a la otra
 * no se ve.
 */

const TARJETAS = SELECCION.map(porCodigo).filter((p): p is Propiedad => !!p);
/** Cada cuánto pasa sola, mientras nadie la toque. */
const CADA_MS = 5000;

/** La distancia de la tarjeta i a la del medio, del lado más corto de la vuelta. */
function distancia(i: number, activo: number, n: number) {
  let d = i - activo;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

export function Carrusel() {
  const calma = usePrefiereCalma();
  const navegar = useNavigate();
  const n = TARJETAS.length;
  const [activo, setActivo] = useState(0);
  // Antes de llegar, las tarjetas esperan afuera de la pantalla.
  const [llegaron, setLlegaron] = useState(calma);
  // Mientras llegan, cada una sale con su demora; después se mueven todas juntas.
  const [acomodadas, setAcomodadas] = useState(calma);
  const [arrastre, setArrastre] = useState(0);
  const [tocado, setTocado] = useState(false);
  const escenario = useRef<HTMLDivElement>(null);
  const toque = useRef<{ id: number; x: number; movio: boolean } | null>(null);
  const [paso, setPaso] = useState(200);

  const ir = (d: number) => setActivo((a) => (a + d + n) % n);

  // La llegada: un cuadro con las tarjetas afuera y al siguiente se sueltan.
  useEffect(() => {
    if (calma) return;
    const c = requestAnimationFrame(() => requestAnimationFrame(() => setLlegaron(true)));
    const t = window.setTimeout(() => setAcomodadas(true), 1200 + n * 90);
    return () => {
      cancelAnimationFrame(c);
      window.clearTimeout(t);
    };
  }, [calma, n]);

  // La separación entre tarjetas sale del ancho real de una tarjeta.
  useEffect(() => {
    const medir = () => {
      const t = escenario.current?.querySelector<HTMLElement>('.carta-p');
      if (t) setPaso(t.offsetWidth * (window.innerWidth < 760 ? 0.42 : 0.58));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // Pasa sola hasta que alguien la toca.
  useEffect(() => {
    if (calma || tocado || !acomodadas) return;
    const t = window.setInterval(() => ir(1), CADA_MS);
    return () => window.clearInterval(t);
  }, [calma, tocado, acomodadas]);

  const tomar = (cb: () => void) => {
    setTocado(true);
    cb();
  };

  const alApretar = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    toque.current = { id: e.pointerId, x: e.clientX, movio: false };
  };
  const alMover = (e: React.PointerEvent) => {
    const t = toque.current;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.x;
    if (!t.movio && Math.abs(dx) > 6) {
      t.movio = true;
      setTocado(true);
      escenario.current?.setPointerCapture(e.pointerId);
    }
    if (t.movio) setArrastre(dx);
  };
  const alSoltar = (e: React.PointerEvent) => {
    const t = toque.current;
    if (!t || t.id !== e.pointerId) return;
    if (t.movio) {
      const dx = e.clientX - t.x;
      const pasos = Math.abs(dx) < 40 ? 0 : -Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / paso));
      if (pasos) ir(pasos);
    }
    setArrastre(0);
    // El click que viene después de arrastrar no tiene que abrir nada.
    window.setTimeout(() => (toque.current = null), 0);
  };

  const alTocarTarjeta = (e: React.MouseEvent, i: number) => {
    if (toque.current?.movio) {
      e.preventDefault();
      return;
    }
    if (i !== activo) {
      e.preventDefault();
      tomar(() => setActivo(i));
    }
  };

  const actual = TARJETAS[activo];
  const desplazado = arrastre / paso;

  return (
    <section className="carrusel" aria-roledescription="carrusel" aria-label="Propiedades seleccionadas">
      <div className="carrusel__cab">
        <p className="carrusel__pre">Inversiones Generales M &amp; M · Inmobiliaria</p>
        <h1 className="carrusel__titulo">Un lugar para encontrar tu próxima propiedad.</h1>
      </div>

      <div
        ref={escenario}
        className={arrastre ? 'carrusel__escenario es-arrastrado' : 'carrusel__escenario'}
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') tomar(() => ir(1));
          if (e.key === 'ArrowLeft') tomar(() => ir(-1));
        }}
      >
        {TARJETAS.map((p, i) => {
          const d = distancia(i, activo, n) + desplazado;
          const a = Math.abs(d);
          const estilo: React.CSSProperties = llegaron
            ? {
                transform: `translateX(${d * paso}px) translateY(${a * a * 7 + a * 6}px) rotate(${d * 6}deg) scale(${1 - Math.min(a, 3) * 0.09})`,
                opacity: a > 2.6 ? 0 : 1,
                zIndex: 100 - Math.round(a * 10),
              }
            : {
                // Afuera, abajo a la derecha, cada una un poco más lejos.
                transform: `translate(${60 + i * 8}vw, ${50 + i * 4}vh) rotate(${28 + i * 4}deg) scale(0.9)`,
                opacity: 0,
                zIndex: 100 - i,
              };
          if (!acomodadas) estilo.transitionDelay = `${i * 90}ms`;
          return (
            <Link
              key={p.codigo}
              to={`${BASE}/propiedades/${slug(p)}`}
              className={i === activo ? 'carta-p carta-p--activa' : 'carta-p'}
              style={estilo}
              onClick={(e) => alTocarTarjeta(e, i)}
              draggable={false}
              tabIndex={i === activo ? 0 : -1}
              aria-label={i === activo ? `${p.titulo}, ${p.precio}` : `Ver ${p.titulo}`}
            >
              <img src={foto(p.portada, 520, 650)} alt="" draggable={false} decoding="async" />
            </Link>
          );
        })}
      </div>

      <div className="carrusel__pie">
        <button type="button" className="carrusel__flecha" onClick={() => tomar(() => ir(-1))} aria-label="Anterior">
          <IcoFlecha izq />
        </button>

        {actual && (
          <div className="carrusel__info" key={actual.codigo} aria-live="polite">
            <span className="carrusel__loc"><IcoUbicacion /> {actual.localidad}</span>
            <h2>{actual.titulo}</h2>
            <div className="carrusel__fila">
              <strong>{actual.precio}</strong>
              <button
                type="button"
                className="btn btn--primario btn--chico"
                onClick={() => navegar(`${BASE}/propiedades/${slug(actual)}`)}
              >
                Ver propiedad <IcoFlecha />
              </button>
            </div>
          </div>
        )}

        <button type="button" className="carrusel__flecha" onClick={() => tomar(() => ir(1))} aria-label="Siguiente">
          <IcoFlecha />
        </button>
      </div>

      <div className="carrusel__puntos" role="tablist" aria-label="Elegir propiedad">
        {TARJETAS.map((p, i) => (
          <button
            key={p.codigo}
            type="button"
            role="tab"
            aria-selected={i === activo}
            aria-label={`${i + 1} de ${n}`}
            className={i === activo ? 'carrusel__punto carrusel__punto--activo' : 'carrusel__punto'}
            onClick={() => tomar(() => setActivo(i))}
          />
        ))}
      </div>
    </section>
  );
}
