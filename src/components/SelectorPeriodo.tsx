import type { Periodo } from '../domain/types';
import { formatearPeriodo } from '../domain/util';

/**
 * El mes que se está mirando: una pastilla de vidrio con flechas para ir al
 * anterior o al siguiente, y el mes en el medio, que abre la lista completa.
 * `opciones` va del más nuevo al más viejo.
 */
export function SelectorPeriodo({
  valor,
  opciones,
  onCambio,
}: {
  valor: Periodo;
  opciones: Periodo[];
  onCambio: (p: Periodo) => void;
}) {
  const i = opciones.indexOf(valor);
  const anterior = i >= 0 ? opciones[i + 1] : undefined;
  const siguiente = i > 0 ? opciones[i - 1] : undefined;

  return (
    <div className="selector-periodo no-imprimir">
      <button
        type="button"
        className="selector-periodo__flecha"
        disabled={!anterior}
        onClick={() => anterior && onCambio(anterior)}
        aria-label="Mes anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <label className="selector-periodo__mes">
        <span>{formatearPeriodo(valor, true)}</span>
        <select value={valor} onChange={(e) => onCambio(e.target.value)} aria-label="Período">
          {opciones.map((p) => (
            <option key={p} value={p}>{formatearPeriodo(p, true)}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="selector-periodo__flecha"
        disabled={!siguiente}
        onClick={() => siguiente && onCambio(siguiente)}
        aria-label="Mes siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
