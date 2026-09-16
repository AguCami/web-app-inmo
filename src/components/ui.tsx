import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/* ───────────────────────────── Tarjeta ───────────────────────────── */

export function Tarjeta({
  titulo,
  subtitulo,
  acciones,
  children,
  ajustado,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  ajustado?: boolean;
}) {
  return (
    <section className="tarjeta">
      {(titulo || acciones) && (
        <header className="tarjeta__cab">
          <div style={{ flex: 1, minWidth: 140 }}>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <p className="tarjeta__sub">{subtitulo}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className={ajustado ? 'tarjeta__cuerpo tarjeta__cuerpo--ajustado' : 'tarjeta__cuerpo'}>
        {children}
      </div>
    </section>
  );
}

/* ──────────────────────────── Stat tile ──────────────────────────── */

export function Kpi({
  etiqueta,
  valor,
  pie,
  delta,
  tono = 'neutro',
  chico,
}: {
  etiqueta: string;
  valor: ReactNode;
  pie?: ReactNode;
  /** Variación respecto del período anterior, en %. */
  delta?: number | null;
  tono?: 'neutro' | 'ok' | 'alerta' | 'critico';
  chico?: boolean;
}) {
  const color =
    tono === 'ok' ? 'var(--ok-texto)' : tono === 'critico' ? 'var(--critico)' : tono === 'alerta' ? 'var(--serie-4)' : undefined;

  return (
    <div className="kpi">
      <div className="kpi__etiqueta">{etiqueta}</div>
      <div className={chico ? 'kpi__valor kpi__valor--chico' : 'kpi__valor'} style={{ color }}>
        {valor}
      </div>
      <div className="kpi__pie">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`kpi__delta ${delta >= 0 ? 'kpi__delta--sube' : 'kpi__delta--baja'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1).replace('.', ',')} %
          </span>
        )}
        {delta !== undefined && delta !== null && pie ? ' · ' : null}
        {pie}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Chip ────────────────────────────── */

export type TonoChip = 'neutro' | 'ok' | 'alerta' | 'serio' | 'critico' | 'info';

/** El color nunca va solo: siempre acompaña al texto de la etiqueta. */
export function Chip({ tono = 'neutro', children }: { tono?: TonoChip; children: ReactNode }) {
  return (
    <span className={`chip${tono === 'neutro' ? '' : ` chip--${tono}`}`}>
      <span className="chip__punto" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ─────────────────────────────── Campo ───────────────────────────── */

/** El label envuelve al control, así queda asociado sin necesidad de ids. */
export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="campo">
      <span className="campo__et">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </label>
  );
}

/* ─────────────────────────────── Modal ───────────────────────────── */

export function Modal({
  titulo,
  children,
  pie,
  onCerrar,
  ancho,
}: {
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  onCerrar: () => void;
  ancho?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={ancho ? 'modal modal--ancho' : 'modal'} role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <header className="modal__cab">
          <h2>{titulo}</h2>
          <button className="btn btn--fantasma btn--chico" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="modal__cuerpo">{children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/* ──────────────────────────── Estado vacío ───────────────────────── */

export function Vacio({ icono = '📭', titulo, detalle, accion }: { icono?: string; titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <span className="vacio__icono" aria-hidden="true">{icono}</span>
      <strong>{titulo}</strong>
      {detalle && <p>{detalle}</p>}
      {accion}
    </div>
  );
}

/* ────────────────────────────── Pestañas ─────────────────────────── */

export function Pestanas<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { id: T; etiqueta: string; pastilla?: number }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div className="pestanas" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={o.id === valor}
          onClick={() => onCambio(o.id)}
        >
          {o.etiqueta}
          {o.pastilla !== undefined && o.pastilla > 0 && (
            <span className="tenue num"> ({o.pastilla})</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────── Aviso ───────────────────────────── */

export function Aviso({
  tono = 'neutro',
  icono,
  titulo,
  children,
}: {
  tono?: 'neutro' | 'ok' | 'alerta' | 'critico';
  icono?: string;
  titulo?: string;
  children?: ReactNode;
}) {
  const iconoPorTono = { neutro: 'ℹ️', ok: '✅', alerta: '⚠️', critico: '⛔' } as const;
  return (
    <div className={`aviso${tono === 'neutro' ? '' : ` aviso--${tono}`}`} role={tono === 'critico' ? 'alert' : undefined}>
      <span aria-hidden="true">{icono ?? iconoPorTono[tono]}</span>
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────── Ficha de datos (clave/valor) ────────────── */

export function Datos({ items }: { items: { et: string; val: ReactNode }[] }) {
  return (
    <div className="datos">
      {items.map((i) => (
        <div key={i.et}>
          <div className="dato__et">{i.et}</div>
          <div className="dato__val">{i.val}</div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Tabla con scroll ──────────────────────── */

export function Tabla({ children, compacta }: { children: ReactNode; compacta?: boolean }) {
  return (
    <div className="tabla-envoltorio">
      <table className={compacta ? 'tabla tabla--compacta' : 'tabla'}>{children}</table>
    </div>
  );
}

export function Progreso({ valor, tono }: { valor: number; tono?: string }) {
  const ancho = Math.max(0, Math.min(100, valor));
  return (
    <div className="barra-progreso" role="img" aria-label={`${ancho.toFixed(0)} %`}>
      <span style={{ width: `${ancho}%`, background: tono }} />
    </div>
  );
}

/* ───────────────────────────── Paginado ─────────────────────────── */

/**
 * Los listados contables llegan a miles de filas: sin paginar, el navegador
 * arma páginas de decenas de miles de píxeles y la tabla se vuelve inusable.
 */
export function usePaginado<T>(items: T[], porPagina = 50) {
  const [pagina, setPagina] = useState(0);
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  const actual = Math.min(pagina, paginas - 1);

  useEffect(() => {
    setPagina(0);
  }, [items.length]);

  return {
    pagina: actual,
    paginas,
    total: items.length,
    visibles: items.slice(actual * porPagina, actual * porPagina + porPagina),
    desde: items.length ? actual * porPagina + 1 : 0,
    hasta: Math.min(items.length, (actual + 1) * porPagina),
    setPagina,
  };
}

export function Paginador({
  pagina,
  paginas,
  desde,
  hasta,
  total,
  etiqueta,
  onCambio,
}: {
  pagina: number;
  paginas: number;
  desde: number;
  hasta: number;
  total: number;
  etiqueta: string;
  onCambio: (p: number) => void;
}) {
  if (paginas <= 1) return null;
  return (
    <div className="paginador no-imprimir">
      <span className="mini tenue">
        {desde}–{hasta} de {total} {etiqueta}
      </span>
      <span className="fila" style={{ gap: 4 }}>
        <button className="btn btn--chico" disabled={pagina === 0} onClick={() => onCambio(0)} aria-label="Primera página">
          «
        </button>
        <button className="btn btn--chico" disabled={pagina === 0} onClick={() => onCambio(pagina - 1)}>
          Anterior
        </button>
        <span className="mini num" style={{ padding: '0 6px' }}>
          {pagina + 1} / {paginas}
        </span>
        <button className="btn btn--chico" disabled={pagina >= paginas - 1} onClick={() => onCambio(pagina + 1)}>
          Siguiente
        </button>
        <button
          className="btn btn--chico"
          disabled={pagina >= paginas - 1}
          onClick={() => onCambio(paginas - 1)}
          aria-label="Última página"
        >
          »
        </button>
      </span>
    </div>
  );
}
