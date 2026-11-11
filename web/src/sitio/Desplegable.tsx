import { useEffect, useId, useRef, useState } from 'react';

/**
 * Un menú desplegable propio, en lugar del <select> del navegador, que se
 * ve cuadrado y distinto en cada sistema.
 *
 * Todo el recuadro es el botón (la etiqueta, el valor y la flechita), así
 * que se abre tocando en cualquier parte. La lista es una pieza redondeada,
 * como el resto de la web, con la opción elegida marcada.
 *
 * Teclado: flechas para moverse, Enter para elegir, Esc para cerrar.
 */
export interface Opcion {
  valor: string;
  texto: string;
}

export function Desplegable({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  clase = '',
  ariaLabel,
}: {
  etiqueta?: string;
  valor: string;
  opciones: Opcion[];
  alCambiar: (valor: string) => void;
  clase?: string;
  ariaLabel?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();
  const elegida = opciones.find((o) => o.valor === valor) ?? opciones[0];

  // Clic afuera: se cierra.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera);
    return () => document.removeEventListener('pointerdown', afuera);
  }, [abierto]);

  // Al abrir, se resalta la elegida y la lista la muestra.
  useEffect(() => {
    if (!abierto) return;
    const i = Math.max(0, opciones.findIndex((o) => o.valor === valor));
    setResaltado(i);
    lista.current?.children[i]?.scrollIntoView({ block: 'nearest' });
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (v: string) => {
    alCambiar(v);
    setAbierto(false);
  };

  const tecla = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setAbierto(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = opciones.length;
      const i = (resaltado + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      setResaltado(i);
      lista.current?.children[i]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(opciones[resaltado].valor);
    } else if (e.key === 'Tab') {
      setAbierto(false);
    }
  };

  return (
    <div className={`despl ${clase} ${abierto ? 'despl--abierto' : ''}`} ref={caja}>
      <button
        type="button"
        className="despl__boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={ariaLabel}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={tecla}
      >
        {etiqueta && <span className="despl__et">{etiqueta}</span>}
        <span className="despl__valor">{elegida?.texto}</span>
        <svg className="despl__flecha" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {abierto && (
        <ul className="despl__lista" role="listbox" id={id} ref={lista} aria-label={etiqueta ?? ariaLabel}>
          {opciones.map((o, i) => (
            <li
              key={o.valor || '__todas'}
              role="option"
              aria-selected={o.valor === valor}
              className={i === resaltado ? 'despl__opcion despl__opcion--resaltada' : 'despl__opcion'}
              onPointerEnter={() => setResaltado(i)}
              onClick={() => elegir(o.valor)}
            >
              <span>{o.texto}</span>
              {o.valor === valor && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
