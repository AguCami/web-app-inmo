import type { BaseDatos, Contrato, ID, Periodo } from './types';
import { cobradoDeCuota, resumenCobranza, saldoDeCuota } from './cobranzas';
import { proximoAjuste, vigenciaContrato, type ProximoAjuste } from './contratos';
import { diasEntre, hoy, redondear, sumar } from './util';

/* ─────────────────────── Números del mes ─────────────────────────── */

export interface ResumenMes {
  periodo: Periodo;
  emitido: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  punitorios: number;
  tasaCobranza: number;
  cuotasVencidas: number;
  /** Honorarios de administración sobre lo efectivamente cobrado. */
  honorarios: number;
}

export function resumenDelMes(db: BaseDatos, periodo: Periodo): ResumenMes {
  const cuotas = db.cuotas.filter((c) => c.periodo === periodo);
  const base = resumenCobranza(cuotas, db.contratos, db.pagos);
  const porContrato = new Map(db.contratos.map((c) => [c.id, c]));

  // El honorario se calcula sobre la parte de alquiler cobrada, no sobre el total
  // de la cuota: las expensas se las lleva el consorcio, no la inmobiliaria.
  const honorarios = redondear(
    sumar(cuotas, (cuota) => {
      const contrato = porContrato.get(cuota.contratoId);
      if (!contrato || cuota.estado === 'anulada' || cuota.total <= 0) return 0;
      const proporcion = Math.min(1, cobradoDeCuota(cuota, db.pagos) / cuota.total);
      const alquiler = sumar(
        cuota.items.filter((i) => i.tipo === 'alquiler'),
        (i) => i.monto,
      );
      return (alquiler * proporcion * contrato.comisionAdminPct) / 100;
    }),
  );

  return {
    periodo,
    emitido: base.emitido,
    cobrado: base.cobrado,
    pendiente: base.pendiente,
    vencido: base.vencido,
    punitorios: base.punitorios,
    tasaCobranza: base.tasaCobranza,
    cuotasVencidas: base.cuotasVencidas,
    honorarios,
  };
}

export function serieCobranza(db: BaseDatos, periodos: Periodo[]): ResumenMes[] {
  return periodos.map((p) => resumenDelMes(db, p));
}

/* ────────────────────── Lo que pide atención ─────────────────────── */

export interface Alertas {
  /** Cuotas con saldo y vencimiento pasado, de todos los períodos. */
  cuotasVencidas: number;
  deudaTotal: number;
  /** Contratos activos que vencen dentro de los próximos 90 días. */
  contratosPorVencer: Contrato[];
  /** Contratos con una actualización en el mes en curso o el siguiente. */
  ajustesProximos: { contrato: Contrato; ajuste: ProximoAjuste }[];
  propiedadesVacias: number;
  liquidacionesSinPagar: number;
  montoSinRendir: number;
}

export function alertas(db: BaseDatos): Alertas {
  const conSaldo = db.cuotas.filter(
    (c) => c.estado !== 'anulada' && saldoDeCuota(c, db.pagos) > 0.01 && c.vencimiento < hoy(),
  );

  const activos = db.contratos.filter((c) => c.estado === 'activo');
  const sinPagar = db.liquidaciones.filter((l) => l.estado !== 'pagada');

  const ajustesProximos = activos
    .map((contrato) => ({ contrato, ajuste: proximoAjuste(contrato, db.indices) }))
    .filter((x): x is { contrato: Contrato; ajuste: ProximoAjuste } => x.ajuste !== null)
    .filter((x) => x.ajuste.diasRestantes <= 60)
    .sort((a, b) => a.ajuste.diasRestantes - b.ajuste.diasRestantes);

  return {
    cuotasVencidas: conSaldo.length,
    deudaTotal: redondear(sumar(conSaldo, (c) => saldoDeCuota(c, db.pagos))),
    contratosPorVencer: activos
      .filter((c) => vigenciaContrato(c) === 'por_vencer')
      .sort((a, b) => a.fechaFin.localeCompare(b.fechaFin)),
    ajustesProximos,
    propiedadesVacias: db.propiedades.filter((p) => p.estado === 'disponible').length,
    liquidacionesSinPagar: sinPagar.length,
    montoSinRendir: redondear(sumar(sinPagar, (l) => l.neto)),
  };
}

/* ──────────────────── Deuda por inquilino ────────────────────────── */

export interface Deudor {
  inquilinoId: ID;
  nombre: string;
  contratoId: ID;
  cuotas: number;
  saldo: number;
  diasMora: number;
}

export function deudores(db: BaseDatos): Deudor[] {
  const acc = new Map<ID, Deudor>();

  for (const cuota of db.cuotas) {
    const saldo = saldoDeCuota(cuota, db.pagos);
    if (saldo <= 0.01 || cuota.estado === 'anulada') continue;
    const dias = diasEntre(cuota.vencimiento, hoy());
    if (dias <= 0) continue;

    const contrato = db.contratos.find((c) => c.id === cuota.contratoId);
    if (!contrato) continue;
    const persona = db.personas.find((p) => p.id === contrato.inquilinoId);

    const actual = acc.get(contrato.inquilinoId) ?? {
      inquilinoId: contrato.inquilinoId,
      nombre: persona?.nombre ?? 'Sin nombre',
      contratoId: contrato.id,
      cuotas: 0,
      saldo: 0,
      diasMora: 0,
    };
    actual.cuotas += 1;
    actual.saldo = redondear(actual.saldo + saldo);
    actual.diasMora = Math.max(actual.diasMora, dias);
    acc.set(contrato.inquilinoId, actual);
  }

  return [...acc.values()].sort((a, b) => b.saldo - a.saldo);
}
