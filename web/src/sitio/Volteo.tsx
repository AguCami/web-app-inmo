import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { foto, type Propiedad } from '../datos';
import { IcoFlecha } from './iconos';

/**
 * La galería de la ficha en la computadora: una carta que se da vuelta
 * (prueba).
 *
 * - Una carta grande y vertical (4:5), como un naipe. Cada vez que se pasa de foto, la carta gira 180° sobre su
 *   eje vertical y del otro lado está la foto nueva.
 * - Detrás, a cada lado, asoma una carta de cristal con la foto anterior y
 *   la siguiente apenas adivinadas. Tocándolas (o con ← →) se pasa.
 *
 * Cómo gira: la carta tiene dos caras. La que no se ve recibe la foto nueva,
 * se espera a que la imagen esté lista (así no gira hacia un hueco) y se
 * suma ±180° al giro. Si llegan varios pedidos seguidos, se encolan y gana
 * el último.
 */
const GIRO_MS = 760;
/**
 * Los naipes en abanico debajo de la carta (una prueba anterior). Apagados:
 * quedan armados, con sus estilos (.abanico, .naipe-m), por si se vuelven a usar.
 */
const CON_ABANICO = false;

export function Volteo({ p }: { p: Propiedad }) {
  const calma = usePrefiereCalma();
  const fotos = p.fotos.length ? p.fotos : [p.portada];
  const n = fotos.length;
  const [i, setI] = useState(0);
  // Qué foto tiene cada cara y cuánto giró la carta en total.
  const [caras, setCaras] = useState<[number, number]>([0, 0]);
  const [giro, setGiro] = useState(0);
  const girando = useRef(false);
  const pendiente = useRef<{ j: number; dir: 1 | -1 } | null>(null);
  const tira = useRef<HTMLDivElement>(null);
  // Lo mismo que el estado, pero siempre al día para los pedidos encolados.
  const giroRef = useRef(0);
  const iRef = useRef(0);

  useEffect(() => {
    setI(0);
    setCaras([0, 0]);
    setGiro(0);
    giroRef.current = 0;
    iRef.current = 0;
  }, [p.codigo]);

  /** Qué cara se ve con un giro dado: 0 si es múltiplo de 360, 1 si no. */
  const caraDe = (g: number) => (((Math.round(g / 180) % 2) + 2) % 2) as 0 | 1;
  const visible = caraDe(giro);

  const irA = useCallback(
    async (j: number, dir: 1 | -1) => {
      if (j === iRef.current) return;
      if (girando.current) {
        pendiente.current = { j, dir };
        return;
      }
      girando.current = true;
      const oculta = (1 - caraDe(giroRef.current)) as 0 | 1;
      // La foto nueva va a la cara de atrás y se espera a que esté lista.
      const img = new Image();
      img.src = foto(fotos[j], 920, 1150);
      try {
        await img.decode();
      } catch {
        /* si no se pudo decodificar, gira igual */
      }
      setCaras((c) => {
        const nuevas: [number, number] = [c[0], c[1]];
        nuevas[oculta] = j;
        return nuevas;
      });
      setI(j);
      iRef.current = j;
      giroRef.current += dir * 180;
      const nuevo = giroRef.current;
      // Un cuadro después, para que la cara nueva ya tenga su foto al empezar a girar.
      requestAnimationFrame(() => setGiro(nuevo));
      window.setTimeout(() => {
        girando.current = false;
        const sig = pendiente.current;
        pendiente.current = null;
        if (sig) void irA(sig.j, sig.dir);
      }, calma ? 0 : GIRO_MS);
    },
    [fotos, calma],
  );

  const pasar = (d: 1 | -1) => irA((iRef.current + d + n) % n, d);

  // ← → del teclado (si no se está escribiendo en un campo).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') pasar(1);
      if (e.key === 'ArrowLeft') pasar(-1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // El abanico: cada carta gira alrededor de un punto muy por debajo, como
  // naipes en la mano. El ángulo total se reparte entre las cartas (con un
  // tope por carta, para que con pocas fotos no quede un abanico enorme).
  const paso = n > 1 ? Math.min(7, 70 / (n - 1)) : 0;

  return (
    <div className="volteo">
      <div className="volteo__escena">
        <div
          className="volteo__carta"
          style={{ transform: `rotateY(${giro}deg)`, transitionDuration: calma ? '0ms' : `${GIRO_MS}ms` }}
          onClick={() => pasar(1)}
        >
          {[0, 1].map((k) => (
            <div key={k} className={`volteo__cara volteo__cara--${k}`} aria-hidden={k !== visible}>
              <img
                src={foto(fotos[caras[k]], 920, 1150)}
                alt={k === visible ? `${p.titulo}, foto ${i + 1} de ${n}` : ''}
                draggable={false}
                decoding="async"
              />
            </div>
          ))}
        </div>
        {/* Las cartas de cristal que asoman detrás, a cada lado: dejan adivinar,
            borrosa, la foto anterior y la siguiente. Tocándolas se pasa. */}
        {n > 1 && (
          <>
            <button
              type="button"
              key={`izq-${i}`}
              className="volteo__lado volteo__lado--izq"
              onClick={() => pasar(-1)}
              aria-label="Foto anterior"
            >
              <img src={foto(fotos[(i - 1 + n) % n], 460, 575)} alt="" draggable={false} />
              <span className="volteo__lado-flecha" aria-hidden="true"><IcoFlecha izq /></span>
            </button>
            <button
              type="button"
              key={`der-${i}`}
              className="volteo__lado volteo__lado--der"
              onClick={() => pasar(1)}
              aria-label="Foto siguiente"
            >
              <img src={foto(fotos[(i + 1) % n], 460, 575)} alt="" draggable={false} />
              <span className="volteo__lado-flecha" aria-hidden="true"><IcoFlecha /></span>
            </button>
          </>
        )}
        <span className="volteo__cuenta" aria-live="polite">{i + 1} / {n}</span>
      </div>

      {CON_ABANICO && n > 1 && (
        <div className="abanico" ref={tira} role="tablist" aria-label="Elegir foto">
          {fotos.map((f, k) => (
            <button
              key={f + k}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Foto ${k + 1}`}
              className={k === i ? 'naipe-m naipe-m--arriba' : 'naipe-m'}
              style={{ '--r': `${(k - (n - 1) / 2) * paso}deg`, zIndex: k + 1 } as React.CSSProperties}
              onClick={() => irA(k, k > iRef.current ? 1 : -1)}
            >
              <span className="naipe-m__giro">
                <span className="naipe-m__dorso" aria-hidden="true">
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
                </span>
                <span className="naipe-m__frente">
                  <img src={foto(f, 120, 180)} alt="" loading="lazy" draggable={false} />
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
