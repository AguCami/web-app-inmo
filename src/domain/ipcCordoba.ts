import type { Periodo, ValorIndice } from './types';

/**
 * Lectura del IPC de Córdoba tal como lo publica la Dirección General de
 * Estadística y Censos en su portal CKAN (datosestadistica.cba.gov.ar).
 *
 * La tabla viene «a lo ancho»: una fila por rubro (la que importa es
 * «NIVEL GENERAL») y una columna por mes, con encabezados como `abr-22` y
 * valores con coma decimal (`"105,7"`). Algunas planillas repiten los
 * encabezados como primera fila de datos; esas celdas no son números y se
 * descartan solas.
 *
 * Todo acá es puro: no pide nada a la red. Lo que va a buscar los datos está
 * en `data/ipcCordoba.ts`.
 */

const MESES: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12',
};

/**
 * `abr-22` → `2022-04`; `sep-2026` → `2026-09`. También las fechas, por si
 * la planilla se exporta con la celda como fecha: `2025-11-01`, `1/11/2025`.
 * Cualquier otra cosa, null.
 */
export function periodoDeColumna(columna: string): Periodo | null {
  const texto = columna.trim().toLowerCase();
  let m = texto.match(/^([a-z]{3})[a-z]*[-\s/](\d{2}|\d{4})$/);
  if (m && MESES[m[1]]) return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${MESES[m[1]]}`;
  m = texto.match(/^(20\d{2})-(\d{2})-\d{2}/);
  if (m) return `${m[1]}-${m[2]}`;
  m = texto.match(/^\d{1,2}\/(\d{1,2})\/(20\d{2})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  return null;
}

/**
 * `"105,7"` → 105.7; `"1.234,5"` → 1234.5; `"105.6655"` → 105.7.
 * Con coma, la coma es el decimal y los puntos separan miles; sin coma, el
 * punto es el decimal. Se redondea a un decimal porque así publica la
 * Provincia el índice, y así se calculan los ajustes. Lo que no sea un número
 * positivo, null.
 */
export function numeroDeCelda(celda: unknown): number | null {
  let n: number;
  if (typeof celda === 'number') n = celda;
  else if (typeof celda === 'string') {
    const texto = celda.trim();
    const limpio = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
    if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
    n = Number(limpio);
  } else return null;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

const esNivelGeneral = (fila: Record<string, unknown>) =>
  Object.values(fila).some(
    (v) => typeof v === 'string' && v.trim().toUpperCase() === 'NIVEL GENERAL',
  );

/** De las filas de la tabla, la serie del nivel general: período → índice. */
export function serieDeFilas(filas: Record<string, unknown>[]): Map<Periodo, number> {
  const serie = new Map<Periodo, number>();
  const fila = filas.find(esNivelGeneral);
  if (!fila) return serie;
  for (const [columna, celda] of Object.entries(fila)) {
    const periodo = periodoDeColumna(columna);
    const valor = numeroDeCelda(celda);
    if (periodo && valor !== null) serie.set(periodo, valor);
  }
  return serie;
}

/**
 * Lee el CSV de la planilla. Puede venir separado por `;` o por `,` (y en
 * ese caso los decimales van entre comillas), así que se parsea en serio.
 */
export function serieDeCSV(texto: string): Map<Periodo, number> {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return new Map();
  const separador = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (linea: string) => {
    const celdas: string[] = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else entreComillas = !entreComillas;
      } else if (ch === separador && !entreComillas) {
        celdas.push(actual);
        actual = '';
      } else actual += ch;
    }
    celdas.push(actual);
    return celdas;
  };
  // El encabezado es la primera fila con columnas de mes: algunas planillas
  // traen un título arriba.
  const filas = lineas.map(partir);
  const iEncabezado = filas.findIndex((f) => f.some((c) => periodoDeColumna(c) !== null));
  if (iEncabezado === -1) return new Map();
  const encabezado = filas[iEncabezado];
  const objetos = filas.slice(iEncabezado + 1).map((f) =>
    Object.fromEntries(encabezado.map((col, i) => [col, f[i] ?? ''])),
  );
  return serieDeFilas(objetos);
}

/** Diferencia relativa máxima entre dos fuentes para el mismo mes. */
const TOLERANCIA = 0.005;

/**
 * Une las series de varias planillas. Van en orden de confianza: la primera
 * manda, y cada una de las siguientes solo suma meses si coincide con lo ya
 * reunido en los meses que comparten. Si no coincide —otra base, otro
 * rubro— se descarta entera: mezclar bases haría que un ajuste multiplique
 * por 50 en vez de por 1,05.
 */
export function unirSeries(series: Map<Periodo, number>[]): {
  serie: Map<Periodo, number>;
  descartadas: number;
} {
  const serie = new Map<Periodo, number>();
  let descartadas = 0;
  for (const otra of series) {
    if (otra.size === 0) continue;
    const comunes = [...otra.keys()].filter((p) => serie.has(p));
    const coincide = comunes.every((p) => {
      const a = serie.get(p)!;
      return Math.abs(otra.get(p)! - a) / a <= TOLERANCIA;
    });
    // Sin meses en común no hay cómo comprobar la base: solo se acepta la
    // primera, que fija la referencia.
    if (serie.size > 0 && (comunes.length === 0 || !coincide)) {
      descartadas += 1;
      continue;
    }
    for (const [p, v] of otra) if (!serie.has(p)) serie.set(p, v);
  }
  return { serie, descartadas };
}

/**
 * Controla que la serie sea creíble antes de usarla para cobrar alquileres:
 * meses consecutivos sin huecos raros y variaciones mensuales posibles.
 * Devuelve el problema encontrado, o null si está bien.
 */
export function problemaDeSerie(serie: Map<Periodo, number>): string | null {
  if (serie.size < 2) return 'La serie vino vacía o con un solo mes.';
  const ordenados = [...serie.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (let i = 1; i < ordenados.length; i++) {
    const [p, v] = ordenados[i];
    const [, previo] = ordenados[i - 1];
    const variacion = v / previo - 1;
    if (variacion < -0.1 || variacion > 0.5) {
      return `La variación de ${p} da ${(variacion * 100).toFixed(1)} %: no parece el mismo índice.`;
    }
  }
  return null;
}

/**
 * Vuelca la serie oficial sobre la tabla de índices de la app. El dato
 * publicado manda sobre lo cargado a mano para ese mes. Un mes que todavía
 * no existía se crea con los demás índices en 0, que la app lee como «sin
 * publicar» y resuelve arrastrando el último valor conocido.
 */
export function aplicarIpcCordoba(
  actuales: ValorIndice[],
  serie: Map<Periodo, number>,
): { indices: ValorIndice[]; cambios: number } {
  const porPeriodo = new Map(actuales.map((i) => [i.periodo, i]));
  let cambios = 0;
  for (const [periodo, valor] of serie) {
    const fila = porPeriodo.get(periodo);
    if (fila && fila.IPC_CBA === valor) continue;
    porPeriodo.set(
      periodo,
      fila
        ? { ...fila, IPC_CBA: valor }
        : { periodo, ICL: 0, IPC: 0, IPC_CBA: valor, CASA_PROPIA: 0 },
    );
    cambios += 1;
  }
  return {
    indices: [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
    cambios,
  };
}
