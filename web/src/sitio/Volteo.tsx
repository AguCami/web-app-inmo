import { useEffect, useState } from 'react';
import { usePrefiereCalma } from '../../../src/components/animacion';
import { foto, type Propiedad } from '../datos';
import { IcoFlecha } from './iconos';

/**
 * La galería de la ficha en la computadora: tres cartas (prueba).
 *
 * - Al medio, la carta grande y vertical (4:5) con la foto.
 * - A cada lado asoma una carta de cristal con la foto anterior y la
 *   siguiente, borrosas, inclinadas y giradas un poco en 3D.
 * - Al pasar, las cartas se mueven de verdad entre esos lugares: la del medio
 *   cae hacia el costado del que se va (se vuelve de cristal), la del costado
 *   viene al medio (se aclara) y por detrás entra la que sigue. Todo con una
 *   transición del CSS sobre transform, opacity y filter (~480 ms).
 *
 * Se pasa tocando una carta de los costados, la del medio (siguiente) o con
 * ← → del teclado.
 *
 * Por dentro: se dibujan cinco cartas (-2 a 2 lugares de la actual), cada
 * una con su foto como key. Al cambiar la actual, cada carta recibe su lugar
 * nuevo (data-pos) y el CSS la lleva; como el elemento es el mismo, el
 * movimiento es continuo. Las de ±2 esperan escondidas detrás.
 */

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

  useEffect(() => {
    setI(0);
  }, [p.codigo]);

  const pasar = (d: number) => setI((a) => (((a + d) % n) + n) % n);

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

  // Los lugares que se dibujan. Con pocas fotos, sin repetir ninguna.
  const lugares = n >= 5 ? [-2, -1, 0, 1, 2] : n === 4 ? [-1, 0, 1, 2] : n === 3 ? [-1, 0, 1] : n === 2 ? [0, 1] : [0];
  const cartas = lugares.map((pos) => ({ pos, k: (((i + pos) % n) + n) % n }));

  // El abanico (apagado): cada naipe gira alrededor de un punto muy por debajo.
  const paso = n > 1 ? Math.min(7, 70 / (n - 1)) : 0;

  return (
    <div className="volteo">
      <div className={calma ? 'tres tres--quieta' : 'tres'}>
        {cartas.map(({ pos, k }) => (
          <button
            key={k}
            type="button"
            className="tres__carta"
            data-pos={pos}
            tabIndex={Math.abs(pos) === 1 ? 0 : -1}
            aria-hidden={Math.abs(pos) > 1 || undefined}
            aria-label={pos === 0 ? `${p.titulo}, foto ${i + 1} de ${n}. Siguiente` : pos < 0 ? 'Foto anterior' : 'Foto siguiente'}
            onClick={() => pasar(pos === 0 ? 1 : pos)}
          >
            <img src={foto(fotos[k], 920, 1150)} alt="" draggable={false} decoding="async" />
            {Math.abs(pos) === 1 && (
              <span className="tres__flecha" aria-hidden="true">{pos < 0 ? <IcoFlecha izq /> : <IcoFlecha />}</span>
            )}
          </button>
        ))}
        <span className="volteo__cuenta" aria-live="polite">{i + 1} / {n}</span>
      </div>

      {CON_ABANICO && n > 1 && (
        <div className="abanico" role="tablist" aria-label="Elegir foto">
          {fotos.map((f, k) => (
            <button
              key={f + k}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Foto ${k + 1}`}
              className={k === i ? 'naipe-m naipe-m--arriba' : 'naipe-m'}
              style={{ '--r': `${(k - (n - 1) / 2) * paso}deg`, zIndex: k + 1 } as React.CSSProperties}
              onClick={() => setI(k)}
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
