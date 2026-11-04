import { useCallback, useEffect, useRef } from 'react';

/**
 * La física de la credencial colgada.
 *
 * Es un péndulo: la cinta y la tarjeta giran juntas alrededor del punto donde
 * la cinta se pierde arriba de la pantalla. Se puede agarrar la tarjeta y
 * revolearla; al soltarla vuelve sola, con la inercia que traía.
 *
 * No pasa por React: el ángulo se escribe directo en el estilo, cuadro a
 * cuadro, y el bucle se apaga apenas la tarjeta queda quieta. Mientras alguien
 * escribe la contraseña no corre nada.
 *
 * Con `calma` (prefers-reduced-motion) no hay movimiento ni arrastre: la
 * tarjeta cuelga derecha y listo.
 */

/** Rigidez: g/L. Con 15 el vaivén dura ~1,6 s, como una credencial real. */
const RIGIDEZ = 15;
/** Rozamiento. Lo bastante para que se asiente en tres o cuatro idas y vueltas. */
const ROCE = 1.1;
/** Hasta dónde se deja llevar, en radianes (~70°). */
const TOPE = 1.2;

/** Lo que se agarra para arrastrar: todo menos los controles del formulario. */
const NO_ARRASTRA = 'input, button, a, textarea, select, .campo, .nota';

export function useColgante(calma: boolean) {
  const brazo = useRef<HTMLDivElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  const angulo = useRef(0);
  const velocidad = useRef(0);
  const cuadro = useRef(0);
  const ultimo = useRef(0);
  const arrastre = useRef<{
    id: number;
    desdeAngulo: number;
    desdePuntero: number;
    muestras: { t: number; a: number }[];
  } | null>(null);

  const pintar = useCallback(() => {
    const a = angulo.current;
    const w = velocidad.current;
    if (brazo.current) brazo.current.style.transform = `rotate(${a}rad)`;
    if (tarjeta.current) {
      // Al ir y venir la tarjeta se tuerce un poco sobre la cinta: es lo que
      // le da volumen. Se finge en 2D —se angosta y se inclina— porque con
      // un giro 3D de verdad Chrome deja de esmerilar el vidrio.
      const giro = Math.max(-0.5, Math.min(0.5, w * 0.16));
      tarjeta.current.style.transform =
        Math.abs(giro) < 0.004 ? '' : `scaleX(${Math.cos(giro).toFixed(4)}) skewY(${(giro * 9).toFixed(2)}deg)`;
      tarjeta.current.style.setProperty('--brillo', String(a));
    }
  }, []);

  const paso = useCallback(
    (ahora: number) => {
      const dt = Math.min(0.032, (ahora - ultimo.current) / 1000 || 0.016);
      ultimo.current = ahora;

      if (!arrastre.current) {
        const a = angulo.current;
        const acel = -RIGIDEZ * Math.sin(a) - ROCE * velocidad.current;
        velocidad.current += acel * dt;
        angulo.current += velocidad.current * dt;
        // Una credencial no da la vuelta entera: llega al tope y rebota,
        // perdiendo casi todo el impulso. Si pasara por arriba del pivote
        // se vería el tramo de cinta que sigue fuera de la pantalla.
        if (Math.abs(angulo.current) > TOPE) {
          angulo.current = Math.sign(angulo.current) * TOPE;
          velocidad.current = -velocidad.current * 0.3;
        }
      }
      pintar();

      const quieta = Math.abs(angulo.current) < 0.0004 && Math.abs(velocidad.current) < 0.002;
      if (quieta && !arrastre.current) {
        angulo.current = 0;
        velocidad.current = 0;
        pintar();
        cuadro.current = 0;
        return;
      }
      cuadro.current = requestAnimationFrame(paso);
    },
    [pintar],
  );

  const andar = useCallback(() => {
    if (calma || cuadro.current) return;
    ultimo.current = performance.now();
    cuadro.current = requestAnimationFrame(paso);
  }, [calma, paso]);

  /** Un empujón: para la entrada y para cuando la contraseña no va. */
  const empujar = useCallback(
    (impulso: number) => {
      if (calma) return;
      velocidad.current += impulso;
      andar();
    },
    [calma, andar],
  );

  // El pivote es el borde de arriba del brazo, que no se mueve de lugar.
  const anguloDelPuntero = (e: PointerEvent | React.PointerEvent) => {
    const r = brazo.current!.parentElement!.getBoundingClientRect();
    const px = r.left + r.width / 2;
    const py = r.top;
    return -Math.atan2(e.clientX - px, Math.max(1, e.clientY - py));
  };

  const alApretar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (calma || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(NO_ARRASTRA)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = {
      id: e.pointerId,
      desdeAngulo: angulo.current,
      desdePuntero: anguloDelPuntero(e),
      muestras: [{ t: performance.now(), a: angulo.current }],
    };
    velocidad.current = 0;
    e.currentTarget.classList.add('es-arrastrada');
    andar();
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = arrastre.current;
    if (!d || d.id !== e.pointerId) return;
    const a = d.desdeAngulo + (anguloDelPuntero(e) - d.desdePuntero);
    angulo.current = Math.max(-TOPE, Math.min(TOPE, a));
    const t = performance.now();
    d.muestras.push({ t, a: angulo.current });
    // Solo los últimos ~80 ms: la velocidad al soltar es la de ese momento.
    while (d.muestras.length > 2 && t - d.muestras[0].t > 80) d.muestras.shift();
    const p = d.muestras[0];
    if (t > p.t) velocidad.current = (angulo.current - p.a) / ((t - p.t) / 1000);
  };

  const alSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = arrastre.current;
    if (!d || d.id !== e.pointerId) return;
    arrastre.current = null;
    velocidad.current = Math.max(-6, Math.min(6, velocidad.current));
    e.currentTarget.classList.remove('es-arrastrada');
    andar();
  };

  useEffect(() => {
    if (calma) {
      angulo.current = 0;
      velocidad.current = 0;
      pintar();
      return;
    }
    // Entra cayendo y queda hamacándose un poco.
    angulo.current = 0.22;
    velocidad.current = 0;
    andar();
    return () => {
      cancelAnimationFrame(cuadro.current);
      cuadro.current = 0;
    };
  }, [calma, andar, pintar]);

  return {
    brazo,
    tarjeta,
    empujar,
    manejadores: {
      onPointerDown: alApretar,
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alSoltar,
    },
  };
}
