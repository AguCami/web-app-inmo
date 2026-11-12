import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { foto, type Propiedad } from '../datos';
import { IcoEscritura, IcoFlecha, IcoSuperficie, IcoTerreno, IcoUbicacion } from './iconos';

/**
 * La galería de la ficha como un mazo de cartas (prueba).
 *
 * Las fotos son cartas verticales apiladas; se ven los cantos de las dos de
 * atrás para que se note que hay más. La de arriba:
 *
 * - Con el dedo se arrastra de costado: sigue al dedo girando un poco en 3D
 *   (rotateY) y de canto (rotateZ). Al soltar, si se tiró lo bastante (o
 *   rápido), sale volando para ese lado y pasa al fondo del mazo; si no,
 *   vuelve a su lugar con un resorte.
 * - Tocándola (o con las flechas, o con ← → del teclado) pasa a la siguiente.
 * - El botón «Datos» la da vuelta 180° y en el dorso muestra los datos de la
 *   propiedad. Volver a tocarlo (o tocar el dorso) la endereza.
 *
 * Con el mouse no se arrastra: se hace clic. Así se maneja igual que el
 * carrusel del inicio.
 *
 * Rendimiento: nada de esto pasa por React mientras se mueve. Un resorte
 * (masa-resorte-amortiguador) corre en requestAnimationFrame y escribe solo
 * transform en la carta de arriba; el bucle se apaga apenas todo queda
 * quieto. React solo se entera cuando cambia la foto de arriba.
 *
 * Las fotos no tienen nombre de ambiente cargado en el CMS: la píldora dice
 * «Foto 3 / 25». Si algún día se cargan nombres, alcanza con pasarlos en
 * `nombres` y la píldora los muestra.
 */

/** Resorte: rigidez y amortiguación. Con estos valores se asienta en ~0,4 s, con un rebote apenas visible. */
const RIGIDEZ = 260;
const AMORTIGUA = 24;
/** Cuánto hay que tirar (en fracción del ancho) para que salga. */
const UMBRAL = 0.28;
/** O qué tan rápido (px por ms). */
const UMBRAL_VEL = 0.55;

interface Estado {
  x: number;
  vx: number;
  /** Destino de x: 0 (en su lugar) o afuera, a un costado. */
  objetivoX: number;
  giro: number;
  vGiro: number;
  /** 0 o 180: de frente o dada vuelta. */
  objetivoGiro: number;
}

