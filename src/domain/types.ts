/**
 * Modelo de dominio — gestión de alquileres (Argentina).
 *
 * Convenciones:
 *  - Los importes son `number` con 2 decimales, en su moneda original.
 *  - Las fechas van como ISO `YYYY-MM-DD` (sin hora ni zona): `new Date('2026-01-01')`
 *    se parsea como UTC y en Argentina devuelve el día anterior.
 *  - Los períodos mensuales van como `YYYY-MM`, que ordena igual alfabética
 *    que cronológicamente.
 */

export type ISODate = string; // YYYY-MM-DD
export type Periodo = string; // YYYY-MM
export type ID = string;

export type Moneda = 'ARS' | 'USD';

/* ───────────────────────────── Personas ───────────────────────────── */

export type RolPersona = 'propietario' | 'inquilino' | 'garante';

export type CondicionIVA =
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'consumidor_final';

export interface Persona {
  id: ID;
  nombre: string;
  roles: RolPersona[];
  tipoDoc: 'DNI' | 'CUIT' | 'CUIL' | 'PAS';
  documento: string;
  email?: string;
  telefono?: string;
  domicilio?: string;
  condicionIVA: CondicionIVA;
  /** Se usa para transferirle la liquidación al propietario. */
  cbu?: string;
  notas?: string;
  activo: boolean;
}

/* ──────────────────────────── Propiedades ─────────────────────────── */

export type TipoPropiedad =
  | 'departamento'
  | 'casa'
  | 'ph'
  | 'local'
  | 'oficina'
  | 'galpon'
  | 'cochera';

export type EstadoPropiedad = 'alquilada' | 'disponible' | 'fuera_de_servicio';

export interface Propiedad {
  id: ID;
  codigo: string;
  tipo: TipoPropiedad;
  propietarioId: ID;
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  barrio: string;
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  m2?: number;
  cochera: boolean;
  estado: EstadoPropiedad;
  /** Valor de referencia para publicar cuando queda vacía. */
  alquilerSugerido?: number;
  expensas?: number;
  notas?: string;
}

/* ───────────────────────── Contratos de alquiler ──────────────────── */

/**
 * Esquemas de actualización que se usan en los contratos de locación.
 * El índice es por contrato: tiene que ser el que dice el contrato firmado.
 */
export type IndiceAjuste =
  | 'ICL'
  | 'IPC'
  | 'IPC_CBA'
  | 'CASA_PROPIA'
  | 'PORCENTAJE_FIJO'
  | 'SIN_AJUSTE';

export type EstadoContrato = 'activo' | 'finalizado' | 'rescindido';

export interface ConceptoFijo {
  id: ID;
  descripcion: string;
  monto: number;
  /** Si es true, el importe se le rinde al propietario en la liquidación. */
  aCuentaDelPropietario: boolean;
}

export interface Contrato {
  id: ID;
  numero: string;
  propiedadId: ID;
  inquilinoId: ID;
  garanteIds: ID[];
  fechaInicio: ISODate;
  fechaFin: ISODate;
  /** Alquiler del primer período; el resto sale del cronograma de ajustes. */
  montoInicial: number;
  moneda: Moneda;
  diaVencimiento: number;
  indiceAjuste: IndiceAjuste;
  mesesAjuste: number;
  /** Solo si indiceAjuste === 'PORCENTAJE_FIJO'. */
  porcentajeFijo?: number;
  /** Honorarios de administración, sobre el alquiler cobrado. */
  comisionAdminPct: number;
  /** Interés punitorio diario por mora, en %. */
  punitorioDiarioPct: number;
  depositoGarantia: number;
  conceptosFijos: ConceptoFijo[];
  estado: EstadoContrato;
  notas?: string;
}

/** Un tramo del cronograma: desde `periodoDesde` rige `monto`. */
export interface TramoAjuste {
  periodoDesde: Periodo;
  periodoHasta: Periodo;
  monto: number;
  coeficiente: number;
  variacionPct: number;
}

