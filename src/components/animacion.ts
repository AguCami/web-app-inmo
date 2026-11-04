import { useEffect, useRef, useState } from 'react';

/**
 * ¿La persona pidió que la interfaz se quede quieta?
 *
 * Se consulta en vivo, no una sola vez: en el sistema se puede cambiar con
 * la app abierta.
 */
export function usePrefiereCalma(): boolean {
  const [calma, setCalma] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = () => setCalma(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return calma;
}

/** Desaceleración: rápido al principio, se frena al llegar. */
function suavizar(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Lleva un número hasta su valor en vez de plantarlo de golpe.
 *
 * Dos razones, y ninguna es decorativa:
 *
 *   · cuando un importe cambia porque se cobró una cuota, el movimiento
 *     dice QUÉ cambió. Un número que salta no avisa nada;
 *   · al abrir el panel, ver subir los totales da la medida de la escala
 *     antes de leer el número.
 *
 * Arranca desde el valor anterior, no desde cero: si se cobran $ 5.000 de
 * un total de $ 9.800.000, la animación va de 9.795.000 a 9.800.000 y se
 * ve el salto real, no un recuento completo que no significa nada.
 *
 * Con `prefers-reduced-motion` devuelve el valor final en el acto.
 */
export function useContador(valor: number, duracion = 900): number {
  const calma = usePrefiereCalma();
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  const cuadro = useRef<number>(0);

  useEffect(() => {
    if (calma) {
      setMostrado(valor);
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    const delta = valor - origen;
    if (delta === 0) return;

    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      setMostrado(origen + delta * suavizar(t));
      if (t < 1) cuadro.current = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    cuadro.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro.current);
  }, [valor, duracion, calma]);

  useEffect(() => {
    if (calma) desde.current = valor;
  }, [calma, valor]);

  return calma ? valor : mostrado;
}
