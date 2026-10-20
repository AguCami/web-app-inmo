import type {
  Contrato,
  IndiceAjuste,
  ISODate,
  Periodo,
  TramoAjuste,
  ValorIndice,
} from './types';
import {
  diasEntre,
  diferenciaPeriodos,
  hoy,
  nuevoId,
  periodoDe,
  redondear,
  sumarMeses,
  sumarPeriodos,
} from './util';

/**
 * Valor del índice para un período. Si todavía no se publicó el del período
 * pedido, se arrastra el último publicado (es lo que hace la administración
 * en la práctica hasta que el BCRA/INDEC publica el dato definitivo).
 */
export function valorIndice(
  indices: ValorIndice[],
  periodo: Periodo,
  tipo: Exclude<IndiceAjuste, 'PORCENTAJE_FIJO' | 'SIN_AJUSTE'>,
): { valor: number; estimado: boolean } {
  const exacto = indices.find((i) => i.periodo === periodo);
  if (exacto) return { valor: exacto[tipo], estimado: false };
  return { valor: valorMasCercano(indices, periodo, (i) => i[tipo]), estimado: true };
}

/**
 * Para un período sin dato se arrastra el último publicado; si el período es
 * anterior al comienzo de la serie se usa el primero. Devolver 1 acá sería
 * catastrófico: el coeficiente de ajuste se dispararía y multiplicaría el
 * alquiler por el valor entero del índice.
 */
function valorMasCercano(
  indices: ValorIndice[],
  periodo: Periodo,
  leer: (i: ValorIndice) => number,
): number {
  if (indices.length === 0) return 1;
  const ordenados = [...indices].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const anteriores = ordenados.filter((i) => i.periodo < periodo);
  const referencia = anteriores.length ? anteriores[anteriores.length - 1] : ordenados[0];
  return leer(referencia);
}

/** Cantidad de meses que abarca el contrato (mínimo 1). */
export function mesesDeContrato(c: Contrato): number {
  return Math.max(1, diferenciaPeriodos(periodoDe(c.fechaInicio), periodoDe(c.fechaFin)) + 1);
}

/** Todos los períodos facturables del contrato. */
export function periodosDelContrato(c: Contrato): Periodo[] {
  const inicio = periodoDe(c.fechaInicio);
  return Array.from({ length: mesesDeContrato(c) }, (_, i) => sumarPeriodos(inicio, i));
}

/**
 * Cronograma de actualizaciones: un tramo por cada ventana de `mesesAjuste`.
 * El monto de cada tramo se calcula encadenando el coeficiente del índice
 * respecto del tramo anterior (equivale a monto inicial × índice(t)/índice(0)).
 */
export function cronogramaAjustes(c: Contrato, indices: ValorIndice[]): TramoAjuste[] {
  const inicio = periodoDe(c.fechaInicio);
  const meses = mesesDeContrato(c);
  const paso = Math.max(1, c.mesesAjuste);
  const tramos: TramoAjuste[] = [];

  let monto = c.montoInicial;
  for (let offset = 0; offset < meses; offset += paso) {
    const periodoDesde = sumarPeriodos(inicio, offset);
    const periodoHasta = sumarPeriodos(inicio, Math.min(offset + paso - 1, meses - 1));
    let coeficiente = 1;

    if (offset > 0) {
      if (c.indiceAjuste === 'PORCENTAJE_FIJO') {
        coeficiente = 1 + (c.porcentajeFijo ?? 0) / 100;
      } else if (c.indiceAjuste !== 'SIN_AJUSTE') {
        const anterior = valorIndice(indices, sumarPeriodos(inicio, offset - paso), c.indiceAjuste);
        const actual = valorIndice(indices, periodoDesde, c.indiceAjuste);
        coeficiente = anterior.valor > 0 ? actual.valor / anterior.valor : 1;
      }
      monto = redondear(monto * coeficiente, 2);
    }

    tramos.push({
      periodoDesde,
      periodoHasta,
      monto,
      coeficiente: redondear(coeficiente, 4),
      variacionPct: redondear((coeficiente - 1) * 100, 2),
    });
  }
  return tramos;
}

/** Alquiler que rige en un período dado. */
export function montoVigente(c: Contrato, periodo: Periodo, indices: ValorIndice[]): number {
  const tramos = cronogramaAjustes(c, indices);
  const tramo = [...tramos].reverse().find((t) => t.periodoDesde <= periodo);
  return tramo?.monto ?? c.montoInicial;
}

