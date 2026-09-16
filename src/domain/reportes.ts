import type { BaseDatos, ID, ISODate, Movimiento, Periodo } from './types';
import { estadoDeResultados, libroDiario } from './contabilidad';
import { cobradoDeCuota, resumenCobranza, saldoDeCuota } from './cobranzas';
import { direccionDe } from './propiedades';
import { honorariosDeOperacion, valorPonderado } from './ventas';
import { proximoAjuste, vigenciaContrato } from './contratos';
import {
  hoy,
  periodoActual,
  redondear,
  sumar,
  ultimosPeriodos,
} from './util';

const finDePeriodo = (p: Periodo): ISODate => {
  const [y, m] = p.split('-').map(Number);
  return `${p}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

/* ─────────────────── Serie mensual de resultado ───────────────────── */

export interface PuntoResultado {
  periodo: Periodo;
  ingresos: number;
  egresos: number;
  resultado: number;
}

export function serieResultadoMensual(db: BaseDatos, periodos: Periodo[]): PuntoResultado[] {
  const diario = libroDiario(db);
  return periodos.map((p) => {
    const er = estadoDeResultados(diario, `${p}-01`, finDePeriodo(p));
    return {
      periodo: p,
      ingresos: er.totalIngresos,
      egresos: er.totalEgresos,
      resultado: er.resultado,
    };
  });
}

/* ───────────────────── Composición de ingresos ────────────────────── */

export interface RubroIngreso {
  nombre: string;
  monto: number;
}

export function composicionIngresos(db: BaseDatos, desde: ISODate, hasta: ISODate): RubroIngreso[] {
  const er = estadoDeResultados(libroDiario(db), desde, hasta);
  return er.ingresos.map((i) => ({ nombre: i.nombre, monto: i.monto }));
}

/* ──────────────────────── Serie de cobranza ───────────────────────── */

export interface PuntoCobranza {
  periodo: Periodo;
  emitido: number;
  cobrado: number;
  pendiente: number;
  tasa: number;
}

export function serieCobranza(db: BaseDatos, periodos: Periodo[]): PuntoCobranza[] {
  return periodos.map((p) => {
    const cuotas = db.cuotas.filter((c) => c.periodo === p);
    const r = resumenCobranza(cuotas, db.contratos, db.pagos);
    return {
      periodo: p,
      emitido: r.emitido,
      cobrado: r.cobrado,
      pendiente: r.pendiente,
      tasa: r.tasaCobranza,
    };
  });
}

/* ──────────────────────────── Tesorería ───────────────────────────── */

/**
 * Libro de caja: se deriva de los hechos (cobros, pagos de gastos y de
 * liquidaciones) más los movimientos cargados a mano. Así no hay que cargar
 * dos veces el mismo movimiento.
 */
export function movimientosDerivados(db: BaseDatos): Movimiento[] {
  const out: Movimiento[] = [...db.movimientos];
  const cuotaDe = new Map(db.cuotas.map((c) => [c.id, c]));
  const personaDe = new Map(db.personas.map((p) => [p.id, p]));

  for (const pago of db.pagos) {
    const esEgreso = Boolean(pago.gastoId);
    const cuota = pago.cuotaId ? cuotaDe.get(pago.cuotaId) : undefined;
    const concepto = pago.gastoId
      ? 'Pago a proveedor'
      : pago.operacionId
        ? 'Cobro de honorarios por venta'
        : `Cobranza alquiler${cuota ? ` ${cuota.periodo}` : ''}`;
    out.push({
      id: `mov_pago_${pago.id}`,
      fecha: pago.fecha,
      cuentaId: pago.cuentaId,
      tipo: esEgreso ? 'egreso' : 'ingreso',
      concepto,
      monto: redondear(pago.monto + (pago.punitorios ?? 0)),
      moneda: pago.moneda,
      origen: { tipo: 'pago', id: pago.id },
      conciliado: false,
    });
  }

  for (const liq of db.liquidaciones) {
    if (liq.estado !== 'pagada' || !liq.fechaPago || !liq.cuentaId) continue;
    out.push({
      id: `mov_liq_${liq.id}`,
      fecha: liq.fechaPago,
      cuentaId: liq.cuentaId,
      tipo: 'egreso',
      concepto: `Liquidación ${liq.numero} · ${personaDe.get(liq.propietarioId)?.nombre ?? ''}`.trim(),
      monto: liq.neto,
      moneda: liq.moneda,
      origen: { tipo: 'liquidacion', id: liq.id },
      conciliado: false,
    });
  }

  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function saldoDeCuenta(db: BaseDatos, cuentaId: ID, hasta: ISODate = hoy()): number {
  const cuenta = db.cuentas.find((c) => c.id === cuentaId);
  if (!cuenta) return 0;
  const movs = movimientosDerivados(db).filter((m) => m.cuentaId === cuentaId && m.fecha <= hasta);
  const delta = sumar(movs, (m) => (m.tipo === 'egreso' ? -m.monto : m.monto));
  return redondear(cuenta.saldoInicial + delta);
}

/* ───────────────── Rentabilidad por propiedad ─────────────────────── */

export interface FilaRentabilidad {
  propiedadId: ID;
  codigo: string;
  direccion: string;
  propietario: string;
  alquilerCobrado: number;
  honorarios: number;
  gastos: number;
  aporteNeto: number;
}

export function rentabilidadPorPropiedad(db: BaseDatos, desde: Periodo, hasta: Periodo): FilaRentabilidad[] {
  const personaDe = new Map(db.personas.map((p) => [p.id, p]));
  const contratosDe = (propiedadId: ID) => db.contratos.filter((c) => c.propiedadId === propiedadId);

  return db.propiedades
    .map((prop) => {
      const contratos = contratosDe(prop.id);
      const ids = new Set(contratos.map((c) => c.id));
      const cuotas = db.cuotas.filter(
        (c) => ids.has(c.contratoId) && c.periodo >= desde && c.periodo <= hasta,
      );
      const alquilerCobrado = redondear(sumar(cuotas, (c) => cobradoDeCuota(c, db.pagos)));
      const comisionPct = contratos[0]?.comisionAdminPct ?? 0;
      const honorarios = redondear((alquilerCobrado * comisionPct) / 100);
      const gastos = redondear(
        sumar(
          db.gastos.filter(
            (g) =>
              g.propiedadId === prop.id &&
              !g.reintegrablePorPropietario &&
              g.fecha.slice(0, 7) >= desde &&
              g.fecha.slice(0, 7) <= hasta,
          ),
          (g) => g.total,
        ),
      );
      return {
        propiedadId: prop.id,
        codigo: prop.codigo,
        direccion: direccionDe(prop),
        propietario: personaDe.get(prop.propietarioId)?.nombre ?? '—',
        alquilerCobrado,
        honorarios,
        gastos,
        aporteNeto: redondear(honorarios - gastos),
      };
    })
    .filter((f) => f.alquilerCobrado > 0 || f.gastos > 0)
    .sort((a, b) => b.aporteNeto - a.aporteNeto);
}

/* ────────────────────────── KPIs del tablero ──────────────────────── */

export interface KpisDashboard {
  periodo: Periodo;
  ingresosMes: number;
  ingresosMesAnterior: number;
  resultadoMes: number;
  emitidoMes: number;
  cobradoMes: number;
  tasaCobranza: number;
  deudaTotal: number;
  cuotasVencidas: number;
  contratosActivos: number;
  contratosPorVencer: number;
  ajustesDelMes: number;
  propiedadesTotal: number;
  propiedadesAlquiladas: number;
  propiedadesDisponibles: number;
  ocupacion: number;
  pipelineHonorarios: number;
  pipelinePonderado: number;
  ventasCerradasAnio: number;
  disponibilidadARS: number;
  aRendirPropietarios: number;
}

export function kpisDashboard(db: BaseDatos, periodo: Periodo = periodoActual()): KpisDashboard {
  const periodoAnterior = ultimosPeriodos(periodo, 2)[0];
  const [mesActual, mesPrevio] = serieResultadoMensual(db, [periodoAnterior, periodo]).reverse();

  const cuotasMes = db.cuotas.filter((c) => c.periodo === periodo);
  const resumenMes = resumenCobranza(cuotasMes, db.contratos, db.pagos);
  const deudaTotal = redondear(sumar(db.cuotas, (c) => Math.max(0, saldoDeCuota(c, db.pagos))));
  const cuotasVencidas = db.cuotas.filter(
    (c) => saldoDeCuota(c, db.pagos) > 0.01 && c.vencimiento < hoy(),
  ).length;

  const activos = db.contratos.filter((c) => c.estado === 'activo');
  const porVencer = activos.filter((c) => vigenciaContrato(c) === 'por_vencer').length;
  const ajustesDelMes = activos.filter((c) => proximoAjuste(c, db.indices)?.periodo === periodo).length;

  const abiertas = db.operaciones.filter((o) => o.estado !== 'escriturada' && o.estado !== 'caida');
  const cerradas = db.operaciones.filter(
    (o) => o.estado === 'escriturada' && (o.fechaEscritura ?? '').slice(0, 4) === periodo.slice(0, 4),
  );

  const alquiladas = db.propiedades.filter((p) => p.estado === 'alquilada').length;
  const enCartera = db.propiedades.filter((p) => p.estado !== 'vendida' && p.estado !== 'fuera_de_mercado').length;

  const disponibilidadARS = redondear(
    sumar(
      db.cuentas.filter((c) => c.activa && c.moneda === 'ARS'),
      (c) => saldoDeCuenta(db, c.id),
    ),
  );

  const aRendir = redondear(
    sumar(
      db.liquidaciones.filter((l) => l.estado !== 'pagada'),
      (l) => l.neto,
    ),
  );

  return {
    periodo,
    ingresosMes: mesActual?.ingresos ?? 0,
    ingresosMesAnterior: mesPrevio?.ingresos ?? 0,
    resultadoMes: mesActual?.resultado ?? 0,
    emitidoMes: resumenMes.emitido,
    cobradoMes: resumenMes.cobrado,
    tasaCobranza: resumenMes.tasaCobranza,
    deudaTotal,
    cuotasVencidas,
    contratosActivos: activos.length,
    contratosPorVencer: porVencer,
    ajustesDelMes,
    propiedadesTotal: db.propiedades.length,
    propiedadesAlquiladas: alquiladas,
    propiedadesDisponibles: db.propiedades.filter((p) => p.estado === 'disponible').length,
    ocupacion: enCartera > 0 ? redondear((alquiladas / enCartera) * 100, 1) : 0,
    pipelineHonorarios: redondear(sumar(abiertas, (o) => honorariosDeOperacion(o).total)),
    pipelinePonderado: redondear(sumar(abiertas, valorPonderado)),
    ventasCerradasAnio: cerradas.length,
    disponibilidadARS,
    aRendirPropietarios: aRendir,
  };
}
