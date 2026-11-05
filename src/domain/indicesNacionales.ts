import type { Periodo } from './types';

/**
 * Lectura del ICL (BCRA) y del IPC nacional (INDEC) tal como los devuelven
 * sus APIs públicas. Puro: lo que va a buscarlos está en
 * `data/indicesNacionales.ts`.
 */

interface PuntoBCRA {
  fecha?: string;
  valor?: number | string;
}

/**
 * El ICL es diario y la app trabaja por mes: se toma el valor del día 1 de
 * cada mes, o el primero publicado de ese mes si el 1 no está. Es la
 * referencia habitual para los ajustes de los contratos de la Ley 27.551.
 *
 * Acepta las dos formas del API de estadísticas del BCRA: la v3
 * (`results: [{ fecha, valor }]`) y la v4
 * (`results: [{ detalle: [{ fecha, valor }] }]`).
 */
export function serieICL(respuesta: unknown): Map<Periodo, number> {
  const resultados = (respuesta as { results?: unknown[] })?.results;
  if (!Array.isArray(resultados)) return new Map();
  const puntos: PuntoBCRA[] = resultados.flatMap((r) => {
    const detalle = (r as { detalle?: PuntoBCRA[] }).detalle;
    return Array.isArray(detalle) ? detalle : [r as PuntoBCRA];
  });

  const primeroDelMes = new Map<Periodo, { dia: string; valor: number }>();
  for (const p of puntos) {
    const fecha = String(p.fecha ?? '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) continue;
    const valor = Number(p.valor);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const periodo = fecha.slice(0, 7);
    const dia = fecha.slice(8, 10);
    const actual = primeroDelMes.get(periodo);
    if (!actual || dia < actual.dia) primeroDelMes.set(periodo, { dia, valor });
  }
  return new Map(
    [...primeroDelMes].map(([p, { valor }]) => [p, Math.round(valor * 100) / 100]),
  );
}

/**
 * El API de series de tiempo (apis.datos.gob.ar) devuelve
 * `data: [["2026-09-01", 9876.54], ...]`. Se redondea a un decimal, como
 * publica el INDEC el índice.
 */
export function serieIPCNacional(respuesta: unknown): Map<Periodo, number> {
  const filas = (respuesta as { data?: unknown[] })?.data;
  const serie = new Map<Periodo, number>();
  if (!Array.isArray(filas)) return serie;
  for (const fila of filas) {
    if (!Array.isArray(fila)) continue;
    const [fecha, valor] = fila;
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}/.test(fecha)) continue;
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) continue;
    serie.set(fecha.slice(0, 7), Math.round(n * 10) / 10);
  }
  return serie;
}
