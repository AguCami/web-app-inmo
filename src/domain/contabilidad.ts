import type {
  Asiento,
  BaseDatos,
  ISODate,
  LineaAsiento,
  Moneda,
  TipoCuentaContable,
} from './types';
import { cotizacionUSD } from './contratos';
import { CUENTA_POR_CATEGORIA_GASTO, CUENTA_POR_CODIGO, cuentaContableDe, PLAN_CUENTAS } from './planCuentas';
import { formatearPeriodo, periodoDe, redondear, sumar } from './util';

/**
 * Todos los asientos se registran en la moneda base (ARS). Los importes en
 * dólares se convierten con la cotización del período del hecho económico.
 */
function aMonedaBase(monto: number, moneda: Moneda, fecha: ISODate, db: BaseDatos): number {
  if (moneda === db.configuracion.monedaBase) return redondear(monto);
  const cot = cotizacionUSD(db.indices, periodoDe(fecha));
  return redondear(monto * cot);
}

function asiento(
  id: string,
  fecha: ISODate,
  descripcion: string,
  lineas: LineaAsiento[],
  origen: Asiento['origen'],
): Asiento {
  return { id, numero: 0, fecha, descripcion, lineas, automatico: true, origen };
}

/**
 * Genera el libro diario automático a partir de los hechos registrados.
 *
 * Los asientos automáticos se recalculan enteros cada vez (son función pura de
 * los datos); los asientos manuales cargados por el contador se conservan.
 */
