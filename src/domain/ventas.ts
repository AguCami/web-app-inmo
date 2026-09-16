import type { EstadoOperacion, ID, Operacion, Persona } from './types';
import { redondear, sumar } from './util';

export const ORDEN_ESTADOS: EstadoOperacion[] = [
  'captacion',
  'reserva',
  'boleto',
  'escriturada',
];

export const ETIQUETA_ESTADO_OPERACION: Record<EstadoOperacion, string> = {
  captacion: 'Captación',
  reserva: 'Reserva',
  boleto: 'Boleto',
  escriturada: 'Escriturada',
  caida: 'Caída',
};

/** Probabilidad de cierre por defecto según la etapa del embudo. */
export const PROBABILIDAD_POR_ESTADO: Record<EstadoOperacion, number> = {
  captacion: 20,
  reserva: 60,
  boleto: 90,
  escriturada: 100,
  caida: 0,
};

export interface HonorariosOperacion {
  base: number;
  vendedor: number;
  comprador: number;
  total: number;
  moneda: Operacion['moneda'];
}

export function honorariosDeOperacion(op: Operacion): HonorariosOperacion {
  const base = op.precioAcordado ?? op.precioPublicado;
  const vendedor = redondear((base * op.honorariosVendedorPct) / 100);
  const comprador = redondear((base * op.honorariosCompradorPct) / 100);
  return { base, vendedor, comprador, total: redondear(vendedor + comprador), moneda: op.moneda };
}

/** Honorarios ponderados por probabilidad — lo que vale el pipeline hoy. */
export function valorPonderado(op: Operacion): number {
  const prob = op.probabilidad ?? PROBABILIDAD_POR_ESTADO[op.estado];
  return redondear((honorariosDeOperacion(op).total * prob) / 100);
}

export interface EtapaEmbudo {
  estado: EstadoOperacion;
  etiqueta: string;
  cantidad: number;
  volumen: number; // precio de las operaciones en la etapa
  honorarios: number;
  ponderado: number;
}

/**
 * Embudo por etapa. Por defecto incluye las escrituradas (lo que quiere el
 * listado de ventas); el tablero pasa solo las etapas abiertas, porque mezclar
 * lo cerrado histórico con lo que está en curso aplasta la escala del gráfico.
 */
export function embudoVentas(
  operaciones: Operacion[],
  etapas: EstadoOperacion[] = ORDEN_ESTADOS,
): EtapaEmbudo[] {
  return etapas.map((estado) => {
    const ops = operaciones.filter((o) => o.estado === estado);
    return {
      estado,
      etiqueta: ETIQUETA_ESTADO_OPERACION[estado],
      cantidad: ops.length,
      volumen: redondear(sumar(ops, (o) => o.precioAcordado ?? o.precioPublicado)),
      honorarios: redondear(sumar(ops, (o) => honorariosDeOperacion(o).total)),
      ponderado: redondear(sumar(ops, valorPonderado)),
    };
  });
}

export interface ComisionAgente {
  agenteId: ID;
  nombre: string;
  operaciones: number;
  volumen: number;
  comision: number;
  comisionPendiente: number;
}

/** Reparto de honorarios entre agentes. */
export function comisionesPorAgente(operaciones: Operacion[], personas: Persona[]): ComisionAgente[] {
  const acc = new Map<ID, ComisionAgente>();

  for (const op of operaciones) {
    if (op.estado === 'caida') continue;
    const honorarios = honorariosDeOperacion(op).total;
    for (const part of op.agentes) {
      const persona = personas.find((p) => p.id === part.agenteId);
      const actual = acc.get(part.agenteId) ?? {
        agenteId: part.agenteId,
        nombre: persona?.nombre ?? 'Sin asignar',
        operaciones: 0,
        volumen: 0,
        comision: 0,
        comisionPendiente: 0,
      };
      const monto = redondear((honorarios * part.porcentaje) / 100);
      actual.operaciones += 1;
      actual.volumen = redondear(actual.volumen + (op.precioAcordado ?? op.precioPublicado));
      if (op.estado === 'escriturada') actual.comision = redondear(actual.comision + monto);
      else actual.comisionPendiente = redondear(actual.comisionPendiente + monto);
      acc.set(part.agenteId, actual);
    }
  }

  return [...acc.values()].sort((a, b) => b.comision + b.comisionPendiente - (a.comision + a.comisionPendiente));
}

/** Días que lleva la operación desde la captación hasta la escritura (o hasta hoy). */
export function diasEnPipeline(op: Operacion, hasta: string): number {
  const fin = op.fechaEscritura ?? hasta;
  const ms = new Date(fin).getTime() - new Date(op.fechaCaptacion).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
