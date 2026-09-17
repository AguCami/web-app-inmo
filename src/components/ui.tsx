import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconoAlerta, IconoCerrar, IconoCheck, IconoInfo } from './iconos';

/* ───────────────────────────── Panel ────────────────────────────── */

export function Panel({
  titulo,
  subtitulo,
  acciones,
  children,
  comoLista,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  /** Deja que los hijos sean ítems de lista, con su propio espaciado. */
  comoLista?: boolean;
}) {
  return (
    <section className="panel">
      {(titulo || acciones) && (
        <header className="panel__cab">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <p className="panel__sub">{subtitulo}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className={comoLista ? 'panel__lista' : 'panel__cuerpo'}>{children}</div>
    </section>
  );
}

/* ────────────────────────── Tarjeta de dato ─────────────────────── */

export function Dato({
  etiqueta,
  valor,
  pie,
  tono = 'neutro',
  children,
}: {
  etiqueta: string;
  valor: ReactNode;
  pie?: ReactNode;
  tono?: 'neutro' | 'ok' | 'alerta' | 'critico' | 'acento';
  children?: ReactNode;
}) {
  const color =
    tono === 'ok'
      ? 'var(--ok)'
      : tono === 'critico'
        ? 'var(--critico)'
        : tono === 'alerta'
          ? 'var(--alerta)'
          : tono === 'acento'
            ? 'var(--acento)'
            : undefined;

  return (
    <article className="dato">
      <span className="dato__et">{etiqueta}</span>
      <span className="dato__valor" style={{ color }}>{valor}</span>
      {children}
      {pie && <span className="dato__pie">{pie}</span>}
    </article>
  );
}

/* ──────────────────────────── Pastilla ──────────────────────────── */

export type Tono = 'neutro' | 'ok' | 'alerta' | 'critico' | 'acento';

/** El color nunca va solo: siempre acompaña al texto. */
export function Pastilla({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={`pastilla${tono === 'neutro' ? '' : ` pastilla--${tono}`}`}>
      <span className="pastilla__punto" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ───────────────────────────── Avatar ───────────────────────────── */

/** Tono estable por nombre: la misma persona tiene siempre el mismo color. */
function tonoDe(texto: string): 1 | 2 | 3 | 4 {
  let suma = 0;
  for (let i = 0; i < texto.length; i += 1) suma = (suma + texto.charCodeAt(i)) % 997;
  return ((suma % 4) + 1) as 1 | 2 | 3 | 4;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter((p) => p.length > 2);
  if (partes.length === 0) return nombre.slice(0, 2).toUpperCase();
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function Avatar({ nombre, chico }: { nombre: string; chico?: boolean }) {
  return (
    <span
      className={`avatar avatar--t${tonoDe(nombre)}${chico ? ' avatar--chico' : ''}`}
      title={nombre}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  );
}

/* ─────────────────────── Ítem de lista ──────────────────────────── */

export function Item({
  avatar,
  titulo,
  sub,
  monto,
  montoPie,
  fin,
  onClick,
}: {
  avatar?: ReactNode;
  titulo: ReactNode;
  sub?: ReactNode;
  monto?: ReactNode;
  montoPie?: ReactNode;
  fin?: ReactNode;
  onClick?: () => void;
}) {
  const contenido = (
    <>
      {avatar}
      <span className="item__cuerpo">
        <span className="item__titulo">{titulo}</span>
        {sub && <span className="item__sub">{sub}</span>}
      </span>
      {monto !== undefined && (
        <span className="item__monto">
          {monto}
          {montoPie && <small>{montoPie}</small>}
        </span>
      )}
      {fin && <span className="item__fin">{fin}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="item" onClick={onClick}>
        {contenido}
      </button>
    );
  }
  return <div className="item">{contenido}</div>;
}

/* ───────────────────────────── Campo ────────────────────────────── */

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

/* ───────────────────────────── Modal ────────────────────────────── */

export function Modal({
  titulo,
  subtitulo,
  children,
  pie,
  onCerrar,
  ancho,
}: {
  titulo: string;
  subtitulo?: ReactNode;
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
      <div
        className={ancho ? 'modal modal--ancho' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        ref={ref}
      >
        <header className="modal__cab">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p className="panel__sub">{subtitulo}</p>}
          </div>
          <button className="btn btn--fantasma btn--icono" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </header>
        <div className="modal__cuerpo">{children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/* ──────────────────────────── Estado vacío ──────────────────────── */

export function Vacio({
  icono,
  titulo,
  detalle,
  accion,
}: {
  icono?: ReactNode;
  titulo: string;
  detalle?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="vacio">
      <div className="vacio__icono">{icono ?? <IconoCheck tam={24} />}</div>
      <strong>{titulo}</strong>
      {detalle && <p>{detalle}</p>}
      {accion && <div style={{ marginTop: 14 }}>{accion}</div>}
    </div>
  );
}

/* ─────────────────────────── Segmentos ──────────────────────────── */

export function Segmentos<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { id: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="segmentos" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} aria-pressed={o.id === valor} onClick={() => onCambio(o.id)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Nota ─────────────────────────────── */

export function Nota({
  tono = 'neutro',
  titulo,
  children,
}: {
  tono?: 'neutro' | 'ok' | 'alerta' | 'critico';
  titulo?: string;
  children?: ReactNode;
}) {
  const Icono = tono === 'ok' ? IconoCheck : tono === 'neutro' ? IconoInfo : IconoAlerta;
  return (
    <div className={`nota${tono === 'neutro' ? '' : ` nota--${tono}`}`} role={tono === 'critico' ? 'alert' : undefined}>
      <Icono tam={17} />
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────── Progreso ──────────────────────────── */

export function Progreso({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const ancho = Math.max(0, Math.min(100, valor));
  return (
    <div
      className="progreso"
      role="img"
      aria-label={`${etiqueta}: ${ancho.toFixed(0)} %`}
      style={{ marginTop: 10 }}
    >
      <span style={{ width: `${ancho}%` }} />
    </div>
  );
}

/* ────────────────── Mini serie de barras (tendencia) ────────────── */

export function Serie({
  datos,
  formato,
}: {
  datos: { etiqueta: string; titulo: string; total: number; parte: number }[];
  formato: (v: number) => string;
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  return (
    <div>
      <div className="serie">
        {datos.map((d) => (
          <div
            key={d.etiqueta}
            className="serie__barra"
            style={{ height: `${Math.max(8, (d.total / maximo) * 100)}%` }}
            title={`${d.titulo}: cobrado ${formato(d.parte)} de ${formato(d.total)}`}
          >
            <span style={{ height: `${d.total > 0 ? Math.min(100, (d.parte / d.total) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="serie__pie">
        {datos.map((d) => (
          <span key={d.etiqueta}>{d.etiqueta}</span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── Paginado ──────────────────────────── */

export function usePaginado<T>(items: T[], porPagina = 24) {
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
      <span className="fila" style={{ gap: 6 }}>
        <button className="btn btn--chico" disabled={pagina === 0} onClick={() => onCambio(pagina - 1)}>
          Anterior
        </button>
        <span className="mini tenue num">{pagina + 1} / {paginas}</span>
        <button className="btn btn--chico" disabled={pagina >= paginas - 1} onClick={() => onCambio(pagina + 1)}>
          Siguiente
        </button>
      </span>
    </div>
  );
}