export function generarAsientosAutomaticos(db: BaseDatos): Asiento[] {
  const out: Asiento[] = [];
  const contratoDe = new Map(db.contratos.map((c) => [c.id, c]));
  const cuotaDe = new Map(db.cuotas.map((c) => [c.id, c]));
  const cuentaDe = new Map(db.cuentas.map((c) => [c.id, c]));
  const personaDe = new Map(db.personas.map((p) => [p.id, p]));

  // 1. Emisión de la cuota: nace el crédito contra el inquilino y la deuda con el propietario.
  for (const cuota of db.cuotas) {
    if (cuota.estado === 'anulada') continue;
    const monto = aMonedaBase(cuota.total, cuota.moneda, cuota.vencimiento, db);
    if (monto <= 0) continue;
    const contrato = contratoDe.get(cuota.contratoId);
    out.push(
      asiento(
        `auto_cuota_${cuota.id}`,
        cuota.vencimiento,
        `Emisión cuota ${formatearPeriodo(cuota.periodo, true)} · contrato ${contrato?.numero ?? ''}`.trim(),
        [
          { cuenta: '1.2.01', debe: monto, haber: 0, detalle: 'Alquiler devengado' },
          { cuenta: '2.1.01', debe: 0, haber: monto, detalle: 'A rendir al propietario' },
        ],
        { tipo: 'cuota', id: cuota.id },
      ),
    );
  }

  // 2. Cobros y pagos registrados en tesorería.
  for (const pago of db.pagos) {
    const cuentaContable = cuentaContableDe(cuentaDe.get(pago.cuentaId));
    const monto = aMonedaBase(pago.monto, pago.moneda, pago.fecha, db);
    const punitorios = aMonedaBase(pago.punitorios ?? 0, pago.moneda, pago.fecha, db);

    if (pago.cuotaId) {
      const cuota = cuotaDe.get(pago.cuotaId);
      const lineas: LineaAsiento[] = [
        { cuenta: cuentaContable, debe: redondear(monto + punitorios), haber: 0, detalle: 'Cobranza' },
        { cuenta: '1.2.01', debe: 0, haber: monto, detalle: 'Cancela alquiler' },
      ];
      if (punitorios > 0) {
        lineas.push({ cuenta: '4.1.03', debe: 0, haber: punitorios, detalle: 'Punitorios por mora' });
      }
      out.push(
        asiento(
          `auto_pago_${pago.id}`,
          pago.fecha,
          `Cobranza alquiler ${cuota ? formatearPeriodo(cuota.periodo, true) : ''}`.trim(),
          lineas,
          { tipo: 'pago', id: pago.id },
        ),
      );
    } else if (pago.operacionId) {
      out.push(
        asiento(
          `auto_pago_${pago.id}`,
          pago.fecha,
          'Cobro de honorarios por venta',
          [
            { cuenta: cuentaContable, debe: monto, haber: 0 },
            { cuenta: '1.2.02', debe: 0, haber: monto },
          ],
          { tipo: 'pago', id: pago.id },
        ),
      );
    } else if (pago.gastoId) {
      out.push(
        asiento(
          `auto_pago_${pago.id}`,
          pago.fecha,
          'Pago a proveedor',
          [
            { cuenta: '2.1.02', debe: monto, haber: 0 },
            { cuenta: cuentaContable, debe: 0, haber: monto },
          ],
          { tipo: 'pago', id: pago.id },
        ),
      );
    }
  }

  // 3. Liquidaciones: recién acá la inmobiliaria reconoce el honorario de administración.
  for (const liq of db.liquidaciones) {
    if (liq.estado === 'borrador') continue;
    const propietario = personaDe.get(liq.propietarioId);
    const comision = aMonedaBase(liq.comisionTotal, liq.moneda, liq.fecha, db);
    if (comision > 0) {
      out.push(
        asiento(
          `auto_liq_${liq.id}`,
          liq.fecha,
          `Honorarios administración · liquidación ${liq.numero} · ${propietario?.nombre ?? ''}`.trim(),
          [
            { cuenta: '2.1.01', debe: comision, haber: 0 },
            { cuenta: '4.1.01', debe: 0, haber: comision, detalle: formatearPeriodo(liq.periodo, true) },
          ],
          { tipo: 'liquidacion', id: liq.id },
        ),
      );
    }
    if (liq.estado === 'pagada' && liq.fechaPago) {
      const neto = aMonedaBase(liq.neto, liq.moneda, liq.fechaPago, db);
      out.push(
        asiento(
          `auto_liqpago_${liq.id}`,
          liq.fechaPago,
          `Pago liquidación ${liq.numero} a ${propietario?.nombre ?? 'propietario'}`,
          [
            { cuenta: '2.1.01', debe: neto, haber: 0 },
            { cuenta: cuentaContableDe(cuentaDe.get(liq.cuentaId ?? '')), debe: 0, haber: neto },
          ],
          { tipo: 'liquidacion', id: liq.id },
        ),
      );
    }
  }

  // 4. Ventas escrituradas: se devengan los honorarios.
  for (const op of db.operaciones) {
    if (op.estado !== 'escriturada' || !op.fechaEscritura) continue;
    const base = op.precioAcordado ?? op.precioPublicado;
    const honorarios = redondear((base * (op.honorariosVendedorPct + op.honorariosCompradorPct)) / 100);
    const monto = aMonedaBase(honorarios, op.moneda, op.fechaEscritura, db);
    if (monto <= 0) continue;
    out.push(
      asiento(
        `auto_venta_${op.id}`,
        op.fechaEscritura,
        `Honorarios venta · operación ${op.numero}`,
        [
          { cuenta: '1.2.02', debe: monto, haber: 0 },
          { cuenta: '4.1.02', debe: 0, haber: monto },
        ],
        { tipo: 'operacion', id: op.id },
      ),
    );
  }

  // 5. Gastos. Los reintegrables no son gasto propio: se cargan al propietario.
  for (const g of db.gastos) {
    const monto = aMonedaBase(g.total, g.moneda, g.fecha, db);
    if (monto <= 0) continue;
    const cuentaDebe = g.reintegrablePorPropietario ? '2.1.01' : CUENTA_POR_CATEGORIA_GASTO[g.categoria];
    out.push(
      asiento(
        `auto_gasto_${g.id}`,
        g.fecha,
        g.descripcion,
        [
          { cuenta: cuentaDebe, debe: monto, haber: 0 },
          { cuenta: '2.1.02', debe: 0, haber: monto, detalle: 'Proveedor' },
        ],
        { tipo: 'gasto', id: g.id },
      ),
    );
  }

  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Diario completo: automáticos + manuales, numerados por fecha. */
export function libroDiario(db: BaseDatos): Asiento[] {
  const manuales = db.asientos.filter((a) => !a.automatico);
  const todos = [...generarAsientosAutomaticos(db), ...manuales].sort((a, b) =>
    a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha),
  );
  return todos.map((a, i) => ({ ...a, numero: i + 1 }));
}

export interface LineaMayor {
  fecha: ISODate;
  asientoNumero: number;
  descripcion: string;
  debe: number;
  haber: number;
  saldo: number;
}

