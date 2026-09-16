import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatearCompacto, formatearMoneda, formatearPeriodo } from '../domain/util';

/* Los colores se escriben como custom properties: el gráfico cambia de tema
 * junto con el resto de la app, sin recalcular nada en JS. */
const EJE = { fill: 'var(--tinta-3)', fontSize: 11 } as const;
const GRILLA = 'var(--borde)';

interface FilaTooltip {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function TooltipViz({
  active,
  payload,
  label,
  formatoValor,
  formatoTitulo,
}: {
  active?: boolean;
  payload?: FilaTooltip[];
  label?: string;
  formatoValor: (v: number) => string;
  formatoTitulo?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-viz">
      <div className="tooltip-viz__titulo">{formatoTitulo ? formatoTitulo(String(label)) : label}</div>
      {payload.map((p, i) => (
        <div className="tooltip-viz__fila" key={i}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              className="leyenda__marca"
              style={{ background: p.color, width: 9, height: 9 }}
              aria-hidden="true"
            />
            {p.name}
          </span>
          <span>{formatoValor(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

/** Todo gráfico viene con su gemelo en tabla: el color nunca es el único canal. */
export function PanelGrafico({
  titulo,
  subtitulo,
  acciones,
  grafico,
  tabla,
  nota,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  grafico: ReactNode;
  tabla: ReactNode;
  nota?: string;
}) {
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico');
  return (
    <section className="tarjeta">
      <header className="tarjeta__cab">
        <div style={{ flex: 1, minWidth: 140 }}>
          <h2>{titulo}</h2>
          {subtitulo && <p className="tarjeta__sub">{subtitulo}</p>}
        </div>
        {acciones}
        <div className="interruptores no-imprimir">
          <button aria-pressed={vista === 'grafico'} onClick={() => setVista('grafico')}>
            Gráfico
          </button>
          <button aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>
            Tabla
          </button>
        </div>
      </header>
      <div className={vista === 'tabla' ? 'tarjeta__cuerpo tarjeta__cuerpo--ajustado' : 'tarjeta__cuerpo'}>
        {vista === 'grafico' ? (
          <>
            <div className="grafico">{grafico}</div>
            {nota && <p className="grafico__nota">{nota}</p>}
          </>
        ) : (
          tabla
        )}
      </div>
    </section>
  );
}

export function Leyenda({ items }: { items: { color: string; etiqueta: string }[] }) {
  return (
    <div className="leyenda">
      {items.map((i) => (
        <span className="leyenda__item" key={i.etiqueta}>
          <span className="leyenda__marca" style={{ background: i.color }} aria-hidden="true" />
          {i.etiqueta}
        </span>
      ))}
    </div>
  );
}

/* ─────────────── Resultado mensual: ingresos, egresos, neto ────────────── */

export function GraficoResultado({
  datos,
}: {
  datos: { periodo: string; ingresos: number; egresos: number; resultado: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2}>
        <CartesianGrid stroke={GRILLA} vertical={false} />
        <XAxis
          dataKey="periodo"
          tick={EJE}
          tickLine={false}
          axisLine={{ stroke: 'var(--borde-fuerte)' }}
          tickFormatter={(p: string) => formatearPeriodo(p)}
        />
        <YAxis
          tick={EJE}
          tickLine={false}
          axisLine={false}
          width={62}
          tickFormatter={(v: number) => formatearCompacto(v)}
        />
        <Tooltip
          cursor={{ fill: 'var(--superficie-2)' }}
          content={
            <TooltipViz
              formatoValor={(v) => formatearMoneda(v)}
              formatoTitulo={(l) => formatearPeriodo(l, true)}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--tinta-2)', paddingTop: 6 }}
          iconType="square"
          iconSize={9}
        />
        <Bar dataKey="ingresos" name="Ingresos" fill="var(--serie-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="egresos" name="Egresos" fill="var(--serie-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Line
          type="monotone"
          dataKey="resultado"
          name="Resultado"
          stroke="var(--serie-7)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 2, stroke: 'var(--superficie)' }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--superficie)' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ──────────────────── Cobranza: emitido vs. cobrado ───────────────────── */

export function GraficoCobranza({
  datos,
}: {
  datos: { periodo: string; emitido: number; cobrado: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2}>
        <CartesianGrid stroke={GRILLA} vertical={false} />
        <XAxis
          dataKey="periodo"
          tick={EJE}
          tickLine={false}
          axisLine={{ stroke: 'var(--borde-fuerte)' }}
          tickFormatter={(p: string) => formatearPeriodo(p)}
        />
        <YAxis tick={EJE} tickLine={false} axisLine={false} width={62} tickFormatter={(v: number) => formatearCompacto(v)} />
        <Tooltip
          cursor={{ fill: 'var(--superficie-2)' }}
          content={<TooltipViz formatoValor={(v) => formatearMoneda(v)} formatoTitulo={(l) => formatearPeriodo(l, true)} />}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--tinta-2)', paddingTop: 6 }} iconType="square" iconSize={9} />
        <Bar dataKey="emitido" name="Emitido" fill="var(--serie-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="cobrado" name="Cobrado" fill="var(--serie-3)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────── Barras horizontales: una sola serie, una sola tinta ────────── */

export function GraficoBarrasHorizontales({
  datos,
  alto = 220,
  color = 'var(--serie-1)',
  /** Rampa ordinal para categorías con orden natural (embudo, antigüedad). */
  rampa,
  formato = (v: number) => formatearMoneda(v),
}: {
  datos: { etiqueta: string; valor: number }[];
  alto?: number;
  color?: string;
  rampa?: string[];
  formato?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRILLA} horizontal={false} />
        <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatearCompacto(v)} />
        <YAxis
          type="category"
          dataKey="etiqueta"
          tick={{ ...EJE, fill: 'var(--tinta-2)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--borde-fuerte)' }}
          width={150}
        />
        <Tooltip cursor={{ fill: 'var(--superficie-2)' }} content={<TooltipViz formatoValor={formato} />} />
        <Bar dataKey="valor" name="Monto" radius={[0, 4, 4, 0]} maxBarSize={22} fill={color}>
          {rampa &&
            datos.map((_, i) => <Cell key={i} fill={rampa[Math.min(i, rampa.length - 1)]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Rampa ordinal: una sola tinta con pasos de luminosidad bien separados, para
 * categorías con orden natural (etapas del embudo, tramos de mora). El paso más
 * cercano a la superficie conserva el contraste mínimo en los dos temas.
 */
export const RAMPA_ORDINAL = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)', 'var(--ord-5)'];
export const RAMPA_MORA = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)'];
