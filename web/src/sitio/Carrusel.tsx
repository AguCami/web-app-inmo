import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { SELECCION, foto, porCodigo, slug, type Propiedad } from '../datos';
import { BASE } from './Sitio';
import { IcoFlecha, IcoUbicacion } from './iconos';

/**
 * La portada del inicio: una selección de propiedades en tarjetas.
 *
 * Al abrir, las tarjetas llegan volando de a una y se acomodan en abanico,
 * con la del medio adelante. Después se pasan con las flechas, tocando una
 * de los costados, con los puntos, el teclado o el trackpad de costado; en
 * el celular, también deslizando con el dedo. Con el mouse no se arrastra.
 * Tocar la del medio abre la propiedad.
 *
 * Para que se sienta fluido, las tarjetas no pasan por React al moverse:
 * su lugar se escribe directo en el estilo. Al deslizar siguen al dedo
 * cuadro a cuadro, y al soltar se tiene en cuenta la velocidad: un tirón
 * rápido pasa varias, uno lento vuelve o avanza una.
 *
 * Es circular: después de la última vuelve la primera. Las que quedan lejos
 * del medio se esconden, así el salto de una punta a la otra no se ve.
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

/** Dónde va una tarjeta que está a d lugares del medio. */
function pose(d: number, paso: number) {
  const a = Math.abs(d);
  return {
    transform: `translate3d(${d * paso}px, ${a * a * 7 + a * 6}px, 0) rotate(${d * 6}deg) scale(${1 - Math.min(a, 3) * 0.09})`,
    opacity: a > 2.6 ? '0' : '1',
    zIndex: String(100 - Math.round(a * 10)),
  };
}