export interface ProximoAjuste {
  periodo: Periodo;
  montoAnterior: number;
  montoNuevo: number;
  variacionPct: number;
  diasRestantes: number;
}

/** Próxima actualización pendiente del contrato, si queda alguna. */
export function proximoAjuste(
  c: Contrato,
  indices: ValorIndice[],
  desde: Periodo = periodoDe(hoy()),
): ProximoAjuste | null {
  if (c.indiceAjuste === 'SIN_AJUSTE' || c.estado !== 'activo') return null;
  const tramos = cronogramaAjustes(c, indices);
  const idx = tramos.findIndex((t, i) => i > 0 && t.periodoDesde > desde);
  if (idx <= 0) return null;
  const tramo = tramos[idx];
  const fecha = `${tramo.periodoDesde}-01`;
  return {
    periodo: tramo.periodoDesde,
    montoAnterior: tramos[idx - 1].monto,
    montoNuevo: tramo.monto,
    variacionPct: tramo.variacionPct,
    diasRestantes: diasEntre(hoy(), fecha),
  };
}

export type VigenciaContrato = 'vigente' | 'por_vencer' | 'vencido' | 'no_iniciado';

/** Estado de vigencia calculado (distinto del estado administrativo guardado). */
export function vigenciaContrato(c: Contrato, fecha: ISODate = hoy()): VigenciaContrato {
  if (fecha < c.fechaInicio) return 'no_iniciado';
  if (fecha > c.fechaFin) return 'vencido';
  return diasEntre(fecha, c.fechaFin) <= 90 ? 'por_vencer' : 'vigente';
}

export const ETIQUETA_INDICE: Record<IndiceAjuste, string> = {
  ICL: 'ICL · BCRA',
  IPC: 'IPC nacional · INDEC',
  IPC_CBA: 'IPC Córdoba',
  CASA_PROPIA: 'Casa Propia',
  PORCENTAJE_FIJO: 'Porcentaje fijo',
  SIN_AJUSTE: 'Sin ajuste',
};

/** Los índices que se leen de una serie publicada (los otros no llevan tabla). */
export const INDICES_CON_SERIE = ['ICL', 'IPC', 'IPC_CBA', 'CASA_PROPIA'] as const;

export type IndiceConSerie = (typeof INDICES_CON_SERIE)[number];

/* ──────────────────────────── Renovación ──────────────────────────── */

/**
 * El número que sigue, con el formato LOC-AAAA-NNN que usa la cartera.
 * Si la inmobiliaria numera de otra forma, es solo una sugerencia editable.
 */
export function siguienteNumeroContrato(
  contratos: Contrato[],
  anio = new Date().getFullYear(),
): string {
  let mayor = 0;
  for (const c of contratos) {
    const m = c.numero.match(/^LOC-(\d{4})-(\d+)$/);
    if (m && Number(m[1]) === anio) mayor = Math.max(mayor, Number(m[2]));
  }
  return `LOC-${anio}-${String(mayor + 1).padStart(3, '0')}`;
}

/**
 * Propone el contrato que sigue al que vence.
 *
 * Es un contrato NUEVO, no una extensión del viejo, y eso importa: el
 * cronograma de actualizaciones encadena coeficientes desde el monto inicial,
 * así que estirarle la fecha de fin al viejo seguiría ajustando sobre una
 * base vieja. Además el anterior queda intacto con sus cuotas, sus recibos y
 * sus liquidaciones, que es lo que hay que poder mostrar si algo se discute.
 *
 * Arranca el mes siguiente al último que factura el anterior, y por el
 * alquiler que regía al final, no por el original. Lo del mes y no el día
 * siguiente importa: las cuotas son mensuales, así que un contrato que
 * termina el 1 de noviembre igual factura noviembre entero. Si el nuevo
 * empezara el 2, los dos emitirían la cuota de ese mes para la misma unidad.
 *
 * Todo lo demás se hereda y se puede editar.
 */
export function contratoRenovado(
  viejo: Contrato,
  indices: ValorIndice[],
  numero: string,
  meses = mesesDeContrato(viejo),
): Contrato {
  const inicio = `${sumarPeriodos(periodoDe(viejo.fechaFin), 1)}-01`;
  return {
    ...viejo,
    id: nuevoId('c'),
    numero,
    fechaInicio: inicio,
    fechaFin: sumarMeses(inicio, meses - 1),
    montoInicial: montoVigente(viejo, periodoDe(inicio), indices),
    estado: 'activo',
  };
}
