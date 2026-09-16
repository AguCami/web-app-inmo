import type {
  Contrato,
  Cuota,
  Gasto,
  ID,
  ItemLiquidacion,
  Liquidacion,
  Pago,
  Periodo,
  Propiedad,
} from './types';
import { cobradoDeCuota } from './cobranzas';
import { formatearPeriodo, hoy, nuevoId, redondear, sumar } from './util';

export interface ContextoLiquidacion {
  propiedades: Propiedad[];
  contratos: Contrato[];
  cuotas: Cuota[];
  pagos: Pago[];
  gastos: Gasto[];
  liquidaciones: Liquidacion[];
}

/** Umbral por debajo del cual una fracción pendiente no justifica una liquidación. */
const EPSILON = 0.001;

/**
 * Fracción de una cuota que ya se le rindió al propietario, sumando todas las
 * liquidaciones emitidas. Las liquidaciones viejas (anteriores a que se
 * guardara la proporción) se consideran totales.
 */
export function proporcionLiquidada(cuotaId: ID, liquidaciones: Liquidacion[]): number {
  let total = 0;
  for (const liq of liquidaciones) {
    for (const item of liq.items) {
      if (item.tipo !== 'alquiler_cobrado' || item.referenciaId !== cuotaId) continue;
      total += item.proporcion ?? 1;
    }
  }
  return Math.min(1, total);
}

/** Fracción de la cuota cobrada que todavía está sin rendir. */
export function proporcionPendiente(
  cuota: Cuota,
  pagos: Pago[],
  liquidaciones: Liquidacion[],
): number {
  if (cuota.estado === 'anulada' || cuota.total <= 0) return 0;
  const cobrada = Math.min(1, cobradoDeCuota(cuota, pagos) / cuota.total);
  return Math.max(0, cobrada - proporcionLiquidada(cuota.id, liquidaciones));
}

/**
 * Arma la liquidación de un propietario para un período.
 *
 * Criterio: se liquida lo efectivamente cobrado (no lo devengado). Sobre el
 * alquiler cobrado se descuentan los honorarios de administración; los gastos
 * reintegrables de sus propiedades se descuentan del neto a pagar.
 *
 * Es incremental: si el mes ya se liquidó y después entró una cobranza tardía
 * o se completó un pago parcial, vuelve a armar una liquidación por la
 * diferencia. Si no quedó nada por rendir devuelve null.
 */
export function armarLiquidacion(
  propietarioId: ID,
  periodo: Periodo,
  ctx: ContextoLiquidacion,
  numero: string,
): Liquidacion | null {
  const propiedades = ctx.propiedades.filter((p) => p.propietarioId === propietarioId);
  const idsPropiedades = new Set(propiedades.map((p) => p.id));
  const contratos = ctx.contratos.filter((c) => idsPropiedades.has(c.propiedadId));
  const porContrato = new Map(contratos.map((c) => [c.id, c]));

  const pendientes = ctx.cuotas
    .filter((cu) => cu.periodo === periodo && porContrato.has(cu.contratoId))
    .map((cu) => ({ cuota: cu, proporcion: proporcionPendiente(cu, ctx.pagos, ctx.liquidaciones) }))
    .filter((x) => x.proporcion > EPSILON);

  const gastos = ctx.gastos.filter(
    (g) =>
      g.reintegrablePorPropietario &&
      g.propiedadId &&
      idsPropiedades.has(g.propiedadId) &&
      !g.liquidacionId &&
      g.fecha.slice(0, 7) <= periodo,
  );

  if (pendientes.length === 0 && gastos.length === 0) return null;

  const items: ItemLiquidacion[] = [];
  let comisionTotal = 0;

  for (const { cuota, proporcion } of pendientes) {
    const contrato = porContrato.get(cuota.contratoId)!;
    const propiedad = propiedades.find((p) => p.id === contrato.propiedadId);

    // Lo que le corresponde al propietario: el alquiler y los conceptos marcados a su cuenta.
    const conceptosPropietario = new Set(
      contrato.conceptosFijos.filter((cf) => cf.aCuentaDelPropietario).map((cf) => cf.descripcion),
    );
    const baseAlquiler = redondear(
      sumar(
        cuota.items.filter((i) => i.tipo === 'alquiler'),
        (i) => i.monto,
      ) * proporcion,
    );
    const baseOtros = redondear(
      sumar(
        cuota.items.filter((i) => i.tipo !== 'alquiler' && conceptosPropietario.has(i.descripcion)),
        (i) => i.monto,
      ) * proporcion,
    );

    const parcial = proporcion < 1 - EPSILON;
    const etiqueta =
      `${propiedad?.codigo ?? 'Propiedad'} · alquiler ${formatearPeriodo(cuota.periodo, true)}` +
      (parcial ? ` (${Math.round(proporcion * 100)} % cobrado)` : '');

    items.push({
      descripcion: etiqueta,
      tipo: 'alquiler_cobrado',
      monto: redondear(baseAlquiler + baseOtros),
      referenciaId: cuota.id,
      proporcion,
    });

    const comision = redondear((baseAlquiler * contrato.comisionAdminPct) / 100);
    comisionTotal = redondear(comisionTotal + comision);
    items.push({
      descripcion: `Honorarios administración (${contrato.comisionAdminPct} %)`,
      tipo: 'comision_admin',
      monto: -comision,
      referenciaId: cuota.id,
    });
  }

  for (const g of gastos) {
    const propiedad = propiedades.find((p) => p.id === g.propiedadId);
    items.push({
      descripcion: `${propiedad?.codigo ?? ''} · ${g.descripcion}`.trim(),
      tipo: 'gasto',
      monto: -redondear(g.total),
      referenciaId: g.id,
    });
  }

  const moneda = pendientes[0]?.cuota.moneda ?? gastos[0]?.moneda ?? 'ARS';

  return {
    id: nuevoId('liq'),
    numero,
    propietarioId,
    periodo,
    fecha: hoy(),
    moneda,
    items,
    neto: redondear(sumar(items, (i) => i.monto)),
    comisionTotal,
    estado: 'borrador',
    cuentaId: undefined,
  };
}

/** Propietarios con algo pendiente de rendir en el período. */
export function propietariosConMovimiento(periodo: Periodo, ctx: ContextoLiquidacion): ID[] {
  const ids = new Set<ID>();
  const propiedadDe = new Map(ctx.propiedades.map((p) => [p.id, p]));

  for (const cuota of ctx.cuotas) {
    if (cuota.periodo !== periodo) continue;
    if (proporcionPendiente(cuota, ctx.pagos, ctx.liquidaciones) <= EPSILON) continue;
    const contrato = ctx.contratos.find((c) => c.id === cuota.contratoId);
    const prop = contrato ? propiedadDe.get(contrato.propiedadId) : undefined;
    if (prop) ids.add(prop.propietarioId);
  }
  return [...ids];
}

export const ETIQUETA_ITEM_LIQUIDACION: Record<ItemLiquidacion['tipo'], string> = {
  alquiler_cobrado: 'Alquiler cobrado',
  comision_admin: 'Honorarios',
  gasto: 'Gasto',
  retencion: 'Retención',
  ajuste: 'Ajuste',
};