export function Carrusel() {
  const calma = usePrefiereCalma();
  const navegar = useNavigate();
  const n = TARJETAS.length;
  const [activo, setActivo] = useState(0);
  const [tocado, setTocado] = useState(false);
  const [encima, setEncima] = useState(false);
  const escenario = useRef<HTMLDivElement>(null);
  const tarjetas = useRef<(HTMLAnchorElement | null)[]>([]);
  const paso = useRef(200);
  const activoRef = useRef(0);
  const llegaron = useRef(calma);
  const arrastre = useRef<{ id: number; x0: number; dx: number; movio: boolean; muestras: { t: number; x: number }[] } | null>(null);
  const cuadro = useRef(0);
  const ultimaRueda = useRef(0);

  /** Pone cada tarjeta en su lugar, corrida `desfase` lugares (al arrastrar). */
  const colocar = useCallback((desfase = 0) => {
    tarjetas.current.forEach((t, i) => {
      if (!t) return;
      const d = distancia(i, activoRef.current, n) + desfase;
      Object.assign(t.style, pose(d, paso.current));
    });
  }, [n]);

  // La separación sale del ancho real de una tarjeta.
  useLayoutEffect(() => {
    const medir = () => {
      const t = tarjetas.current[0];
      if (t) paso.current = t.offsetWidth * (window.innerWidth < 760 ? 0.42 : 0.58);
      if (llegaron.current) colocar();
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [colocar]);

  // La llegada: arrancan afuera, abajo a la derecha, y se sueltan de a una.
  useLayoutEffect(() => {
    if (calma) {
      llegaron.current = true;
      colocar();
      return;
    }
    const el = escenario.current;
    tarjetas.current.forEach((t, i) => {
      if (!t) return;
      t.style.transform = `translate3d(${60 + i * 8}vw, ${50 + i * 4}vh, 0) rotate(${28 + i * 4}deg) scale(0.9)`;
      t.style.opacity = '0';
      t.style.transitionDelay = `${i * 80}ms`;
    });
    el?.classList.add('es-llegando');
    const c = requestAnimationFrame(() => requestAnimationFrame(() => {
      llegaron.current = true;
      colocar();
    }));
    const fin = window.setTimeout(() => {
      el?.classList.remove('es-llegando');
      tarjetas.current.forEach((t) => t && (t.style.transitionDelay = ''));
    }, 1100 + n * 80);
    return () => {
      cancelAnimationFrame(c);
      window.clearTimeout(fin);
    };
  }, [calma, colocar, n]);

  // Cada cambio de la del medio las lleva a su lugar (con la transición del CSS).
  useLayoutEffect(() => {
    activoRef.current = activo;
    if (llegaron.current) colocar();
  }, [activo, colocar]);

  const ir = useCallback((d: number) => setActivo((a) => (((a + d) % n) + n) % n), [n]);
  const tomar = (cb: () => void) => {
    setTocado(true);
    cb();
  };

  // Pasa sola hasta que alguien la toca; con el mouse encima, espera.
  useEffect(() => {
    if (calma || tocado || encima) return;
    const t = window.setInterval(() => ir(1), CADA_MS);
    return () => window.clearInterval(t);
  }, [calma, tocado, encima, ir]);

  // ── Deslizar con el dedo ──
  const alApretar = (e: React.PointerEvent) => {
    // Con el mouse no se agarra: se pasa con las flechas o tocando una tarjeta.
    // Con el dedo sí se desliza, como cualquier carrusel en el celular.
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    arrastre.current = { id: e.pointerId, x0: e.clientX, dx: 0, movio: false, muestras: [{ t: e.timeStamp, x: e.clientX }] };
  };
  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    a.dx = e.clientX - a.x0;
    a.muestras.push({ t: e.timeStamp, x: e.clientX });
    if (a.muestras.length > 6) a.muestras.shift();
    if (!a.movio && Math.abs(a.dx) > 5) {
      a.movio = true;
      setTocado(true);
      escenario.current?.setPointerCapture(e.pointerId);
      escenario.current?.classList.add('es-arrastrado');
    }
    if (a.movio && !cuadro.current) {
      cuadro.current = requestAnimationFrame(() => {
        cuadro.current = 0;
        if (arrastre.current) colocar(arrastre.current.dx / paso.current);
      });
    }
  };
  const alSoltar = (e: React.PointerEvent) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    cancelAnimationFrame(cuadro.current);
    cuadro.current = 0;
    escenario.current?.classList.remove('es-arrastrado');
    if (a.movio) {
      // La velocidad de los últimos ~100 ms: un tirón rápido sigue de largo.
      const m = a.muestras;
      const primera = m.find((s) => e.timeStamp - s.t < 100) ?? m[0];
      const dt = Math.max(1, e.timeStamp - primera.t);
      const v = (e.clientX - primera.x) / dt; // px por ms
      const proyectado = a.dx + v * 180;
      const pasos = Math.max(-3, Math.min(3, -Math.round(proyectado / paso.current)));
      if (pasos) ir(pasos);
      else colocar();
    }
    // El click que viene después de arrastrar no tiene que abrir nada.
    window.setTimeout(() => (arrastre.current = null), 0);
  };

  // La rueda o el trackpad de costado: una tarjeta por gesto.
  const alRodar = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 12) return;
    const ahora = performance.now();
    if (ahora - ultimaRueda.current < 380) return;
    ultimaRueda.current = ahora;
    tomar(() => ir(e.deltaX > 0 ? 1 : -1));
  };

  const alTocarTarjeta = (e: React.MouseEvent, i: number) => {
    if (arrastre.current?.movio) {
      e.preventDefault();
      return;
    }
    if (i !== activo) {
      e.preventDefault();
      tomar(() => setActivo(i));
    }
  };

  const actual = TARJETAS[activo];

  return (
    <section className="carrusel" aria-roledescription="carrusel" aria-label="Propiedades seleccionadas">
      <div className="carrusel__cab">
        <p className="carrusel__pre">Inversiones Generales <span className="carrusel__mym">M &amp; M</span> · Inmobiliaria</p>
        <h1 className="carrusel__titulo">Un lugar para encontrar tu próxima propiedad.</h1>
      </div>

      <div
        ref={escenario}
        className="carrusel__escenario"
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onWheel={alRodar}
        onMouseEnter={() => setEncima(true)}
        onMouseLeave={() => setEncima(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') tomar(() => ir(1));
          if (e.key === 'ArrowLeft') tomar(() => ir(-1));
        }}
      >
        {TARJETAS.map((p, i) => (
          <Link
            key={p.codigo}
            ref={(el) => { tarjetas.current[i] = el; }}
            to={`${BASE}/propiedades/${slug(p)}`}
            className={i === activo ? 'carta-p carta-p--activa' : 'carta-p'}
            onClick={(e) => alTocarTarjeta(e, i)}
            draggable={false}
            tabIndex={i === activo ? 0 : -1}
            aria-label={i === activo ? `${p.titulo}, ${p.precio}` : `Ver ${p.titulo}`}
          >
            <img src={foto(p.portada, 520, 650)} alt="" draggable={false} decoding="async" />
          </Link>
        ))}
      </div>

      <div className="carrusel__pie">
        <button type="button" className="carrusel__flecha" onClick={() => tomar(() => ir(-1))} aria-label="Anterior">
          <IcoFlecha izq />
        </button>

        {actual && (
          <div className="carrusel__info" key={actual.codigo} aria-live="polite">
            <span className="carrusel__loc"><IcoUbicacion /> {actual.localidad}</span>
            <h2><span>{actual.titulo}</span></h2>
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
