import type {
  Contrato,
  Cuota,
  EstadoCuota,
  ISODate,
  ItemCuota,
  Pago,
  Periodo,
  ValorIndice,
} from './types';
import { montoVigente, periodosDelContrato } from './contratos';
import {
  diasEntre,
  fechaDeVencimiento,
  hoy,
  nuevoId,
  redondear,
  sumar,
} from './util';

/** Arma (sin persistir) la cuota de un contrato para un período. */
export function armarCuota(c: Contrato, periodo: Periodo, indices: ValorIndice[]): Cuota {
  const alquiler = montoVigente(c, periodo, indices);
  const items: ItemCuota[] = [{ descripcion: 'Alquiler', monto: alquiler, tipo: 'alquiler' }];

  for (const cf of c.conceptosFijos) {
    items.push({
      descripcion: cf.descripcion,
      monto: cf.monto,
      tipo: cf.descripcion.toLowerCase().includes('expensa') ? 'expensas' : 'servicio',
    });
  }

  return {
    id: nuevoId('cuo'),
    contratoId: c.id,
    periodo,
    vencimiento: fechaDeVencimiento(periodo, c.diaVencimiento),
    moneda: c.moneda,
    items,
    total: redondear(sumar(items, (i) => i.monto)),
    estado: 'pendiente',
  };
}

/**
 * Genera las cuotas que faltan para todos los contratos activos hasta un
 * período tope. Es idempotente: no duplica cuotas ya emitidas.
 */
export function generarCuotasFaltantes(
  contratos: Contrato[],
  cuotasExistentes: Cuota[],
  indices: ValorIndice[],
  hastaPeriodo: Periodo,
): Cuota[] {
  const emitidas = new Set(cuotasExistentes.map((c) => `${c.contratoId}|${c.periodo}`));
  const nuevas: Cuota[] = [];

  for (const c of contratos) {
    if (c.estado !== 'activo') continue;
    for (const periodo of periodosDelContrato(c)) {
      if (periodo > hastaPeriodo) break;
      if (emitidas.has(`${c.id}|${periodo}`)) continue;
      nuevas.push(armarCuota(c, periodo, indices));
    }
  }
  return nuevas;
}

export function pagosDeCuota(pagos: Pago[], cuotaId: string): Pago[] {
  return pagos.filter((p) => p.cuotaId === cuotaId);
}

const PREFIJO_RECIBO = 'REC-';

/** El que sigue al más alto que haya, así nunca se repite un número. */
export function siguienteNumeroRecibo(pagos: Pago[]): string {
  let mayor = 0;
  for (const p of pagos) {
    const n = Number(p.recibo?.replace(PREFIJO_RECIBO, ''));
    if (Number.isFinite(n) && n > mayor) mayor = n;
  }
  return `${PREFIJO_RECIBO}${String(mayor + 1).padStart(5, '0')}`;
}

/**
 * Le pone número de recibo a todo pago que no lo tenga, en orden cronológico.
 * Devuelve el mismo arreglo si no había nada que numerar, así quien llama
 * puede comparar por identidad y evitarse una escritura.
 *
 * Arranca después del número más alto que ya exista: si una parte de los
 * pagos venía numerada, los nuevos no pueden pisarlos.
 */
export function numerarRecibos(pagos: Pago[]): Pago[] {
  if (pagos.every((p) => p.recibo)) return pagos;

  let n = Math.max(0, ...pagos.map((p) => Number(p.recibo?.replace(PREFIJO_RECIBO, '')) || 0));
  const numeros = new Map<string, string>();

  const orden = [...pagos].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );
  for (const pago of orden) {
    if (pago.recibo) continue;
    n += 1;
    numeros.set(pago.id, `${PREFIJO_RECIBO}${String(n).padStart(5, '0')}`);
  }

  return pagos.map((p) => (p.recibo ? p : { ...p, recibo: numeros.get(p.id) }));
}

/**
 * Las cuotas anteriores del mismo contrato que todavía deben algo.
 *
 * Importa por una razón concreta: el artículo 899 inc. b) del Código Civil y
 * Comercial presume que, si se da recibo por un período, los anteriores están
 * cancelados. Dar el recibo de noviembre con octubre impago es, salvo prueba
 * en contrario, regalar octubre. Por eso la app frena el cobro, y si igual se
 * cobra, el recibo sale con la reserva del artículo 898 nombrando lo que se
 * adeuda.
 *
 * Es por contrato: un inquilino con dos unidades tiene dos deudas distintas.
 */
export function cuotasAdeudadasAntes(cuota: Cuota, cuotas: Cuota[], pagos: Pago[]): Cuota[] {
  return cuotas
    .filter(
      (c) =>
        c.contratoId === cuota.contratoId &&
        c.periodo < cuota.periodo &&
        c.estado !== 'anulada' &&
        saldoDeCuota(c, pagos) > 0.01,
    )
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

/** Orden estable de los pagos de una cuota: por fecha y, a igual fecha, por id. */
export function pagosOrdenados(pagos: Pago[], cuotaId: string): Pago[] {
  return pagosDeCuota(pagos, cuotaId).sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id),
  );
}

