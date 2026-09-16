import type { ISODate, Moneda, Periodo } from './types';

/* ───────────────────────────── IDs ───────────────────────────── */

export function nuevoId(prefijo = 'id'): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}${rnd}`;
}

/* ──────────────────────────── Fechas ─────────────────────────── */

/** Hoy en formato ISO local (no UTC: evita el corrimiento de un día). */
export function hoy(): ISODate {
  return aISO(new Date());
}

export function aISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Parsea `YYYY-MM-DD` como fecha local (new Date('2026-01-01') sería UTC). */
export function desdeISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function sumarMeses(iso: ISODate, meses: number): ISODate {
  const d = desdeISO(iso);
  const diaOriginal = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  d.setDate(Math.min(diaOriginal, ultimoDiaDelMes(d.getFullYear(), d.getMonth() + 1)));
  return aISO(d);
}

export function sumarDias(iso: ISODate, dias: number): ISODate {
  const d = desdeISO(iso);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

export function ultimoDiaDelMes(anio: number, mes1a12: number): number {
  return new Date(anio, mes1a12, 0).getDate();
}

export function diasEntre(desde: ISODate, hasta: ISODate): number {
  const ms = desdeISO(hasta).getTime() - desdeISO(desde).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatearFecha(iso?: ISODate): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ──────────────────────────── Períodos ───────────────────────── */

export function periodoDe(iso: ISODate): Periodo {
  return iso.slice(0, 7);
}

export function periodoActual(): Periodo {
  return hoy().slice(0, 7);
}

export function sumarPeriodos(p: Periodo, meses: number): Periodo {
  const [y, m] = p.split('-').map(Number);
  const total = y * 12 + (m - 1) + meses;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function diferenciaPeriodos(desde: Periodo, hasta: Periodo): number {
  const [y1, m1] = desde.split('-').map(Number);
  const [y2, m2] = hasta.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export function formatearPeriodo(p: Periodo, largo = false): string {
  const [y, m] = p.split('-').map(Number);
  const nombre = MESES[(m ?? 1) - 1] ?? '';
  return largo ? `${nombre} ${y}` : `${nombre} ${String(y).slice(2)}`;
}

/** Devuelve los N períodos que terminan en `hasta` (incluido). */
export function ultimosPeriodos(hasta: Periodo, n: number): Periodo[] {
  return Array.from({ length: n }, (_, i) => sumarPeriodos(hasta, i - (n - 1)));
}

export function fechaDeVencimiento(periodo: Periodo, dia: number): ISODate {
  const [y, m] = periodo.split('-').map(Number);
  const d = Math.min(dia, ultimoDiaDelMes(y, m));
  return `${periodo}-${String(d).padStart(2, '0')}`;
}

/* ──────────────────────────── Dinero ─────────────────────────── */

const fmtARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtUSD = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearMoneda(monto: number, moneda: Moneda = 'ARS'): string {
  const f = moneda === 'USD' ? fmtUSD : fmtARS;
  return f.format(monto ?? 0);
}

/** Versión compacta para ejes y tiles: $ 1,2 M / US$ 340 k. */
export function formatearCompacto(monto: number, moneda: Moneda = 'ARS'): string {
  const signo = monto < 0 ? '-' : '';
  const abs = Math.abs(monto);
  const simbolo = moneda === 'USD' ? 'US$' : '$';
  if (abs >= 1_000_000_000) return `${signo}${simbolo} ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} MM`;
  if (abs >= 1_000_000) return `${signo}${simbolo} ${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1_000) return `${signo}${simbolo} ${Math.round(abs / 1_000)} k`;
  return `${signo}${simbolo} ${Math.round(abs)}`;
}

export function formatearPorcentaje(v: number, decimales = 1): string {
  return `${v.toFixed(decimales).replace('.', ',')} %`;
}

export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/* ─────────────────────────── Varios ──────────────────────────── */

export function agrupar<T, K extends string | number>(items: T[], clave: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = clave(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function sumar<T>(items: T[], valor: (t: T) => number): number {
  return items.reduce((acc, it) => acc + valor(it), 0);
}

/** «1 día» / «5 días»: castellano correcto sin repetir el condicional por todos lados. */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function incluyeTexto(campos: (string | undefined)[], busqueda: string): boolean {
  if (!busqueda.trim()) return true;
  const b = normalizar(busqueda);
  return campos.some((c) => c && normalizar(c).includes(b));
}