export function mayorDeCuenta(asientos: Asiento[], codigo: string): LineaMayor[] {
  const cuenta = CUENTA_POR_CODIGO.get(codigo);
  const naturalezaDeudora = cuenta?.tipo === 'activo' || cuenta?.tipo === 'egreso';
  let saldo = 0;
  const lineas: LineaMayor[] = [];

  for (const a of asientos) {
    for (const l of a.lineas) {
      if (l.cuenta !== codigo) continue;
      saldo += naturalezaDeudora ? l.debe - l.haber : l.haber - l.debe;
      lineas.push({
        fecha: a.fecha,
        asientoNumero: a.numero,
        descripcion: l.detalle ? `${a.descripcion} — ${l.detalle}` : a.descripcion,
        debe: l.debe,
        haber: l.haber,
        saldo: redondear(saldo),
      });
    }
  }
  return lineas;
}

export interface FilaBalance {
  codigo: string;
  nombre: string;
  tipo: TipoCuentaContable;
  debe: number;
  haber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

export function balanceSumasYSaldos(asientos: Asiento[]): FilaBalance[] {
  const acc = new Map<string, { debe: number; haber: number }>();
  for (const a of asientos) {
    for (const l of a.lineas) {
      const actual = acc.get(l.cuenta) ?? { debe: 0, haber: 0 };
      actual.debe += l.debe;
      actual.haber += l.haber;
      acc.set(l.cuenta, actual);
    }
  }

  return PLAN_CUENTAS.filter((c) => c.imputable && acc.has(c.codigo)).map((c) => {
    const { debe, haber } = acc.get(c.codigo)!;
    const diferencia = redondear(debe - haber);
    return {
      codigo: c.codigo,
      nombre: c.nombre,
      tipo: c.tipo,
      debe: redondear(debe),
      haber: redondear(haber),
      saldoDeudor: diferencia > 0 ? diferencia : 0,
      saldoAcreedor: diferencia < 0 ? -diferencia : 0,
    };
  });
}

export interface RubroResultado {
  codigo: string;
  nombre: string;
  monto: number;
}

export interface EstadoResultados {
  ingresos: RubroResultado[];
  egresos: RubroResultado[];
  totalIngresos: number;
  totalEgresos: number;
  resultado: number;
  margen: number;
}

export function estadoDeResultados(
  asientos: Asiento[],
  desde: ISODate,
  hasta: ISODate,
): EstadoResultados {
  const enRango = asientos.filter((a) => a.fecha >= desde && a.fecha <= hasta);
  const acc = new Map<string, number>();

  for (const a of enRango) {
    for (const l of a.lineas) {
      const cuenta = CUENTA_POR_CODIGO.get(l.cuenta);
      if (!cuenta) continue;
      if (cuenta.tipo === 'ingreso') acc.set(l.cuenta, (acc.get(l.cuenta) ?? 0) + l.haber - l.debe);
      if (cuenta.tipo === 'egreso') acc.set(l.cuenta, (acc.get(l.cuenta) ?? 0) + l.debe - l.haber);
    }
  }

  const armar = (tipo: TipoCuentaContable): RubroResultado[] =>
    PLAN_CUENTAS.filter((c) => c.tipo === tipo && c.imputable && (acc.get(c.codigo) ?? 0) !== 0)
      .map((c) => ({ codigo: c.codigo, nombre: c.nombre, monto: redondear(acc.get(c.codigo) ?? 0) }))
      .sort((a, b) => b.monto - a.monto);

  const ingresos = armar('ingreso');
  const egresos = armar('egreso');
  const totalIngresos = redondear(sumar(ingresos, (r) => r.monto));
  const totalEgresos = redondear(sumar(egresos, (r) => r.monto));
  const resultado = redondear(totalIngresos - totalEgresos);

  return {
    ingresos,
    egresos,
    totalIngresos,
    totalEgresos,
    resultado,
    margen: totalIngresos > 0 ? redondear((resultado / totalIngresos) * 100, 1) : 0,
  };
}

/** Control de partida doble: debe = haber en cada asiento. */
export function asientosDesbalanceados(asientos: Asiento[]): Asiento[] {
  return asientos.filter((a) => {
    const debe = sumar(a.lineas, (l) => l.debe);
    const haber = sumar(a.lineas, (l) => l.haber);
    return Math.abs(debe - haber) > 0.01;
  });
}