export function Mazo({ p, nombres }: { p: Propiedad; nombres?: string[] }) {
  const calma = usePrefiereCalma();
  const fotos = p.fotos.length ? p.fotos : [p.portada];
  const n = fotos.length;
  const [i, setI] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const arriba = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const est = useRef<Estado>({ x: 0, vx: 0, objetivoX: 0, giro: 0, vGiro: 0, objetivoGiro: 0 });
  const cuadro = useRef(0);
  const ultimo = useRef(0);
  const saliendo = useRef<number | null>(null);
  const toque = useRef<{ id: number; x0: number; y0: number; movio: boolean; muestras: { t: number; x: number }[]; horizontal: boolean | null } | null>(null);

  useEffect(() => {
    setI(0);
    setVolteada(false);
  }, [p.codigo]);

  /** Escribe la pose de la carta de arriba. */
  const pintar = useCallback(() => {
    const el = arriba.current;
    const w = caja.current?.offsetWidth ?? 360;
    if (!el) return;
    const { x, giro } = est.current;
    const f = x / w;
    // Al arrastrar gira un poco de costado y de canto; se aleja apenas.
    const rotY = giro + f * 28;
    const rotZ = f * 12;
    el.style.transform = `translate3d(${x}px, ${Math.abs(f) * -14}px, 0) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`;
  }, []);

  /** El bucle del resorte: corre mientras algo se mueve. */
  const animar = useCallback(() => {
    if (cuadro.current) return;
    ultimo.current = performance.now();
    const paso = (ahora: number) => {
      const dt = Math.min(0.032, (ahora - ultimo.current) / 1000);
      ultimo.current = ahora;
      const e = est.current;
      const arrastrando = !!toque.current?.movio;
      if (!arrastrando) {
        const ax = -RIGIDEZ * (e.x - e.objetivoX) - AMORTIGUA * e.vx;
        e.vx += ax * dt;
        e.x += e.vx * dt;
      }
      const ag = -RIGIDEZ * (e.giro - e.objetivoGiro) - AMORTIGUA * e.vGiro;
      e.vGiro += ag * dt;
      e.giro += e.vGiro * dt;
      pintar();

      // ¿Terminó de salir? Pasa al fondo y la de abajo queda arriba.
      const w = caja.current?.offsetWidth ?? 360;
      if (saliendo.current !== null && Math.abs(e.x) > w * 1.05) {
        const dir = saliendo.current;
        saliendo.current = null;
        Object.assign(e, { x: 0, vx: 0, objetivoX: 0, giro: 0, vGiro: 0, objetivoGiro: 0 });
        setVolteada(false);
        setI((a) => (a + dir + n) % n);
        cuadro.current = 0;
        return;
      }
      const quieto =
        !arrastrando &&
        Math.abs(e.x - e.objetivoX) < 0.5 && Math.abs(e.vx) < 5 &&
        Math.abs(e.giro - e.objetivoGiro) < 0.2 && Math.abs(e.vGiro) < 1;
      if (quieto) {
        e.x = e.objetivoX;
        e.giro = e.objetivoGiro;
        pintar();
        cuadro.current = 0;
        return;
      }
      cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);
  }, [n, pintar]);

  useEffect(() => () => cancelAnimationFrame(cuadro.current), []);

  // Cada foto nueva arriba arranca derecha y de frente.
  useLayoutEffect(() => {
    pintar();
  }, [i, pintar]);

  /** Tira la carta de arriba para un lado: dir 1 = siguiente (sale a la izquierda). */
  const pasar = useCallback(
    (dir: 1 | -1, velocidad = 0) => {
      if (n < 2) return;
      if (calma) {
        setVolteada(false);
        est.current.objetivoGiro = 0;
        est.current.giro = 0;
        setI((a) => (a + dir + n) % n);
        return;
      }
      const e = est.current;
      const w = caja.current?.offsetWidth ?? 360;
      saliendo.current = dir;
      e.objetivoX = -dir * w * 1.4;
      // Si venía con impulso del dedo lo conserva; si no, le damos uno.
      e.vx = velocidad || -dir * w * 3;
      animar();
    },
    [animar, calma, n],
  );

  const voltear = () => {
    const nueva = !volteada;
    setVolteada(nueva);
    est.current.objetivoGiro = nueva ? 180 : 0;
    if (calma) {
      est.current.giro = est.current.objetivoGiro;
      pintar();
    } else animar();
  };

  // Teclado: ← → pasan, Enter o espacio la dan vuelta (con el foco en el mazo).
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') pasar(1);
    else if (e.key === 'ArrowLeft') pasar(-1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      voltear();
    }
  };

  // ── El dedo ──
  const alApretar = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    toque.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, movio: false, muestras: [{ t: e.timeStamp, x: e.clientX }], horizontal: null };
  };
  const alMover = (e: React.PointerEvent) => {
    const t = toque.current;
    if (!t || t.id !== e.pointerId || e.pointerType === 'mouse') return;
    const dx = e.clientX - t.x0;
    const dy = e.clientY - t.y0;
    // Se decide una vez si el gesto es de costado (mazo) o vertical (scroll de la página).
    if (t.horizontal === null && Math.hypot(dx, dy) > 8) t.horizontal = Math.abs(dx) > Math.abs(dy);
    if (!t.horizontal) return;
    if (!t.movio) {
      t.movio = true;
      try {
        caja.current?.setPointerCapture(e.pointerId);
      } catch {
        /* sin puntero activo (eventos sintéticos): se sigue igual */
      }
      animar();
    }
    t.muestras.push({ t: e.timeStamp, x: e.clientX });
    if (t.muestras.length > 6) t.muestras.shift();
    // Más allá del borde cuesta más: se siente que «tira».
    est.current.x = dx;
    est.current.vx = 0;
  };
  const alSoltar = (e: React.PointerEvent) => {
    const t = toque.current;
    if (!t || t.id !== e.pointerId) return;
    toque.current = null;
    // Un gesto vertical (scroll de la página) o cancelado no es un toque.
    if (e.type === 'pointercancel' || t.horizontal === false) {
      if (t.movio) {
        est.current.objetivoX = 0;
        animar();
      }
      return;
    }
    if (!t.movio) {
      // Un toque: si está de frente pasa a la siguiente; si está dada vuelta, se endereza.
      if (volteada) voltear();
      else pasar(1);
      return;
    }
    const w = caja.current?.offsetWidth ?? 360;
    const primera = t.muestras.find((s) => e.timeStamp - s.t < 100) ?? t.muestras[0];
    const v = (e.clientX - primera.x) / Math.max(1, e.timeStamp - primera.t); // px/ms
    const dx = e.clientX - t.x0;
    if (Math.abs(dx) > w * UMBRAL || Math.abs(v) > UMBRAL_VEL) {
      const dir = (dx !== 0 ? -Math.sign(dx) : -Math.sign(v)) as 1 | -1;
      pasar(dir, v * 1000);
    } else {
      est.current.objetivoX = 0;
      est.current.vx = v * 1000;
      animar();
    }
  };

  // Precarga las dos que siguen: al pasar ya están.
  useEffect(() => {
    for (const k of [1, 2]) {
      const img = new Image();
      img.src = foto(fotos[(i + k) % n], 800, 1000);
    }
  }, [i, fotos, n]);

  const nombre = nombres?.[i];
  // De atrás para adelante: las dos de abajo y la de arriba (que va última, encima).
  // Van con la foto como key: al pasar, la que estaba segunda se corre a
  // primera con la transición del CSS en vez de aparecer de golpe.
  const atras = [2, 1].filter((k) => k < n).map((k) => ({ k, id: fotos[(i + k) % n], pos: (i + k) % n }));

  return (
    <div className="mazo">
      <div className="mazo__pildora" aria-live="polite">
        <span>{nombre ?? 'Foto'}</span>
        <span className="mazo__cuenta">{i + 1} / {n}</span>
      </div>

      <div
        ref={caja}
        className="mazo__pila"
        role="group"
        aria-roledescription="mazo de fotos"
        aria-label={`Fotos de ${p.titulo}. Flechas para pasar, Enter para ver los datos.`}
        tabIndex={0}
        onKeyDown={tecla}
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        {atras.map(({ k, id, pos }) => (
          <div key={`atras-${pos}`} className={`mazo__carta mazo__carta--atras mazo__carta--${k}`} aria-hidden="true">
            <img src={foto(id, 800, 1000)} alt="" draggable={false} decoding="async" />
          </div>
        ))}

        {/* La de arriba sube desde el lugar de la segunda (animación del CSS en
            .mazo__nivel); adentro, el resorte la mueve con transform. */}
        <div key={`arriba-${i}`} className={calma ? 'mazo__nivel' : 'mazo__nivel mazo__nivel--sube'}>
        <div ref={arriba} className="mazo__carta mazo__carta--arriba">
          <div className="mazo__cara mazo__cara--frente">
            <img
              src={foto(fotos[i], 800, 1000)}
              alt={`${p.titulo}, foto ${i + 1} de ${n}`}
              draggable={false}
              decoding="async"
            />
          </div>
          <div className="mazo__cara mazo__cara--dorso" aria-hidden={!volteada}>
            <p className="mazo__dorso-pre">{p.tipo} en venta</p>
            <h3>{p.titulo}</h3>
            <p className="mazo__dorso-loc"><IcoUbicacion /> {p.localidad}</p>
            <ul>
              {p.cubiertos && <li><IcoSuperficie /><span>Cubiertos</span><strong>{p.cubiertos}</strong></li>}
              {p.terreno && <li><IcoTerreno /><span>Terreno</span><strong>{p.terreno}</strong></li>}
              {p.escritura !== null && <li><IcoEscritura /><span>Escritura</span><strong>{p.escritura ? 'Sí' : 'No'}</strong></li>}
            </ul>
            <p className="mazo__dorso-precio">{p.precio}</p>
            <p className="mazo__dorso-ayuda">Tocá para volver a la foto</p>
          </div>
        </div>
        </div>
      </div>

      <div className="mazo__controles">
        <button type="button" className="mazo__boton" onClick={() => pasar(-1)} aria-label="Foto anterior" disabled={n < 2}>
          <IcoFlecha izq />
        </button>
        <button type="button" className={volteada ? 'mazo__voltear mazo__voltear--activo' : 'mazo__voltear'} onClick={voltear} aria-pressed={volteada}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></svg>
          {volteada ? 'Ver foto' : 'Datos'}
        </button>
        <button type="button" className="mazo__boton" onClick={() => pasar(1)} aria-label="Foto siguiente" disabled={n < 2}>
          <IcoFlecha />
        </button>
      </div>
    </div>
  );
}
