import type { ValorIndice } from '../domain/types';
import { sumarPeriodos } from '../domain/util';

/**
 * Serie de índices de referencia.
 *
 * Los valores son de demostración: se construyen encadenando variaciones
 * mensuales plausibles a partir de una base 100 en el primer período. La serie
 * arranca tres años antes del presente para que hasta el contrato más viejo de
 * la cartera tenga índice publicado en su mes de inicio.
 *
 * Al poner la app en producción se reemplazan por los datos oficiales del BCRA
 * (ICL), el INDEC (IPC) y la Secretaría de Vivienda (Casa Propia), cargables a
 * mano desde Configuración.
 */
const PERIODO_BASE = '2023-09';

// Variaciones mensuales (%) desde PERIODO_BASE. El primer valor es la base.
const VAR_IPC = [
  0, 8.3, 12.8, 25.5, 20.6, 13.2, 11.0, 8.8, 4.2, 4.6, 4.0, 4.2, 4.2,
  2.7, 2.4, 2.7, 2.2, 2.4, 3.7, 2.8, 1.5, 1.6, 1.9, 1.9, 2.1, 2.3, 2.0, 1.8,
  1.7, 1.6, 1.5, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.2, 1.1, 1.1,
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

const VAR_USD = [
  0, 10.0, 12.0, 60.0, 18.0, 8.0, 6.0, 5.0, 4.0, 3.0, 3.0, 3.0, 3.0,
  1.5, 1.8, 2.2, 2.0, 1.8, 3.5, 2.4, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 1.8, 1.6,
  1.5, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.1, 1.1, 1.1, 1.0, 1.0,
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
  const casa = encadenar(100, VAR_CASA_PROPIA);
  const usd = encadenar(400, VAR_USD);

  return VAR_IPC.map((_, i) => ({
    periodo: sumarPeriodos(PERIODO_BASE, i),
    ICL: icl[i],
    IPC: ipc[i],
    CASA_PROPIA: casa[i],
    usd: Math.round(usd[i]),
  }));
}