/**
 * Lo que quedaba debiendo la cuota justo después de este pago. El recibo tiene
 * que decir lo que decía el día que se emitió, no lo que pasó después, así que
 * se suma solo hasta este pago inclusive.
 */
export function saldoTrasPago(cuota: Cuota, pagos: Pago[], pagoId: string): number {
  let acumulado = 0;
  for (const p of pagosOrdenados(pagos, cuota.id)) {
    acumulado += p.monto;
    if (p.id === pagoId) break;
  }
  return redondear(Math.max(0, cuota.total - acumulado));
}

export function cobradoDeCuota(cuota: Cuota, pagos: Pago[]): number {
  return redondear(sumar(pagosDeCuota(pagos, cuota.id), (p) => p.monto));
}

/** Interés punitorio devengado sobre el saldo impago. */
export function punitoriosDeCuota(
  cuota: Cuota,
  contrato: Contrato | undefined,
  pagos: Pago[],
  fechaRef: ISODate = hoy(),
): number {
  const saldo = saldoDeCuota(cuota, pagos);
  if (saldo <= 0 || cuota.estado === 'anulada') return 0;
  const dias = diasEntre(cuota.vencimiento, fechaRef);
  if (dias <= 0) return 0;
  const tasa = contrato?.punitorioDiarioPct ?? 0;
  return redondear((saldo * tasa * dias) / 100);
}

export function saldoDeCuota(cuota: Cuota, pagos: Pago[]): number {
  if (cuota.estado === 'anulada') return 0;
  return redondear(cuota.total - cobradoDeCuota(cuota, pagos));
}

/** Estado derivado: lo que muestra la grilla, no lo que hay guardado. */
export function estadoDeCuota(cuota: Cuota, pagos: Pago[], fechaRef: ISODate = hoy()): EstadoCuota {
  if (cuota.estado === 'anulada') return 'anulada';
  const cobrado = cobradoDeCuota(cuota, pagos);
  if (cobrado >= cuota.total - 0.01) return 'pagada';
  if (fechaRef > cuota.vencimiento) return 'vencida';
  return cobrado > 0 ? 'parcial' : 'pendiente';
}

export function diasDeMora(cuota: Cuota, pagos: Pago[], fechaRef: ISODate = hoy()): number {
  if (saldoDeCuota(cuota, pagos) <= 0) return 0;
  return Math.max(0, diasEntre(cuota.vencimiento, fechaRef));
}

export interface ResumenCobranza {
  emitido: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  punitorios: number;
  cantidadCuotas: number;
  cuotasVencidas: number;
  tasaCobranza: number; // % cobrado sobre emitido
}

export function resumenCobranza(
  cuotas: Cuota[],
  contratos: Contrato[],
  pagos: Pago[],
  fechaRef: ISODate = hoy(),
): ResumenCobranza {
  const porContrato = new Map(contratos.map((c) => [c.id, c]));
  let emitido = 0;
  let cobrado = 0;
  let vencido = 0;
  let punitorios = 0;
  let cuotasVencidas = 0;

  for (const cuota of cuotas) {
    if (cuota.estado === 'anulada') continue;
    emitido += cuota.total;
    const c = cobradoDeCuota(cuota, pagos);
    cobrado += c;
    const saldo = cuota.total - c;
    if (saldo > 0.01 && fechaRef > cuota.vencimiento) {
      vencido += saldo;
      cuotasVencidas += 1;
      punitorios += punitoriosDeCuota(cuota, porContrato.get(cuota.contratoId), pagos, fechaRef);
    }
  }

  return {
    emitido: redondear(emitido),
    cobrado: redondear(cobrado),
    pendiente: redondear(emitido - cobrado),
    vencido: redondear(vencido),
    punitorios: redondear(punitorios),
    cantidadCuotas: cuotas.filter((c) => c.estado !== 'anulada').length,
    cuotasVencidas,
    tasaCobranza: emitido > 0 ? redondear((cobrado / emitido) * 100, 1) : 0,
  };
}

/** Antigüedad de la deuda, como la pide cualquier administrador. */
export interface TramoMora {
  etiqueta: string;
  monto: number;
  cantidad: number;
}

export function antiguedadDeuda(
  cuotas: Cuota[],
  pagos: Pago[],
  fechaRef: ISODate = hoy(),
): TramoMora[] {
  const tramos: TramoMora[] = [
    { etiqueta: '1 a 30 días', monto: 0, cantidad: 0 },
    { etiqueta: '31 a 60 días', monto: 0, cantidad: 0 },
    { etiqueta: '61 a 90 días', monto: 0, cantidad: 0 },
    { etiqueta: 'más de 90 días', monto: 0, cantidad: 0 },
  ];

  for (const cuota of cuotas) {
    const saldo = saldoDeCuota(cuota, pagos);
    if (saldo <= 0.01) continue;
    const dias = diasEntre(cuota.vencimiento, fechaRef);
    if (dias <= 0) continue;
    const i = dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3;
    tramos[i].monto = redondear(tramos[i].monto + saldo);
    tramos[i].cantidad += 1;
  }
  return tramos;
}
