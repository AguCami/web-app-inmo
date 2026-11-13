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
 * - Las de los costados están dadas vuelta: se ve su dorso de cristal. Al
 *   pasar, la del medio cae hacia el costado del que se va dándose vuelta,
 *   y la del costado viene al medio dándose vuelta hasta mostrar la foto
 *   (card flip). Las dos giran para el mismo lado, como cartas que ruedan;
 *   por detrás entra la que sigue. Transición del CSS (~520 ms).
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
          // Un div con rol de botón y no un <button>: dentro de un botón el
          // navegador aplana el 3D y el dorso se vería como la foto espejada.
          <div
            key={k}
            role="button"
            className="tres__carta"
            data-pos={pos}
            tabIndex={Math.abs(pos) === 1 ? 0 : -1}
            aria-hidden={Math.abs(pos) > 1 || undefined}
            aria-label={pos === 0 ? `${p.titulo}, foto ${i + 1} de ${n}. Siguiente` : pos < 0 ? 'Foto anterior' : 'Foto siguiente'}
            onClick={() => pasar(pos === 0 ? 1 : pos)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pasar(pos === 0 ? 1 : pos);
              }
            }}
          >
            {/* El frente: la foto. El dorso: la misma foto borrosa bajo un cristal.
                Al medio se ve el frente; a los costados la carta está dada vuelta. */}
            <span className="tres__cara tres__cara--frente">
              <img src={foto(fotos[k], 920, 1150)} alt="" draggable={false} decoding="async" />
            </span>
            <span className="tres__cara tres__cara--dorso" aria-hidden="true">
              <img src={foto(fotos[k], 460, 575)} alt="" draggable={false} decoding="async" />
              {Math.abs(pos) === 1 && (
                <span className="tres__flecha">{pos < 0 ? <IcoFlecha izq /> : <IcoFlecha />}</span>
              )}
            </span>
          </div>
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
