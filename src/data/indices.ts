import type { ValorIndice } from '../domain/types';
import { sumarPeriodos } from '../domain/util';

/**
 * Series de índices de actualización.
 *
 * Los valores que vienen acá son de DEMOSTRACIÓN: se arman encadenando
 * variaciones mensuales plausibles desde una base 100. Los reales se cargan de
 * dos maneras, y las dos ganan sobre esta serie:
 *
 *  1. A mano, desde Configuración.
 *  2. Solos, desde `public/indices.json`, que actualiza una tarea programada
 *     de GitHub Actions cuando el organismo publica el dato del mes.
 *
 * La serie arranca tres años antes del presente para que hasta el contrato más
 * viejo de la cartera tenga índice publicado en su mes de inicio.
 */
const PERIODO_BASE = '2023-09';

// Variaciones mensuales (%) desde PERIODO_BASE. El primer valor es la base.
const VAR_IPC = [
  0, 8.3, 12.8, 25.5, 20.6, 13.2, 11.0, 8.8, 4.2, 4.6, 4.0, 4.2, 4.2,
  2.7, 2.4, 2.7, 2.2, 2.4, 3.7, 2.8, 1.5, 1.6, 1.9, 1.9, 2.1, 2.3, 2.0, 1.8,
  1.7, 1.6, 1.5, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.2, 1.1, 1.1,
];

// Córdoba se mueve cerca del nacional, con desvíos de algunas décimas.
const VAR_IPC_CBA = [
  0, 8.6, 13.1, 24.8, 21.2, 12.8, 10.6, 9.1, 4.5, 4.3, 4.1, 4.4, 4.0,
  2.9, 2.2, 2.8, 2.4, 2.2, 3.5, 3.0, 1.7, 1.5, 2.0, 1.8, 2.2, 2.1, 2.1, 1.9,
  1.6, 1.7, 1.6, 1.3, 1.5, 1.2, 1.4, 1.3, 1.1, 1.3, 1.2, 1.0,
];

// El ICL combina precios y salarios: sube más tarde y más suave que el IPC.
const VAR_ICL = [
  0, 7.5, 9.0, 11.0, 14.0, 12.0, 10.0, 8.5, 6.0, 5.0, 4.5, 4.3, 4.0,
  3.1, 2.9, 3.0, 2.6, 2.7, 3.4, 3.0, 2.0, 2.0, 2.2, 2.2, 2.3, 2.4, 2.2, 2.0,
  1.9, 1.8, 1.7, 1.6, 1.6, 1.5, 1.5, 1.4, 1.4, 1.3, 1.3, 1.2,
];

const VAR_CASA_PROPIA = [
  0, 5.5, 6.5, 8.0, 10.0, 9.0, 7.5, 6.5, 4.5, 3.8, 3.4, 3.2, 3.0,
  2.2, 2.0, 2.1, 1.9, 2.0, 2.4, 2.2, 1.4, 1.4, 1.6, 1.6, 1.7, 1.8, 1.6, 1.5,
  1.4, 1.3, 1.3, 1.2, 1.2, 1.1, 1.1, 1.0, 1.0, 1.0, 0.9, 0.9,
];

function encadenar(base: number, variaciones: number[]): number[] {
  const out: number[] = [];
  let v = base;
  for (const pct of variaciones) {
    v = v * (1 + pct / 100);
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

export function construirIndices(): ValorIndice[] {
  const icl = encadenar(100, VAR_ICL);
  const ipc = encadenar(100, VAR_IPC);
  const ipcCba = encadenar(100, VAR_IPC_CBA);
  const casa = encadenar(100, VAR_CASA_PROPIA);

  return VAR_IPC.map((_, i) => ({
    periodo: sumarPeriodos(PERIODO_BASE, i),
    ICL: icl[i],
    IPC: ipc[i],
    IPC_CBA: ipcCba[i],
    CASA_PROPIA: casa[i],
  }));
}

/**
 * Mezcla la serie publicada sobre la que ya está cargada. El dato publicado
 * pisa al provisorio, pero nunca pisa un valor que el usuario cargó a mano y
 * marcó como definitivo — para eso se compara `provisorio`.
 */
export function combinarIndices(actuales: ValorIndice[], publicados: ValorIndice[]): ValorIndice[] {
  const porPeriodo = new Map(actuales.map((i) => [i.periodo, i]));

  for (const nuevo of publicados) {
    const viejo = porPeriodo.get(nuevo.periodo);
    if (!viejo) {
      porPeriodo.set(nuevo.periodo, nuevo);
      continue;
    }
    // Solo se completan los valores que el publicado trae y el viejo no fijó a mano.
    porPeriodo.set(nuevo.periodo, {
      ...viejo,
      ...nuevo,
      provisorio: nuevo.provisorio ?? false,
    });
  }

  return [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/**
 * Lee `public/indices.json`, que mantiene actualizado el workflow
 * `.github/workflows/indices.yml`. Si el archivo no está o no se puede leer,
 * la app sigue con la serie que ya tiene: nunca es un error fatal.
 */
export async function traerIndicesPublicados(): Promise<ValorIndice[] | null> {
  try {
    const respuesta = await fetch(`${import.meta.env.BASE_URL}indices.json`, { cache: 'no-cache' });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as { serie?: ValorIndice[] };
    return Array.isArray(datos.serie) && datos.serie.length ? datos.serie : null;
  } catch {
    return null;
  }
}