/* ──────────────────────────── Cobranzas ───────────────────────────── */

export type EstadoCuota = 'pendiente' | 'parcial' | 'pagada' | 'vencida' | 'anulada';

export interface ItemCuota {
  descripcion: string;
  monto: number;
  tipo: 'alquiler' | 'expensas' | 'servicio' | 'otro';
}

export interface Cuota {
  id: ID;
  contratoId: ID;
  periodo: Periodo;
  vencimiento: ISODate;
  moneda: Moneda;
  items: ItemCuota[];
  total: number;
  estado: EstadoCuota;
  /** Se completa cuando el cobro entra en una liquidación. */
  liquidacionId?: ID;
  notas?: string;
}

export type MedioPago = 'transferencia' | 'efectivo' | 'debito_automatico' | 'mercadopago';

export interface Pago {
  id: ID;
  cuotaId: ID;
  fecha: ISODate;
  monto: number;
  moneda: Moneda;
  medio: MedioPago;
  comprobante?: string;
  /** Punitorios incluidos en este pago. */
  punitorios?: number;
  notas?: string;
}

/* ────────────────── Liquidaciones a propietarios ──────────────────── */

export type EstadoLiquidacion = 'borrador' | 'aprobada' | 'pagada';

export interface ItemLiquidacion {
  descripcion: string;
  tipo: 'alquiler_cobrado' | 'comision_admin' | 'gasto' | 'ajuste';
  /** Positivo suma al propietario, negativo le descuenta. */
  monto: number;
  referenciaId?: ID;
  /**
   * Qué fracción de la cuota referenciada liquida este ítem (0 a 1). Es lo que
   * permite rendir después el resto de una cuota cobrada en partes.
   */
  proporcion?: number;
}

export interface Liquidacion {
  id: ID;
  numero: string;
  propietarioId: ID;
  periodo: Periodo;
  fecha: ISODate;
  moneda: Moneda;
  items: ItemLiquidacion[];
  /** Total a transferirle al propietario. */
  neto: number;
  /** Lo que gana la inmobiliaria en esta liquidación. */
  comisionTotal: number;
  estado: EstadoLiquidacion;
  fechaPago?: ISODate;
  notas?: string;
}

/* ───────────────────────── Gastos de la unidad ────────────────────── */

export type CategoriaGasto = 'mantenimiento' | 'expensas' | 'impuestos' | 'servicios' | 'otros';

export interface Gasto {
  id: ID;
  fecha: ISODate;
  descripcion: string;
  categoria: CategoriaGasto;
  propiedadId: ID;
  monto: number;
  moneda: Moneda;
  /** Si se le descuenta al propietario en su próxima liquidación. */
  seLeDescuentaAlPropietario: boolean;
  comprobante?: string;
  liquidacionId?: ID;
}

/* ─────────────────────── Índices de actualización ─────────────────── */

export interface ValorIndice {
  periodo: Periodo;
  ICL: number;
  /** IPC nacional (INDEC). */
  IPC: number;
  /** IPC de la provincia de Córdoba (Dirección General de Estadística y Censos). */
  IPC_CBA: number;
  CASA_PROPIA: number;
  /** true cuando el valor todavía no es el definitivo publicado. */
  provisorio?: boolean;
}

/* ─────────────────────────── Configuración ────────────────────────── */

export interface Configuracion {
  nombre: string;
  cuit: string;
  telefono: string;
  email: string;
  comisionAdminPctDefault: number;
  punitorioDiarioPctDefault: number;
  /** Días antes del vencimiento en que una cuota se marca como "por vencer". */
  diasAvisoVencimiento: number;
}

/* ───────────────────────── Estado completo ────────────────────────── */

export interface BaseDatos {
  version: number;
  configuracion: Configuracion;
  personas: Persona[];
  propiedades: Propiedad[];
  contratos: Contrato[];
  cuotas: Cuota[];
  pagos: Pago[];
  liquidaciones: Liquidacion[];
  gastos: Gasto[];
  indices: ValorIndice[];
}
